const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require(require.resolve('playwright', { paths: [process.env.CODEX_NODE_MODULES || 'C:/Users/z00654528/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'] }));

const VIEWPORTS = [[390, 844], [1024, 768], [1366, 768], [1920, 1080]];

async function main() {
  const root = path.resolve(__dirname, '../..');
  const frontend = path.join(root, 'frontend');
  const evidence = path.join(root, 'docs/evidence');
  fs.mkdirSync(evidence, { recursive: true });
  const python = process.env.PYTHON || 'C:/Users/z00654528/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
  const fixture = spawn(python, ['-B', 'tests/browser_fixture.py'], { cwd: root, stdio: ['pipe', 'pipe', 'inherit'] });
  let vite;
  let browser;
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
    const port = vite.httpServer.address().port;
    const base = `http://127.0.0.1:${port}`;
    browser = await chromium.launch({ headless: true, channel: 'msedge' });
    const results = [];

    for (const dpr of [1, 2]) {
      for (const [width, height] of VIEWPORTS) {
        const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, reducedMotion: 'no-preference' });
        const page = await context.newPage();
        const posts = [];
        const external = [];
        const errors = [];
        page.on('request', request => {
          const url = new URL(request.url());
          if (request.method() === 'POST') posts.push(request.url());
          const loopback = ['127.0.0.1', 'localhost'].includes(url.hostname) ||
            (url.protocol === 'blob:' && (url.pathname.startsWith('http://127.0.0.1:') || url.pathname.startsWith('http://localhost:')));
          if (!loopback) external.push(request.url());
        });
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(base, { waitUntil: 'domcontentloaded' });
        await page.locator('.office-stage canvas').waitFor();
        await page.getByText('办公室场景已就绪', { exact: true }).waitFor();

        const canvas = await page.locator('.office-stage canvas').evaluate((element, expectedDpr) => {
          const rect = element.getBoundingClientRect();
          const probe = document.createElement('canvas');
          probe.width = 64; probe.height = 64;
          const context2d = probe.getContext('2d');
          context2d.drawImage(element, 0, 0, 64, 64);
          const pixels = context2d.getImageData(0, 0, 64, 64).data;
          const colors = new Set();
          let opaque = 0;
          for (let index = 0; index < pixels.length; index += 4) {
            if (pixels[index + 3]) opaque += 1;
            colors.add(`${pixels[index]},${pixels[index + 1]},${pixels[index + 2]},${pixels[index + 3]}`);
          }
          return { cssWidth: rect.width, cssHeight: rect.height, width: element.width, height: element.height,
            ratioX: element.width / rect.width, ratioY: element.height / rect.height, devicePixelRatio, expectedDpr, opaque, colors: colors.size };
        }, dpr);
        assert.ok(canvas.opaque > 0 && canvas.colors > 4, `Blank canvas ${width}x${height}@${dpr}: ${JSON.stringify(canvas)}`);
        assert.equal(canvas.devicePixelRatio, dpr, `Browser DPR mismatch ${width}x${height}@${dpr}`);
        assert.ok(Math.abs(canvas.ratioX - canvas.ratioY) < 0.01 && Math.abs(canvas.ratioX - dpr) < 0.1,
          `Canvas CSS/backing ratio invalid ${width}x${height}@${dpr}: ${JSON.stringify(canvas)}`);

        const layout = await page.evaluate(() => ({
          documentWidth: document.documentElement.scrollWidth,
          outside: [...document.querySelectorAll('.office-surface button,.office-surface select')].filter(element => {
            const rect = element.getBoundingClientRect();
            return rect.width > 0 && (rect.left < -1 || rect.right > innerWidth + 1 || rect.top < -1 || rect.bottom > document.documentElement.scrollHeight + 1);
          }).map(element => element.getAttribute('aria-label') || element.textContent?.trim()),
        }));
        assert.ok(layout.documentWidth <= width + 1, `Horizontal overflow ${width}@${dpr}: ${JSON.stringify(layout)}`);
        assert.deepEqual(layout.outside, [], `Office controls outside layout ${width}@${dpr}`);
        if (width === 390) {
          const undersized = await page.locator('.office-surface button,.office-surface select').evaluateAll(elements => elements
            .filter(element => { const rect = element.getBoundingClientRect(); return rect.width > 0 && (rect.width < 44 || rect.height < 44); })
            .map(element => ({ label: element.getAttribute('aria-label') || element.textContent?.trim(), width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height })));
          assert.deepEqual(undersized, [], `Mobile office controls must be at least 44px: ${JSON.stringify(undersized)}`);
        }

        await page.getByRole('button', { name: '放大画布', exact: true }).click();
        await page.getByRole('button', { name: '办公室总览', exact: true }).click();
        if (width === 390) await page.getByRole('button', { name: '导航', exact: true }).click();
        await page.getByRole('button', { name: '团队', exact: true }).click();
        await page.getByRole('button', { name: /Dev-02/ }).first().click();
        if (width === 390) await page.getByRole('button', { name: '导航', exact: true }).click();
        await page.getByRole('button', { name: '办公室', exact: true }).click();
        await page.locator('.office-stage canvas').waitFor();
        await page.getByRole('button', { name: '演示', exact: true }).click();
        await page.getByLabel('目标', { exact: true }).selectOption('meeting-1');
        await page.getByRole('button', { name: '移动', exact: true }).click();
        await page.waitForFunction(() => {
          const scene = window.__THEMETEAM_OFFICE_TEST__?.snapshot();
          const occupied = scene?.agentStates.some(agent => agent.occupied === 'meeting-1');
          const feedback = document.querySelector('.office-feedback')?.textContent || '';
          return occupied || feedback.includes('MEETING DEMO');
        }, undefined, { timeout: 15000 });
        if (width === 390) {
          const order = await page.evaluate(() => ({
            contentTop: document.querySelector('.content').getBoundingClientRect().top,
            inspectorTop: document.querySelector('.inspector').getBoundingClientRect().top,
          }));
          assert.ok(order.contentTop < order.inspectorTop, `Mobile office scene must precede details: ${JSON.stringify(order)}`);
        }
        await page.screenshot({ path: path.join(evidence, `m1-${width}x${height}-dpr${dpr}.png`), fullPage: true });
        assert.deepEqual(posts, [], `Scene workflow emitted POST ${width}@${dpr}: ${JSON.stringify(posts)}`);
        assert.deepEqual(external, [], `External request ${width}@${dpr}: ${JSON.stringify(external)}`);
        assert.deepEqual(errors, [], `Page errors ${width}@${dpr}: ${JSON.stringify(errors)}`);
        results.push({ width, height, dpr, canvas, layout, posts: posts.length, external: external.length, pageErrors: errors.length });
        await context.close();
      }
    }
    {
      const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
      const page = await context.newPage();
      const posts = [];
      page.on('request', request => { if (request.method() === 'POST') posts.push(request.url()); });
      await page.route('**/assets/office/office-map.v0.3.json', route => route.fulfill({ status: 503, body: '{}' }), { times: 1 });
      await page.goto(base);
      await page.waitForFunction(() => document.querySelector('.office-feedback')?.textContent?.includes('办公室本地资源加载失败'));
      await page.getByRole('button', { name: '重试场景', exact: true }).click();
      await page.getByText('办公室场景已就绪', { exact: true }).waitFor();
      assert.equal(await page.locator('.office-stage canvas').count(), 1, 'Scene retry must create exactly one canvas');
      assert.deepEqual(posts, [], 'Scene load retry must not POST');
      results.push({ recovery: 'map-load-retry', canvases: 1, posts: 0 });
      await context.close();
    }    {
      const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
      const page = await context.newPage();
      const posts = [];
      page.on('request', request => { if (request.method() === 'POST') posts.push(request.url()); });
      await page.goto(base);
      await page.getByText('办公室场景已就绪', { exact: true }).waitFor();
      await page.getByRole('button', { name: '演示', exact: true }).click();
      assert.equal(await page.getByRole('button', { name: '演示', exact: true }).getAttribute('aria-pressed'), 'true');
      const original = await page.locator('.office-stage canvas').elementHandle();
      await page.locator('.office-stage canvas').dispatchEvent('webglcontextlost');
      await page.waitForFunction(() => document.querySelector('.office-feedback')?.textContent?.includes('办公室渲染上下文已丢失'));
      assert.equal(await page.getByRole('button', { name: '演示', exact: true }).getAttribute('aria-pressed'), 'false',
        'Context loss must synchronize the React preview control');
      await page.getByRole('button', { name: '重试场景', exact: true }).click();
      await page.getByText('办公室场景已就绪', { exact: true }).waitFor();
      assert.equal(await page.locator('.office-stage canvas').count(), 1, 'Context recovery must leave one canvas');
      assert.equal(await original.evaluate(canvas => canvas.isConnected), false, 'Context recovery must replace the old canvas');
      assert.equal(await page.getByRole('button', { name: '移动', exact: true }).isDisabled(), true,
        'Recovered scene must require preview to be enabled again');
      assert.deepEqual(posts, [], 'Context recovery must not POST');
      results.push({ recovery: 'context-loss-retry', canvases: 1, oldCanvasConnected: false, previewSynchronized: true, posts: 0 });
      await context.close();
    }
    {
      const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
      const page = await context.newPage();
      const posts = [];
      page.on('request', request => { if (request.method() === 'POST') posts.push(request.url()); });
      await page.goto(base + '?officeTest=1');
      await page.getByText('办公室场景已就绪', { exact: true }).waitFor();
      const ids = await page.evaluate(() => window.__THEMETEAM_OFFICE_TEST__.snapshot().agentStates.slice(0, 2).map(agent => agent.id));
      await page.evaluate(([first, second]) => {
        const hook = window.__THEMETEAM_OFFICE_TEST__;
        hook.setPreview(true);
        hook.selectAndMove(first, 'meeting-1');
        hook.selectAndMove(second, 'meeting-1');
      }, ids);
      await page.waitForFunction(first => window.__THEMETEAM_OFFICE_TEST__.snapshot().agentStates
        .some(agent => agent.id === first && agent.occupied === 'meeting-1'), ids[0]);
      let state = await page.evaluate(() => window.__THEMETEAM_OFFICE_TEST__.snapshot());
      assert.equal(state.agentStates.find(agent => agent.id === ids[1]).occupied?.startsWith('work-'), true, 'Losing contender must retain its seat');
      await page.evaluate(first => {
        const hook = window.__THEMETEAM_OFFICE_TEST__;
        hook.selectAndMove(first, 'meeting-2');
        hook.selectAndMove(first, 'missing-anchor');
      }, ids[0]);
      await page.waitForFunction(first => window.__THEMETEAM_OFFICE_TEST__.snapshot().agentStates
        .some(agent => agent.id === first && agent.occupied === 'meeting-2'), ids[0]);
      await page.evaluate(first => {
        const hook = window.__THEMETEAM_OFFICE_TEST__;
        hook.selectAndMove(first, 'meeting-3');
        hook.selectAndMove(first, 'meeting-4');
      }, ids[0]);
      await page.waitForFunction(first => window.__THEMETEAM_OFFICE_TEST__.snapshot().agentStates
        .some(agent => agent.id === first && agent.occupied === 'meeting-4'), ids[0]);
      state = await page.evaluate(() => window.__THEMETEAM_OFFICE_TEST__.snapshot());
      assert.equal(state.reservations, 0, 'Latest motion completion must release all candidate reservations');
      assert.deepEqual(posts, [], 'Reservation and stale-motion workflows must not POST');
      results.push({ concurrency: 'first-wins-invalid-preserves-latest-wins', reservations: 0, posts: 0 });
      await context.close();
    }
    {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
      const page = await context.newPage();
      const posts = [];
      page.on('request', request => { if (request.method() === 'POST') posts.push(request.url()); });
      await page.goto(base + '?officeTest=1');
      await page.getByText('办公室场景已就绪', { exact: true }).waitFor();
      const agentId = await page.evaluate(() => window.__THEMETEAM_OFFICE_TEST__.snapshot().agentStates[0].id);
      await page.evaluate(id => {
        const hook = window.__THEMETEAM_OFFICE_TEST__;
        hook.setPreview(true);
        hook.selectAndMove(id, 'meeting-6');
      }, agentId);
      await page.waitForFunction(id => window.__THEMETEAM_OFFICE_TEST__.snapshot().agentStates
        .some(agent => agent.id === id && agent.phase === 'walking'), agentId);
      const beforeZoom = await page.evaluate(() => window.__THEMETEAM_OFFICE_TEST__.snapshot().cameraZoom);
      await page.locator('.office-stage canvas').evaluate(canvas => {
        const rect = canvas.getBoundingClientRect();
        const fire = (type, pointerId, x, y, buttons) => canvas.dispatchEvent(new PointerEvent(type, {
          bubbles: true, cancelable: true, composed: true, pointerId, pointerType: 'touch', isPrimary: pointerId === 31,
          clientX: rect.left + x, clientY: rect.top + y, button: 0, buttons,
        }));
        fire('pointerdown', 31, 100, 120, 1);
        fire('pointerdown', 32, 200, 120, 1);
        fire('pointermove', 32, 300, 120, 1);
      });
      await page.waitForFunction(zoom => window.__THEMETEAM_OFFICE_TEST__.snapshot().cameraZoom > zoom, beforeZoom);
      await page.locator('.office-stage canvas').evaluate(canvas => {
        canvas.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, cancelable: true, pointerId: 31, pointerType: 'touch' }));
      });
      const gesture = await page.evaluate(id => ({ scene: window.__THEMETEAM_OFFICE_TEST__.snapshot(), id }), agentId);
      const movingAgent = gesture.scene.agentStates.find(agent => agent.id === gesture.id);
      assert.equal(gesture.scene.activeTouches, 0, 'pointercancel must clear all root-local touch pointers');
      assert.equal(gesture.scene.pinching, false, 'pointercancel must clear pinch state');
      assert.ok(gesture.scene.cameraZoom > beforeZoom && gesture.scene.cameraZoom <= 2, 'Pinch must zoom around its anchor within bounds');
      assert.ok(!['standing', 'obstructed'].includes(movingAgent.phase), 'Gesture cancellation must not stop an active movement');
      const more = page.getByRole('button', { name: '更多场景操作', exact: true });
      await more.click();
      const mobileMenu = page.getByRole('menu', { name: '成员场景操作' });
      await mobileMenu.waitFor();
      await page.waitForFunction(() => document.activeElement?.closest('[role="menu"]'));
      const mobileBounds = await page.evaluate(() => {
        const wrap = document.querySelector('.office-stage-wrap').getBoundingClientRect();
        const menu = document.querySelector('.office-context-menu').getBoundingClientRect();
        return { inside: menu.left >= wrap.left && menu.top >= wrap.top && menu.right <= wrap.right && menu.bottom <= wrap.bottom };
      });
      assert.equal(mobileBounds.inside, true, 'Touch menu must be clamped within the scene');
      await page.keyboard.press('Escape');
      await mobileMenu.waitFor({ state: 'detached' });
      await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === '更多场景操作');
      assert.equal(await more.evaluate(element => element === document.activeElement), true, 'Closing touch menu must restore More button focus');
      assert.deepEqual(posts, [], 'Pinch/cancel workflow must not POST');
      results.push({ gesture: 'pinch-pointercancel', beforeZoom, afterZoom: gesture.scene.cameraZoom,
        activeTouches: gesture.scene.activeTouches, movementPhase: movingAgent.phase, mobileMenuInside: mobileBounds.inside, posts: 0 });
      await context.close();
    }
    {
      const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
      const page = await context.newPage();
      const posts = [];
      page.on('request', request => { if (request.method() === 'POST') posts.push(request.url()); });
      await page.goto(base + '?officeTest=1');
      await page.getByText('办公室场景已就绪', { exact: true }).waitFor();
      const agentId = await page.evaluate(() => window.__THEMETEAM_OFFICE_TEST__.snapshot().agentStates[0].id);
      await page.evaluate(id => {
        const hook = window.__THEMETEAM_OFFICE_TEST__;
        hook.setPreview(true);
        hook.selectAndMove(id, 'meeting-6');
      }, agentId);
      await page.waitForFunction(id => window.__THEMETEAM_OFFICE_TEST__.snapshot().agentStates
        .some(agent => agent.id === id && agent.phase === 'walking'), agentId);
      const started = Date.now();
      await page.evaluate(id => window.__THEMETEAM_OFFICE_TEST__.setDynamicBlocked(id, true), agentId);
      await page.waitForFunction(id => window.__THEMETEAM_OFFICE_TEST__.snapshot().agentStates
        .some(agent => agent.id === id && agent.phase === 'obstructed'), agentId, { timeout: 10000 });
      const elapsed = Date.now() - started;
      const scene = await page.evaluate(() => window.__THEMETEAM_OFFICE_TEST__.snapshot());
      const blocked = scene.agentStates.find(agent => agent.id === agentId);
      assert.equal(blocked.replanAttempts, 2, 'Dynamic obstruction must attempt exactly two finite replans');
      assert.equal(blocked.target, null, 'Final obstruction must release the target intent');
      assert.equal(scene.reservations, 0, 'Final obstruction must release unused target reservations');
      assert.ok(elapsed >= 5500 && elapsed < 10000, `Three wait windows must end in bounded time, got ${elapsed}ms`);
      assert.deepEqual(posts, [], 'Dynamic replan workflow must not POST');
      results.push({ movement: 'dynamic-block-two-replans', replanAttempts: blocked.replanAttempts, elapsed,
        reservations: scene.reservations, posts: 0 });
      await context.close();
    }
    {
      const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
      const page = await context.newPage();
      const posts = [];
      page.on('request', request => { if (request.method() === 'POST') posts.push(request.url()); });
      await page.goto(base + '?officeTest=1');
      await page.getByText('办公室场景已就绪', { exact: true }).waitFor();
      const initial = await page.evaluate(() => window.__THEMETEAM_OFFICE_TEST__.snapshot().agentStates[0]);
      assert.ok(initial.occupied?.startsWith('work-'));
      await page.evaluate(id => {
        const hook = window.__THEMETEAM_OFFICE_TEST__;
        hook.setPreview(true);
        hook.selectAndMove(id, 'meeting-6');
      }, initial.id);
      await page.waitForFunction(id => window.__THEMETEAM_OFFICE_TEST__.snapshot().agentStates
        .some(agent => agent.id === id && agent.phase === 'undocking'), initial.id);
      const undocking = await page.evaluate(id => window.__THEMETEAM_OFFICE_TEST__.snapshot().agentStates.find(agent => agent.id === id), initial.id);
      assert.equal(undocking.occupied, initial.occupied, 'Undocking must retain the old seat until stand completes');
      await page.waitForFunction(id => window.__THEMETEAM_OFFICE_TEST__.snapshot().agentStates
        .some(agent => agent.id === id && agent.occupied === 'meeting-6'), initial.id, { timeout: 15000 });
      await page.evaluate(() => window.__THEMETEAM_OFFICE_TEST__.setPreview(false));
      const restored = await page.evaluate(id => window.__THEMETEAM_OFFICE_TEST__.snapshot().agentStates.find(agent => agent.id === id), initial.id);
      assert.equal(restored.occupied, initial.occupied, 'Leaving preview must restore the workspace seat');
      assert.equal(restored.phase, 'seated');
      assert.equal(await page.getByRole('button', { name: '演示', exact: true }).getAttribute('aria-pressed'), 'false');
      assert.deepEqual(posts, []);
      results.push({ movement: 'undock-retains-seat-preview-restores', seat: initial.occupied, posts: 0 });
      await context.close();
    }
    {
      const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
      const page = await context.newPage();
      const posts = [];
      page.on('request', request => { if (request.method() === 'POST') posts.push(request.url()); });
      await page.route('**/api/state', async route => {
        const response = await route.fetch();
        const state = await response.json();
        state.rooms = state.rooms.map(room => room.id === 'room_meeting' ? { ...room, unlocked: false } : room);
        await route.fulfill({ response, json: state });
      });
      await page.goto(base + '?officeTest=1');
      await page.getByText('办公室场景已就绪', { exact: true }).waitFor();
      const agentId = await page.evaluate(() => window.__THEMETEAM_OFFICE_TEST__.snapshot().agentStates[0].id);
      await page.evaluate(id => {
        const hook = window.__THEMETEAM_OFFICE_TEST__;
        hook.setPreview(true);
        hook.selectAndMove(id, 'work-8');
      }, agentId);
      await page.waitForFunction(id => window.__THEMETEAM_OFFICE_TEST__.snapshot().agentStates
        .some(agent => agent.id === id && ['undocking', 'walking'].includes(agent.phase) && agent.target === 'work-8'), agentId);
      await page.evaluate(id => window.__THEMETEAM_OFFICE_TEST__.selectAndMove(id, 'meeting-1'), agentId);
      const preserved = await page.evaluate(id => window.__THEMETEAM_OFFICE_TEST__.snapshot().agentStates.find(agent => agent.id === id), agentId);
      assert.equal(preserved.target, 'work-8', 'Locked target must not replace a legal intent');
      assert.notEqual(preserved.phase, 'obstructed');
      await page.waitForFunction(id => window.__THEMETEAM_OFFICE_TEST__.snapshot().agentStates
        .some(agent => agent.id === id && agent.occupied === 'work-8'), agentId, { timeout: 15000 });
      assert.deepEqual(posts, []);
      results.push({ movement: 'locked-target-preserves-intent', target: 'work-8', posts: 0 });
      await context.close();
    }
    {
      const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
      const page = await context.newPage();
      const posts = [];
      page.on('request', request => { if (request.method() === 'POST') posts.push(request.url()); });
      await page.route('**/assets/office/office-agents.v0.3.png', route => route.fulfill({
        status: 200, contentType: 'image/png', body: Buffer.from('not-the-approved-atlas'),
      }), { times: 1 });
      await page.goto(base);
      await page.waitForFunction(() => document.querySelector('.office-feedback')?.textContent?.includes('办公室纹理校验失败: agents'));
      assert.equal(await page.locator('.office-stage canvas').count(), 0);
      await page.getByRole('button', { name: '重试场景', exact: true }).click();
      await page.getByText('办公室场景已就绪', { exact: true }).waitFor();
      assert.equal(await page.locator('.office-stage canvas').count(), 1);
      assert.deepEqual(posts, []);
      results.push({ recovery: 'texture-integrity-retry', canvases: 1, posts: 0 });
      await context.close();
    }
    {
      const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
      const page = await context.newPage();
      await page.goto(base + '?officeTest=1');
      await page.getByText('办公室场景已就绪', { exact: true }).waitFor();
      const canvas = page.locator('.office-stage canvas');
      const box = await canvas.boundingBox();
      const agents = await page.evaluate(() => {
        const scene = window.__THEMETEAM_OFFICE_TEST__.snapshot();
        const canvas = document.querySelector('.office-stage canvas');
        const bounds = canvas.getBoundingClientRect();
        const visible = scene.agentStates.filter(agent =>
          agent.hit.x >= 8 && agent.hit.x <= bounds.width - 8 &&
          agent.hit.y >= 8 && agent.hit.y <= bounds.height - 8);
        if (visible.length < 2) throw new Error('Need two visible agents for pointer menu E2E');
        return visible.slice(0, 2);
      });
      assert.ok(box);
      const first = { x: box.x + agents[0].hit.x, y: box.y + agents[0].hit.y };
      const second = { x: box.x + agents[1].hit.x, y: box.y + agents[1].hit.y };
      await page.mouse.click(first.x, first.y, { button: 'right' });
      const contextMenu = page.getByRole('menu', { name: '成员场景操作' });
      await contextMenu.waitFor();
      assert.equal(await page.evaluate(() => window.__THEMETEAM_OFFICE_TEST__.snapshot().selectedId), agents[0].id);
      const contextBounds = await page.evaluate(() => {
        const wrap = document.querySelector('.office-stage-wrap').getBoundingClientRect();
        const menu = document.querySelector('.office-context-menu').getBoundingClientRect();
        return { inside: menu.left >= wrap.left && menu.top >= wrap.top && menu.right <= wrap.right && menu.bottom <= wrap.bottom };
      });
      assert.equal(contextBounds.inside, true, 'Pointer menu must be clamped within the scene');
      assert.equal(await page.getByRole('menuitem', { name: '聚焦成员' }).evaluate(element => element === document.activeElement), true,
        'Context menu must focus its first enabled command');
      await page.keyboard.press('ArrowDown');
      assert.equal(await page.getByRole('menuitem', { name: '关闭场景操作' }).evaluate(element => element === document.activeElement), true,
        'ArrowDown must advance context menu focus');
      await page.keyboard.press('Escape');
      await contextMenu.waitFor({ state: 'detached' });
      await page.waitForFunction(() => document.activeElement?.classList.contains('office-stage'));
      assert.equal(await canvas.evaluate(element => element.parentElement === document.activeElement), true,
        'Closing pointer menu must restore stage focus');
      await page.mouse.move(second.x, second.y);
      await page.mouse.down({ button: 'left' });
      await page.mouse.move(second.x + 8, second.y);
      await page.mouse.up({ button: 'left' });
      assert.equal(await page.evaluate(() => window.__THEMETEAM_OFFICE_TEST__.snapshot().selectedId), agents[0].id,
        'A drag beyond 6 CSS pixels must suppress selection');
      await page.mouse.move(second.x, second.y);
      await page.mouse.down({ button: 'left' });
      await canvas.dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'mouse' });
      await page.mouse.up({ button: 'left' });
      assert.equal(await page.evaluate(() => window.__THEMETEAM_OFFICE_TEST__.snapshot().selectedId), agents[0].id,
        'pointercancel must suppress a pending selection');
      results.push({ gesture: 'context-drag-cancel', rightClickSelected: true, menuInside: contextBounds.inside,
        keyboardMenu: true, focusRestored: true, dragSuppressed: true, cancelSuppressed: true });
      await context.close();
    }
    {
      const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
      const page = await context.newPage();
      await page.goto(base + '?officeTest=1');
      await page.getByText('办公室场景已就绪', { exact: true }).waitFor();
      const before = await page.evaluate(() => window.__THEMETEAM_OFFICE_TEST__.snapshot());
      await page.evaluate(id => window.__THEMETEAM_OFFICE_TEST__.selectAgent(id), before.agentStates[0].id);
      await page.getByRole('complementary', { name: '选中对象详情' }).waitFor();
      await page.getByRole('button', { name: '关闭详情', exact: true }).click();
      await page.getByRole('complementary', { name: '选中对象详情' }).waitFor({ state: 'detached' });
      const after = await page.evaluate(() => window.__THEMETEAM_OFFICE_TEST__.snapshot().cameraScroll);
      assert.ok(Math.abs(after.x - before.cameraScroll.x) < 0.5 && Math.abs(after.y - before.cameraScroll.y) < 0.5,
        `Closing details must restore camera: ${JSON.stringify({ before: before.cameraScroll, after })}`);
      results.push({ navigation: 'close-restores-camera', before: before.cameraScroll, after });
      await context.close();
    }
    {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
      const page = await context.newPage();
      await page.goto(base + '?officeTest=1');
      await page.getByText('办公室场景已就绪', { exact: true }).waitFor();
      const canvas = page.locator('.office-stage canvas');
      const box = await canvas.boundingBox();
      assert.ok(box);
      const agentId = await page.evaluate(() => window.__THEMETEAM_OFFICE_TEST__.snapshot().agentStates[0].id);
      await page.evaluate(id => {
        const hook = window.__THEMETEAM_OFFICE_TEST__;
        hook.selectAgent(id);
        hook.setPreview(true);
        hook.selectAndMove(id, 'meeting-6');
      }, agentId);
      await page.getByRole('complementary', { name: '选中对象详情' }).waitFor();
      await page.waitForFunction(({ id, width, height }) => {
        const agent = window.__THEMETEAM_OFFICE_TEST__.snapshot().agentStates.find(item => item.id === id);
        return agent?.phase === 'walking' && agent.screen.x >= 32 && agent.screen.x <= width - 32 &&
          agent.screen.y >= 48 && agent.screen.y <= height - 24;
      }, { id: agentId, width: box.width, height: box.height });
      const mobileLayout = await page.evaluate(id => {
        const scene = window.__THEMETEAM_OFFICE_TEST__.snapshot();
        const stage = document.querySelector('.office-stage-wrap').getBoundingClientRect();
        const inspector = document.querySelector('.inspector').getBoundingClientRect();
        return {
          followed: scene.agentStates.find(item => item.id === id),
          safeRect: scene.safeRect,
          stage: stage.toJSON(),
          inspector: inspector.toJSON(),
          sceneAboveDetails: stage.bottom <= inspector.top + 1,
        };
      }, agentId);
      assert.equal(mobileLayout.sceneAboveDetails, true, 'Mobile scene must remain above details');
      assert.ok(mobileLayout.followed.screen.x >= mobileLayout.safeRect.left &&
        mobileLayout.followed.screen.x <= mobileLayout.safeRect.right &&
        mobileLayout.followed.screen.y >= mobileLayout.safeRect.top &&
        mobileLayout.followed.screen.y <= mobileLayout.safeRect.bottom,
      'Followed agent must remain inside the measured drawable safe rect');
      await page.mouse.click(box.x + 8, box.y + 8);
      await page.waitForFunction(() => window.__THEMETEAM_OFFICE_TEST__.snapshot().selectedId === null);
      await page.getByRole('complementary', { name: '选中对象详情' }).waitFor({ state: 'detached' });
      results.push({ navigation: 'mobile-follow-and-blank-clear', selectedScreen: mobileLayout.followed.screen,
        safeRect: mobileLayout.safeRect, sceneAboveDetails: mobileLayout.sceneAboveDetails, cleared: true });
      await context.close();
    }
    {
      const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
      const page = await context.newPage();
      await page.route('**/api/state', async route => {
        const response = await route.fetch();
        const state = await response.json();
        state.agents[0] = { ...state.agents[0], roleTemplate: 'unknown-role', status: 'Unknown activity' };
        await route.fulfill({ response, json: state });
      });
      await page.goto(base + '?officeTest=1');
      await page.getByText('办公室场景已就绪', { exact: true }).waitFor();
      const fallback = await page.evaluate(() => window.__THEMETEAM_OFFICE_TEST__.snapshot().agentStates.find(agent => agent.id === 'agent_pm'));
      assert.equal(fallback.frame, 'developer-idle-SE');
      assert.equal(fallback.tint, 0xe04f68, 'Unknown role/activity must use a visibly distinct fallback tint');
      results.push({ fallback: 'unknown-role-activity', frame: fallback.frame, tint: fallback.tint });
      await context.close();
    }
    const report = { result: 'passed', viewports: results, movementRuns: 10, recoveryRuns: 3, concurrencyRuns: 1,
      gestureRuns: 2, dynamicBlockRuns: 1, navigationRuns: 2, fallbackRuns: 1,
      scenePosts: 0, externalRequests: 0 };
    fs.writeFileSync(path.join(evidence, 'm1-browser-matrix.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await browser?.close();
    await vite?.close();
    fixture.stdin.end();
    await Promise.race([new Promise(resolve => fixture.once('exit', resolve)), new Promise(resolve => setTimeout(resolve, 2000))]);
    if (fixture.exitCode === null) fixture.kill();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
