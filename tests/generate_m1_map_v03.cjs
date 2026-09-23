const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const mapPath = path.join(root, 'frontend/public/assets/office/office-map.v0.3.json');
const oraclePath = path.join(root, 'frontend/tests/fixtures/m1/collision-oracle.v0.3.json');
const evidencePath = path.join(root, 'docs/evidence/m1-map-v03-generation.json');
const cell = (col, row) => ({ col, row });
const keyOf = value => `${value.col},${value.row}`;
const project = value => ({ x: 1024 + (value.col - value.row) * 32, y: 96 + (value.col + value.row) * 16 });
const rectangleCells = (fromCol, toCol, fromRow, toRow) => {
  const cells = [];
  for (let row = fromRow; row <= toRow; row += 1) {
    for (let col = fromCol; col <= toCol; col += 1) cells.push(cell(col, row));
  }
  return cells;
};
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function createMap() {
  const grid = Array.from({ length: 24 }, () => Array(32).fill(0));
  for (let col = 0; col < 32; col += 1) grid[0][col] = grid[23][col] = 1;
  for (let row = 0; row < 24; row += 1) grid[row][0] = grid[row][31] = 1;
  for (let col = 1; col < 31; col += 1) grid[7][col] = 1;
  for (let row = 1; row <= 6; row += 1) grid[row][11] = 1;
  for (let row = 8; row <= 22; row += 1) grid[row][25] = 1;

  const doors = [
    { id: 'door-boss-meeting', cell: cell(11, 4), roomKeys: ['boss', 'meeting'], open: true },
    { id: 'door-boss-work', cell: cell(6, 7), roomKeys: ['boss', 'work'], open: true },
    { id: 'door-meeting-coffee', cell: cell(28, 7), roomKeys: ['meeting', 'coffee'], open: true },
    { id: 'door-work-coffee', cell: cell(25, 16), roomKeys: ['work', 'coffee'], open: true },
  ];
  for (const door of doors) grid[door.cell.row][door.cell.col] = 0;

  const workColumns = [3, 7, 11, 15, 19];
  const workRows = [11, 14, 17, 20];
  const workAnchors = workRows.flatMap((row, rowIndex) => workColumns.map((col, colIndex) => {
    const footprint = cell(col, row - 1);
    const sit = project(footprint);
    return {
      id: `work-${rowIndex * workColumns.length + colIndex + 1}`,
      kind: 'workSeat', roomKey: 'work', stand: cell(col, row), approach: cell(col, row),
      sit: { worldX: sit.x, worldY: sit.y - 18 }, facing: 'NE', footprint: [footprint],
    };
  }));
  const meetingAnchors = [15, 18, 21, 24, 27, 29].map((col, index) => {
    const footprint = cell(col, 4);
    const sit = project(footprint);
    return {
      id: `meeting-${index + 1}`, kind: 'meetingSeat', roomKey: 'meeting', stand: cell(col, 6), approach: cell(col, 6),
      sit: { worldX: sit.x, worldY: sit.y - 12 }, facing: index < 3 ? 'SW' : 'NE', footprint: [footprint],
    };
  });
  const anchors = [...workAnchors, ...meetingAnchors];
  for (const anchor of anchors) for (const footprint of anchor.footprint) grid[footprint.row][footprint.col] = 1;

  const props = [];
  for (const anchor of workAnchors) {
    props.push({ id: `${anchor.id}-desk`, frameId: 'desk', cell: anchor.footprint[0], layer: 'propsBack', depthOffset: -8 });
    props.push({ id: `${anchor.id}-chair`, frameId: 'chair', cell: anchor.approach, layer: 'propsFront', depthOffset: 8 });
    props.push({ id: `${anchor.id}-crt`, frameId: 'crt', cell: anchor.footprint[0], layer: 'propsBack', depthOffset: 4 });
  }
  props.push(
    { id: 'meeting-table', frameId: 'meeting-table', cell: cell(23, 3), layer: 'propsBack', depthOffset: 0 },
    { id: 'meeting-whiteboard', frameId: 'whiteboard', cell: cell(29, 2), layer: 'propsBack', depthOffset: -16 },
    { id: 'boss-console', frameId: 'boss-console', cell: cell(5, 3), layer: 'propsBack', depthOffset: 0 },
    { id: 'coffee-counter', frameId: 'coffee-counter', cell: cell(28, 13), layer: 'propsBack', depthOffset: 0 },
    { id: 'water-cooler', frameId: 'water-cooler', cell: cell(29, 18), layer: 'propsBack', depthOffset: 0 },
    { id: 'boss-plant', frameId: 'plant', cell: cell(2, 2), layer: 'propsFront', depthOffset: 0 },
    { id: 'coffee-plant', frameId: 'plant', cell: cell(27, 20), layer: 'propsFront', depthOffset: 0 },
  );

  return {
    version: '0.3', mapRevision: 'office-v0.3-r1',
    dimensions: { columns: 32, rows: 24, tileWidth: 64, tileHeight: 32 }, origin: { x: 1024, y: 96 },
    roomBindings: [
      { key: 'boss', roomId: 'room_boss', roomType: 'boss', movementEnabled: true, cells: rectangleCells(1, 10, 1, 6) },
      { key: 'meeting', roomId: 'room_meeting', roomType: 'meeting', movementEnabled: true, cells: rectangleCells(12, 30, 1, 6) },
      { key: 'work', roomId: 'room_work', roomType: 'work', movementEnabled: true, cells: rectangleCells(1, 24, 8, 22) },
      { key: 'coffee', roomId: 'room_coffee', roomType: 'coffee', movementEnabled: true, cells: rectangleCells(26, 30, 8, 22) },
    ],
    collision: grid.map(row => row.join('')), doors, anchors, props,
    spawns: workAnchors.map(anchor => ({ ...anchor.approach })),
    renderLayers: ['ground', 'propsBack', 'dynamic', 'propsFront', 'effects'],
  };
}

const map = createMap();
const workAnchors = map.anchors.filter(anchor => anchor.kind === 'workSeat');
const meetingAnchors = map.anchors.filter(anchor => anchor.kind === 'meetingSeat');
assert.equal(workAnchors.length, 20);
assert.equal(meetingAnchors.length, 6);
assert.equal(new Set(map.spawns.map(keyOf)).size, 20);
for (const anchor of map.anchors) {
  assert.equal(map.collision[anchor.approach.row][anchor.approach.col], '0');
  assert.equal(map.collision[anchor.footprint[0].row][anchor.footprint[0].col], '1');
}

const oracle = {
  version: '0.3', mapRevision: map.mapRevision, sourceMap: '/assets/office/office-map.v0.3.json',
  topology: { neighborMode: 'four', diagonals: false, connectedRoomKeys: ['boss', 'work', 'meeting', 'coffee'], mandatoryDoors: map.doors.map(door => ({ id: door.id, cell: door.cell })) },
  cases: [
    { id: 'straight-work', start: cell(3, 11), target: cell(19, 20), expectation: 'reachable' },
    { id: 'boss-through-door', start: cell(3, 11), target: cell(5, 5), expectation: 'reachable', mustVisit: [cell(6, 7)] },
    { id: 'meeting-through-door', start: cell(19, 20), target: cell(24, 6), expectation: 'reachable', mustVisit: [cell(28, 7)] },
    { id: 'blocked-wall', start: cell(3, 11), target: cell(10, 7), expectation: 'unreachable-target-cell' },
    { id: 'occupied-desk', start: cell(3, 11), target: workAnchors[0].footprint[0], expectation: 'unreachable-target-cell' },
  ],
  syntheticUniqueDoor: {
    dimensions: { columns: 9, rows: 7 },
    collision: ['111111111', '100010001', '100010001', '100000001', '100010001', '100010001', '111111111'],
    door: cell(4, 3),
    cases: [
      { id: 'straight', start: cell(1, 3), target: cell(7, 3), expectation: 'reachable', requiredDoor: cell(4, 3) },
      { id: 'l-route', start: cell(1, 1), target: cell(7, 5), expectation: 'reachable', requiredDoor: cell(4, 3) },
      { id: 'blocked-end', start: cell(1, 1), target: cell(4, 1), expectation: 'unreachable-target-cell' },
      { id: 'closed-door', start: cell(1, 1), target: cell(7, 1), expectation: 'unreachable-when-door-closed', requiredDoor: cell(4, 3) },
    ],
  },
};

fs.writeFileSync(mapPath, `${JSON.stringify(map, null, 2)}\n`);
fs.writeFileSync(oraclePath, `${JSON.stringify(oracle, null, 2)}\n`);
const report = {
  result: 'passed', date: new Date().toISOString(), command: 'node tests/generate_m1_map_v03.cjs', cwd: root,
  map: { path: path.relative(root, mapPath), sha256: sha256(mapPath), revision: map.mapRevision, workSeats: 20, meetingSeats: 6, spawns: 20 },
  oracle: { path: path.relative(root, oraclePath), sha256: sha256(oraclePath) },
  roomCells: Object.fromEntries(map.roomBindings.map(room => [room.key, room.cells.length])),
};
fs.writeFileSync(evidencePath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
