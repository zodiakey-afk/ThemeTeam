const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const candidateDir = path.join(root, 'output/m1-visual-candidate');
const runtimeDir = path.join(root, 'frontend/public/assets/office');
const backupDir = path.join(root, 'output/m1-runtime-backup-before-atlas-v2');
const reviewPath = path.join(root, 'docs/evidence/m1-atlas-source-review-v2.json');
const runtimeManifestPath = path.join(runtimeDir, 'office-assets.v0.2.json');
const candidateManifestPath = path.join(candidateDir, 'candidate-manifest.json');
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));

function pngSize(file) {
  const bytes = fs.readFileSync(file);
  assert.equal(bytes.subarray(1, 4).toString('ascii'), 'PNG', `${file} is not PNG`);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function geometry(frames) {
  return frames.map(({ id, x, y, width, height, pivotX, pivotY, kind }) => ({ id, x, y, width, height, pivotX, pivotY, kind }));
}

function backupOnce(name) {
  fs.mkdirSync(backupDir, { recursive: true });
  const source = path.join(runtimeDir, name);
  const backup = path.join(backupDir, name);
  if (!fs.existsSync(backup)) fs.copyFileSync(source, backup);
}

const candidate = readJson(candidateManifestPath);
const review = readJson(reviewPath);
assert.equal(review.decision, 'approved', 'independent source review must approve packaging');
assert.equal(review.geometryUnchanged, true, 'independent review must confirm unchanged geometry');
assert.equal(review.candidateOnlySafe, true, 'independent review must confirm candidate-only isolation');
assert.equal(review.generatorSha256, candidate.generatorSha256, 'reviewed generator hash differs from candidate manifest');

const files = [
  { name: 'office-agents.v0.2.png', atlasId: 'agents', width: 320, height: 288, frames: candidate.agentFrames },
  { name: 'office-props.v0.2.png', atlasId: 'props', width: 512, height: 256, frames: candidate.propFrames },
];
const reviewed = new Map(review.files.map(file => [file.name, file]));
const declared = new Map(candidate.files.map(file => [file.name, file]));
const runtimeManifest = readJson(runtimeManifestPath);

for (const file of files) {
  const candidatePath = path.join(candidateDir, file.name);
  const hash = sha256(candidatePath);
  const size = pngSize(candidatePath);
  const priorAtlas = runtimeManifest.atlases.find(atlas => atlas.id === file.atlasId);
  assert.ok(priorAtlas, `runtime atlas ${file.atlasId} is missing`);
  assert.equal(hash, declared.get(file.name)?.sha256, `${file.name} candidate hash mismatch`);
  assert.equal(hash, reviewed.get(file.name)?.sha256, `${file.name} review hash mismatch`);
  assert.deepEqual(size, { width: file.width, height: file.height }, `${file.name} dimensions changed`);
  assert.deepEqual(geometry(file.frames), geometry(priorAtlas.frames), `${file.name} frame geometry changed`);
}

for (const name of ['office-agents.v0.2.png', 'office-props.v0.2.png', 'office-assets.v0.2.json']) backupOnce(name);

for (const file of files) fs.copyFileSync(path.join(candidateDir, file.name), path.join(runtimeDir, file.name));
runtimeManifest.rightsReview = {
  status: 'approved',
  reviewer: review.reviewer,
  reviewedAt: review.reviewedAt,
  distributionScope: 'ThemeTeam project runtime packaging only',
};
for (const file of files) {
  const atlas = runtimeManifest.atlases.find(item => item.id === file.atlasId);
  atlas.sha256 = sha256(path.join(runtimeDir, file.name));
  atlas.source = 'tests/generate_m1_design_assets.cjs Canvas primitives; no imported bitmap or game asset';
  atlas.author = 'ThemeTeam project generator';
  atlas.license = 'Project-local original; independently approved for ThemeTeam runtime packaging';
  atlas.frames = file.frames;
}
fs.writeFileSync(runtimeManifestPath, `${JSON.stringify(runtimeManifest, null, 2)}\n`);

const result = {
  result: 'promoted',
  review: path.relative(root, reviewPath).replaceAll('\\', '/'),
  backup: path.relative(root, backupDir).replaceAll('\\', '/'),
  files: files.map(file => ({ name: file.name, sha256: sha256(path.join(runtimeDir, file.name)), ...pngSize(path.join(runtimeDir, file.name)) })),
  manifestSha256: sha256(runtimeManifestPath),
};
console.log(JSON.stringify(result, null, 2));
