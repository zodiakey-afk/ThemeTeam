const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Ajv = require(require.resolve('ajv', { paths: [path.resolve(__dirname, '../frontend/node_modules')] }));

const root = path.resolve(__dirname, '..');
const contracts = path.join(root, '.ai-spec/iterations/ITER-2026-001/02-design/contracts');
const read = name => JSON.parse(fs.readFileSync(path.join(contracts, name), 'utf8'));
const readRootJson = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const ajv = new Ajv({ strict: true, allErrors: true, formats: { 'date-time': true } });
ajv.addKeyword({ keyword: 'x-semanticChecks', schemaType: 'array', valid: true });
ajv.addKeyword({ keyword: 'x-transitionTable', schemaType: 'array', valid: true });
ajv.addKeyword({ keyword: 'x-isolation', schemaType: 'string', valid: true });
const main = read('m1-v0.4.json');
const mapValidate = ajv.compile(read('m1-map-v0.3.schema.json'));
const assetValidate = ajv.compile(read('m1-assets-v0.3.schema.json'));
const intentValidate = ajv.compile(main.intentSchema);
const navigationValidate = ajv.compile(main.navigationTransition);

const cell = (col, row) => ({ col, row });
const workCells = Array.from({ length: 20 }, (_, i) => [cell(2 + i, 5), cell(2 + i, 6)]).flat();
const meetingCells = Array.from({ length: 6 }, (_, i) => [cell(24 + i, 5), cell(24 + i, 6)]).flat();
const map = {
  version: '0.3', mapRevision: 'office-v0.3-r1', dimensions: { columns: 32, rows: 24, tileWidth: 64, tileHeight: 32 }, origin: { x: 1024, y: 48 },
  roomBindings: [
    { key: 'boss', roomId: 'room_boss', roomType: 'boss', movementEnabled: true, cells: [cell(1, 1)] },
    { key: 'work', roomId: 'room_work', roomType: 'work', movementEnabled: true, cells: workCells },
    { key: 'meeting', roomId: 'room_meeting', roomType: 'meeting', movementEnabled: true, cells: meetingCells },
    { key: 'coffee', roomId: 'room_coffee', roomType: 'coffee', movementEnabled: true, cells: [cell(4, 1)] }
  ],
  collision: Array(24).fill('0'.repeat(32)),
  doors: [{ id: 'door-boss', cell: cell(3, 3), roomKeys: ['boss', 'work'], open: true }],
  anchors: [
    ...Array.from({ length: 20 }, (_, i) => ({ id: `work-${i + 1}`, kind: 'workSeat', roomKey: 'work', stand: cell(2 + i, 6), approach: cell(2 + i, 6), sit: { worldX: 300 + i * 32, worldY: 260 }, facing: 'NE', footprint: [cell(2 + i, 5)] })),
    ...Array.from({ length: 6 }, (_, i) => ({ id: `meeting-${i + 1}`, kind: 'meetingSeat', roomKey: 'meeting', stand: cell(24 + i, 6), approach: cell(24 + i, 6), sit: { worldX: 800 + i * 32, worldY: 320 }, facing: 'SW', footprint: [cell(24 + i, 5)] }))
  ],
  props: Array.from({ length: 43 }, (_, i) => ({ id: `prop-${i + 1}`, frameId: 'prop-fallback', cell: cell(1 + (i % 30), 1 + Math.floor(i / 30)), layer: i % 2 ? 'propsFront' : 'propsBack', depthOffset: 0 })),
  spawns: Array.from({ length: 20 }, (_, i) => cell(1 + i, 12)),
  renderLayers: ['ground', 'propsBack', 'dynamic', 'propsFront', 'effects']
};
const frame = (id, x) => ({ id, x, y: 0, width: 32, height: 48, pivotX: 16, pivotY: 48, kind: 'agent' });
const roles = ['pm', 'developer', 'tester'];
const directions = ['NE', 'SE', 'SW', 'NW'];
const requiredAnimations = roles.flatMap(role => [
  ...['idle', 'walk'].flatMap(activity => directions.map(direction => ({ role, activity, direction }))),
  ...['dock', 'sit', 'work'].map(activity => ({ role, activity, direction: 'NE' }))
]);
const assets = {
  version: '0.3', rightsReview: { status: 'pending', reviewer: null, reviewedAt: null, distributionScope: 'local design fixture only' },
  atlases: [
    { id: 'agents', image: '/assets/office/agents.png', sha256: 'a'.repeat(64), width: 256, height: 64, source: 'fixture', author: 'ThemeTeam fixture generator', license: 'fixture only', frames: Array.from({ length: 8 }, (_, i) => frame(`agent-${i}`, i * 32)) },
    { id: 'props', image: '/assets/office/props.png', sha256: 'b'.repeat(64), width: 64, height: 64, source: 'fixture', author: 'ThemeTeam fixture generator', license: 'fixture only', frames: [{ ...frame('prop-fallback', 0), kind: 'propBack' }] }
  ],
  animations: requiredAnimations.map((item, i) => ({ id: `animation-${i}`, ...item, frameIds: [`agent-${i % 8}`], fps: 8, loop: ['idle', 'walk', 'work'].includes(item.activity) })),
  fallbacks: { unknownRole: 'animation-0', unknownActivity: 'animation-0', missingFrame: 'prop-fallback' }
};

const keyOf = value => `${value.col},${value.row}`;
const duplicates = values => values.length !== new Set(values).size;
function mapSemanticErrors(value) {
  const errors = [];
  const roomKeys = value.roomBindings.map(room => room.key);
  const roomIds = value.roomBindings.map(room => room.roomId);
  const doorIds = value.doors.map(door => door.id), anchorIds = value.anchors.map(anchor => anchor.id), propIds = value.props.map(prop => prop.id);
  if (duplicates(roomKeys) || new Set(roomKeys).size !== 4) errors.push('room keys must occur exactly once');
  if (duplicates(roomIds)) errors.push('room ids must occur exactly once');
  if (duplicates(doorIds) || duplicates(anchorIds) || duplicates(propIds)) errors.push('door, anchor and prop ids must be unique');
  if (value.anchors.filter(anchor => anchor.kind === 'workSeat').length !== 20 || value.anchors.filter(anchor => anchor.kind === 'meetingSeat').length !== 6) errors.push('anchor counts must be 20/6');
  const walkable = candidate => value.collision[candidate.row][candidate.col] === '0' && !value.doors.some(door => !door.open && keyOf(door.cell) === keyOf(candidate));
  const roomCells = new Map(value.roomBindings.map(room => [room.key, new Set(room.cells.map(keyOf))]));
  const footprintKeys = value.anchors.flatMap(anchor => anchor.footprint.map(keyOf));
  if (duplicates(footprintKeys)) errors.push('anchor footprints overlap');
  for (const door of value.doors) {
    if (!door.roomKeys.every(key => roomCells.has(key))) errors.push(`door ${door.id} references missing room`);
    if (door.open && !walkable(door.cell)) errors.push(`open door ${door.id} is not walkable`);
  }
  for (const anchor of value.anchors) {
    if (!walkable(anchor.stand)) errors.push(`anchor ${anchor.id} stand is not walkable`);
    if (!walkable(anchor.approach)) errors.push(`anchor ${anchor.id} approach is not walkable`);
    const cells = roomCells.get(anchor.roomKey);
    if (!cells || !cells.has(keyOf(anchor.stand)) || !cells.has(keyOf(anchor.approach)) || !anchor.footprint.every(item => cells.has(keyOf(item)))) errors.push(`anchor ${anchor.id} is outside room binding`);
    if (Math.abs(anchor.stand.col - anchor.approach.col) + Math.abs(anchor.stand.row - anchor.approach.row) > 1) errors.push(`anchor ${anchor.id} stand is not adjacent to approach`);
    if (![anchor.sit.worldX, anchor.sit.worldY].every(Number.isFinite)) errors.push(`anchor ${anchor.id} sit is not finite`);
  }
  const spawnKeys = value.spawns.map(keyOf);
  if (duplicates(spawnKeys) || value.spawns.some(item => !walkable(item)) || spawnKeys.some(item => footprintKeys.includes(item))) errors.push('spawns must be unique walkable non-footprint cells');
  const reached = new Set(), queue = value.spawns.filter(walkable);
  for (const item of queue) reached.add(keyOf(item));
  for (let index = 0; index < queue.length; index++) {
    const current = queue[index];
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = { col: current.col + dc, row: current.row + dr };
      if (next.col < 0 || next.col >= 32 || next.row < 0 || next.row >= 24 || !walkable(next) || reached.has(keyOf(next))) continue;
      reached.add(keyOf(next)); queue.push(next);
    }
  }
  for (const anchor of value.anchors) if (!reached.has(keyOf(anchor.stand)) || !reached.has(keyOf(anchor.approach))) errors.push(`anchor ${anchor.id} is unreachable`);
  return [...new Set(errors)];
}
function assetSemanticErrors(value, packaging = false) {
  const errors = [];
  const atlasIds = value.atlases.map(atlas => atlas.id), frames = value.atlases.flatMap(atlas => atlas.frames), frameIds = frames.map(frame => frame.id), animationIds = value.animations.map(animation => animation.id);
  if (duplicates(atlasIds) || duplicates(frameIds) || duplicates(animationIds)) errors.push('atlas/frame/animation ids must be unique');
  for (const atlas of value.atlases) for (const item of atlas.frames) {
    if (item.x + item.width > atlas.width || item.y + item.height > atlas.height) errors.push(`frame ${item.id} exceeds atlas bounds`);
    if (item.pivotX > item.width || item.pivotY > item.height) errors.push(`frame ${item.id} pivot exceeds frame`);
  }
  const frameById = new Map(frames.map(item => [item.id, item]));
  for (const animation of value.animations) for (const id of animation.frameIds) {
    if (!frameById.has(id) || frameById.get(id).kind !== 'agent') errors.push(`animation ${animation.id} has invalid agent frame`);
  }
  for (const role of roles) {
    for (const activity of ['idle', 'walk']) for (const direction of directions) if (!value.animations.some(item => item.role === role && item.activity === activity && item.direction === direction)) errors.push(`${role}/${activity}/${direction} missing`);
    for (const activity of ['dock', 'sit', 'work']) if (!value.animations.some(item => item.role === role && item.activity === activity)) errors.push(`${role}/${activity} fallback missing`);
  }
  if (!['unknownRole', 'unknownActivity'].every(key => animationIds.includes(value.fallbacks[key])) || !frameIds.includes(value.fallbacks.missingFrame)) errors.push('fallback references do not resolve');
  if (packaging && value.rightsReview.status !== 'approved') errors.push('rights review must be approved for packaging');
  return [...new Set(errors)];
}
function crossAssetErrors(mapValue, assetValue) {
  const frameIds = new Set(assetValue.atlases.flatMap(atlas => atlas.frames.map(frame => frame.id)));
  return mapValue.props.filter(prop => !frameIds.has(prop.frameId)).map(prop => `prop ${prop.id} frame ${prop.frameId} does not resolve`);
}

assert.equal(mapValidate(map), true, JSON.stringify(mapValidate.errors));
assert.equal(assetValidate(assets), true, JSON.stringify(assetValidate.errors));
const actualMap = readRootJson('frontend/public/assets/office/office-map.v0.3.json');
const actualAssets = readRootJson('frontend/public/assets/office/office-assets.v0.3.json');
assert.equal(mapValidate(actualMap), true, JSON.stringify(mapValidate.errors));
assert.equal(assetValidate(actualAssets), true, JSON.stringify(assetValidate.errors));
const intent = { type: 'demo-move', agentId: 'agent_dev', anchorId: 'work-1', mapRevision: map.mapRevision };
const navigation = { sequence: 1, reason: 'select-different', from: { kind: 'task', id: 'task-1' }, to: { kind: 'agent', id: 'agent_dev' }, cameraAction: 'capture' };
assert.equal(intentValidate(intent), true, JSON.stringify(intentValidate.errors));
assert.equal(navigationValidate(navigation), true, JSON.stringify(navigationValidate.errors));
assert.equal(main.compatibility.adapterUpdate, 'update(snapshot: Snapshot|null, selection: Selection|null): void');
assert.deepEqual(main.motion.tokens, ['rootGeneration', 'motionId', 'mapRevision']);
assert.deepEqual(mapSemanticErrors(map), []);
assert.deepEqual(assetSemanticErrors(assets), []);
assert.deepEqual(mapSemanticErrors(actualMap), []);
assert.deepEqual(assetSemanticErrors(actualAssets), []);
assert.deepEqual(crossAssetErrors(actualMap, actualAssets), []);
assert.deepEqual(assetSemanticErrors(assets, true), ['rights review must be approved for packaging']);
assert.deepEqual(assetSemanticErrors(actualAssets, true), []);
for (const mutate of [
  value => { value.dimensions.tileHeight = 64; }, value => { value.collision.pop(); }, value => { value.anchors[0].approach.col = 32; },
  value => { value.renderLayers.reverse(); }, value => { delete value.mapRevision; }, value => { delete value.roomBindings[0].roomId; },
  value => { delete value.anchors[0].stand; }
]) {
  const bad = structuredClone(map); mutate(bad); assert.equal(mapValidate(bad), false);
}
for (const mutate of [
  value => { value.atlases[0].image = 'https://example.invalid/a.png'; }, value => { value.atlases[0].image = '/assets/office/../secret.png'; }, value => { value.atlases[0].sha256 = 'not-a-hash'; },
  value => { value.animations[0].fps = 0; }, value => { value.rightsReview.status = 'unknown'; }
]) {
  const bad = structuredClone(assets); mutate(bad); assert.equal(assetValidate(bad), false);
}
for (const [validate, value] of [
  [intentValidate, { type: 'demo-move', agentId: 'agent_dev', anchorId: 'work-1' }],
  [intentValidate, { type: 'zoom', zoom: 3 }],
  [navigationValidate, { ...navigation, sequence: 0 }],
  [navigationValidate, { ...navigation, reason: 'teleport' }]
]) assert.equal(validate(value), false);
const semanticCases = [
  [mapSemanticErrors, value => { value.roomBindings[1].key = 'boss'; }],
  [mapSemanticErrors, value => { value.roomBindings[1].roomId = value.roomBindings[0].roomId; }],
  [mapSemanticErrors, value => { value.anchors.pop(); }],
  [mapSemanticErrors, value => { value.anchors[1].footprint = value.anchors[0].footprint; }],
  [mapSemanticErrors, value => { const row = value.anchors[0].approach.row; const col = value.anchors[0].approach.col; value.collision[row] = value.collision[row].slice(0, col) + '1' + value.collision[row].slice(col + 1); }],
  [mapSemanticErrors, value => { value.anchors[0].stand = cell(9, 6); }],
  [mapSemanticErrors, value => { value.roomBindings[1].cells = value.roomBindings[1].cells.filter(item => keyOf(item) !== keyOf(value.anchors[0].approach)); }],
  [assetSemanticErrors, value => { value.atlases[1].frames[0].id = value.atlases[0].frames[0].id; }],
  [assetSemanticErrors, value => { value.atlases[0].frames[0].x = 250; }],
  [assetSemanticErrors, value => { value.animations = value.animations.filter(item => !(item.role === 'pm' && item.activity === 'walk' && item.direction === 'NE')); }],
  [assetSemanticErrors, value => { value.animations[0].frameIds = ['prop-fallback']; }],
  [assetSemanticErrors, value => { value.fallbacks.unknownRole = 'missing'; }]
];
for (const [validate, mutate] of semanticCases) {
  const value = structuredClone(validate === mapSemanticErrors ? map : assets); mutate(value); assert.ok(validate(value).length > 0);
}
const badCrossMap = structuredClone(actualMap);
badCrossMap.props[0].frameId = 'missing-frame';
assert.ok(crossAssetErrors(badCrossMap, actualAssets).length > 0);
const hashes = ['m1-v0.4.json', 'm1-map-v0.3.schema.json', 'm1-assets-v0.3.schema.json'].map(name => ({ name, sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(contracts, name))).digest('hex') }));
const report = { result: 'passed', date: new Date().toISOString(), command: 'node tests/m1_contracts.cjs', cwd: root, runtime: process.version,
  exitCode: 0, log: 'docs/evidence/m1-contracts.log',
  structural: { accepted: 6, rejected: 16 }, semantic: { accepted: 6, rejected: semanticCases.length + 1, packagingBlockedWithoutRightsApproval: true, runtimeCandidateApprovedForPackaging: true },
  runtimeCandidates: {
    map: { path: 'frontend/public/assets/office/office-map.v0.3.json', sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'frontend/public/assets/office/office-map.v0.3.json'))).digest('hex') },
    assets: { path: 'frontend/public/assets/office/office-assets.v0.3.json', sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'frontend/public/assets/office/office-assets.v0.3.json'))).digest('hex') },
    oracle: { path: 'frontend/tests/fixtures/m1/collision-oracle.v0.3.json', sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'frontend/tests/fixtures/m1/collision-oracle.v0.3.json'))).digest('hex') }
  }, hashes,
  scope: 'Design-contract and candidate map/atlas-manifest validation only; PNG pixel quality, full Phaser runtime, performance and M1 acceptance are separate.' };
const serialized = JSON.stringify(report, null, 2);
fs.writeFileSync(path.join(root, 'docs/evidence/m1-contracts.json'), serialized);
fs.writeFileSync(path.join(root, 'docs/evidence/m1-contracts.log'), `${serialized}\n`);
console.log(`M1 v0.4 contract with v0.3 map/assets: 6 structural and 6 semantic fixtures accepted, ${17 + semanticCases.length} malformed cases rejected; unapproved fixture blocked and approved runtime candidate accepted.`);
