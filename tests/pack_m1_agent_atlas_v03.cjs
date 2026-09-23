const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'output', 'm1-visual-candidate-v0.3');
const runtimeModules = process.env.CODEX_NODE_MODULES || 'C:/Users/z00654528/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const sharp = require(require.resolve('sharp', { paths: [runtimeModules] }));
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

const roles = [
  { id: 'pm', source: 'pm-source-grid.png' },
  { id: 'developer', source: 'developer-source-grid.png' },
  { id: 'tester', source: 'qa-source-grid.png' },
];
const directions = ['NE', 'SE', 'SW', 'NW'];
const states = ['idle', 'walk1', 'walk2', 'sit', 'work'];
const frameWidth = 64;
const frameHeight = 96;
const columns = 10;

async function keepLargestAlphaComponent(buffer) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const visited = new Uint8Array(info.width * info.height);
  let largest = [];
  const offsets = [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const start = y * info.width + x;
      if (visited[start] || data[start * 4 + 3] < 16) continue;
      const component = [];
      const queue = [start];
      visited[start] = 1;
      for (let cursor = 0; cursor < queue.length; cursor += 1) {
        const index = queue[cursor];
        component.push(index);
        const px = index % info.width;
        const py = Math.floor(index / info.width);
        for (const [dx, dy] of offsets) {
          const nx = px + dx, ny = py + dy;
          if (nx < 0 || ny < 0 || nx >= info.width || ny >= info.height) continue;
          const next = ny * info.width + nx;
          if (!visited[next] && data[next * 4 + 3] >= 16) {
            visited[next] = 1;
            queue.push(next);
          }
        }
      }
      if (component.length > largest.length) largest = component;
    }
  }
  const keep = new Uint8Array(info.width * info.height);
  for (const index of largest) keep[index] = 1;
  for (let index = 0; index < keep.length; index += 1) if (!keep[index]) data[index * 4 + 3] = 0;
  return sharp(data, { raw: info }).png().toBuffer();
}

async function cropCell(sourcePath, column, row) {
  const metadata = await sharp(sourcePath).metadata();
  const left = Math.floor(column * metadata.width / 5);
  const top = Math.floor(row * metadata.height / 4);
  const right = Math.floor((column + 1) * metadata.width / 5);
  const bottom = Math.floor((row + 1) * metadata.height / 4);
  const extracted = await sharp(sourcePath)
    .extract({ left, top, width: right - left, height: bottom - top })
    .png()
    .toBuffer();
  const cell = await keepLargestAlphaComponent(extracted);
  return sharp(cell)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 8 })
    .resize({ width: 60, height: 90, fit: 'inside', kernel: 'nearest', withoutEnlargement: false })
    .png()
    .toBuffer({ resolveWithObject: true });
}

async function main() {
  const composites = [];
  const frames = [];
  const diagnostics = [];
  let index = 0;
  for (const role of roles) {
    const sourcePath = path.join(output, role.source);
    if (!fs.existsSync(sourcePath)) throw new Error(`Missing source grid: ${sourcePath}`);
    for (let row = 0; row < directions.length; row += 1) {
      for (let column = 0; column < states.length; column += 1) {
        const sprite = await cropCell(sourcePath, column, row);
        const frameX = (index % columns) * frameWidth;
        const frameY = Math.floor(index / columns) * frameHeight;
        const left = frameX + Math.floor((frameWidth - sprite.info.width) / 2);
        const top = frameY + frameHeight - sprite.info.height - 2;
        composites.push({ input: sprite.data, left, top });
        const id = `${role.id}-${states[column]}-${directions[row]}`;
        frames.push({ id, x: frameX, y: frameY, width: frameWidth, height: frameHeight, pivotX: 32, pivotY: 94, kind: 'agent' });
        diagnostics.push({ id, source: role.source, sourceCell: { column, row }, packedBounds: { left, top, width: sprite.info.width, height: sprite.info.height } });
        index += 1;
      }
    }
  }

  const atlasPath = path.join(output, 'office-agents.v0.3.png');
  await sharp({ create: { width: columns * frameWidth, height: 6 * frameHeight, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(composites)
    .png({ compressionLevel: 9, palette: false })
    .toFile(atlasPath);

  const manifestPath = path.join(output, 'candidate-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.source.agentAtlas = 'Transparent PM/Developer/QA 4x5 source grids generated from the approved identity board, then deterministically cropped and packed with Sharp';
  manifest.proposedContract.agentAtlas = { width: 640, height: 576, frameWidth, frameHeight, frameCount: frames.length };
  manifest.agentFrames = frames;
  manifest.agentPackingDiagnostics = diagnostics;
  manifest.commands = [
    'node tests/generate_m1_visual_candidate_v03.cjs',
    'node tests/pack_m1_agent_atlas_v03.cjs'
  ];
  const sourceNames = roles.map(role => role.source);
  for (const name of sourceNames) {
    if (!manifest.files.some(file => file.name === name)) manifest.files.push({ name });
  }
  for (const file of manifest.files) {
    const filePath = path.join(output, file.name);
    if (fs.existsSync(filePath)) {
      file.sha256 = sha256(filePath);
      file.bytes = fs.statSync(filePath).size;
    }
  }
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify({ atlasPath, sha256: sha256(atlasPath), frames: frames.length, width: 640, height: 576 }, null, 2));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
