const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const { once } = require('node:events');

const root = path.resolve(__dirname, '../..');
const frontend = path.join(root, 'frontend');
const evidence = path.join(root, 'docs/evidence');
const python = process.env.PYTHON || 'C:/Users/z00654528/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function fingerprint(paths) {
  const result = {};
  function visit(file) {
    if (fs.statSync(file).isDirectory()) {
      for (const name of fs.readdirSync(file).sort()) {
        if (name === '__pycache__') continue;
        visit(path.join(file, name));
      }
    } else {
      result[path.relative(root, file).replaceAll('\\', '/')] = hash(file);
    }
  }
  for (const file of paths) visit(path.resolve(root, file));
  return result;
}

function captureFingerprint() {
  return fingerprint(['frontend/src', 'frontend/public/assets/office', 'frontend/package.json', 'frontend/package-lock.json',
    'frontend/tests', 'tests/browser_fixture.py', 'tests/support.py', 'themeteam/core', 'themeteam/web/server.py',
    '.ai-spec/iterations/ITER-2026-001/05-testing/m1-spec.md']);
}

function environment(browser) {
  let hardware = null;
  if (process.platform === 'win32') {
    const probe = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      '$gpu = Get-CimInstance Win32_VideoController | Select-Object Name,CurrentRefreshRate; ' +
      '$power = powercfg /getactivescheme; @{gpu=@($gpu); powerMode=($power -join " ")} | ConvertTo-Json -Depth 4'],
    { encoding: 'utf8', timeout: 15000, windowsHide: true });
    if (probe.status === 0) {
      try { hardware = JSON.parse(probe.stdout); } catch { /* Report missing metadata below. */ }
    }
  }
  const py = spawnSync(python, ['--version'], { encoding: 'utf8', windowsHide: true });
  const pkg = JSON.parse(fs.readFileSync(path.join(frontend, 'package.json'), 'utf8'));
  const missing = [];
  if (!hardware?.gpu?.length) missing.push('GPU');
  if (!hardware?.gpu?.some(item => Number(item.CurrentRefreshRate) > 1)) missing.push('display refresh rate');
  if (!hardware?.powerMode) missing.push('power mode');
  if (py.status !== 0) missing.push('Python version');
  return {
    os: { platform: process.platform, release: os.release(), version: os.version(), arch: os.arch() },
    cpu: os.cpus()[0]?.model || null, logicalCpus: os.cpus().length, ramBytes: os.totalmem(),
    browser: browser.version(), node: process.version, python: py.status === 0 ? py.stdout.trim() : null,
    phaser: pkg.dependencies.phaser, easyStar: pkg.dependencies.easystarjs, hardware, missing,
  };
}

async function startProductionFixture({ twoRoots = false, loadM1 = false, accessibilityProfile = false } = {}) {
  fs.mkdirSync(evidence, { recursive: true });
  const buildArgs = twoRoots ? [path.join(frontend, 'tests/build-two-roots.mjs')]
    : [path.join(frontend, 'node_modules/vite/bin/vite.js'), 'build'];
  const build = spawnSync(process.execPath, buildArgs,
    { cwd: frontend, encoding: 'utf8', windowsHide: true });
  fs.writeFileSync(path.join(evidence, 'm1-production-build.log'), `${build.stdout || ''}${build.stderr || ''}`);
  if (build.status !== 0) throw new Error(`Production build failed: ${build.error || build.stderr}`);
  const source = captureFingerprint();
  const fixture = spawn(python, ['-B', 'tests/browser_fixture.py', '--production', ...(twoRoots ? ['--two-roots'] : []),
    ...(loadM1 ? ['--m1-load'] : []), ...(accessibilityProfile ? ['--m1-a11y'] : [])],
    { cwd: root, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  let stderr = '';
  fixture.stderr.on('data', chunk => { stderr += chunk; });
  async function close() {
    if (fixture.exitCode !== null) return;
    const exited = once(fixture, 'exit');
    fixture.stdin.end();
    let timeout;
    await Promise.race([exited, new Promise(resolve => { timeout = setTimeout(resolve, 5000); })]);
    clearTimeout(timeout);
    if (fixture.exitCode === null) {
      fixture.kill();
      await exited;
    }
  }
  try {
    const base = await new Promise((resolve, reject) => {
      let output = '';
      const timer = setTimeout(() => reject(new Error(`Fixture timeout: ${stderr}`)), 10000);
      const fail = error => { clearTimeout(timer); reject(error); };
      fixture.once('error', fail);
      fixture.once('exit', code => fail(new Error(`Fixture exited ${code}: ${stderr}`)));
      fixture.stdout.on('data', chunk => {
        output += chunk;
        if (output.includes('\n')) {
          clearTimeout(timer);
          const url = output.split(/\r?\n/)[0].trim();
          if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(url)) reject(new Error('Invalid fixture URL'));
          else resolve(url);
        }
      });
    });
    return { base, source, close };
  } catch (error) {
    await close();
    throw error;
  }
}

function summarize(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return { samples: values, count: values.length, mean,
    standardDeviation: Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length),
    p95: sorted[Math.max(0, Math.ceil(0.95 * values.length) - 1)],
    p99: sorted[Math.max(0, Math.ceil(0.99 * values.length) - 1)] };
}

module.exports = { root, frontend, evidence, environment, fingerprint, captureFingerprint, startProductionFixture, summarize };
