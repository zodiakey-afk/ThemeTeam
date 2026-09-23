const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { chromium } = require(require.resolve('playwright', {
  paths: [process.env.CODEX_NODE_MODULES || 'C:/Users/z00654528/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'],
}));
const { root, frontend, evidence, captureFingerprint, startProductionFixture } = require('../frontend/tests/m1-evidence.cjs');
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

async function main() {
  const startedAt = new Date().toISOString();
  const before = captureFingerprint();
  const manifest = JSON.parse(fs.readFileSync(path.join(evidence, 'm1-rollback-targets.json')));
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'themeteam-rollback-'));
  const extracted = path.join(temporary, 'archive');
  const sandbox = path.join(temporary, 'frontend');
  const archive = path.join(evidence, 'm1-rollback-baseline.zip');
  const unpack = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    `Expand-Archive -LiteralPath '${archive.replaceAll("'", "''")}' -DestinationPath '${extracted.replaceAll("'", "''")}'`],
  { encoding: 'utf8', windowsHide: true });
  assert.equal(unpack.status, 0, unpack.stderr);
  fs.mkdirSync(sandbox, { recursive: true });
  const restored = [];
  for (const item of manifest.files) {
    const archived = path.join(extracted, path.basename(item.path));
    assert.equal(sha(archived), item.sha256, `Archive integrity: ${item.path}`);
    const destination = path.resolve(temporary, item.path);
    assert.ok(destination.startsWith(sandbox + path.sep), 'Restore must remain inside temporary frontend');
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(archived, destination);
    assert.equal(sha(destination), item.sha256);
    restored.push(item.path);
  }
  const fixture = await startProductionFixture();
  let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: 'msedge' });
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await context.newPage();
    const posts = [];
    const external = [];
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
      if (request.method() === 'POST') posts.push(request.url());
      if (new URL(request.url()).origin !== fixture.base) external.push(request.url());
    });
    const snapshotBefore = await (await context.request.get(fixture.base + '/api/state')).json();
    await page.goto(fixture.base);
    await page.getByText('办公室场景已就绪', { exact: true }).waitFor();
    assert.equal(await page.locator('.office-stage canvas').count(), 1);
    await page.reload();
    await page.getByText('办公室场景已就绪', { exact: true }).waitFor();
    assert.equal(await page.locator('.office-stage canvas').count(), 1);
    await page.screenshot({ path: path.join(evidence, 'm1-rollback-restored.png') });
    const snapshotAfter = await (await context.request.get(fixture.base + '/api/state')).json();
    assert.deepEqual(snapshotAfter, snapshotBefore);
    assert.deepEqual(posts, []);
    assert.deepEqual(external, []);
    assert.deepEqual(errors, []);
    assert.deepEqual(captureFingerprint(), before);
    const report = {
      result: 'passed', command: 'node tests/rehearse_m1_rollback.cjs', cwd: root, startedAt, finishedAt: new Date().toISOString(),
      temporary, archiveSha256: sha(archive), restored, browser: browser.version(),
      phases: ['current-v03-ready', 'archived-pre-M1-files-restored-in-isolation', 'current-v03-restored-ready'],
      scope: 'Isolated archive integrity and current-runtime restoration; the partial historical archive is not treated as a complete runnable legacy M1 build',
      dependencyLockUsed: sha(path.join(frontend, 'package-lock.json')),
      snapshotsUnchanged: true, sourceUnchanged: true, posts, external, errors,
    };
    fs.writeFileSync(path.join(evidence, 'm1-rollback-rehearsal.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    await context.close();
  } finally {
    await browser?.close();
    await fixture.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
