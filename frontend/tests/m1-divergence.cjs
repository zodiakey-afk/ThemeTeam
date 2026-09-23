const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const EasyStar = require('easystarjs');
const { chromium } = require(require.resolve('playwright', { paths: [process.env.CODEX_NODE_MODULES || 'C:/Users/z00654528/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'] }));
const { evidence, captureFingerprint, startProductionFixture } = require('./m1-evidence.cjs');

const SEED = 20260911;
function randomSource(seed) {
  let value = seed >>> 0;
  return () => {
    value ^= value << 13; value ^= value >>> 17; value ^= value << 5;
    return (value >>> 0) / 0x100000000;
  };
}

function bfs(grid, start, end) {
  const queue = [start];
  const seen = new Set([`${start.x},${start.y}`]);
  for (let index = 0; index < queue.length; index += 1) {
    const point = queue[index];
    if (point.x === end.x && point.y === end.y) return true;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = { x: point.x + dx, y: point.y + dy };
      const key = `${next.x},${next.y}`;
      if (next.x < 0 || next.y < 0 || next.y >= grid.length || next.x >= grid[0].length || grid[next.y][next.x] !== 0 || seen.has(key)) continue;
      seen.add(key); queue.push(next);
    }
  }
  return false;
}

async function easyPath(grid, start, end) {
  const engine = new EasyStar.js();
  engine.setGrid(grid);
  engine.setAcceptableTiles([0]);
  engine.disableDiagonals();
  engine.enableSync();
  engine.setIterationsPerCalculation(64);
  return new Promise((resolve, reject) => {
    let settled = false;
    engine.findPath(start.x, start.y, end.x, end.y, pathResult => { settled = true; resolve(pathResult); });
    for (let index = 0; index < 1000 && !settled; index += 1) engine.calculate();
    if (!settled) reject(new Error('EasyStar did not settle within 1000 calculation slices'));
  });
}

async function obstacleCorpus(random) {
  const failures = [];
  for (let caseIndex = 0; caseIndex < 100; caseIndex += 1) {
    const width = 7 + Math.floor(random() * 6);
    const height = 7 + Math.floor(random() * 6);
    const grid = Array.from({ length: height }, (_, row) => Array.from({ length: width }, (_, col) =>
      row === 0 || col === 0 || row === height - 1 || col === width - 1 || random() < 0.28 ? 1 : 0));
    const start = { x: 1, y: 1 };
    const end = { x: width - 2, y: height - 2 };
    grid[start.y][start.x] = 0;
    grid[end.y][end.x] = 0;
    const expected = bfs(grid, start, end);
    try {
      const result = await easyPath(grid, start, end);
      assert.equal(result !== null, expected, 'EasyStar reachability differs from independent BFS');
      if (result) {
        for (let index = 1; index < result.length; index += 1) {
          const previous = result[index - 1];
          const current = result[index];
          assert.equal(Math.abs(previous.x - current.x) + Math.abs(previous.y - current.y), 1, 'Path contains a non-cardinal step');
          assert.equal(grid[current.y][current.x], 0, 'Path enters a blocked cell');
        }
      }
    } catch (error) {
      failures.push({ caseIndex, width, height, grid: grid.map(row => row.join('')), start, end, expected, error: error.message });
    }
  }
  return failures;
}

async function interactionCorpus(browser, base, random) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  page.setDefaultTimeout(3000);
  const errors = [];
  const posts = [];
  const external = [];
  const actionCounts = {};
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    const url = new URL(request.url());
    if (request.method() === 'POST') posts.push(request.url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname) && url.protocol !== 'blob:') external.push(request.url());
  });
  try {
    await page.goto(`${base}?officeTest=1`, { waitUntil: 'domcontentloaded' });
    await page.getByText('办公室场景已就绪', { exact: true }).waitFor();
    await page.waitForFunction(() => window.__THEMETEAM_OFFICE_TEST__?.snapshot().agents === 20);
    for (let index = 0; index < 200; index += 1) {
      const actionMenu = page.getByRole('menu', { name: '成员场景操作' });
      if (await actionMenu.isVisible().catch(() => false)) {
        await page.keyboard.press('Escape');
        await actionMenu.waitFor({ state: 'detached' });
      }
      const action = Math.floor(random() * 9);
      const actionName = ['select', 'zoom', 'preview', 'menu', 'pan', 'overview', 'focus', 'target', 'close'][action];
      actionCounts[actionName] = (actionCounts[actionName] || 0) + 1;
      let selectionDebug = null;
      try {
        if (action === 0) {
          let box = await page.locator('.office-stage canvas').boundingBox();
          let candidates = await page.evaluate(({ width, height }) => {
            const snapshot = window.__THEMETEAM_OFFICE_TEST__.snapshot();
            return snapshot.agentStates
              .filter(item => item.hit.x >= 24 && item.hit.x <= width - 24 && item.hit.y >= 24 && item.hit.y <= height - 24)
              .sort((a, b) => Math.hypot(a.hit.x - width / 2, a.hit.y - height / 2) -
                Math.hypot(b.hit.x - width / 2, b.hit.y - height / 2))
              .map(item => ({ id: item.id, hit: item.hit }));
          }, { width: box.width, height: box.height });
          if (!candidates.length) {
            await page.getByRole('button', { name: '办公室总览', exact: true }).click();
            await page.waitForTimeout(100);
            box = await page.locator('.office-stage canvas').boundingBox();
            candidates = await page.evaluate(({ width, height }) => {
              const snapshot = window.__THEMETEAM_OFFICE_TEST__.snapshot();
              return snapshot.agentStates
                .filter(item => item.hit.x >= 24 && item.hit.x <= width - 24 && item.hit.y >= 24 && item.hit.y <= height - 24)
                .sort((a, b) => Math.hypot(a.hit.x - width / 2, a.hit.y - height / 2) -
                  Math.hypot(b.hit.x - width / 2, b.hit.y - height / 2))
                .map(item => ({ id: item.id, hit: item.hit }));
            }, { width: box.width, height: box.height });
          }
          assert.ok(candidates.length, 'Overview must expose at least one canvas-selectable worker');
          let selected = null;
          selectionDebug = { candidates: candidates.slice(0, 6), attempted: [] };
          for (const candidate of candidates.slice(0, 6)) {
            await page.mouse.click(box.x + candidate.hit.x, box.y + candidate.hit.y);
            await page.waitForTimeout(75);
            selected = await page.evaluate(() => window.__THEMETEAM_OFFICE_TEST__.snapshot().selectedId);
            selectionDebug.attempted.push({ id: candidate.id, hit: candidate.hit, selected });
            if (selected === candidate.id) break;
          }
          assert.ok(selected && candidates.some(candidate => candidate.id === selected),
            'At least one visible worker must remain canvas-selectable after random camera actions');
        } else if (action === 1) {
          const zoom = await page.evaluate(() => window.__THEMETEAM_OFFICE_TEST__.snapshot().cameraZoom);
          await page.getByRole('button', { name: zoom >= 1.5 ? '缩小画布' : '放大画布', exact: true }).click();
        } else if (action === 2) {
          const preview = await page.getByRole('button', { name: '演示', exact: true }).getAttribute('aria-pressed');
          await page.getByRole('button', { name: preview === 'true' ? '工作区' : '演示', exact: true }).click();
        } else if (action === 3) {
          await page.getByRole('button', { name: '更多场景操作', exact: true }).click();
          await actionMenu.waitFor({ state: 'visible' });
          await page.waitForFunction(() => document.activeElement?.closest('[role="menu"]')?.getAttribute('aria-label') === '成员场景操作');
          await page.keyboard.press('Escape');
          await actionMenu.waitFor({ state: 'detached' });
        } else if (action === 4) {
          const box = await page.locator('.office-stage canvas').boundingBox();
          const x = box.x + box.width * 0.55;
          const y = box.y + box.height * 0.55;
          await page.mouse.move(x, y); await page.mouse.down({ button: 'middle' });
          await page.mouse.move(x + 12, y + 8); await page.mouse.up({ button: 'middle' });
        } else if (action === 5) {
          await page.getByRole('button', { name: '办公室总览', exact: true }).click();
        } else if (action === 6) {
          if ((await page.evaluate(() => window.__THEMETEAM_OFFICE_TEST__.snapshot().selectedId)) !== null)
            await page.getByRole('button', { name: '聚焦选中成员', exact: true }).click();
        } else if (action === 7) {
          const select = page.getByLabel('目标', { exact: true });
          const options = await select.locator('option').count();
          await select.selectOption({ index: Math.floor(random() * options) });
        } else if (await page.getByRole('button', { name: '关闭详情', exact: true }).isVisible().catch(() => false)) {
          await page.getByRole('button', { name: '关闭详情', exact: true }).click();
        }
        await page.waitForTimeout(120);
        const scene = await page.evaluate(() => window.__THEMETEAM_OFFICE_TEST__.snapshot());
        assert.ok(scene.cameraZoom >= 0.5 && scene.cameraZoom <= 2, 'Camera zoom escaped frozen bounds');
        assert.equal(scene.activeTouches, 0, 'Interaction sequence leaked touch pointers');
      } catch (error) {
        errors.push(JSON.stringify({
          index,
          action: actionName,
          error: error.message,
          menu: await page.getByRole('menu', { name: '成员场景操作' }).evaluate(element => ({
            hidden: element.hidden,
            style: element.getAttribute('style'),
            computed: getComputedStyle(element).visibility,
            rect: element.getBoundingClientRect().toJSON(),
          })).catch(() => null),
          selectionDebug,
          scene: await page.evaluate(() => window.__THEMETEAM_OFFICE_TEST__?.snapshot() || null),
        }));
        await page.keyboard.press('Escape').catch(() => {});
        await actionMenu.waitFor({ state: 'detached' }).catch(() => {});
      }
    }
    return { actionCounts, errors, posts, external, finalScene: await page.evaluate(() => window.__THEMETEAM_OFFICE_TEST__.snapshot()) };
  } finally {
    await context.close();
  }
}

async function main() {
  const startedAt = new Date().toISOString();
  const sourceBefore = captureFingerprint();
  const fixture = await startProductionFixture({ loadM1: true });
  let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: 'msedge' });
    const random = randomSource(SEED);
    const mapFailures = await obstacleCorpus(random);
    const interactions = await interactionCorpus(browser, fixture.base, random);
    const sourceUnchanged = JSON.stringify(sourceBefore) === JSON.stringify(captureFingerprint());
    const failures = [...mapFailures, ...interactions.errors.map(error => ({ interaction: error }))];
    const report = {
      result: failures.length === 0 && interactions.posts.length === 0 && interactions.external.length === 0 && sourceUnchanged ? 'passed' : 'failed',
      command: 'node tests/m1-divergence.cjs', cwd: path.resolve(__dirname, '..'), generatorVersion: 1, seed: SEED,
      startedAt, finishedAt: new Date().toISOString(), interactionSequences: 200, obstacleMaps: 100,
      interactions, mapFailures, triage: failures.length ? failures : [], sourceUnchanged,
    };
    fs.writeFileSync(path.join(evidence, 'm1-divergence.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ result: report.result, seed: SEED, interactionSequences: 200, obstacleMaps: 100,
      actionCounts: interactions.actionCounts, failures: failures.length, posts: interactions.posts.length,
      external: interactions.external.length, sourceUnchanged }, null, 2));
    assert.equal(report.result, 'passed');
  } finally {
    await browser?.close();
    await fixture.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
