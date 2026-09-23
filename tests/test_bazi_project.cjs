const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(require.resolve('playwright', {
  paths: [process.env.CODEX_NODE_MODULES || 'C:/Users/z00654528/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'],
}));

const root = path.resolve(__dirname, '..');
const evidence = path.join(root, 'docs/evidence');
const url = process.env.BAZI_URL || 'http://127.0.0.1:4173/';

async function run() {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const results = [];
  try {
    for (const [width, height, dpr] of [[1440, 900, 1], [390, 844, 2]]) {
      const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr });
      const page = await context.newPage();
      const external = [];
      const errors = [];
      page.on('request', request => {
        const requestUrl = new URL(request.url());
        if (!['127.0.0.1', 'localhost'].includes(requestUrl.hostname)) external.push(request.url());
      });
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.getByRole('heading', { name: '八字预测' }).waitFor();
      await page.getByLabel('出生日期').fill('1995-05-18');
      await page.getByLabel('出生时间').fill('14:30');
      await page.getByLabel('出生地').fill('上海');
      await page.getByRole('button', { name: '生成排盘' }).click();
      await page.locator('.pillars .pillar').nth(3).waitFor();
      const resultText = await page.locator('#result').innerText();
      assert.match(resultText, /上海/);
      assert.match(resultText, /传统文化体验/);
      assert.equal(await page.locator('.pillars .pillar').count(), 4);
      assert.deepEqual(external, []);
      assert.deepEqual(errors, []);
      const screenshot = path.join(evidence, `bazi-project-${width}x${height}-dpr${dpr}.png`);
      await page.screenshot({ path: screenshot, fullPage: true });
      results.push({ width, height, dpr, pillars: 4, external: 0, pageErrors: 0, screenshot });
      await context.close();
    }
    const report = {
      result: 'passed',
      command: 'node tests/test_bazi_project.cjs',
      url,
      generatedProject: 'projects/bazi-prediction-demo',
      checkedAt: new Date().toISOString(),
      results,
      safety: {
        traditionalCultureDisclaimer: true,
        externalRequests: 0,
        secretUse: false,
        runtime: 'controlled mock runtime',
      },
    };
    fs.writeFileSync(path.join(evidence, 'bazi-project-verification.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await browser.close();
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
