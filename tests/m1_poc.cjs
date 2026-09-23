const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..');
const frontend = path.join(root, 'frontend');
const evidence = path.join(root, 'docs/evidence');
const cache = path.join(root, '.cache/npm-m1-poc');
const modulePath = name => path.join(frontend, 'node_modules', name, 'package.json');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const run = (command, args, cwd) => {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', windowsHide: true, shell: command.endsWith('.cmd') });
  if (result.error) throw result.error;
  return result;
};

async function easyStarProof() {
  const EasyStar = require(require.resolve('easystarjs', { paths: [path.join(frontend, 'node_modules')] }));
  const finder = new EasyStar.js();
  finder.setGrid([
    [0, 0, 1, 0, 0],
    [1, 0, 1, 0, 1],
    [0, 0, 0, 0, 0]
  ]);
  finder.setAcceptableTiles([0]);
  finder.disableDiagonals();
  finder.setIterationsPerCalculation(1);
  let generation = 1;
  let accepted = null;
  const staleGeneration = generation;
  finder.findPath(0, 0, 4, 2, pathResult => {
    if (staleGeneration === generation) accepted = pathResult;
  });
  generation += 1;
  for (let i = 0; i < 100; i += 1) finder.calculate();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(accepted, null, 'Late result from an invalid generation must be discarded');

  let currentPath;
  finder.findPath(0, 0, 4, 2, pathResult => { currentPath = pathResult; });
  for (let i = 0; i < 100; i += 1) finder.calculate();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.ok(Array.isArray(currentPath) && currentPath.length > 0);
  for (let i = 1; i < currentPath.length; i += 1) {
    assert.equal(Math.abs(currentPath[i].x - currentPath[i - 1].x) + Math.abs(currentPath[i].y - currentPath[i - 1].y), 1);
  }

  let cancelledCalled = false;
  const requestId = finder.findPath(0, 0, 4, 2, () => { cancelledCalled = true; });
  assert.equal(finder.cancelPath(requestId), true);
  for (let i = 0; i < 100; i += 1) finder.calculate();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(cancelledCalled, false);
  return { fourNeighborPathNodes: currentPath.length, staleGenerationDiscarded: true, cancelPathSuppressedCallback: true, iterationsPerCalculation: 1 };
}

function createServer(phaserFile) {
  const html = `<!doctype html><html><body><div id="host"></div><script src="/phaser.js"></script><script>
    window.poc = { creates: 0, destroys: 0, contextLost: false, errors: [] };
    window.addEventListener('error', event => window.poc.errors.push(event.message));
    window.createGame = function(type) {
      return new Promise(resolve => {
        const game = new Phaser.Game({ type, width: 128, height: 96, parent: 'host', backgroundColor: '#123b4a', audio: { noAudio: true },
          render: { antialias: false, preserveDrawingBuffer: true },
          scene: { create() { this.add.rectangle(64, 48, 40, 24, 0x55aa66); window.poc.creates += 1; resolve(game); } }
        });
        window.currentGame = game;
      });
    };
    window.destroyGame = function() { if (!window.currentGame) return; window.currentGame.destroy(true); window.currentGame = null; window.poc.destroys += 1; };
    window.loseContext = function() {
      const game = window.currentGame;
      const canvas = game && game.canvas;
      if (!canvas) return false;
      canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); window.poc.contextLost = true; game.scene.pause(); }, { once: true });
      const gl = game.renderer && game.renderer.gl;
      const extension = gl && gl.getExtension('WEBGL_lose_context');
      if (!extension) return false;
      extension.loseContext();
      return true;
    };
  </script></body></html>`;
  return http.createServer((req, res) => {
    if (req.url === '/phaser.js') {
      res.writeHead(200, { 'Content-Type': 'text/javascript' });
      fs.createReadStream(phaserFile).pipe(res);
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  });
}

async function phaserProof() {
  const runtimeModules = process.env.CODEX_NODE_MODULES || 'C:/Users/z00654528/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
  const { chromium } = require(require.resolve('playwright', { paths: [runtimeModules] }));
  const phaserFile = path.join(path.dirname(modulePath('phaser')), 'dist/phaser.js');
  const server = createServer(phaserFile);
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: 'msedge' });
    const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    for (let i = 0; i < 3; i += 1) {
      await page.evaluate(() => window.createGame(Phaser.CANVAS));
      assert.equal(await page.locator('canvas').count(), 1);
      await page.evaluate(() => window.destroyGame());
      await page.waitForFunction(() => document.querySelectorAll('canvas').length === 0);
    }
    await page.evaluate(() => window.createGame(Phaser.WEBGL));
    const contextLossSupported = await page.evaluate(() => window.loseContext());
    if (contextLossSupported) await page.waitForFunction(() => window.poc.contextLost === true);
    const beforeFinalDestroy = await page.evaluate(() => ({ ...window.poc, canvasCount: document.querySelectorAll('canvas').length }));
    await page.evaluate(() => window.destroyGame());
    await page.waitForFunction(() => document.querySelectorAll('canvas').length === 0);
    const result = await page.evaluate(() => ({ ...window.poc, canvasCount: document.querySelectorAll('canvas').length }));
    assert.equal(beforeFinalDestroy.canvasCount, 1);
    assert.equal(result.creates, 4);
    assert.equal(result.destroys, 4);
    assert.deepEqual(result.errors, []);
    assert.equal(contextLossSupported, true, 'WebGL context-loss extension is required for the fixed PoC browser');
    assert.equal(result.contextLost, true);
    return { ...result, contextLossSupported, finalCanvasCount: await page.locator('canvas').count() };
  } finally {
    if (browser) await browser.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}

async function buildProof(tempRoot) {
  const source = `import * as Phaser from 'phaser';\nimport { js as EasyStar } from 'easystarjs';\nconst config: Phaser.Types.Core.GameConfig = { type: Phaser.CANVAS, width: 64, height: 64 };\nconst finder = new EasyStar();\nfinder.setAcceptableTiles([0]);\nexport { config, finder };\n`;
  fs.writeFileSync(path.join(tempRoot, 'index.html'), '<div id="app"></div><script type="module" src="/src.ts"></script>');
  fs.writeFileSync(path.join(tempRoot, 'src.ts'), source);
  const ts = require(require.resolve('typescript', { paths: [path.join(frontend, 'node_modules')] }));
  const options = { module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, target: ts.ScriptTarget.ES2022, lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'], esModuleInterop: true, skipLibCheck: true, noEmit: true };
  const program = ts.createProgram([path.join(tempRoot, 'src.ts')], options);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  assert.deepEqual(diagnostics.map(item => ts.flattenDiagnosticMessageText(item.messageText, '\n')), []);
  const { build } = await import(pathToFileURL(require.resolve('vite', { paths: [path.join(frontend, 'node_modules')] })).href);
  await build({ root: tempRoot, logLevel: 'silent', resolve: { alias: {
    phaser: path.join(frontend, 'node_modules/phaser/dist/phaser.esm.js'),
    easystarjs: path.join(frontend, 'node_modules/easystarjs/src/easystar.js')
  } }, build: { outDir: path.join(tempRoot, 'dist'), emptyOutDir: true } });
  const files = fs.readdirSync(path.join(tempRoot, 'dist/assets'));
  assert.ok(files.some(name => name.endsWith('.js')));
  return { typeDiagnostics: 0, viteOutputFiles: files.length };
}

function dependencyProof(tempRoot) {
  const packages = ['phaser', 'easystarjs', 'eventemitter3', 'heap'].map(name => {
    const file = modulePath(name);
    const pkg = readJson(file);
    const license = pkg.license || (Array.isArray(pkg.licenses) ? pkg.licenses.map(item => item.type).join(' OR ') : null);
    assert.ok(['MIT', 'PSF'].includes(license), `${pkg.name} has unreviewed license ${license}`);
    return { name: pkg.name, version: pkg.version, license, packageHash: sha256(file) };
  });
  assert.equal(packages.find(item => item.name === 'phaser').version, '3.90.0');
  assert.equal(packages.find(item => item.name === 'easystarjs').version, '0.4.4');

  const auditRoot = path.join(tempRoot, 'audit');
  fs.mkdirSync(auditRoot);
  fs.writeFileSync(path.join(auditRoot, 'package.json'), JSON.stringify({ private: true, dependencies: { phaser: '3.90.0', easystarjs: '0.4.4' } }, null, 2));
  const lock = run('npm.cmd', ['install', '--package-lock-only', '--ignore-scripts', '--offline', '--cache', cache], auditRoot);
  assert.equal(lock.status, 0, lock.stderr || lock.stdout);
  const audit = run('npm.cmd', ['audit', '--omit=dev', '--json', '--cache', cache], auditRoot);
  fs.writeFileSync(path.join(evidence, 'm1-dependency-audit.json'), audit.stdout || audit.stderr);
  assert.equal(audit.status, 0, audit.stdout || audit.stderr);
  const auditJson = JSON.parse(audit.stdout);
  assert.equal(auditJson.metadata.vulnerabilities.total, 0);
  return { packages, offlinePackageLock: true, auditVulnerabilities: auditJson.metadata.vulnerabilities, auditExitCode: audit.status };
}

async function main() {
  const tempRoot = fs.mkdtempSync(path.join(frontend, '.m1-poc-'));
  try {
    const dependencies = dependencyProof(tempRoot);
    const build = await buildProof(tempRoot);
    const easyStar = await easyStarProof();
    const phaser = await phaserProof();
    const report = {
      result: 'passed', date: new Date().toISOString(), command: 'node tests/m1_poc.cjs', cwd: root,
      runtime: process.version, exitCode: 0, log: 'docs/evidence/m1-poc.log', dependencies, build, easyStar, phaser,
      scope: 'Pre-G2 dependency and lifecycle/path-selection PoC only; no product scene implementation or M1 acceptance.'
    };
    const serialized = JSON.stringify(report, null, 2);
    fs.writeFileSync(path.join(evidence, 'm1-poc.json'), serialized);
    fs.writeFileSync(path.join(evidence, 'm1-poc.log'), `${serialized}\n`);
    console.log(serialized);
  } finally {
    const resolved = path.resolve(tempRoot);
    assert.ok(resolved.startsWith(path.resolve(frontend) + path.sep));
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
