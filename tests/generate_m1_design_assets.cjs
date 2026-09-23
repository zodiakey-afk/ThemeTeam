const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const candidateOnly = process.argv.includes('--candidate-only');
const output = path.join(root, candidateOnly ? 'output/m1-visual-candidate' : 'frontend/public/assets/office');
const fixtureOutput = path.join(root, 'frontend/tests/fixtures/m1');
const evidence = path.join(root, 'docs/evidence');
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const cell = (col, row) => ({ col, row });
const keyOf = value => `${value.col},${value.row}`;

function rectangleCells(fromCol, toCol, fromRow, toRow) {
  const cells = [];
  for (let row = fromRow; row <= toRow; row += 1) for (let col = fromCol; col <= toCol; col += 1) cells.push(cell(col, row));
  return cells;
}

function createMap() {
  const grid = Array.from({ length: 24 }, () => Array(32).fill(0));
  for (let col = 0; col < 32; col += 1) grid[0][col] = grid[23][col] = 1;
  for (let row = 0; row < 24; row += 1) grid[row][0] = grid[row][31] = 1;
  for (let col = 1; col < 31; col += 1) grid[9][col] = 1;
  for (let row = 1; row <= 8; row += 1) grid[row][16] = 1;
  for (let row = 10; row <= 22; row += 1) grid[row][20] = 1;
  const doors = [
    { id: 'door-boss-meeting', cell: cell(16, 5), roomKeys: ['boss', 'meeting'], open: true },
    { id: 'door-boss-work', cell: cell(6, 9), roomKeys: ['boss', 'work'], open: true },
    { id: 'door-meeting-coffee', cell: cell(24, 9), roomKeys: ['meeting', 'coffee'], open: true },
    { id: 'door-work-coffee', cell: cell(20, 16), roomKeys: ['work', 'coffee'], open: true }
  ];
  for (const door of doors) grid[door.cell.row][door.cell.col] = 0;

  const workColumns = [3, 7, 11, 15];
  const anchors = [
    ...workColumns.map((col, index) => ({ id: `work-${index + 1}`, kind: 'workSeat', roomKey: 'work', stand: cell(col, 14), approach: cell(col, 14), sit: { worldX: 1024 + (col - 13) * 32, worldY: 96 + (col + 13) * 16 - 18 }, facing: 'NE', footprint: [cell(col, 13)] })),
    ...workColumns.map((col, index) => ({ id: `work-${index + 5}`, kind: 'workSeat', roomKey: 'work', stand: cell(col, 18), approach: cell(col, 18), sit: { worldX: 1024 + (col - 17) * 32, worldY: 96 + (col + 17) * 16 - 18 }, facing: 'NE', footprint: [cell(col, 17)] })),
    ...[19, 21, 23, 25, 27, 29].map((col, index) => ({ id: `meeting-${index + 1}`, kind: 'meetingSeat', roomKey: 'meeting', stand: cell(col, 6), approach: cell(col, 6), sit: { worldX: 1024 + (col - 4) * 32, worldY: 96 + (col + 4) * 16 - 12 }, facing: index < 3 ? 'SW' : 'NE', footprint: [cell(col, 4)] }))
  ];
  for (const anchor of anchors) for (const footprint of anchor.footprint) grid[footprint.row][footprint.col] = 1;

  const props = [];
  for (const anchor of anchors.filter(item => item.kind === 'workSeat')) {
    props.push({ id: `${anchor.id}-desk`, frameId: 'desk', cell: anchor.footprint[0], layer: 'propsBack', depthOffset: -8 });
    props.push({ id: `${anchor.id}-chair`, frameId: 'chair', cell: anchor.approach, layer: 'propsFront', depthOffset: 8 });
    props.push({ id: `${anchor.id}-crt`, frameId: 'crt', cell: anchor.footprint[0], layer: 'propsBack', depthOffset: 4 });
  }
  props.push(
    { id: 'meeting-table', frameId: 'meeting-table', cell: cell(24, 4), layer: 'propsBack', depthOffset: 0 },
    { id: 'meeting-whiteboard', frameId: 'whiteboard', cell: cell(27, 2), layer: 'propsBack', depthOffset: -16 },
    { id: 'boss-console', frameId: 'boss-console', cell: cell(6, 4), layer: 'propsBack', depthOffset: 0 },
    { id: 'coffee-counter', frameId: 'coffee-counter', cell: cell(26, 15), layer: 'propsBack', depthOffset: 0 },
    { id: 'water-cooler', frameId: 'water-cooler', cell: cell(28, 18), layer: 'propsBack', depthOffset: 0 },
    { id: 'boss-plant', frameId: 'plant', cell: cell(3, 3), layer: 'propsFront', depthOffset: 0 },
    { id: 'coffee-plant', frameId: 'plant', cell: cell(23, 19), layer: 'propsFront', depthOffset: 0 }
  );

  return {
    version: '0.2', mapRevision: 'office-v0.2-r1',
    dimensions: { columns: 32, rows: 24, tileWidth: 64, tileHeight: 32 }, origin: { x: 1024, y: 96 },
    roomBindings: [
      { key: 'boss', roomId: 'room_boss', roomType: 'boss', movementEnabled: true, cells: rectangleCells(1, 15, 1, 8) },
      { key: 'meeting', roomId: 'room_meeting', roomType: 'meeting', movementEnabled: true, cells: rectangleCells(17, 30, 1, 8) },
      { key: 'work', roomId: 'room_work', roomType: 'work', movementEnabled: true, cells: rectangleCells(1, 19, 10, 22) },
      { key: 'coffee', roomId: 'room_coffee', roomType: 'coffee', movementEnabled: true, cells: rectangleCells(21, 30, 10, 22) }
    ],
    collision: grid.map(row => row.join('')), doors, anchors, props,
    spawns: [...Array.from({ length: 19 }, (_, index) => cell(index + 1, 11)), cell(21, 11)],
    renderLayers: ['ground', 'propsBack', 'dynamic', 'propsFront', 'effects']
  };
}

function buildPage() {
  return `<!doctype html><html><body><canvas id="agents" width="320" height="288"></canvas><canvas id="props" width="512" height="256"></canvas><script>
    const crisp = context => { context.imageSmoothingEnabled = false; context.lineJoin = 'miter'; };
    function diamond(ctx, x, y, width, height, fill, stroke) { ctx.beginPath(); ctx.moveTo(x, y - height/2); ctx.lineTo(x + width/2, y); ctx.lineTo(x, y + height/2); ctx.lineTo(x - width/2, y); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); } }
    function drawAgent(ctx, x, y, role, direction, state) {
      const colors = {
        pm: { main:'#347fc9', dark:'#143b62', light:'#9fd0ff', accent:'#e85d4a' },
        developer: { main:'#2f9b63', dark:'#173f34', light:'#91dfae', accent:'#56c7d9' },
        tester: { main:'#e39a2f', dark:'#654012', light:'#ffe09a', accent:'#d85845' },
      }[role];
      const flip = direction === 'NW' || direction === 'SW' ? -1 : 1;
      const back = direction === 'NW' || direction === 'NE';
      const walking = state.startsWith('walk');
      const seated = state === 'sit' || state === 'work';
      const phase = state === 'walk2' ? -1 : 1;
      const bob = walking && state === 'walk2' ? 1 : 0;
      const torsoTop = (seated ? -28 : -32) + bob;
      const headTop = (seated ? -41 : -45) + bob;
      ctx.save(); ctx.translate(x + 16, y + 47); ctx.scale(flip, 1);
      ctx.fillStyle = 'rgba(18,35,40,.28)'; ctx.fillRect(-11, -3, 22, 2); ctx.fillRect(-7, -4, 14, 1);
      ctx.fillStyle = '#15252d';
      ctx.fillRect(-8 + (walking ? phase * 2 : 0), seated ? -13 : -11, 6, seated ? 11 : 13);
      ctx.fillRect(2 - (walking ? phase * 2 : 0), seated ? -13 : -11, 6, seated ? 11 : 13);
      ctx.fillStyle = '#253944';
      ctx.fillRect(-9 + (walking ? phase * 2 : 0), -3, 7, 3);
      ctx.fillRect(2 - (walking ? phase * 2 : 0), -3, 7, 3);
      ctx.fillStyle = colors.dark; ctx.fillRect(-10, torsoTop, 20, seated ? 16 : 22);
      ctx.fillStyle = colors.main; ctx.fillRect(-9, torsoTop + 3, 18, seated ? 13 : 17);
      ctx.fillStyle = colors.light; ctx.fillRect(-8, torsoTop + 4, 3, seated ? 10 : 13);
      ctx.fillStyle = '#e7a978';
      const armY = torsoTop + 5;
      ctx.fillRect(-13, armY, 4, state === 'work' ? 9 : 13);
      ctx.fillRect(9, armY, 4, state === 'work' ? 9 : 13);
      if (state === 'work') { ctx.fillRect(-15, armY + 8, 7, 3); ctx.fillRect(8, armY + 8, 7, 3); }
      if (role === 'pm') {
        ctx.fillStyle = '#f4f6ed'; ctx.fillRect(-5, torsoTop + 4, 10, 11);
        ctx.fillStyle = colors.accent; ctx.fillRect(0, torsoTop + 5, 2, 9);
        ctx.fillStyle = '#285a85'; ctx.fillRect(-14, torsoTop + 10, 5, 9);
        ctx.fillStyle = '#c5e6ff'; ctx.fillRect(-13, torsoTop + 11, 3, 5);
      }
      if (role === 'developer') {
        ctx.fillStyle = '#d8f4df'; ctx.fillRect(0, torsoTop + 4, 2, 14);
        ctx.fillStyle = colors.accent; ctx.fillRect(-7, torsoTop + 7, 4, 3);
        ctx.fillStyle = colors.dark; ctx.fillRect(-10, torsoTop - 1, 4, 5); ctx.fillRect(6, torsoTop - 1, 4, 5);
      }
      if (role === 'tester') {
        ctx.fillStyle = '#fff1bf'; ctx.fillRect(-5, torsoTop + 5, 10, 4);
        ctx.fillStyle = colors.accent; ctx.fillRect(4, torsoTop + 11, 4, 4);
        ctx.fillStyle = '#f6cf7a'; ctx.fillRect(-7, torsoTop + 12, 4, 3);
      }
      ctx.fillStyle = '#e7a978'; ctx.fillRect(-8, headTop + 4, 16, 13);
      ctx.fillStyle = '#f4c08b'; ctx.fillRect(-6, headTop + 6, 12, 10);
      ctx.fillStyle = '#162b34'; ctx.fillRect(-9, headTop + 1, 18, 6);
      ctx.fillRect(back ? -9 : -8, headTop + 6, back ? 18 : 4, 6);
      if (role === 'pm') {
        ctx.fillStyle = '#24557b'; ctx.fillRect(-11, headTop + 7, 3, 7);
        ctx.fillStyle = '#72b4ec'; ctx.fillRect(-11, headTop + 9, 2, 3);
      }
      if (role === 'developer') {
        ctx.fillStyle = '#173f34'; ctx.fillRect(-11, headTop + 7, 3, 7); ctx.fillRect(8, headTop + 7, 3, 7);
        ctx.fillStyle = '#56c7d9'; ctx.fillRect(-12, headTop + 9, 3, 4); ctx.fillRect(9, headTop + 9, 3, 4);
      }
      if (role === 'tester') {
        ctx.fillStyle = '#6a4216'; ctx.fillRect(-5, headTop - 3, 10, 5); ctx.fillRect(-3, headTop - 6, 7, 4);
        if (!back) { ctx.fillStyle = '#263a43'; ctx.fillRect(-6, headTop + 10, 5, 2); ctx.fillRect(2, headTop + 10, 5, 2); }
      }
      if (!back) { ctx.fillStyle = '#24343c'; ctx.fillRect(3, headTop + 9, 2, 2); }
      ctx.restore();
    }
    const agentCanvas = document.getElementById('agents'), agentCtx = agentCanvas.getContext('2d'); crisp(agentCtx);
    const roles = ['pm','developer','tester'], directions = ['NE','SE','SW','NW'], states = ['idle','walk1','walk2','sit','work'];
    const agentFrames = []; let frameIndex = 0;
    for (const role of roles) for (const direction of directions) for (const state of states) {
      const x = (frameIndex % 10) * 32, y = Math.floor(frameIndex / 10) * 48;
      drawAgent(agentCtx, x, y, role, direction, state); agentFrames.push({ id: role + '-' + state + '-' + direction, x, y, width:32, height:48, pivotX:16, pivotY:48, kind:'agent' }); frameIndex += 1;
    }
    const propCanvas = document.getElementById('props'), ctx = propCanvas.getContext('2d'); crisp(ctx);
    const propFrames = []; let propIndex = 0;
    function frame(id, draw, kind='propBack') { const x=(propIndex%8)*64, y=Math.floor(propIndex/8)*64; ctx.save(); ctx.translate(x,y); draw(ctx); ctx.restore(); propFrames.push({id,x,y,width:64,height:64,pivotX:32,pivotY:64,kind}); propIndex += 1; }
    frame('floor-mint', c => { diamond(c,32,48,64,32,'#b9ded5','#7faea5'); c.fillStyle='#d7eee7'; c.fillRect(30,33,3,2); c.fillRect(13,47,2,2); c.fillRect(47,47,2,2); }, 'tile');
    frame('floor-blue', c => { diamond(c,32,48,64,32,'#afd3dc','#779eaa'); c.fillStyle='#d8edf2'; c.fillRect(30,33,3,2); c.fillRect(13,47,2,2); c.fillRect(47,47,2,2); }, 'tile');
    frame('wall-nw', c => { c.fillStyle='#4d7779'; c.beginPath(); c.moveTo(0,29); c.lineTo(64,61); c.lineTo(64,42); c.lineTo(0,10); c.closePath(); c.fill(); c.fillStyle='#8fc1bc'; c.beginPath(); c.moveTo(0,10); c.lineTo(64,42); c.lineTo(64,47); c.lineTo(0,15); c.closePath(); c.fill(); c.strokeStyle='#31595d'; c.lineWidth=2; c.beginPath(); c.moveTo(0,29); c.lineTo(64,61); c.stroke(); }, 'propFront');
    frame('wall-ne', c => { c.fillStyle='#416d72'; c.beginPath(); c.moveTo(0,61); c.lineTo(64,29); c.lineTo(64,10); c.lineTo(0,42); c.closePath(); c.fill(); c.fillStyle='#86bbb7'; c.beginPath(); c.moveTo(0,42); c.lineTo(64,10); c.lineTo(64,15); c.lineTo(0,47); c.closePath(); c.fill(); c.strokeStyle='#31595d'; c.lineWidth=2; c.beginPath(); c.moveTo(0,61); c.lineTo(64,29); c.stroke(); }, 'propFront');
    frame('desk', c => { c.fillStyle='rgba(28,35,31,.24)'; c.fillRect(12,58,40,3); diamond(c,32,42,60,25,'#bd7540','#613923'); c.fillStyle='#e2a162'; c.fillRect(11,39,42,3); c.fillStyle='#744326'; c.fillRect(9,45,5,17); c.fillRect(50,45,5,17); c.fillStyle='#9c5b32'; c.fillRect(18,50,28,5); });
    frame('chair', c => { c.fillStyle='#17394e'; c.fillRect(21,25,24,21); c.fillStyle='#2d7897'; c.fillRect(23,27,20,16); c.fillStyle='#83bfd0'; c.fillRect(25,28,3,12); c.fillStyle='#163747'; c.fillRect(25,46,16,7); c.fillRect(20,53,5,9); c.fillRect(41,53,5,9); c.fillRect(28,59,10,4); }, 'propFront');
    frame('crt', c => { c.fillStyle='#172a33'; c.fillRect(14,15,38,31); c.fillStyle='#33505b'; c.fillRect(17,18,32,25); c.fillStyle='#6fc7d5'; c.fillRect(20,21,26,18); c.fillStyle='#d9fbff'; c.fillRect(23,24,18,2); c.fillStyle='#28768a'; c.fillRect(23,29,14,2); c.fillRect(23,34,19,2); c.fillStyle='#182930'; c.fillRect(29,45,8,7); c.fillRect(22,52,22,3); c.fillStyle='#e7b84c'; c.fillRect(46,42,2,2); });
    frame('meeting-table', c => { c.fillStyle='rgba(31,34,28,.24)'; c.fillRect(10,57,44,3); c.fillStyle='#71402a'; c.fillRect(28,32,8,28); diamond(c,32,29,62,34,'#bd7540','#613923'); c.fillStyle='#e4a361'; c.fillRect(11,27,42,3); c.fillStyle='#f2efe0'; c.fillRect(17,25,10,6); c.fillStyle='#4f8ead'; c.fillRect(38,31,8,5); c.fillStyle='#e4cf72'; c.fillRect(29,21,6,7); });
    frame('whiteboard', c => { c.fillStyle='#31585d'; c.fillRect(3,9,58,45); c.fillStyle='#f6f8ed'; c.fillRect(7,13,50,35); c.fillStyle='#e39a2f'; c.fillRect(12,19,10,3); c.fillStyle='#347fc9'; c.fillRect(12,26,35,3); c.fillStyle='#2f9b63'; c.fillRect(12,33,25,3); c.fillStyle='#d85845'; c.fillRect(12,40,17,3); c.fillStyle='#233f43'; c.fillRect(9,54,5,9); c.fillRect(50,54,5,9); });
    frame('boss-console', c => { c.fillStyle='#273e48'; c.fillRect(7,31,50,26); c.fillStyle='#3f6570'; c.fillRect(10,34,44,18); c.fillStyle='#65c4d3'; c.fillRect(12,16,18,18); c.fillRect(34,16,18,18); c.fillStyle='#d9f7fb'; c.fillRect(15,19,12,2); c.fillRect(37,19,12,2); c.fillStyle='#e7b54a'; c.fillRect(14,40,7,5); c.fillStyle='#2f9b63'; c.fillRect(25,40,7,5); });
    frame('coffee-counter', c => { c.fillStyle='#724229'; c.fillRect(6,31,52,28); c.fillStyle='#a96539'; c.fillRect(4,27,56,8); c.fillStyle='#df9c5a'; c.fillRect(7,28,50,3); c.fillStyle='#d9e5e2'; c.fillRect(13,15,14,13); c.fillStyle='#305b64'; c.fillRect(16,18,8,7); c.fillStyle='#f2efe3'; c.fillRect(39,20,7,8); c.fillStyle='#e39a2f'; c.fillRect(40,18,5,3); });
    frame('water-cooler', c => { c.fillStyle='#dbe9e6'; c.fillRect(21,28,23,31); c.fillStyle='#80cde1'; c.fillRect(23,8,19,24); c.fillStyle='#c8f2fa'; c.fillRect(26,11,13,10); c.fillStyle='#31585d'; c.fillRect(25,39,6,5); c.fillStyle='#d85845'; c.fillRect(34,39,5,5); c.fillStyle='#8aa6a5'; c.fillRect(24,54,17,5); });
    frame('plant', c => { c.fillStyle='#8f5031'; c.fillRect(23,43,18,15); c.fillStyle='#c57643'; c.fillRect(25,44,14,3); c.fillStyle='#246f4d'; c.fillRect(29,18,7,27); c.fillRect(16,23,18,8); c.fillRect(31,14,17,8); c.fillStyle='#42a66f'; c.fillRect(18,24,8,4); c.fillRect(37,16,8,4); }, 'propFront');
    frame('selection', c => { diamond(c,32,49,46,23,'rgba(110,216,82,.24)','#66c94d'); c.fillStyle='#d9ef52'; c.fillRect(30,36,4,4); }, 'effect');
    frame('error-target', c => { diamond(c,32,49,42,21,'rgba(229,69,65,.28)','#df4541'); c.strokeStyle='#df4541'; c.lineWidth=5; c.beginPath(); c.moveTo(24,24); c.lineTo(40,40); c.moveTo(40,24); c.lineTo(24,40); c.stroke(); }, 'effect');
    frame('path-dot', c => { diamond(c,32,49,14,7,'rgba(102,201,77,.62)','#4f9f3d'); }, 'effect');
    frame('door-open', c => { c.fillStyle='#2d555a'; c.fillRect(7,8,6,52); c.fillRect(51,8,6,52); c.fillStyle='#8fc1bc'; c.fillRect(13,8,38,6); c.fillStyle='#d9efdf'; c.fillRect(17,10,30,2); });
    window.result = { agents: agentCanvas.toDataURL('image/png'), props: propCanvas.toDataURL('image/png'), agentFrames, propFrames };
  </script></body></html>`;
}

function animationManifest(frames) {
  const activities = ['idle', 'walk', 'dock', 'sit', 'work', 'think', 'blocked'];
  return ['pm', 'developer', 'tester'].flatMap(role => ['NE', 'SE', 'SW', 'NW'].flatMap(direction => activities.map(activity => {
    const ids = activity === 'walk' ? [`${role}-walk1-${direction}`, `${role}-walk2-${direction}`]
      : activity === 'sit' || activity === 'work' || activity === 'dock' ? [`${role}-${activity === 'dock' ? 'idle' : activity}-${direction}`]
        : [`${role}-idle-${direction}`];
    return { id: `${role}-${activity}-${direction}`, role, activity, direction, frameIds: ids, fps: activity === 'walk' ? 8 : 4, loop: ['idle', 'walk', 'work', 'think'].includes(activity) };
  })));
}

async function main() {
  fs.mkdirSync(output, { recursive: true });
  fs.mkdirSync(fixtureOutput, { recursive: true });
  const runtimeModules = process.env.CODEX_NODE_MODULES || 'C:/Users/z00654528/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
  const { chromium } = require(require.resolve('playwright', { paths: [runtimeModules] }));
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  let generated;
  try {
    const page = await browser.newPage({ viewport: { width: 900, height: 620 } });
    await page.setContent(buildPage());
    generated = await page.evaluate(() => window.result);
  } finally {
    await browser.close();
  }
  const writeDataUrl = (name, value) => fs.writeFileSync(path.join(output, name), Buffer.from(value.split(',')[1], 'base64'));
  writeDataUrl('office-agents.v0.2.png', generated.agents);
  writeDataUrl('office-props.v0.2.png', generated.props);
  if (candidateOnly) {
    const manifest = {
      status: 'pending-independent-source-and-visual-review',
      command: 'node tests/generate_m1_design_assets.cjs --candidate-only',
      createdAt: new Date().toISOString(),
      source: 'Project-local Canvas primitives; no external image input',
      generatorSha256: sha256(__filename),
      topologyChanged: false,
      frameGeometryChanged: false,
      files: ['office-agents.v0.2.png', 'office-props.v0.2.png'].map(name => ({
        name, sha256: sha256(path.join(output, name)),
      })),
      agentFrames: generated.agentFrames,
      propFrames: generated.propFrames,
    };
    fs.writeFileSync(path.join(output, 'candidate-manifest.json'), JSON.stringify(manifest, null, 2));
    console.log(JSON.stringify({ status: manifest.status, output, files: manifest.files }, null, 2));
    return;
  }
  const map = createMap();
  fs.writeFileSync(path.join(output, 'office-map.v0.2.json'), JSON.stringify(map, null, 2));
  const agentsPath = path.join(output, 'office-agents.v0.2.png'), propsPath = path.join(output, 'office-props.v0.2.png');
  const manifest = {
    version: '0.2',
    rightsReview: { status: 'pending', reviewer: null, reviewedAt: null, distributionScope: 'Project runtime candidate; packaging blocked pending independent source audit' },
    atlases: [
      { id: 'agents', image: '/assets/office/office-agents.v0.2.png', sha256: sha256(agentsPath), width: 320, height: 288, source: 'tests/generate_m1_design_assets.cjs canvas primitives; no imported bitmap or game asset', author: 'ThemeTeam project generator', license: 'Project-local original candidate; independent approval pending', frames: generated.agentFrames },
      { id: 'props', image: '/assets/office/office-props.v0.2.png', sha256: sha256(propsPath), width: 512, height: 256, source: 'tests/generate_m1_design_assets.cjs canvas primitives; no imported bitmap or game asset', author: 'ThemeTeam project generator', license: 'Project-local original candidate; independent approval pending', frames: generated.propFrames }
    ],
    animations: animationManifest(generated.agentFrames),
    fallbacks: { unknownRole: 'developer-idle-SE', unknownActivity: 'developer-idle-SE', missingFrame: 'selection' }
  };
  fs.writeFileSync(path.join(output, 'office-assets.v0.2.json'), JSON.stringify(manifest, null, 2));
  const oracle = {
    version: '0.2', mapRevision: map.mapRevision, sourceMap: '/assets/office/office-map.v0.2.json',
    topology: { neighborMode: 'four', diagonals: false, connectedRoomKeys: ['boss', 'work', 'meeting', 'coffee'], mandatoryDoors: map.doors.map(door => ({ id: door.id, cell: door.cell })) },
    cases: [
      { id: 'straight-work', start: cell(1, 11), target: cell(15, 14), expectation: 'reachable' },
      { id: 'boss-through-door', start: cell(1, 11), target: cell(5, 5), expectation: 'reachable', mustVisit: [cell(6, 9)] },
      { id: 'meeting-through-door', start: cell(21, 11), target: cell(24, 6), expectation: 'reachable', mustVisit: [cell(24, 9)] },
      { id: 'blocked-wall', start: cell(1, 11), target: cell(10, 9), expectation: 'unreachable-target-cell' },
      { id: 'occupied-desk', start: cell(1, 11), target: map.anchors[0].footprint[0], expectation: 'unreachable-target-cell' }
    ],
    syntheticUniqueDoor: {
      dimensions: { columns: 9, rows: 7 },
      collision: ['111111111', '100010001', '100010001', '100000001', '100010001', '100010001', '111111111'],
      door: cell(4, 3),
      cases: [
        { id: 'straight', start: cell(1, 3), target: cell(7, 3), expectation: 'reachable', requiredDoor: cell(4, 3) },
        { id: 'l-route', start: cell(1, 1), target: cell(7, 5), expectation: 'reachable', requiredDoor: cell(4, 3) },
        { id: 'blocked-end', start: cell(1, 1), target: cell(4, 1), expectation: 'unreachable-target-cell' },
        { id: 'closed-door', start: cell(1, 1), target: cell(7, 1), expectation: 'unreachable-when-door-closed', requiredDoor: cell(4, 3) }
      ]
    }
  };
  fs.writeFileSync(path.join(fixtureOutput, 'collision-oracle.v0.2.json'), JSON.stringify(oracle, null, 2));
  const files = [
    'frontend/public/assets/office/office-agents.v0.2.png',
    'frontend/public/assets/office/office-props.v0.2.png',
    'frontend/public/assets/office/office-map.v0.2.json',
    'frontend/public/assets/office/office-assets.v0.2.json',
    'frontend/tests/fixtures/m1/collision-oracle.v0.2.json',
    'tests/generate_m1_design_assets.cjs'
  ].map(file => ({ path: file, bytes: fs.statSync(path.join(root, file)).size, sha256: sha256(path.join(root, file)) }));
  assert.equal(map.anchors.filter(item => item.kind === 'workSeat').length, 8);
  assert.equal(map.anchors.filter(item => item.kind === 'meetingSeat').length, 6);
  assert.equal(new Set(map.spawns.map(keyOf)).size, 20);
  const report = { result: 'passed', date: new Date().toISOString(), command: 'node tests/generate_m1_design_assets.cjs', cwd: root, runtime: process.version, exitCode: 0,
    map: { revision: map.mapRevision, dimensions: map.dimensions, workSeats: 8, meetingSeats: 6, spawns: 20 }, atlases: { agentFrames: generated.agentFrames.length, propFrames: generated.propFrames.length, animations: manifest.animations.length }, files,
    scope: 'Deterministic original design/runtime candidate assets and collision oracle; not Phaser runtime, rights approval, visual acceptance or M1 completion.' };
  const serialized = JSON.stringify(report, null, 2);
  fs.writeFileSync(path.join(evidence, 'm1-design-assets.json'), serialized);
  fs.writeFileSync(path.join(evidence, 'm1-design-assets.log'), `${serialized}\n`);
  console.log(serialized);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
