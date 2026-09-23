const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(require.resolve('playwright', {
  paths: [process.env.CODEX_NODE_MODULES || 'C:/Users/z00654528/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'],
}));

async function main() {
  const python = process.env.PYTHON || 'C:/Users/z00654528/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
  const child = spawn(python, ['-B', 'tests/browser_fixture.py'], { cwd: path.resolve(__dirname, '..'), stdio: ['pipe', 'pipe', 'inherit'] });
  let browser;
  const exited = new Promise(resolve => child.once('exit', resolve));
  try {
    const base = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('fixture startup timeout')), 10000);
      child.once('error', reject);
      child.stdout.once('data', data => { clearTimeout(timeout); resolve(data.toString().trim()); });
      child.once('exit', code => { clearTimeout(timeout); reject(new Error(`fixture exited ${code}`)); });
    });
    browser = await chromium.launch({ headless: true, channel: 'msedge' });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [], foreignRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (!request.url().startsWith(base)) foreignRequests.push(request.url()); });
    await page.goto(base);
    await page.locator('[data-agent-id="agent_pm"]').waitFor();
    const hostile = `<img src="https://invalid.example/x" onerror="window.XSS=1"><svg onload="window.XSS=2"></svg>"'&`;
    const post = (route, body) => page.evaluate(async ({ route, body }) => {
      const r = await fetch(route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      return { status: r.status, data: await r.json() };
    }, { route, body });
    for (const [route, body] of [
      ['/api/agents', { name: hostile }], ['/api/tasks', { title: hostile, description: hostile }],
      ['/api/documents', { title: hostile, content: hostile }], ['/api/memory', { text: hostile }],
      ['/api/meetings', { title: hostile, summary: hostile }],
    ]) assert.equal((await post(route, body)).status, 201);
    await page.reload();
    await page.locator('#memoryList').getByText(hostile, { exact: true }).waitFor();
    assert.equal(await page.locator('img, [onerror], [onload], script:not([src="/app.js"])').count(), 0);
    assert.equal(await page.evaluate(() => window.XSS), undefined);
    assert.deepEqual(foreignRequests, []);
    await page.locator('#themeToggle').click();
    await page.waitForFunction(() => document.body.dataset.theme === 'modern');
    await page.locator('[data-agent-id="agent_pm"]').click();
    await page.locator('#moveToMeeting').waitFor();
    await page.locator('#moveToMeeting').click();
    await page.locator('#saveWorkspace').click();
    await page.waitForFunction(() => document.querySelector('#eventFeed').textContent.includes('已保存'));
    await page.route('**/api/state', async route => {
      const response = await route.fetch();
      const data = await response.json();
      data.name = hostile;
      data.teams[0].name = hostile;
      data.rooms[0].name = hostile;
      data.rooms[0].x = '0" onload="window.XSS=3';
      data.modelProfiles[0].name = hostile;
      data.modelProfiles[0].id = '" onmouseover="window.XSS=4';
      data.selection = { kind: 'workspace', id: 'workspace' };
      await route.fulfill({ response, json: data });
    });
    await page.reload();
    await page.locator('#selectionCard strong').getByText(hostile, { exact: true }).waitFor();
    assert.equal(await page.locator('img, [onerror], [onload], [onmouseover]').count(), 0);
    assert.equal(await page.evaluate(() => window.XSS), undefined);
    assert.deepEqual(foreignRequests, []);
    const report = { result: 'passed', viewport: '1440x900', maliciousSurfaces: 10, injectedElements: 0, foreignRequests, pageErrors: errors, positiveFlows: ['load', 'theme', 'select', 'move', 'save'] };
    assert.deepEqual(errors, []);
    fs.mkdirSync('docs/evidence', { recursive: true });
    await page.screenshot({ path: 'docs/evidence/w02-browser.png', fullPage: true });
    fs.writeFileSync('docs/evidence/w02-browser.json', JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  } finally {
    if (browser) await browser.close();
    child.stdin.end();
    await exited;
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
