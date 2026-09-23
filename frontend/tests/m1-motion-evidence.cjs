const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(require.resolve('playwright', {
  paths: [process.env.CODEX_NODE_MODULES || 'C:/Users/z00654528/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'],
}));

const DOORS = new Set(['11,4', '6,7', '28,7', '25,16']);

async function main() {
  const root = path.resolve(__dirname, '../..');
  const frontend = path.join(root, 'frontend');
  const evidence = path.join(root, 'docs/evidence');
  fs.mkdirSync(evidence, { recursive: true });
  const python = process.env.PYTHON || 'C:/Users/z00654528/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
  const fixture = spawn(python, ['-B', 'tests/browser_fixture.py'], { cwd: root, stdio: ['pipe', 'pipe', 'inherit'] });
  let vite;
  let browser;
  let context;
  try {
    const api = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Fixture timeout')), 10000);
      fixture.once('error', reject);
      fixture.stdout.once('data', data => { clearTimeout(timer); resolve(data.toString().trim()); });
    });
    process.env.THEMETEAM_API_PORT = new URL(api).port;
    const { createServer } = await import('vite');
    vite = await createServer({ configFile: path.join(frontend, 'vite.config.ts'), root: frontend, server: { port: 0 }, logLevel: 'error' });
    await vite.listen();
    const base = 'http://127.0.0.1:' + vite.httpServer.address().port;
    browser = await chromium.launch({ headless: true, channel: 'msedge' });
    context = await browser.newContext({ viewport: { width: 1366, height: 768 }, acceptDownloads: true });
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
    const page = await context.newPage();
    const posts = [];
    const external = [];
    const pageErrors = [];
    page.on('request', request => {
      const url = new URL(request.url());
      if (request.method() === 'POST') posts.push(request.url());
      const loopback = ['127.0.0.1', 'localhost'].includes(url.hostname) ||
        (url.protocol === 'blob:' && (url.pathname.startsWith('http://127.0.0.1:') || url.pathname.startsWith('http://localhost:')));
      if (!loopback) external.push(request.url());
    });
    page.on('pageerror', error => pageErrors.push(error.message));
    const timeline = [];
    const facings = new Set();
    const phases = new Set();
    const occlusionRelations = new Set();
    let lastKey = '';
    let previousCell = null;
    const observe = async (agentId, label) => {
      const scene = await page.evaluate(() => window.__THEMETEAM_OFFICE_TEST__.snapshot());
      const agent = scene.agentStates.find(item => item.id === agentId);
      assert.ok(agent, 'Missing observed agent ' + agentId);
      let facing = null;
      if (previousCell) {
        const dc = agent.cell.col - previousCell.col;
        const dr = agent.cell.row - previousCell.row;
        if (Math.abs(dc) + Math.abs(dr) === 1) facing = dc > 0 ? 'SE' : dc < 0 ? 'NW' : dr > 0 ? 'SW' : 'NE';
      }
      if (facing && agent.phase === 'walking') facings.add(facing);
      previousCell = { ...agent.cell };
      phases.add(agent.phase);
      if (agent.homeOccluderDepth !== null) {
        occlusionRelations.add(agent.spriteDepth < agent.homeOccluderDepth ? 'behind-home-occluder' : 'in-front-of-home-occluder');
      }
      const key = [label, agent.phase, facing || '', agent.cell.col + ',' + agent.cell.row, agent.replanAttempts].join('|');
      if (key !== lastKey) {
        timeline.push({ elapsedMs: Math.round(performance.now()), label, phase: agent.phase, facing,
          cell: agent.cell, occupied: agent.occupied, target: agent.target, replanAttempts: agent.replanAttempts });
        lastKey = key;
      }
      return { agent, scene };
    };    const waitFor = async (agentId, label, predicate, timeoutMs = 20000) => {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        const current = await observe(agentId, label);
        if (predicate(current.agent, current.scene)) return current;
        await page.waitForTimeout(80);
      }
      throw new Error('Timed out waiting for ' + label);
    };

    await page.goto(base + '?officeTest=1', { waitUntil: 'domcontentloaded' });
    await page.getByText('办公室场景已就绪', { exact: true }).waitFor();
    await page.evaluate(() => {
      const canvas = document.querySelector('.office-stage canvas');
      const stream = canvas.captureStream(30);
      const chunks = [];
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.start(250);
      window.__M1_CANVAS_RECORDING__ = { recorder, chunks, stream };
    });
    const initialAgent = await page.evaluate(() => window.__THEMETEAM_OFFICE_TEST__.snapshot().agentStates[0]);
    const agentId = initialAgent.id;
    assert.ok(initialAgent.homeOccluderDepth > initialAgent.spriteDepth, 'Seated agent must begin behind its home chair');
    occlusionRelations.add('behind-home-occluder');
    await page.evaluate(id => {
      const hook = window.__THEMETEAM_OFFICE_TEST__;
      hook.selectAgent(id);
      for (let index = 0; index < 4; index += 1) hook.zoomBy(1);
      hook.focusSelected();
    }, agentId);
    await page.waitForTimeout(260);
    const canvasBox = await page.locator('.office-stage canvas').boundingBox();
    assert.ok(canvasBox);
    await page.screenshot({ path: path.join(evidence, 'm1-occlusion-behind-workstation.png'), clip: canvasBox });
    timeline.push({ elapsedMs: Math.round(performance.now()), label: 'startup-ready' });
    await page.evaluate(id => {
      const hook = window.__THEMETEAM_OFFICE_TEST__;
      hook.setPreview(true);
      hook.selectAndMove(id, 'meeting-6');
    }, agentId);
    await waitFor(agentId, 'outbound', agent => agent.phase === 'walking');
    await page.evaluate(id => window.__THEMETEAM_OFFICE_TEST__.selectAgent(id), agentId);
    timeline.push({ elapsedMs: Math.round(performance.now()), label: 'selected-while-walking' });
    await page.screenshot({ path: path.join(evidence, 'm1-motion-selected-walking.png'), fullPage: true });
    await waitFor(agentId, 'outbound-door', agent => agent.phase === 'walking' && DOORS.has(agent.cell.col + ',' + agent.cell.row));
    await page.evaluate(id => window.__THEMETEAM_OFFICE_TEST__.setDynamicBlocked(id, true), agentId);
    await waitFor(agentId, 'doorway-wait', agent => agent.phase === 'waiting');
    await page.screenshot({ path: path.join(evidence, 'm1-motion-doorway-waiting.png'), fullPage: true });
    await waitFor(agentId, 'doorway-obstructed', agent => agent.phase === 'obstructed' && agent.replanAttempts === 2, 10000);
    await page.evaluate(id => {
      const hook = window.__THEMETEAM_OFFICE_TEST__;
      hook.setDynamicBlocked(id, false);
      hook.selectAndMove(id, 'meeting-6');
    }, agentId);
    await waitFor(agentId, 'meeting-dock', agent => agent.occupied === 'meeting-6', 20000);
    const inFront = await observe(agentId, 'occlusion-front');
    assert.ok(inFront.agent.homeOccluderDepth !== null && inFront.agent.spriteDepth > inFront.agent.homeOccluderDepth);
    await page.screenshot({ path: path.join(evidence, 'm1-occlusion-front-workstation.png'), clip: canvasBox });
    await page.evaluate(id => window.__THEMETEAM_OFFICE_TEST__.selectAndMove(id, 'work-1'), agentId);
    await waitFor(agentId, 'return-work', agent => agent.occupied === 'work-1', 20000);
    await page.screenshot({ path: path.join(evidence, 'm1-motion-complete.png'), fullPage: true });

    for (const facing of ['NE', 'SE', 'SW', 'NW']) assert.ok(facings.has(facing), 'Missing ' + facing + ' walking direction');
    for (const phase of ['undocking', 'walking', 'waiting', 'planning', 'obstructed', 'docking', 'seated']) assert.ok(phases.has(phase), 'Missing ' + phase + ' phase');
    assert.deepEqual([...occlusionRelations].sort(), ['behind-home-occluder', 'in-front-of-home-occluder'],
      'Selected traversal must cross both sides of the same workstation occluder');
    assert.deepEqual(posts, [], 'Motion evidence workflow must not POST');
    assert.deepEqual(external, [], 'Motion evidence workflow must not request external resources');
    assert.deepEqual(pageErrors, [], 'Motion evidence workflow must not produce page errors');

    const finalScene = await page.evaluate(() => window.__THEMETEAM_OFFICE_TEST__.snapshot());
    const downloadPromise = page.waitForEvent('download');
    await page.evaluate(async () => {
      const recording = window.__M1_CANVAS_RECORDING__;
      await new Promise(resolve => { recording.recorder.addEventListener('stop', resolve, { once: true }); recording.recorder.stop(); });
      recording.stream.getTracks().forEach(track => track.stop());
      const blob = new Blob(recording.chunks, { type: 'video/webm' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'm1-motion-evidence.webm';
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 0);
      delete window.__M1_CANVAS_RECORDING__;
    });
    const download = await downloadPromise;
    await download.saveAs(path.join(evidence, 'm1-motion-evidence.webm'));
    await context.tracing.stop({ path: path.join(evidence, 'm1-motion-trace.zip') });
    await context.close();
    context = null;
    const report = {
      result: 'passed',
      viewport: { width: 1366, height: 768, dpr: 1 },
      agentId,
      facings: [...facings].sort(),
      phases: [...phases].sort(),
      occlusionRelations: [...occlusionRelations].sort(),
      posts: posts.length,
      externalRequests: external.length,
      pageErrors,
      finalScene,
      artifacts: {
        video: 'docs/evidence/m1-motion-evidence.webm',
        trace: 'docs/evidence/m1-motion-trace.zip',
        occlusionBehind: 'docs/evidence/m1-occlusion-behind-workstation.png',
        occlusionFront: 'docs/evidence/m1-occlusion-front-workstation.png',
        selectedScreenshot: 'docs/evidence/m1-motion-selected-walking.png',
        doorwayScreenshot: 'docs/evidence/m1-motion-doorway-waiting.png',
        completedScreenshot: 'docs/evidence/m1-motion-complete.png',
      },
      timeline,
    };
    fs.writeFileSync(path.join(evidence, 'm1-motion-evidence.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ result: report.result, facings: report.facings, phases: report.phases,
      timelineEvents: timeline.length, posts: report.posts, externalRequests: report.externalRequests }, null, 2));
  } finally {
    await context?.close();
    await browser?.close();
    await vite?.close();
    fixture.stdin.end();
    await Promise.race([new Promise(resolve => fixture.once('exit', resolve)), new Promise(resolve => setTimeout(resolve, 2000))]);
    if (fixture.exitCode === null) fixture.kill();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
