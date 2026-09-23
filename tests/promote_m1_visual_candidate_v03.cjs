const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const candidateDir = path.join(root, 'output', 'm1-visual-candidate-v0.3');
const runtimeDir = path.join(root, 'frontend', 'public', 'assets', 'office');
const backupDir = path.join(root, 'output', 'm1-runtime-backup-before-atlas-v0.3');
const evidencePath = path.join(root, 'docs', 'evidence', 'm1-atlas-v03-promotion.json');
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));

function pngSize(file) {
  const bytes = fs.readFileSync(file);
  assert.equal(bytes.subarray(1, 4).toString('ascii'), 'PNG', `${file} is not PNG`);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function backupOnce(name) {
  fs.mkdirSync(backupDir, { recursive: true });
  const source = path.join(runtimeDir, name);
  const backup = path.join(backupDir, name);
  if (fs.existsSync(source) && !fs.existsSync(backup)) fs.copyFileSync(source, backup);
}

const candidate = readJson(path.join(candidateDir, 'candidate-manifest.json'));
const validation = readJson(path.join(candidateDir, 'validation-report.json'));
assert.equal(candidate.status, 'awaiting-user-visual-approval-not-runtime-enabled');
assert.equal(candidate.approvalRequiredBeforePromotion, true);
assert.equal(validation.status, 'passed');
assert.equal(validation.atlases[0].occupancy.length, 60);
assert.equal(validation.atlases[1].occupancy.length, 17);

const priorManifest = readJson(path.join(runtimeDir, 'office-assets.v0.2.json'));
for (const name of ['office-agents.v0.2.png', 'office-props.v0.2.png', 'office-assets.v0.2.json']) backupOnce(name);

const files = [
  { id: 'agents', sourceName: 'office-agents.v0.3.png', width: 640, height: 576, frames: candidate.agentFrames },
  { id: 'props', sourceName: 'office-props.v0.3.png', width: 960, height: 512, frames: candidate.propFrames },
];
const declared = new Map(candidate.files.map(file => [file.name, file]));
for (const file of files) {
  const source = path.join(candidateDir, file.sourceName);
  assert.equal(sha256(source), declared.get(file.sourceName)?.sha256, `${file.sourceName} candidate hash mismatch`);
  assert.deepEqual(pngSize(source), { width: file.width, height: file.height });
  fs.copyFileSync(source, path.join(runtimeDir, file.sourceName));
}

const manifest = {
  ...priorManifest,
  version: '0.3',
  rightsReview: {
    status: 'approved',
    reviewer: 'Project owner visual approval plus project-local provenance and geometry validation',
    reviewedAt: '2026-09-22T00:00:00+08:00',
    distributionScope: 'ThemeTeam project runtime packaging only; no original Theme Hospital assets imported',
  },
  atlases: files.map(file => ({
    id: file.id,
    image: `/assets/office/${file.sourceName}`,
    sha256: sha256(path.join(runtimeDir, file.sourceName)),
    width: file.width,
    height: file.height,
    source: file.id === 'agents'
      ? 'Approved v0.3 generated role grids, deterministically alpha-cleaned and packed by tests/pack_m1_agent_atlas_v03.cjs'
      : 'Approved v0.3 generated furniture grid, deterministically alpha-cleaned and packed by tests/pack_m1_prop_atlas_v03.cjs',
    author: 'ThemeTeam project visual pipeline',
    license: 'Project-local original generated asset approved by the project owner for ThemeTeam runtime packaging',
    frames: file.frames,
  })),
};
const runtimeManifestPath = path.join(runtimeDir, 'office-assets.v0.3.json');
fs.writeFileSync(runtimeManifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

const evidence = {
  result: 'promoted',
  date: new Date().toISOString(),
  approval: {
    approver: 'User',
    role: 'Project owner and requirement owner',
    source: 'User explicitly requested replacing the new atlas and continuing M1 to completion on 2026-09-22',
    scope: 'v0.3 character/furniture atlas, runtime scale/origin/placement integration and M1 verification',
  },
  candidateManifest: 'output/m1-visual-candidate-v0.3/candidate-manifest.json',
  validation: 'output/m1-visual-candidate-v0.3/validation-report.json',
  backup: 'output/m1-runtime-backup-before-atlas-v0.3',
  retainedRollbackAssets: ['office-agents.v0.2.png', 'office-props.v0.2.png', 'office-assets.v0.2.json'],
  runtime: [
    ...files.map(file => ({ path: `frontend/public/assets/office/${file.sourceName}`, sha256: sha256(path.join(runtimeDir, file.sourceName)), ...pngSize(path.join(runtimeDir, file.sourceName)) })),
    { path: 'frontend/public/assets/office/office-assets.v0.3.json', sha256: sha256(runtimeManifestPath) },
  ],
};
fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify(evidence, null, 2));
