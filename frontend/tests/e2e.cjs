const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const { chromium } = require(require.resolve('playwright', { paths: [process.env.CODEX_NODE_MODULES || 'C:/Users/z00654528/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'] }));

async function rawRequest(port, headers, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: '/api/state', method, headers }, response => {
      response.resume(); response.once('end', () => resolve(response.statusCode));
    });
    req.once('error', reject); req.end();
  });
}
async function main() {
  const root = path.resolve(__dirname, '../..');
  const evidence = path.join(root, 'docs/evidence');
  const python = process.env.PYTHON || 'C:/Users/z00654528/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
  const child = spawn(python, ['-B', 'tests/browser_fixture.py'], { cwd: root, stdio: ['pipe', 'pipe', 'inherit'] });
  const childExit = new Promise(resolve => child.once('exit', resolve));
  let vite, browser, stub, previewServer;
  try {
    const api = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Fixture timeout')), 10000);
      child.once('error', reject);
      child.stdout.once('data', data => { clearTimeout(timeout); resolve(data.toString().trim()); });
      child.once('exit', code => { clearTimeout(timeout); reject(new Error(`Fixture exited ${code}`)); });
    });
    process.env.THEMETEAM_API_PORT = new URL(api).port;
    const { createServer, preview } = await import('vite');
    vite = await createServer({ configFile: path.join(root, 'frontend/vite.config.ts'), root: path.join(root, 'frontend'), server: { port: 0 }, logLevel: 'error' });
    await vite.listen();
    const port = vite.httpServer.address().port;
    const base = `http://127.0.0.1:${port}`;
    browser = await chromium.launch({ headless: true, channel: 'msedge' });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    const officePosts = [];
    page.on('request', request => { if (request.method() === 'POST') officePosts.push(request.url()); });
    await page.locator('.office-stage canvas').waitFor();
    await page.getByText('办公室场景已就绪', { exact: true }).waitFor();
    const officePixels = await page.locator('.office-stage canvas').evaluate(canvas => {
      const probe = document.createElement('canvas');
      probe.width = 64; probe.height = 64;
      const context = probe.getContext('2d');
      context.drawImage(canvas, 0, 0, 64, 64);
      const data = context.getImageData(0, 0, 64, 64).data;
      const colors = new Set();
      let opaque = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3]) opaque++;
        colors.add(`${data[i]},${data[i + 1]},${data[i + 2]},${data[i + 3]}`);
      }
      return { opaque, colors: colors.size };
    });
    assert.ok(officePixels.opaque > 0 && officePixels.colors > 4, `Office canvas blank: ${JSON.stringify(officePixels)}`);
    await page.getByRole('button', { name: '放大画布', exact: true }).click();
    await page.getByRole('button', { name: '办公室总览', exact: true }).click();
    await page.getByRole('button', { name: '团队', exact: true }).click();
    await page.getByRole('button', { name: /Dev-02/ }).first().click();
    await page.getByRole('button', { name: '办公室', exact: true }).click();
    await page.locator('.office-stage canvas').waitFor();
    await page.getByRole('button', { name: '演示', exact: true }).click();
    await page.getByLabel('目标', { exact: true }).selectOption('meeting-1');
    await page.getByRole('button', { name: '移动', exact: true }).click();
    const movementFeedback = [];
    const movementDeadline = Date.now() + 15000;
    let movementText = '';
    while (Date.now() < movementDeadline) {
      movementText = (await page.locator('.office-feedback').innerText()).trim();
      if (movementFeedback.at(-1) !== movementText) movementFeedback.push(movementText);
      if (/已入座，MEETING DEMO/.test(movementText)) break;
      if (/无法到达|路径规划超时|目标已被|请选择成员/.test(movementText)) break;
      await page.waitForTimeout(100);
    }
    assert.match(movementText, /已入座，MEETING DEMO/, `Movement feedback: ${JSON.stringify(movementFeedback)}`);
    assert.equal(officePosts.length, 0, 'Local scene actions must not POST');
    await page.screenshot({ path: path.join(evidence, 'm1-office-1440.png') });
    await page.getByRole('button', { name: '任务', exact: true }).click();
    await page.getByRole('main').getByRole('button', { name: '落地 2.5D 办公画布', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: '视觉参考', exact: true }).count(), 0,
      'Design references must remain development assets, not a runtime navigation module');
    await page.getByRole('button', { name: '新建任务', exact: true }).click();
    await page.getByLabel('标题', { exact: true }).waitFor();
    assert.equal(await page.getByLabel('标题', { exact: true }).evaluate(el => el === document.activeElement), true);
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    assert.equal(await page.getByRole('button', { name: '新建任务', exact: true }).evaluate(el => el === document.activeElement), true);
    await page.getByRole('button', { name: '新建任务', exact: true }).click();
    await page.getByLabel('标题', { exact: true }).fill('浏览器验收任务');
    await page.getByLabel('描述', { exact: true }).fill('临时数据，不影响用户工作区。');
    await page.getByLabel('负责人', { exact: true }).selectOption('agent_dev');
    await page.getByRole('button', { name: '创建', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    const repeatedOwner = page.locator('.task-card').filter({ has: page.getByRole('button', { name: '浏览器验收任务', exact: true }) }).getByRole('button', { name: 'Dev-02', exact: true });
    await repeatedOwner.click();
    await page.getByRole('button', { name: '关闭详情', exact: true }).click();
    await page.waitForFunction(() => document.activeElement?.closest('.task-card')?.querySelector('.task-title')?.textContent === '浏览器验收任务');
    assert.equal(await repeatedOwner.evaluate(el => el === document.activeElement), true);
    await page.getByRole('button', { name: '浏览器验收任务', exact: true }).click();
    await page.getByRole('complementary', { name: '选中对象详情' }).getByRole('button', { name: 'Dev-02', exact: true }).click();
    await page.locator('.inspector h2').getByText('Dev-02', { exact: true }).waitFor();
    await page.getByRole('button', { name: '关闭详情', exact: true }).click();
    await page.waitForFunction(() => document.activeElement?.matches('.content .owner'));
    await page.keyboard.press('Enter');
    await page.locator('.inspector h2').getByText('Dev-02', { exact: true }).waitFor();
    await page.getByRole('button', { name: '返回上个对象', exact: true }).click();
    await page.locator('.inspector h2').getByText('浏览器验收任务', { exact: true }).waitFor();
    await page.waitForFunction(() => document.activeElement?.textContent === '浏览器验收任务');
    await page.getByLabel('浏览器验收任务 状态', { exact: true }).selectOption('in_review');
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.save-status').textContent === '已同步');
    await page.getByRole('button', { name: '新建任务', exact: true }).click();
    await page.getByLabel('标题', { exact: true }).fill('重新加载移除的临时任务');
    await page.getByRole('button', { name: '创建', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: '重新加载移除的临时任务', exact: true }).click();
    await page.route('**/api/reload', async route => {
      await page.getByRole('button', { name: '关闭详情', exact: true }).focus();
      await route.continue();
    }, { times: 1 });
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: '从磁盘重新加载', exact: true }).click();
    await page.getByRole('complementary', { name: '选中对象详情' }).waitFor({ state: 'hidden' });
    await page.waitForFunction(() => document.activeElement?.tagName === 'H1');
    assert.equal(await page.getByRole('button', { name: '重新加载移除的临时任务', exact: true }).count(), 0);
    await page.getByRole('button', { name: '浏览器验收任务', exact: true }).click();
    const screens = [];
    for (const [width, height] of [[1440, 900], [1024, 768], [390, 844]]) {
      await page.setViewportSize({ width, height });
      await page.screenshot({ path: path.join(evidence, `w03-${width}.png`), fullPage: true });
      const bounds = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: innerWidth,
        outside: [...document.querySelectorAll('button,input,select')].filter(e => {
          const r = e.getBoundingClientRect(); return r.width > 0 && (r.left < -1 || r.right > innerWidth + 1);
        }).map(e => e.getAttribute('aria-label') || e.textContent) }));
      assert.ok(bounds.scroll <= width + 1, `Horizontal overflow ${width}: ${JSON.stringify(bounds)}`);
      assert.deepEqual(bounds.outside, [], `Controls outside viewport ${width}`);
      await page.getByRole('button', { name: '新建任务', exact: true }).click();
      await page.getByLabel('标题', { exact: true }).fill('ResponsiveDialogWithAnUnbrokenLongTitle');
      await page.screenshot({ path: path.join(evidence, `w03-dialog-${width}.png`) });
      const dialogBounds = await page.getByRole('dialog').evaluate(el => {
        const r = el.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, scroll: el.scrollWidth, width: el.clientWidth };
      });
      assert.ok(dialogBounds.left >= 0 && dialogBounds.right <= width && dialogBounds.top >= 0 && dialogBounds.bottom <= height);
      assert.ok(dialogBounds.scroll <= dialogBounds.width + 1);
      if (width <= 760) {
        const small = await page.getByRole('dialog').locator('button,input,select,textarea').evaluateAll(elements => elements
          .filter(el => el.getBoundingClientRect().height < 44).map(el => el.tagName));
        assert.deepEqual(small, [], 'Mobile form controls must be at least 44px high');
      }
      await page.keyboard.press('Escape');
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
      screens.push({ width, height, bounds, dialogBounds });
    }
    await page.getByRole('button', { name: '关闭详情', exact: true }).click();
    await page.getByRole('complementary', { name: '选中对象详情' }).waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: '浏览器验收任务', exact: true }).click();
    await page.locator('.inspector h2').getByText('浏览器验收任务', { exact: true }).waitFor();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole('button', { name: '团队', exact: true }).click();
    await page.getByRole('button', { name: '新建成员', exact: true }).click();
    const hostile = '<img src="https://invalid.example/x" onerror="window.XSS=1">';
    await page.getByLabel('名称', { exact: true }).fill(hostile);
    await page.getByRole('button', { name: '创建', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await page.locator('.record-main strong').getByText(hostile, { exact: true }).waitFor();
    assert.equal(await page.locator('[onerror]').count(), 0);
    assert.equal(await page.evaluate(() => window.XSS), undefined);
    await page.getByRole('button', { name: '任务', exact: true }).click();
    await page.route('**/api/tasks', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: '{}' });
    }, { times: 1 });
    await page.getByRole('button', { name: '新建任务', exact: true }).click();
    await page.getByLabel('标题', { exact: true }).fill('结果未知但服务端已提交');
    await page.getByRole('button', { name: '创建', exact: true }).click();
    await page.locator('.form-error').waitFor();
    assert.equal(await page.getByRole('button', { name: '创建', exact: true }).isDisabled(), true);
    await page.getByRole('dialog').getByRole('button', { name: '取消', exact: true }).last().click();
    assert.equal(await page.getByRole('button', { name: '保存', exact: true }).isDisabled(), true);
    await page.getByRole('button', { name: '重新读取', exact: true }).click();
    await page.getByRole('button', { name: '结果未知但服务端已提交', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: '保存', exact: true }).isDisabled(), true);
    assert.deepEqual(errors, []);
    const rootsPage = await browser.newPage();
    rootsPage.on('pageerror', error => errors.push(error.message));
    await rootsPage.goto(`${base}/tests/two-roots.html`);
    const rootA = rootsPage.locator('#root-a'), rootB = rootsPage.locator('#root-b');
    await rootA.locator('.office-stage canvas').waitFor();
    await rootB.locator('.office-stage canvas').waitFor();
    await rootA.getByRole('button', { name: '任务', exact: true }).click();
    await rootB.getByRole('button', { name: '任务', exact: true }).click();
    await rootA.getByRole('button', { name: '落地 2.5D 办公画布', exact: true }).waitFor();
    await rootB.getByRole('button', { name: '落地 2.5D 办公画布', exact: true }).waitFor();
    const ownerB = rootB.locator('.content .owner').filter({ hasText: 'Dev-02' }).first();
    await ownerB.click();
    assert.equal(await rootA.locator('.inspector').count(), 0);
    await rootB.getByRole('button', { name: '关闭详情', exact: true }).click();
    await rootsPage.waitForFunction(() => !!document.activeElement?.closest('#root-b .content'));
    assert.equal(await ownerB.evaluate(el => el === document.activeElement), true);
    await rootsPage.close();
    assert.deepEqual(errors, []);
    await browser.close(); browser = null;
    await vite.close(); vite = null;

    let upstream = 0;
    stub = http.createServer((req, res) => { upstream++; res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{}'); });
    await new Promise(resolve => stub.listen(0, '127.0.0.1', resolve));
    process.env.THEMETEAM_API_PORT = String(stub.address().port);
    vite = await createServer({ configFile: path.join(root, 'frontend/vite.config.ts'), root: path.join(root, 'frontend'), server: { port: 0 }, logLevel: 'error' });
    await vite.listen();
    const proxyPort = vite.httpServer.address().port;
    const localHost = `127.0.0.1:${proxyPort}`;
    const badHeaders = [ { Host: 'evil.example' }, { Host: localHost, Origin: 'null' }, { Host: localHost, Origin: 'https://evil.example' },
      { Host: `127.0.0.1:${proxyPort + 1}` }, ['Host', localHost, 'Host', localHost], { Host: localHost, Origin: `https://${localHost}` } ];
    for (const method of ['GET', 'POST']) for (const headers of badHeaders) assert.equal(await rawRequest(proxyPort, headers, method), 403);
    assert.equal(upstream, 0);
    assert.equal(await rawRequest(proxyPort, { Host: localHost, Origin: `http://${localHost}` }), 200);
    assert.equal(upstream, 1);
    previewServer = await preview({ configFile: path.join(root, 'frontend/vite.config.ts'), root: path.join(root, 'frontend'),
      build: { outDir: 'public' }, preview: { port: 0 }, logLevel: 'error' });
    const previewPort = previewServer.httpServer.address().port;
    for (const headers of [{ Host: `127.0.0.1:${previewPort}`, Origin: 'https://foreign.example' },
      { Host: `127.0.0.1:${previewPort}`, Origin: 'null' }, { Host: `127.0.0.1:${previewPort + 1}` }]) {
      assert.equal(await rawRequest(previewPort, headers, 'POST'), 403);
    }
    assert.equal(await rawRequest(previewPort, { Host: `127.0.0.1:${previewPort}` }, 'POST'), 404);
    assert.equal(upstream, 1, 'Static preview must not forward any API request');
    const report = { result: 'passed', screens, pageErrors: errors, proxyRejected: 12, rejectedUpstreamRequests: 0,
      previewRejected: 3, previewApiDisabled: true, previewUpstreamRequests: 0,
      workflows: ['task create', 'task status', 'owner select/back', 'close/reopen', 'dialog keyboard focus', 'exact repeated-owner focus', 'two-root focus isolation', 'owner close/back focus', 'reload prune focus', 'save', 'agent create/XSS', 'unknown write freeze'], fixture: 'temporary Python Store; never real workspace' };
    fs.writeFileSync(path.join(evidence, 'w03-browser.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally {
    if (previewServer) {
      previewServer.httpServer.closeAllConnections();
      await new Promise(resolve => previewServer.httpServer.close(resolve));
    }
    if (browser) await browser.close();
    if (vite) await vite.close();
    if (stub) await new Promise(resolve => stub.close(resolve));
    child.stdin.end(); await childExit;
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
