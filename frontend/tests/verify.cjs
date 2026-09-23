const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const frontend = path.resolve(__dirname, '..');
const root = path.dirname(frontend);
const evidence = path.join(root, 'docs/evidence');
const hash = file => fs.existsSync(file) ? crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') : null;
const stateFile = path.join(root, 'themeteam/core/workspace_state.json');
const before = hash(stateFile);
const commands = [];
let passed = true;
for (const script of ['typecheck', 'test:unit', 'test:m1:contracts', 'build', 'test:m1:two-roots',
  'test:m1:e2e', 'test:m1:motion', 'test:m1:nfr', 'test:m1:divergence', 'test:m1:accessibility',
  'test:m1:stability', 'test:e2e']) {
  const result = spawnSync(process.execPath, [process.env.npm_execpath, '--offline', 'run', script], {
    cwd: frontend, encoding: 'utf8', env: { ...process.env, npm_config_offline: 'true' },
  });
  const log = path.join(evidence, `m1-${script.replaceAll(':', '-')}.log`);
  fs.writeFileSync(log, `${result.stdout || ''}${result.stderr || ''}${result.error || ''}`);
  commands.push({ command: `npm --offline run ${script}`, cwd: frontend, exitCode: result.status,
    log: path.relative(root, log), sha256: hash(log) });
  console.log(`${script}: ${result.status === 0 ? 'PASS' : 'FAIL'}`);
  if (result.status !== 0) { passed = false; break; }
}
const lock = JSON.parse(fs.readFileSync(path.join(frontend, 'package-lock.json'), 'utf8'));
const licenses = Object.entries(lock.packages).filter(([key]) => key).map(([key, value]) => {
  const packageDirectory = path.join(frontend, key);
  const packageFile = path.join(packageDirectory, 'package.json');
  const installedMetadata = fs.existsSync(packageFile) ? JSON.parse(fs.readFileSync(packageFile, 'utf8')) : {};
  const licenseFile = fs.existsSync(packageDirectory) ? fs.readdirSync(packageDirectory).find(name => /^licen[cs]e(?:\.|$)/i.test(name)) || null : null;
  const legacyLicenses = Array.isArray(installedMetadata.licenses) ? installedMetadata.licenses.map(item => item.type).filter(Boolean).join(', ') : null;
  const license = value.license || installedMetadata.license || legacyLicenses || (licenseFile ? 'LICENSE_FILE_PRESENT' : null);
  return { packagePath: key, version: value.version, license,
    licenseSource: value.license ? 'package-lock' : installedMetadata.license ? 'installed-package' : legacyLicenses ? 'installed-package-legacy' : licenseFile,
    installed: fs.existsSync(packageFile) };
});
const licenseReport = path.join(evidence, 'm1-licenses.json');
fs.writeFileSync(licenseReport, JSON.stringify(licenses, null, 2));
const missingLicenses = licenses.filter(item => !item.license);
const findings = [];
const patterns = [/\bsk-[A-Za-z0-9_-]{16,}\b/g, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
  /(?:api[_-]?key|password|secret)\s*[:=]\s*["'][^"'\r\n]{12,}["']/gi];
const excluded = new Set(['node_modules', '.git', '.cache', '__pycache__', 'dist', 'dist-two-roots', 'output']);
let scannedFiles = 0;
function scan(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) { if (!excluded.has(entry.name)) scan(file); continue; }
    if (!/\.(?:py|js|cjs|mjs|ts|tsx|json|yaml|md|html|css)$/.test(entry.name) || file === __filename) continue;
    scannedFiles++;
    const content = fs.readFileSync(file, 'utf8');
    for (const [index, expression] of patterns.entries()) {
      expression.lastIndex = 0;
      if (expression.test(content)) findings.push({ file: path.relative(root, file), rule: index + 1 });
    }
  }
}
scan(root);
const after = hash(stateFile);
passed = passed && before === after && missingLicenses.length === 0 && findings.length === 0;
const report = { result: passed ? 'passed' : 'failed', date: new Date().toISOString(), node: process.version,
  platform: `${process.platform}/${process.arch}`, commands, lockSha256: hash(path.join(frontend, 'package-lock.json')),
  licenses: { count: licenses.length, missing: missingLicenses, report: 'docs/evidence/m1-licenses.json', sha256: hash(licenseReport) },
  secretScan: { scannedFiles, findings, limitation: 'Heuristic credential scan, not a comprehensive PII or secret audit; generated output and dependencies excluded.' },
  workspaceIntegrity: { before, after, unchanged: before === after },
  offline: 'npm offline mode with already-installed locked dependencies; not a network-isolated install or OS egress proof.' };
fs.writeFileSync(path.join(evidence, 'm1-verification.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (!passed) process.exitCode = 1;
