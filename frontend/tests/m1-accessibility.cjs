const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(require.resolve('playwright', {
  paths: [process.env.CODEX_NODE_MODULES || 'C:/Users/z00654528/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'],
}));
const { evidence, captureFingerprint, startProductionFixture } = require('./m1-evidence.cjs');

const LONG_ID = 'agent_' + 'unbroken_identifier_'.repeat(9);
const LONG_NAME = '超长中文成员名称用于验证办公室详情与目录在窄屏下仍然完整换行且所有按钮保持可达'.repeat(2);

async function tabTo(page, expected, limit = 100) {
  for (let index = 0; index < limit; index += 1) {
    await page.keyboard.press('Tab');
    const current = await page.evaluate(() => {
      const element = document.activeElement;
      const label = element?.labels?.[0]?.textContent?.trim();
      return element?.getAttribute?.('aria-label') || label || element?.textContent?.trim() || '';
    });
    if (typeof expected === 'string' ? current === expected : expected.test(current)) return current;
  }
  throw new Error(`Keyboard focus did not reach ${expected}`);
}

async function contrastAudit(page) {
  return page.evaluate(() => {
    const parse = value => {
      const match = value.match(/rgba?\((\d+)[, ]+(\d+)[, ]+(\d+)(?:[, /]+([\d.]+))?\)/);
      return match ? [Number(match[1]), Number(match[2]), Number(match[3]), match[4] === undefined ? 1 : Number(match[4])] : null;
    };
    const over = (top, bottom) => {
      const alpha = top[3] + bottom[3] * (1 - top[3]);
      if (!alpha) return [0, 0, 0, 0];
      return [0, 1, 2].map(index => (top[index] * top[3] + bottom[index] * bottom[3] * (1 - top[3])) / alpha).concat(alpha);
    };
    const luminance = color => {
      const channels = color.slice(0, 3).map(value => {
        const normalized = value / 255;
        return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    const ratio = (first, second) => {
      const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
      return (values[0] + 0.05) / (values[1] + 0.05);
    };
    const roots = document.querySelectorAll('.office-toolbar,.office-feedback,.inspector');
    const entries = [];
    const seen = new Set();
    for (const root of roots) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const text = walker.currentNode.textContent.trim();
        const element = walker.currentNode.parentElement;
        if (!text || !element || seen.has(element) || element.closest('.office-stage') || element.matches(':disabled')) continue;
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        if (style.visibility === 'hidden' || style.display === 'none' || rect.width === 0 || rect.height === 0) continue;
        seen.add(element);
        let background = [255, 255, 255, 1];
        const ancestry = [];
        for (let current = element; current; current = current.parentElement) ancestry.unshift(current);
        for (const current of ancestry) {
          const color = parse(getComputedStyle(current).backgroundColor);
          if (color && color[3]) background = over(color, background);
        }
        const foreground = over(parse(style.color), background);
        entries.push({ text: text.slice(0, 80), ratio: ratio(foreground, background), color: style.color,
          background: background.slice(0, 3).map(Math.round), fontSize: style.fontSize });
      }
    }
    return { entries, failures: entries.filter(item => item.ratio < 4.5) };
  });
}

async function captureOcclusion(page) {
  for (let index = 0; index < 4; index += 1) await page.getByRole('button', { name: '放大画布', exact: true }).click();
  await page.getByRole('button', { name: '聚焦选中成员', exact: true }).click();
  await page.waitForTimeout(100);
  const metrics = await page.evaluate(id => {
    const canvas = document.querySelector('.office-stage canvas');
    const scene = window.__THEMETEAM_OFFICE_TEST__.snapshot();
    const agent = scene.agentStates.find(item => item.id === id);
    const ratioX = canvas.width / canvas.getBoundingClientRect().width;
    const ratioY = canvas.height / canvas.getBoundingClientRect().height;
    const left = Math.max(0, Math.floor((agent.screen.x - 48) * ratioX));
    const top = Math.max(0, Math.floor((agent.screen.y - 88) * ratioY));
    const width = Math.min(canvas.width - left, Math.ceil(96 * ratioX));
    const height = Math.min(canvas.height - top, Math.ceil(96 * ratioY));
    const copy = document.createElement('canvas');
    copy.width = canvas.width; copy.height = canvas.height;
    const context = copy.getContext('2d', { willReadFrequently: true });
    context.drawImage(canvas, 0, 0);
    const pixels = context.getImageData(left, top, width, height).data;
    const colors = new Set();
    let hash = 2166136261;
    for (let index = 0; index < pixels.length; index += 4) {
      colors.add(`${pixels[index]},${pixels[index + 1]},${pixels[index + 2]},${pixels[index + 3]}`);
      hash = Math.imul(hash ^ pixels[index], 16777619);
      hash = Math.imul(hash ^ pixels[index + 1], 16777619);
      hash = Math.imul(hash ^ pixels[index + 2], 16777619);
    }
    return { agent, colors: colors.size, hash: (hash >>> 0).toString(16).padStart(8, '0') };
  }, LONG_ID);
  const canvas = page.locator('.office-stage canvas');
  const box = await canvas.boundingBox();
  await page.screenshot({ path: path.join(evidence, 'm1-occlusion-work-seated.png'), clip: box });
  assert.match(metrics.agent.occupied || '', /^work-/);
  assert.ok(metrics.agent.frontOccluderDepth > metrics.agent.spriteDepth, 'Front chair must remain above the selected seated agent');
  assert.ok(metrics.colors >= 20, 'Close-range canvas ROI must contain rendered sprite and furniture pixels');
  return metrics;
}

async function main() {
  const sourceBefore = captureFingerprint();
  const fixture = await startProductionFixture({ accessibilityProfile: true });
  let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: 'msedge' });
    const desktop = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    const page = await desktop.newPage();
    await page.goto(`${fixture.base}?officeTest=1`, { waitUntil: 'domcontentloaded' });
    await page.getByText('办公室场景已就绪', { exact: true }).waitFor();
    await page.evaluate(id => window.__THEMETEAM_OFFICE_TEST__.selectAgent(id), LONG_ID);
    await page.locator('.inspector h2').filter({ hasText: LONG_NAME }).waitFor();
    const occlusion = await captureOcclusion(page);
    const desktopContrast = await contrastAudit(page);
    assert.deepEqual(desktopContrast.failures, [], `Desktop contrast failures: ${JSON.stringify(desktopContrast.failures)}`);

    await tabTo(page, '团队');
    await page.keyboard.press('Enter');
    await tabTo(page, new RegExp(`^${LONG_NAME}`));
    await page.keyboard.press('Enter');
    await page.getByText(LONG_ID, { exact: true }).waitFor();
    await tabTo(page, '办公室');
    await page.keyboard.press('Enter');
    await page.getByText('办公室场景已就绪', { exact: true }).waitFor();
    await tabTo(page, '演示');
    await page.keyboard.press('Enter');
    await tabTo(page, '目标');
    await page.keyboard.press('End');
    await tabTo(page, /^移动$/);
    await page.keyboard.press('Enter');
    await page.waitForFunction(id => {
      const agent = window.__THEMETEAM_OFFICE_TEST__.snapshot().agentStates.find(item => item.id === id);
      return agent && agent.phase !== 'seated';
    }, LONG_ID);
    await tabTo(page, '办公室总览');
    await page.keyboard.press('Enter');
    await desktop.close();

    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    const mobilePage = await mobile.newPage();
    await mobilePage.goto(`${fixture.base}?officeTest=1`, { waitUntil: 'domcontentloaded' });
    await mobilePage.getByText('办公室场景已就绪', { exact: true }).waitFor();
    await mobilePage.evaluate(id => window.__THEMETEAM_OFFICE_TEST__.selectAgent(id), LONG_ID);
    await mobilePage.locator('.inspector h2').filter({ hasText: LONG_NAME }).waitFor();
    const longText = await mobilePage.evaluate(({ id, name }) => {
      const title = [...document.querySelectorAll('.inspector h2')].find(item => item.textContent === name);
      const entity = [...document.querySelectorAll('.entity-id')].find(item => item.textContent === id);
      return { documentWidth: document.documentElement.scrollWidth, viewport: innerWidth,
        title: title && { scrollWidth: title.scrollWidth, clientWidth: title.clientWidth },
        entity: entity && { scrollWidth: entity.scrollWidth, clientWidth: entity.clientWidth } };
    }, { id: LONG_ID, name: LONG_NAME });
    assert.ok(longText.documentWidth <= longText.viewport + 1, `Long text caused horizontal overflow: ${JSON.stringify(longText)}`);
    assert.ok(longText.title && longText.title.scrollWidth <= longText.title.clientWidth + 1, 'Long Chinese name must wrap within the inspector');
    assert.ok(longText.entity && longText.entity.scrollWidth <= longText.entity.clientWidth + 1, 'Long unbroken ID must wrap within the inspector');

    await tabTo(mobilePage, '更多场景操作');
    await mobilePage.keyboard.press('Enter');
    const menu = mobilePage.getByRole('menu', { name: '成员场景操作' });
    await menu.waitFor();
    await mobilePage.waitForFunction(() => document.activeElement?.closest('[role="menu"]'));
    const targets = await menu.locator('button').evaluateAll(buttons => buttons.map(button => {
      let rect = button.getBoundingClientRect();
      let left = rect.left; let top = rect.top; let right = rect.right; let bottom = rect.bottom;
      for (let parent = button.parentElement; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        if (!['hidden', 'clip', 'scroll', 'auto'].includes(style.overflow) &&
            !['hidden', 'clip', 'scroll', 'auto'].includes(style.overflowX) &&
            !['hidden', 'clip', 'scroll', 'auto'].includes(style.overflowY)) continue;
        rect = parent.getBoundingClientRect();
        left = Math.max(left, rect.left); top = Math.max(top, rect.top);
        right = Math.min(right, rect.right); bottom = Math.min(bottom, rect.bottom);
      }
      return { label: button.getAttribute('aria-label') || button.textContent.trim(), width: right - left, height: bottom - top };
    }));
    assert.deepEqual(targets.filter(item => item.width < 44 || item.height < 44), [], `Clipped mobile targets: ${JSON.stringify(targets)}`);
    await mobilePage.keyboard.press('ArrowDown');
    await mobilePage.keyboard.press('Escape');
    await menu.waitFor({ state: 'detached' });
    await mobilePage.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === '更多场景操作');
    assert.equal(await mobilePage.getByRole('button', { name: '更多场景操作' }).evaluate(element => element === document.activeElement), true);
    const mobileContrast = await contrastAudit(mobilePage);
    assert.deepEqual(mobileContrast.failures, [], `Mobile contrast failures: ${JSON.stringify(mobileContrast.failures)}`);
    await mobilePage.screenshot({ path: path.join(evidence, 'm1-long-text-mobile.png'), fullPage: true });
    await mobile.close();

    const sourceUnchanged = JSON.stringify(sourceBefore) === JSON.stringify(captureFingerprint());
    assert.equal(sourceUnchanged, true, 'Accessibility run changed protected source or workspace state');
    const report = { result: 'passed', command: 'node tests/m1-accessibility.cjs', cwd: path.resolve(__dirname, '..'),
      fixture: 'temporary Store long-text profile', longText, keyboardOnly: true, targets, occlusion,
      contrast: { desktop: desktopContrast.entries, mobile: mobileContrast.entries }, sourceUnchanged,
      artifacts: ['docs/evidence/m1-occlusion-work-seated.png', 'docs/evidence/m1-long-text-mobile.png'] };
    fs.writeFileSync(path.join(evidence, 'm1-accessibility.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ result: report.result, keyboardOnly: true, contrastChecks: desktopContrast.entries.length + mobileContrast.entries.length,
      mobileTargets: targets, occlusion, sourceUnchanged }, null, 2));
  } finally {
    await browser?.close();
    await fixture.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
