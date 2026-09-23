const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require(require.resolve('playwright', { paths: [process.env.CODEX_NODE_MODULES || 'C:/Users/z00654528/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'] }));
const { evidence, fingerprint, startProductionFixture } = require('./m1-evidence.cjs');

async function main() {
  const fixture = await startProductionFixture({ twoRoots: true });
  const tracked = ['frontend/dist-two-roots', 'frontend/src', 'frontend/tests/two-roots.tsx',
    'frontend/tests/two-roots.html', 'frontend/tests/build-two-roots.mjs', 'frontend/tests/m1-two-roots.cjs',
    'frontend/tests/m1-evidence.cjs', 'frontend/vite.config.ts', 'tests/browser_fixture.py'];
  const source = fingerprint(tracked);
  let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: 'msedge' });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const errors = [];
    const posts = [];
    const external = [];
    await page.addInitScript(() => {
      window.__cspViolations = [];
      document.addEventListener('securitypolicyviolation', event => window.__cspViolations.push(event.violatedDirective));
    });
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
      const url = new URL(request.url());
      if (request.method() === 'POST') posts.push(request.url());
      if (!['127.0.0.1', 'localhost'].includes(url.hostname)) external.push(request.url());
    });
    await page.goto(`${fixture.base}/tests/two-roots.html?officeTest=1`, { waitUntil: 'domcontentloaded' });
    const roots = [page.locator('#root-a'), page.locator('#root-b')];
    for (const root of roots) {
      await root.locator('.office-stage canvas').waitFor();
      await root.getByText('办公室场景已就绪', { exact: true }).waitFor();
    }
    const hookState = async root => root.locator('.office-stage').evaluate(element => {
      const hook = element.__officeTest;
      return hook?.snapshot() || null;
    });
    const initialA = await hookState(roots[0]);
    const initialB = await hookState(roots[1]);
    assert.ok(initialA && initialB);
    const [agentA, agentB] = [initialA.agentStates[0].id, initialB.agentStates[1].id];
    const stageA = roots[0].locator('.office-stage');
    const stageB = roots[1].locator('.office-stage');
    await stageA.evaluate((element, id) => element.__officeTest.selectAgent(id), agentA);
    await stageB.evaluate((element, id) => element.__officeTest.selectAgent(id), agentB);
    await roots[0].getByRole('complementary', { name: '选中对象详情' }).waitFor();
    await roots[1].getByRole('complementary', { name: '选中对象详情' }).waitFor();
    await roots[0].getByRole('button', { name: '团队', exact: true }).click();
    await roots[0].getByRole('button', { name: '办公室', exact: true }).click();
    await roots[0].locator('.office-stage canvas').waitFor();
    await roots[0].getByText('办公室场景已就绪', { exact: true }).waitFor();
    const afterAReenter = await hookState(roots[0]);
    const afterBUnchanged = await hookState(roots[1]);
    assert.equal(afterAReenter.selectedId, agentA);
    assert.equal(afterBUnchanged.selectedId, agentB);
    const beforeBZoom = afterBUnchanged.cameraZoom;
    await roots[1].getByRole('button', { name: '放大画布', exact: true }).click();
    const afterBZoom = await hookState(roots[1]);
    assert.ok(afterBZoom.cameraZoom > beforeBZoom);
    assert.equal((await hookState(roots[0])).cameraZoom, afterAReenter.cameraZoom);
    await stageA.evaluate((element, id) => {
      element.__officeTest.setPreview(true);
      element.__officeTest.selectAndMove(id, 'meeting-6');
    }, agentA);
    assert.equal((await hookState(roots[1])).preview, false, 'A preview must not activate B');
    await roots[1].getByRole('button', { name: '演示', exact: true }).click();
    await stageB.evaluate((element, id) => element.__officeTest.selectAndMove(id, 'meeting-1'), agentB);
    await page.waitForFunction(() => document.querySelector('#root-b .office-stage').__officeTest.snapshot()
      .agentStates.some(agent => agent.target === 'meeting-1' && agent.phase === 'walking'));
    const handlers = await page.evaluate(() => ({ blur: window.onblur === null, focus: window.onfocus === null }));
    assert.deepEqual(handlers, { blur: true, focus: true }, 'Games must not replace window handler slots');
    await page.evaluate(() => window.__ROOT_FIXTURE__.unmount('root-a'));
    await page.waitForFunction(() => !document.querySelector('#root-a .office-stage canvas'));
    await roots[1].getByText(/已入座，MEETING DEMO/).waitFor({ timeout: 15000 });
    const finalB = await hookState(roots[1]);
    assert.equal(finalB.selectedId, agentB);
    assert.equal(finalB.agentStates.find(agent => agent.id === agentB).occupied, 'meeting-1');
    assert.deepEqual(posts, []);
    assert.deepEqual(external, []);
    assert.deepEqual(errors, []);
    const cspViolations = await page.evaluate(() => window.__cspViolations);
    assert.deepEqual(cspViolations, []);
    const sourceUnchanged = JSON.stringify(source) === JSON.stringify(fingerprint(tracked));
    assert.equal(sourceUnchanged, true);
    const report = { result: 'passed', build: 'production', fixture: 'temporary Store', roots: 2,
      independentSelection: true, independentCamera: true, rootADestroyed: true,
      rootBContinuedMovement: true, posts: posts.length, externalRequests: external.length, pageErrors: errors,
      cspViolations, source, sourceUnchanged, browser: browser.version(), date: new Date().toISOString(),
      command: 'npm run test:m1:two-roots', cwd: path.resolve(__dirname, '..'),
      limitations: ['Targeted same-page production lifecycle regression; not full BB-M1-19 or G5 acceptance.'] };
    fs.writeFileSync(path.join(evidence, 'm1-two-roots.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await browser?.close();
    await fixture.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
