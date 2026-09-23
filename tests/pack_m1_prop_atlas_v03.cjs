const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'output', 'm1-visual-candidate-v0.3');
const runtimeModules = process.env.CODEX_NODE_MODULES || 'C:/Users/z00654528/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const sharp = require(require.resolve('sharp', { paths: [runtimeModules] }));
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

const frameIds = [
  ['floor-mint','tile'], ['floor-blue','tile'], ['wall-nw','propFront'], ['wall-ne','propFront'], ['desk','propBack'],
  ['chair','propFront'], ['crt','propBack'], ['meeting-table','propBack'], ['whiteboard','propBack'], ['boss-console','propBack'],
  ['coffee-counter','propBack'], ['water-cooler','propBack'], ['plant','propFront'], ['selection','effect'], ['error-target','effect'],
  ['path-dot','effect'], ['door-open','propFront']
];
const frameWidth = 192;
const frameHeight = 128;
const columns = 5;
const sourceRegions = {
  // Exact opaque-object bounds from props-source-grid.png, with a small
  // source-space gutter so furniture feet remain intact without neighbors.
  desk: { left: 1197, top: 16, width: 304, height: 269 },
  chair: { left: 88, top: 305, width: 153, height: 211 },
  crt: { left: 327, top: 307, width: 199, height: 219 },
  'meeting-table': { left: 575, top: 266, width: 318, height: 261 },
  whiteboard: { left: 917, top: 276, width: 235, height: 261 },
  'boss-console': { left: 1198, top: 297, width: 308, height: 253 },
  'coffee-counter': { left: 42, top: 534, width: 254, height: 246 },
  'water-cooler': { left: 388, top: 537, width: 126, height: 224 },
  plant: { left: 649, top: 545, width: 177, height: 221 },
};

async function cleanRegion(sourcePath, region, componentCount, preserveAllComponents) {
  const metadata = await sharp(sourcePath).metadata();
  const left = region.left;
  const top = region.top;
  const right = Math.min(metadata.width, left + region.width);
  const bottom = Math.min(metadata.height, top + region.height);
  const { data, info } = await sharp(sourcePath)
    .extract({ left, top, width: right - left, height: bottom - top })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let index = 0; index < info.width * info.height; index += 1) {
    const alphaIndex = index * 4 + 3;
    data[alphaIndex] = data[alphaIndex] >= 224 ? 255 : 0;
  }
  const visited = new Uint8Array(info.width * info.height);
  const components = [];
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const start = y * info.width + x;
      if (visited[start] || data[start * 4 + 3] === 0) continue;
      const component = [];
      const queue = [start];
      visited[start] = 1;
      for (let cursor = 0; cursor < queue.length; cursor += 1) {
        const index = queue[cursor];
        component.push(index);
        const px = index % info.width;
        const py = Math.floor(index / info.width);
        for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
          const nx = px + dx, ny = py + dy;
          if (nx < 0 || ny < 0 || nx >= info.width || ny >= info.height) continue;
          const next = ny * info.width + nx;
          if (!visited[next] && data[next * 4 + 3] !== 0) {
            visited[next] = 1;
            queue.push(next);
          }
        }
      }
      components.push(component);
    }
  }
  components.sort((a, b) => b.length - a.length);
  const keep = new Uint8Array(info.width * info.height);
  const selectedComponents = preserveAllComponents ? components : components.slice(0, componentCount);
  for (const component of selectedComponents) for (const index of component) keep[index] = 1;
  for (let index = 0; index < keep.length; index += 1) if (!keep[index]) data[index * 4 + 3] = 0;
  const cleaned = await sharp(data, { raw: info }).png().toBuffer();
  return sharp(cleaned)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 4 })
    .resize({ width: 184, height: 120, fit: 'inside', kernel: 'nearest', withoutEnlargement: false })
    .png()
    .toBuffer({ resolveWithObject: true });
}

async function main() {
  const sourcePath = path.join(output, 'props-source-grid.png');
  if (!fs.existsSync(sourcePath)) throw new Error(`Missing source grid: ${sourcePath}`);
  const composites = [];
  const frames = [];
  const diagnostics = [];
  for (let index = 0; index < frameIds.length; index += 1) {
    const [id, kind] = frameIds[index];
    const column = index % columns;
    const row = Math.floor(index / columns);
    const preserveFurniture = ['desk', 'chair', 'crt', 'meeting-table', 'whiteboard', 'boss-console',
      'coffee-counter', 'water-cooler', 'plant'].includes(id);
    const region = sourceRegions[id] || {
      left: Math.floor(column * 1536 / 5),
      top: Math.floor(row * 1024 / 4),
      width: Math.ceil(1536 / 5),
      height: Math.ceil(1024 / 4),
    };
    const sprite = await cleanRegion(sourcePath, region, id === 'path-dot' ? 5 : 1, preserveFurniture);
    const frameX = column * frameWidth;
    const frameY = row * frameHeight;
    const left = frameX + Math.floor((frameWidth - sprite.info.width) / 2);
    const top = frameY + frameHeight - sprite.info.height - 4;
    composites.push({ input: sprite.data, left, top });
    frames.push({ id, x: frameX, y: frameY, width: frameWidth, height: frameHeight, pivotX: 96, pivotY: 124, kind });
    diagnostics.push({ id, sourceRegion: region, preserveAllComponents: preserveFurniture,
      packedBounds: { left, top, width: sprite.info.width, height: sprite.info.height } });
  }
  const atlasPath = path.join(output, 'office-props.v0.3.png');
  await sharp({ create: { width: columns * frameWidth, height: 4 * frameHeight, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(composites)
    .png({ compressionLevel: 9, palette: false })
    .toFile(atlasPath);

  const manifestPath = path.join(output, 'candidate-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.source.propAtlas = 'High-quality furniture source board with explicit per-object source regions, all legitimate furniture components preserved, alpha-cleaned and aspect-fit into fixed frames';
  manifest.proposedContract.propAtlas = { width: 960, height: 512, frameWidth, frameHeight, frameCount: frames.length };
  manifest.propFrames = frames;
  manifest.propPackingDiagnostics = diagnostics;
  manifest.commands = [
    'node tests/generate_m1_visual_candidate_v03.cjs',
    'node tests/pack_m1_agent_atlas_v03.cjs',
    'node tests/pack_m1_prop_atlas_v03.cjs'
  ];
  if (!manifest.files.some(file => file.name === 'props-source-grid.png')) manifest.files.push({ name: 'props-source-grid.png' });
  for (const file of manifest.files) {
    const filePath = path.join(output, file.name);
    if (fs.existsSync(filePath)) {
      file.sha256 = sha256(filePath);
      file.bytes = fs.statSync(filePath).size;
    }
  }
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify({ atlasPath, sha256: sha256(atlasPath), frames: frames.length, width: 960, height: 512 }, null, 2));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
