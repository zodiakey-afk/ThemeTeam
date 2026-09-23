const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { evidence, environment, captureFingerprint, startProductionFixture } = require('./m1-evidence.cjs');
const { chromium } = require(require.resolve('playwright', { paths: [process.env.CODEX_NODE_MODULES || 'C:/Users/z00654528/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'] }));

const PROFILE = process.argv.includes('--formal') ? 'formal' : 'smoke';
const DURATION_MS = Number(process.env.M1_STABILITY_MS || (PROFILE === 'formal' ? 30 * 60 * 1000 : 60 * 1000));
const DPR_VALUES = PROFILE === 'formal' ? [1, 2] : [1];

function synthesize(source) {
  const snapshot = structuredClone(source);
  const baseAgent = snapshot.agents[0];
  const team = snapshot.teams[0];
  const room = snapshot.rooms[0];
  snapshot.agents = Array.from({ length: 20 }, (_, index) => ({ ...baseAgent,
    id: `stability-agent-${String(index).padStart(2, '0')}`,
    name: `稳定性成员-${String(index).padStart(2, '0')}`,
    roleTemplate: index % 3 === 0 ? 'product-manager' : index % 3 === 1 ? 'developer' : 'tester',
    status: index < 5 ? (index % 3 === 0 ? 'Working' : index % 3 === 1 ? 'Thinking' : 'Blocked') : 'Idle',
    teamId: team.id, seatId: room.id, leaderFlag: index === 0,
  }));
  team.leaderAgentId = snapshot.agents[0].id;
  room.occupantIds = snapshot.agents.map(agent => agent.id);
  return snapshot;
}

async function installSyntheticState(page) {
  await page.route('**/api/state', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, json: synthesize(await response.json()) });
  });
}

async function main() {
  assert.ok(Number.isFinite(DURATION_MS) && DURATION_MS >= 3000, 'Duration must be at least 3000ms');
  const startedAt = new Date().toISOString();
  const fixture = await startProductionFixture();
  let browser;
  try {
    const base = fixture.base;
    browser = await chromium.launch({ headless: PROFILE !== 'formal', channel: 'msedge' });
    const runtime = environment(browser);
    const runs = [];

    for (const dpr of DPR_VALUES) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: dpr });
      const page = await context.newPage();
      const pageErrors = [];
      const consoleErrors = [];
      const unexpectedRequests = [];
      page.on('pageerror', error => pageErrors.push(error.message));
      page.on('console', message => {
        if (message.type() === 'error') consoleErrors.push(message.text());
      });
      page.on('request', request => {
        if (request.method() === 'POST' || !['127.0.0.1', 'localhost'].includes(new URL(request.url()).hostname)) {
          unexpectedRequests.push({ method: request.method(), url: request.url() });
        }
      });
      await page.addInitScript(() => {
        window.__cspViolations = [];
        document.addEventListener('securitypolicyviolation', event => {
          window.__cspViolations.push({ directive: event.violatedDirective, blocked: event.blockedURI });
        });
      });
      await installSyntheticState(page);
      await page.goto(`${base}?officeTest=1`, { waitUntil: 'domcontentloaded' });
      await page.getByText('办公室场景已就绪', { exact: true }).waitFor({ timeout: 15000 }).catch(async error => {
        console.error(await page.locator('body').innerText(), pageErrors);
        throw error;
      });
      await page.waitForFunction(() => window.__THEMETEAM_OFFICE_TEST__?.snapshot().agents === 20);
      await page.evaluate(() => window.__THEMETEAM_OFFICE_TEST__.setStressMotion(8));
      const cdp = await context.newCDPSession(page);
      await cdp.send('HeapProfiler.enable');
      await cdp.send('Performance.enable');
      const lifecycle = [];
      async function sampleResources() {
        await cdp.send('HeapProfiler.collectGarbage');
        const usage = await cdp.send('Runtime.getHeapUsage');
        return { ...usage, dom: await cdp.send('Memory.getDOMCounters'),
          scene: await page.evaluate(() => window.__THEMETEAM_OFFICE_TEST__?.snapshot() || null),
          canvases: await page.locator('.office-stage canvas').count(),
          visibility: await page.evaluate(() => document.visibilityState) };
      }
      // Recreate the actual scene without navigating/reloading the document.
      for (let cycle = 0; cycle < 6; cycle += 1) {
        await page.getByRole('button', { name: '团队', exact: true }).click();
        await page.locator('.office-stage canvas').waitFor({ state: 'detached' });
        await page.waitForTimeout(150);
        const detached = await sampleResources();
        await page.getByRole('button', { name: '办公室', exact: true }).click();
        await page.getByText('办公室场景已就绪', { exact: true }).waitFor();
        await page.evaluate(() => window.__THEMETEAM_OFFICE_TEST__.setStressMotion(8));
        await page.waitForTimeout(100);
        lifecycle.push({ cycle, detached, mounted: await sampleResources() });
      }
      const checkpoints = [DURATION_MS / 3, DURATION_MS * 2 / 3, DURATION_MS];
      const heap = [];
      let toggles = 0;
      const start = Date.now();
      while (Date.now() - start < DURATION_MS) {
        const elapsed = Date.now() - start;
        const expectedToggles = Math.min(100, Math.floor(elapsed / DURATION_MS * 100));
        while (toggles < expectedToggles) {
          const agentId = `stability-agent-${String(toggles % 2).padStart(2, '0')}`;
          await page.evaluate(id => window.__THEMETEAM_OFFICE_TEST__.selectAgent(id), agentId);
          await page.getByRole('button', { name: '关闭详情', exact: true }).click();
          toggles += 1;
        }
        if (heap.length < checkpoints.length && elapsed >= checkpoints[heap.length]) {
          heap.push({ elapsed, ...await sampleResources() });
        }
        await page.waitForTimeout(Math.min(1000, Math.max(20, DURATION_MS / 100)));
      }
      while (toggles < 100) {
        const agentId = `stability-agent-${String(toggles % 2).padStart(2, '0')}`;
        await page.evaluate(id => window.__THEMETEAM_OFFICE_TEST__.selectAgent(id), agentId);
        await page.getByRole('button', { name: '关闭详情', exact: true }).click();
        toggles += 1;
      }
      if (heap.length < 3) {
        heap.push({ elapsed: Date.now() - start, ...await sampleResources() });
      }
      const growth = (heap.at(-1).usedSize - heap[0].usedSize) / heap[0].usedSize;
      const cspViolations = await page.evaluate(() => window.__cspViolations);
      const finalScene = await page.evaluate(() => window.__THEMETEAM_OFFICE_TEST__.snapshot());
      const listenerStable = heap.at(-1).dom.jsEventListeners <= heap[0].dom.jsEventListeners &&
        lifecycle.at(-1).mounted.dom.jsEventListeners <= lifecycle[1].mounted.dom.jsEventListeners &&
        lifecycle.at(-1).detached.dom.jsEventListeners <= lifecycle[1].detached.dom.jsEventListeners;
      const lifecyclePassed = lifecycle.every(sample => sample.detached.canvases === 0 && sample.detached.scene === null &&
        sample.mounted.canvases === 1 && sample.mounted.scene.agents === 20);
      const passed = toggles === 100 && growth <= 0.20 && listenerStable && lifecyclePassed &&
        unexpectedRequests.length === 0 && pageErrors.length === 0 && consoleErrors.length === 0 &&
        cspViolations.length === 0 && finalScene.agents === 20 &&
        finalScene.stressAgents === 8 && finalScene.phases.walking === 8 &&
        heap.every(sample => sample.canvases === 1 && sample.scene.agents === 20 &&
          sample.scene.visibleBubbles === 5 && sample.visibility === 'visible');
      runs.push({ dpr, durationMs: Date.now() - start, toggles, heap, growth, lifecycle, listenerStable,
        lifecyclePassed, pageErrors, consoleErrors, cspViolations, unexpectedRequests, finalScene, passed });
      await cdp.detach();
      await context.close();
    }
    const sourceUnchanged = JSON.stringify(fixture.source) === JSON.stringify(captureFingerprint());
    const formalShape = PROFILE === 'formal' && DURATION_MS >= 30 * 60 * 1000 && DPR_VALUES.length === 2;
    const passed = runs.every(run => run.passed) && sourceUnchanged;
    const limitations = [];
    if (!formalShape) limitations.push('Smoke duration/DPR set does not satisfy the frozen two-by-30-minute stability evidence shape.');
    if (runtime.missing.length) limitations.push(`Missing environment evidence: ${runtime.missing.join(', ')}`);
    limitations.push('Two-root isolation remains a separate required test; this report does not close G5.');
    const report = { result: passed ? (formalShape && !runtime.missing.length ? 'measurements_passed' : 'smoke_passed') : 'failed', profile: PROFILE,
      command: `node tests/m1-stability.cjs${PROFILE === 'formal' ? ' --formal' : ''}`, cwd: path.resolve(__dirname, '..'),
      startedAt, finishedAt: new Date().toISOString(), environment: runtime,
      source: fixture.source, sourceUnchanged, build: 'production', headless: PROFILE !== 'formal',
      parameters: { durationMs: DURATION_MS, dprs: DPR_VALUES }, runs, limitations };
    fs.writeFileSync(path.join(evidence, `m1-stability-${PROFILE}.json`), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ result: report.result, runs: runs.map(({ dpr, growth, passed, listenerStable, lifecyclePassed }) =>
      ({ dpr, growth, passed, listenerStable, lifecyclePassed })), limitations }, null, 2));
    assert.equal(passed, true);
  } finally {
    await browser?.close();
    await fixture.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
