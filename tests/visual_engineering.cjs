const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(require.resolve('playwright', { paths: [process.env.CODEX_NODE_MODULES || 'C:/Users/z00654528/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'] }));
async function main() {
  const root = path.resolve(__dirname, '..');
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage();
    const errors = [], external = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route(/^https?:/, route => { external.push(route.request().url()); return route.abort(); });
    await page.goto(pathToFileURL(path.join(root, 'docs/assets/office-engineering.html')).href);
    await page.waitForFunction(() => document.querySelector('img').naturalWidth > 0);
    const evidence = await page.evaluate(() => window.geometryEvidence);
    assert.equal(evidence.worldTile[0] / evidence.worldTile[1], 2);
    assert.equal(evidence.diagramTile[0] / evidence.diagramTile[1], 2);
    assert.equal(evidence.fourAdjacent, true);
    assert.ok(evidence.route.some(p => p[0] === evidence.doorCell[0] && p[1] === evidence.doorCell[1]));
    const tile = await page.locator('[data-ratio-tile]').evaluate(el => ({ width: el.getBBox().width, height: el.getBBox().height }));
    assert.deepEqual(tile, { width: 128, height: 64 });
    assert.equal(await page.locator('#pivots [data-frame="32x48"]').count(), 4);
    assert.equal(await page.locator('#doorway figure').count(), 5);
    assert.equal(await page.locator('#doorway figure').nth(2).locator('[data-ground="220,161"]').count(), 1);
    const screenshots = [];
    for (const [width, height] of [[1440, 1000], [390, 844]]) {
      await page.setViewportSize({ width, height });
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      assert.equal(scrollWidth, width);
      const file = `docs/evidence/w00v-engineering-${width}.png`;
      await page.screenshot({ path: path.join(root, file), fullPage: true });
      screenshots.push({ width, height, scrollWidth, file });
    }
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    fs.writeFileSync(path.join(root, 'docs/evidence/w00v-engineering.json'), JSON.stringify({ result: 'passed', command: 'node tests/visual_engineering.cjs', cwd: root,
      generatedAt: new Date().toISOString(), runtime: process.version, browser: browser.version(), evidence, tile, screenshots, errors, external,
      scope: 'Deterministic design diagram only, not rendered sprite accuracy, pathfinding engine or M1 acceptance.' }, null, 2));
    console.log('Engineering diagram passed: 2:1 tile, four pivots, doorway route, two viewports; not M1 acceptance.');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
