const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'output', 'm1-visual-candidate-v0.3');
const runtimeModules = process.env.CODEX_NODE_MODULES || 'C:/Users/z00654528/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const sharp = require(require.resolve('sharp', { paths: [runtimeModules] }));
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const manifest = JSON.parse(fs.readFileSync(path.join(output, 'candidate-manifest.json'), 'utf8'));

async function validateAtlas(name, expected, frames) {
  const file = path.join(output, name);
  const metadata = await sharp(file).metadata();
  assert.equal(metadata.width, expected.width, `${name} width`);
  assert.equal(metadata.height, expected.height, `${name} height`);
  assert.equal(metadata.hasAlpha, true, `${name} alpha`);
  assert.equal(frames.length, expected.frameCount, `${name} frame count`);
  assert.equal(new Set(frames.map(frame => frame.id)).size, frames.length, `${name} frame ids unique`);
  const occupancy = [];
  for (const frame of frames) {
    assert(frame.x >= 0 && frame.y >= 0 && frame.x + frame.width <= metadata.width && frame.y + frame.height <= metadata.height, `${frame.id} in atlas bounds`);
    const { data, info } = await sharp(file).extract({ left: frame.x, top: frame.y, width: frame.width, height: frame.height }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let opaque = 0, edge = 0;
    for (let y = 0; y < info.height; y += 1) for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * 4 + 3] < 16) continue;
      opaque += 1;
      if (x === 0 || y === 0 || x === info.width - 1 || y === info.height - 1) edge += 1;
    }
    assert(opaque > (name.includes('agents') ? 200 : 100), `${frame.id} is not blank`);
    occupancy.push({ id: frame.id, opaquePixels: opaque, edgePixels: edge });
  }
  return { name, metadata: { width: metadata.width, height: metadata.height, hasAlpha: metadata.hasAlpha }, occupancy };
}

async function validatePreview(name, width, height) {
  const file = path.join(output, name);
  const metadata = await sharp(file).metadata();
  assert.equal(metadata.width, width, `${name} width`);
  assert.equal(metadata.height, height, `${name} height`);
  const stats = await sharp(file).stats();
  const dynamicChannels = stats.channels.slice(0, 3).filter(channel => channel.max - channel.min > 100).length;
  assert(dynamicChannels >= 3, `${name} contains nonblank visual range`);
  return { name, width, height, dynamicChannels };
}

async function main() {
  assert.equal(manifest.status, 'awaiting-user-visual-approval-not-runtime-enabled');
  assert.equal(manifest.runtimeAssetsModified, false);
  assert.equal(manifest.approvalRequiredBeforePromotion, true);
  const runtimeHashes = {
    agents: sha256(path.join(root, 'frontend/public/assets/office/office-agents.v0.2.png')),
    props: sha256(path.join(root, 'frontend/public/assets/office/office-props.v0.2.png'))
  };
  assert.equal(runtimeHashes.agents, 'de3cc2e922337b0144809a5a07bd60af34a9ad2e79d4f3cbd41b6980966fa088');
  assert.equal(runtimeHashes.props, '3d6024bbd92de6c7bef785da56440de7876dbabc54c7ab8df343ec30abe07351');
  for (const file of manifest.files) {
    const filePath = path.join(output, file.name);
    assert(fs.existsSync(filePath), `${file.name} exists`);
    assert.equal(file.sha256, sha256(filePath), `${file.name} hash matches manifest`);
    assert.equal(file.bytes, fs.statSync(filePath).size, `${file.name} byte count matches manifest`);
  }
  const agentAtlas = await validateAtlas('office-agents.v0.3.png', manifest.proposedContract.agentAtlas, manifest.agentFrames);
  const propAtlas = await validateAtlas('office-props.v0.3.png', manifest.proposedContract.propAtlas, manifest.propFrames);
  const previews = await Promise.all([
    validatePreview('candidate-characters-preview.png', 1320, 590),
    validatePreview('candidate-furniture-preview.png', 1320, 760),
    validatePreview('runtime-closeup-desktop.png', 1440, 900),
    validatePreview('runtime-closeup-mobile.png', 390, 844)
  ]);
  const report = {
    status: 'passed',
    checkedAt: new Date().toISOString(),
    assertions: 3 + manifest.files.length * 3 + manifest.agentFrames.length * 4 + manifest.propFrames.length * 4 + previews.length * 3 + 2,
    runtimeHashes,
    candidateHashes: {
      agents: sha256(path.join(output, 'office-agents.v0.3.png')),
      props: sha256(path.join(output, 'office-props.v0.3.png'))
    },
    atlases: [agentAtlas, propAtlas],
    previews
  };
  fs.writeFileSync(path.join(output, 'validation-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ status: report.status, assertions: report.assertions, runtimeAssetsUnchanged: true, agentFrames: manifest.agentFrames.length, propFrames: manifest.propFrames.length, previews: previews.length }, null, 2));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
