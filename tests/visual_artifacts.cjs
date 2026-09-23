const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const directory = path.join(root, 'output/imagegen');
const entries = fs.readdirSync(directory).filter(name => /^vis\d\d-.+\.png$/.test(name)).sort().map(name => {
  const bytes = fs.readFileSync(path.join(directory, name));
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  assert.ok(width > 0 && height > 0);
  return { path: `output/imagegen/${name}`, bytes: bytes.length, width, height,
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'), generator: /^vis0[56]-/.test(name) ? 'Codex built-in image_gen' : 'user-confirmed compatible image API via bundled CLI',
    type: 'generated-design-reference', rights: 'third-party output terms not independently audited; no runtime redistribution approval' };
});
for (const name of ['vis01-overview-v2.png', 'vis02-closeups-v1.png', 'vis03-storyboard-v7.png', 'vis04-responsive-v4.png', 'vis05-continuation-board-v1.png', 'vis06-meeting-return-v1.png']) {
  assert.ok(entries.some(entry => entry.path.endsWith(name)), `Missing ${name}`);
}
const engineeringFiles = ['docs/assets/office-engineering.html', 'tests/visual_engineering.cjs', 'docs/evidence/w00v-engineering.json',
  'docs/evidence/w00v-engineering-1440.png', 'docs/evidence/w00v-engineering-390.png'];
for (const file of ['docs/assets/office-mobile-study.html', 'tests/visual_mobile.cjs', 'docs/evidence/w00v-mobile.json']) {
  if (fs.existsSync(path.join(root, file))) engineeringFiles.push(file);
}
for (const name of fs.readdirSync(path.join(root, 'docs/evidence')).filter(name => /^w00v-mobile-(390|1024)-(closed|open|task|returned)\.png$/.test(name))) {
  engineeringFiles.push(`docs/evidence/${name}`);
}
engineeringFiles.push('.ai-spec/iterations/ITER-2026-001/05-testing/w00v-mobile-spec.md');
const engineering = engineeringFiles.map(file => {
  const bytes = fs.readFileSync(path.join(root, file));
  return { path: file, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), type: 'project-native-design-evidence' };
});
fs.writeFileSync(path.join(root, 'docs/evidence/w00v-artifact-manifest.json'), JSON.stringify({
  version: 1, generatedAt: new Date().toISOString(), command: 'node tests/visual_artifacts.cjs', cwd: root,
  runtime: process.version, result: 'passed', generationChannels: ['user-confirmed compatible image API via bundled CLI', 'Codex built-in image_gen'],
  register: 'docs/evidence/w00v-assets.md', entries, engineering,
  scope: 'Local inventory and hashes only; not independent visual approval or provider attestation.'
}, null, 2));
console.log(`Inventory verified: ${entries.length} PNGs, ${engineering.length} engineering artifacts; no visual pass inferred.`);
