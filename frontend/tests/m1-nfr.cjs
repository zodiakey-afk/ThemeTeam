const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { evidence, environment, captureFingerprint, startProductionFixture, summarize } = require('./m1-evidence.cjs');
const { chromium } = require(require.resolve('playwright', { paths: [process.env.CODEX_NODE_MODULES || 'C:/Users/z00654528/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'] }));

const PROFILE = process.argv.includes('--formal') || process.env.M1_NFR_PROFILE === 'formal' ? 'formal' : 'smoke';
const WARMUP_MS = Number(process.env.M1_FRAME_WARMUP_MS || (PROFILE === 'formal' ? 30000 : 1000));
const SAMPLE_MS = Number(process.env.M1_FRAME_SAMPLE_MS || (PROFILE === 'formal' ? 60000 : 3000));
const FRAME_RUNS = Number(process.env.M1_FRAME_RUNS || (PROFILE === 'formal' ? 3 : 1));
const VIEWPORTS = [[390, 844], [1024, 768], [1366, 768], [1920, 1080]];

async function waitForOffice(page, base) {
  await page.goto(`${base}?officeTest=1`, { waitUntil: 'domcontentloaded' });
  await page.locator('.office-stage canvas').waitFor();
  await page.getByText('办公室场景已就绪', { exact: true }).waitFor();
  await page.waitForFunction(() => window.__THEMETEAM_OFFICE_TEST__?.snapshot().agents === 20);
}

async function frameSamples(page, duration) {
  return page.evaluate(ms => new Promise(resolve => {
    const samples = [];
    let start;
    let previous;
    function frame(now) {
      if (start === undefined) start = now;
      if (previous !== undefined) samples.push(now - previous);
      previous = now;
      if (now - start >= ms) resolve(samples);
      else requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }), duration);
}

async function afterPaint(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function selectAgentByCanvas(page, index) {
  await page.getByRole('button', { name: '办公室总览', exact: true }).click();
  await afterPaint(page);
  const box = await page.locator('.office-stage canvas').boundingBox();
  assert.ok(box, 'Office canvas must have a clickable bounding box');
  const state = await page.evaluate(({ targetIndex, width, height }) => {
    const snapshot = window.__THEMETEAM_OFFICE_TEST__.snapshot();
    const candidates = snapshot.agentStates.filter(item => item.id !== snapshot.selectedId &&
      item.screen.x >= 20 && item.screen.x <= width - 20 && item.screen.y >= 50 && item.screen.y <= height - 8);
    const agent = candidates[targetIndex < 0 ? 0 : targetIndex % candidates.length];
    if (!agent) throw new Error(`No visible unselected agent in ${width}x${height} canvas`);
    return { id: agent.id, hit: agent.hit };
  }, { targetIndex: index, width: box.width, height: box.height });
  const start = performance.now();
  await page.mouse.click(box.x + state.hit.x, box.y + state.hit.y);
  await page.waitForFunction(id => window.__THEMETEAM_OFFICE_TEST__.snapshot().selectedId === id, state.id);
  await afterPaint(page);
  return performance.now() - start;
}

function requestAudit(page) {
  const audit = { posts: [], external: [], pageErrors: [], consoleErrors: [] };
  page.on('request', request => {
    const url = new URL(request.url());
    if (request.method() === 'POST') audit.posts.push(request.url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname) && url.protocol !== 'blob:') audit.external.push(request.url());
  });
  page.on('pageerror', error => audit.pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') audit.consoleErrors.push(message.text()); });
  return audit;
}

async function measureUiResponse(browser, base, width, height) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  const audit = requestAudit(page);
  try {
    await waitForOffice(page, base);
    const selection = [];
    for (let index = 0; index < 30; index += 1) {
      selection.push(await selectAgentByCanvas(page, index));
    }
    const zoom = [];
    for (let index = 0; index < 30; index += 1) {
      const before = await page.evaluate(() => window.__THEMETEAM_OFFICE_TEST__.snapshot().cameraZoom);
      const name = index % 2 === 0 ? '放大画布' : '缩小画布';
      const start = performance.now();
      await page.getByRole('button', { name, exact: true }).click();
      await page.waitForFunction(old => window.__THEMETEAM_OFFICE_TEST__.snapshot().cameraZoom !== old, before);
      await afterPaint(page);
      zoom.push(performance.now() - start);
    }
    const panel = [];
    const initialSelected = await page.locator('.inspector .entity-id').textContent();
    if (width <= 760) await page.getByRole('button', { name: '导航', exact: true }).click();
    await page.getByRole('button', { name: '团队', exact: true }).click();
    const records = page.locator('.record[data-entity^="agent:"]');
    await records.first().waitFor();
    let selectedEntity = `agent:${initialSelected}`;
    for (let index = 0; index < 30; index += 1) {
      const inspector = page.getByRole('complementary', { name: '选中对象详情' });
      if (await inspector.isVisible().catch(() => false)) {
        const start = performance.now();
        await page.getByRole('button', { name: '关闭详情', exact: true }).click();
        await inspector.waitFor({ state: 'detached' });
        await afterPaint(page);
        panel.push(performance.now() - start);
      } else {
        const candidates = [records.nth(index % 2), records.nth((index + 1) % 2)];
        let record = candidates[0];
        if (await record.getAttribute('data-entity') === selectedEntity) record = candidates[1];
        const start = performance.now();
        selectedEntity = await record.getAttribute('data-entity');
        await record.click();
        await inspector.waitFor();
        await afterPaint(page);
        panel.push(performance.now() - start);
      }
    }
    const summaries = { selection: summarize(selection), zoom: summarize(zoom), panel: summarize(panel) };
    const passed = Object.values(summaries).every(summary => summary.p95 <= 100) &&
      audit.external.length === 0 && audit.pageErrors.length === 0 && audit.consoleErrors.length === 0;
    return { width, height, summaries, audit, passed };
  } finally {
    await context.close();
  }
}

async function measureCommands(browser, base) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();
  const audit = requestAudit(page);
  try {
    await waitForOffice(page, base);
    await page.getByRole('button', { name: '任务', exact: true }).click();
    await page.getByText('200 项任务', { exact: true }).waitFor();
    const firstSelect = page.locator('.task-card select').first();
    const taskLabel = await firstSelect.getAttribute('aria-label');
    assert.ok(taskLabel, 'Performance task status control must have a stable accessible label');
    const user = [];
    const network = [];
    const statuses = ['in_progress', 'in_review', 'done', 'todo'];
    for (let index = 0; index < 30; index += 1) {
      const status = statuses[index % statuses.length];
      const select = page.getByLabel(taskLabel, { exact: true });
      const start = performance.now();
      const [response] = await Promise.all([
        page.waitForResponse(item => item.request().method() === 'POST' && /\/api\/tasks\/[^/]+\/status$/.test(new URL(item.url()).pathname)),
        select.selectOption(status),
      ]);
      assert.equal(response.ok(), true, `Temporary backend task command failed: ${response.status()}`);
      const networkElapsed = performance.now() - start;
      await page.waitForFunction(({ label, value }) => [...document.querySelectorAll('select')]
        .some(element => element.getAttribute('aria-label') === label && element.value === value),
      { label: taskLabel, value: status });
      await afterPaint(page);
      user.push(performance.now() - start);
      network.push(networkElapsed);
    }
    const summaries = { network: summarize(network), user: summarize(user) };
    return { count: 30, serial: true, summaries, audit,
      passed: summaries.network.p95 <= 300 && summaries.user.p95 <= 300 && audit.external.length === 0 && audit.pageErrors.length === 0 };
  } finally {
    await context.close();
  }
}

async function main() {
  const startedAt = new Date().toISOString();
  const fixture = await startProductionFixture({ loadM1: true });
  let browser;
  try {
    browser = await chromium.launch({ headless: PROFILE !== 'formal', channel: 'msedge' });
    const runtime = environment(browser);
    const frameRuns = [];
    const traces = [];
    for (const dpr of [1, 2]) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: dpr });
      const tracePath = path.join(evidence, `m1-nfr-${PROFILE}-dpr${dpr}-trace.zip`);
      await context.tracing.start({ screenshots: true, snapshots: true, sources: false });
      const page = await context.newPage();
      const audit = requestAudit(page);
      await waitForOffice(page, fixture.base);
      await page.evaluate(() => window.__THEMETEAM_OFFICE_TEST__.setStressMotion(8));
      await page.waitForTimeout(750);
      const readyScene = await page.evaluate(() => window.__THEMETEAM_OFFICE_TEST__.snapshot());
      assert.equal(readyScene.agents, 20, `Frame profile agent count: ${JSON.stringify(readyScene)}`);
      assert.equal(readyScene.stressAgents, 8, `Frame profile stress count: ${JSON.stringify(readyScene)}`);
      assert.equal(readyScene.phases.walking, 8, `Frame profile moving count: ${JSON.stringify(readyScene)}`);
      assert.equal(readyScene.visibleBubbles, 5, `Frame profile bubble count: ${JSON.stringify(readyScene)}`);
      for (let run = 1; run <= FRAME_RUNS; run += 1) {
        await page.waitForTimeout(WARMUP_MS);
        const values = await frameSamples(page, SAMPLE_MS);
        const stats = summarize(values);
        const scene = await page.evaluate(() => window.__THEMETEAM_OFFICE_TEST__.snapshot());
        frameRuns.push({ dpr, run, stats, scene, passed: stats.p95 <= 20 && stats.p99 <= 33 && scene.phases.walking === 8 && scene.visibleBubbles === 5 });
      }
      await context.tracing.stop({ path: tracePath });
      traces.push(path.relative(path.resolve(__dirname, '../..'), tracePath).replaceAll('\\', '/'));
      assert.deepEqual(audit.posts, [], 'Frame scene must not emit POST');
      assert.deepEqual(audit.external, [], 'Frame scene must not access external resources');
      assert.deepEqual(audit.pageErrors, [], 'Frame scene must not emit page errors');
      await context.close();
    }

    const responseRuns = [];
    for (const [width, height] of VIEWPORTS) responseRuns.push(await measureUiResponse(browser, fixture.base, width, height));
    const commandRun = await measureCommands(browser, fixture.base);
    const coldLoads = [];
    for (let run = 1; run <= 3; run += 1) {
      const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, serviceWorkers: 'block' });
      const page = await context.newPage();
      const external = [];
      await page.route('**/*', route => {
        const url = new URL(route.request().url());
        if (['127.0.0.1', 'localhost'].includes(url.hostname) || url.protocol === 'blob:') return route.continue();
        external.push(route.request().url());
        return route.abort();
      });
      await waitForOffice(page, fixture.base);
      const elapsed = await page.evaluate(() => performance.now());
      const workers = context.serviceWorkers().length;
      coldLoads.push({ run, elapsed, externalRequests: external.length, serviceWorkers: workers,
        passed: elapsed <= 3000 && external.length === 0 && workers === 0 });
      await context.close();
    }

    const sourceUnchanged = JSON.stringify(fixture.source) === JSON.stringify(captureFingerprint());
    const formalShape = PROFILE === 'formal' && WARMUP_MS >= 30000 && SAMPLE_MS >= 60000 && FRAME_RUNS >= 3;
    const measurementsPassed = frameRuns.every(run => run.passed) && responseRuns.every(run => run.passed) &&
      commandRun.passed && coldLoads.every(run => run.passed) && sourceUnchanged;
    const limitations = [];
    if (!formalShape) limitations.push('Smoke timings do not satisfy the frozen 30s warmup, 60s sample, three-run evidence shape.');
    if (runtime.missing.length) limitations.push(`Missing environment evidence: ${runtime.missing.join(', ')}`);
    limitations.push('Playwright trace captures the tested production interaction timeline; raw rAF samples and variance are embedded separately in frameRuns.');
    const complete = measurementsPassed && formalShape && runtime.missing.length === 0;
    const report = {
      result: measurementsPassed ? (complete ? 'passed' : 'smoke_passed') : 'failed', profile: PROFILE,
      command: `node tests/m1-nfr.cjs${PROFILE === 'formal' ? ' --formal' : ''}`, cwd: path.resolve(__dirname, '..'),
      startedAt, finishedAt: new Date().toISOString(), build: 'production', headless: PROFILE !== 'formal',
      environment: runtime, parameters: { warmupMs: WARMUP_MS, sampleMs: SAMPLE_MS, frameRuns: FRAME_RUNS,
        viewport: '1440x900', dprs: [1, 2], agents: 20, moving: 8, bubbles: 5, tasks: 200 },
      source: fixture.source, sourceUnchanged, traces, frameRuns, responseRuns, commandRun, coldLoads, limitations,
    };
    fs.writeFileSync(path.join(evidence, `m1-nfr-${PROFILE}.json`), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ result: report.result,
      frameRuns: frameRuns.map(run => ({ dpr: run.dpr, run: run.run, p95: run.stats.p95, p99: run.stats.p99, passed: run.passed })),
      responseRuns: responseRuns.map(run => ({ width: run.width, selectionP95: run.summaries.selection.p95,
        zoomP95: run.summaries.zoom.p95, panelP95: run.summaries.panel.p95, passed: run.passed })),
      command: { networkP95: commandRun.summaries.network.p95, userP95: commandRun.summaries.user.p95, passed: commandRun.passed },
      coldLoads, limitations,
    }, null, 2));
    assert.equal(measurementsPassed, true);
    if (PROFILE === 'formal') assert.equal(complete, true);
  } finally {
    await browser?.close();
    await fixture.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
