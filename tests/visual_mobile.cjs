const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(require.resolve('playwright', { paths: [process.env.CODEX_NODE_MODULES || 'C:/Users/z00654528/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'] }));
async function main() {
  const root = path.resolve(__dirname, '..');
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const cases = [];
  try {
    for (const [width, height] of [[390, 844], [1024, 768]]) {
      const page = await browser.newPage({ viewport: { width, height } });
      const errors = [], external = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route(/^https?:/, route => { external.push(route.request().url()); return route.abort(); });
      await page.goto(pathToFileURL(path.join(root, 'docs/assets/office-mobile-study.html')).href);
      await page.waitForFunction(() => document.querySelector('img').naturalWidth > 0);
      const before = await page.locator('.plane img').boundingBox();
      const person = await page.getByRole('button', { name: '查看 Dev' }).boundingBox();
      const snapshots = [];
      async function checkAndCapture(state) {
        const file = `docs/evidence/w00v-mobile-${width}-${state}.png`;
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
        const controls = await page.locator('button:visible').evaluateAll(elements => elements.map(el => {
          const r = el.getBoundingClientRect();
          return { name: el.getAttribute('aria-label') || el.textContent.trim(), x: r.x, y: r.y, width: r.width, height: r.height };
        }));
        for (const control of controls) {
          assert.ok(control.name);
          assert.ok(control.width >= 44 && control.height >= 44, `${control.name}: undersized`);
          assert.ok(control.x >= 0 && control.y >= 0 && control.x + control.width <= width + 0.5 && control.y + control.height <= height + 0.5, `${control.name}: outside viewport`);
        }
        const visibility = await page.locator('button:visible').evaluateAll(elements => elements.map(el => {
          const r = el.getBoundingClientRect();
          let left = Math.max(0, r.left), top = Math.max(0, r.top);
          let right = Math.min(innerWidth, r.right), bottom = Math.min(innerHeight, r.bottom);
          for (let parent = el.parentElement; parent; parent = parent.parentElement) {
            const style = getComputedStyle(parent), p = parent.getBoundingClientRect();
            if (['auto', 'scroll', 'hidden', 'clip'].includes(style.overflowX)) { left = Math.max(left, p.left); right = Math.min(right, p.right); }
            if (['auto', 'scroll', 'hidden', 'clip'].includes(style.overflowY)) { top = Math.max(top, p.top); bottom = Math.min(bottom, p.bottom); }
          }
          const points = [[r.left + 4, r.top + 4], [r.right - 4, r.top + 4], [r.left + 4, r.bottom - 4], [r.right - 4, r.bottom - 4], [r.left + r.width / 2, r.top + r.height / 2]];
          return { name: el.getAttribute('aria-label') || el.textContent.trim(),
            visibleWidth: Math.max(0, right - left), visibleHeight: Math.max(0, bottom - top),
            unclipped: left <= r.left + 0.5 && top <= r.top + 0.5 && right >= r.right - 0.5 && bottom >= r.bottom - 0.5,
            hit: points.every(([x, y]) => el.contains(document.elementFromPoint(x, y))) };
        }));
        for (const control of visibility) {
          assert.ok(control.unclipped && control.visibleWidth >= 44 && control.visibleHeight >= 44 && control.hit, `${control.name}: clipped or occluded ${JSON.stringify(control)}`);
        }
        assert.deepEqual(await page.locator('.plane img').boundingBox(), before);
        assert.deepEqual(await page.getByRole('button', { name: '查看 Dev' }).boundingBox(), person);
        await page.screenshot({ path: path.join(root, file) });
        snapshots.push({ state, file, controls, visibility, bitmap: await page.locator('.plane img').boundingBox(), person: await page.locator('.person').boundingBox() });
      }
      await checkAndCapture('closed');
      await page.getByRole('button', { name: '成员详情', exact: true }).focus();
      await page.keyboard.press('Enter');
      await page.getByRole('complementary', { name: '选中对象详情' }).waitFor();
      const panel = await page.locator('.drawer').boundingBox();
      assert.ok(person.y + person.height <= panel.y, 'Selected Dev must remain above drawer');
      await checkAndCapture('open');
      await page.getByRole('button', { name: '实现办公室画布与周边模块交互' }).click();
      await checkAndCapture('task');
      await page.getByRole('button', { name: '返回 Dev' }).click();
      await page.getByRole('button', { name: '关闭详情' }).click();
      await checkAndCapture('returned');
      assert.equal(await page.locator('#open').evaluate(el => el === document.activeElement), true);
      await page.getByRole('button', { name: '查看 Dev' }).focus();
      await page.keyboard.press('Enter');
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('.person').evaluate(el => el === document.activeElement), true);
      assert.equal(await page.locator('.drawer').isVisible(), false);
      assert.deepEqual(errors, []); assert.deepEqual(external, []);
      cases.push({ width, height, result: 'passed', before, person, panel, snapshots, errors, external,
        ids: ['BB-V04-01', 'BB-V04-02', 'BB-V04-03', 'BB-V04-04', 'BB-V04-05'] });
      await page.close();
    }
    fs.writeFileSync(path.join(root, 'docs/evidence/w00v-mobile.json'), JSON.stringify({ result: 'passed', command: 'node tests/visual_mobile.cjs', cwd: root,
      runtime: process.version, browser: browser.version(), generatedAt: new Date().toISOString(), cases,
      scope: 'Static bitmap layout study only, not actual camera/motion or complete accessibility/M1 acceptance.' }, null, 2));
    console.log('VIS-04 design study: 5 cases at 2 widths passed; context, focus, target bounds and local-only assets.');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
