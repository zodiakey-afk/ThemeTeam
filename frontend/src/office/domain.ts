import type { Facing, GridPoint, OfficeAssets, OfficeMap, WorldPoint } from './types';

const SHA256 = /^[a-f0-9]{64}$/;
const LOCAL_ASSET = /^\/assets\/office\/[A-Za-z0-9._-]+$/;
const finite = (value: number) => Number.isFinite(value);
const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const cellKey = (cell: GridPoint) => `${cell.col},${cell.row}`;

export function projectGrid(point: GridPoint, map: Pick<OfficeMap, 'dimensions' | 'origin'>) {
  const { tileWidth, tileHeight } = map.dimensions;
  return {
    x: map.origin.x + (point.col - point.row) * tileWidth / 2,
    y: map.origin.y + (point.col + point.row) * tileHeight / 2,
  };
}

export function unprojectWorld(point: { x: number; y: number }, map: Pick<OfficeMap, 'dimensions' | 'origin'>) {
  const x = (point.x - map.origin.x) / (map.dimensions.tileWidth / 2);
  const y = (point.y - map.origin.y) / (map.dimensions.tileHeight / 2);
  return { col: (x + y) / 2, row: (y - x) / 2 };
}

export function facingForStep(from: GridPoint, to: GridPoint): Facing {
  const dc = to.col - from.col;
  const dr = to.row - from.row;
  if (Math.abs(dc) + Math.abs(dr) !== 1) throw new Error('办公室移动必须是四邻接单步');
  return dc > 0 ? 'SE' : dc < 0 ? 'NW' : dr > 0 ? 'SW' : 'NE';
}

export interface MotionOccupant {
  id: string;
  cell: GridPoint;
  phase: string;
  segmentFrom: GridPoint;
  segmentTo: GridPoint;
}

export function canEnterGridCell(agentId: string, from: GridPoint, to: GridPoint, occupants: Iterable<MotionOccupant>) {
  if (Math.abs(to.col - from.col) + Math.abs(to.row - from.row) !== 1) return false;
  for (const other of occupants) {
    if (other.id === agentId) continue;
    if (other.cell.col === to.col && other.cell.row === to.row) return false;
    if ((other.phase === 'walking' || other.phase === 'waiting') &&
        other.segmentTo.col === to.col && other.segmentTo.row === to.row) return false;
    if ((other.phase === 'walking' || other.phase === 'waiting') &&
        other.segmentFrom.col === to.col && other.segmentFrom.row === to.row &&
        other.segmentTo.col === from.col && other.segmentTo.row === from.row) return false;
  }
  return true;
}
function validCell(point: GridPoint, map: OfficeMap) {
  return Number.isInteger(point?.col) && Number.isInteger(point?.row) && point.col >= 0 && point.row >= 0 &&
    point.col < map.dimensions.columns && point.row < map.dimensions.rows;
}

export function validateOfficeMap(value: unknown): OfficeMap {
  const map = value as OfficeMap;
  const layers = ['ground', 'propsBack', 'dynamic', 'propsFront', 'effects'];
  if (!map || map.version !== '0.3' || !ID.test(map.mapRevision) ||
      map.dimensions?.columns !== 32 || map.dimensions?.rows !== 24 || map.dimensions.tileWidth !== 64 || map.dimensions.tileHeight !== 32 ||
      !finite(map.origin?.x) || !finite(map.origin?.y) || !Array.isArray(map.collision) ||
      map.collision.length !== map.dimensions.rows || map.collision.some(row => typeof row !== 'string' || !/^[01]{32}$/.test(row)) ||
      !Array.isArray(map.roomBindings) || map.roomBindings.length !== 4 || !Array.isArray(map.doors) || map.doors.length < 1 ||
      !Array.isArray(map.anchors) || map.anchors.length !== 26 || !Array.isArray(map.props) || map.props.length < 43 ||
      !Array.isArray(map.spawns) || map.spawns.length !== 20 || !Array.isArray(map.renderLayers) ||
      map.renderLayers.length !== layers.length || map.renderLayers.some((layer, index) => layer !== layers[index])) {
    throw new Error('办公室地图结构无效');
  }

  const requiredRooms = new Set(['boss', 'work', 'meeting', 'coffee']);
  const roomKeys = new Set<string>();
  const roomIds = new Set<string>();
  const roomCells = new Map<string, Set<string>>();
  for (const room of map.roomBindings) {
    if (!requiredRooms.has(room?.key) || roomKeys.has(room.key) || typeof room.roomId !== 'string' || !room.roomId ||
        roomIds.has(room.roomId) || typeof room.roomType !== 'string' || !room.roomType ||
        typeof room.movementEnabled !== 'boolean' || !Array.isArray(room.cells) || room.cells.length < 1 ||
        room.cells.some(cell => !validCell(cell, map))) throw new Error('办公室地图房间引用无效');
    const cells = new Set(room.cells.map(cellKey));
    if (cells.size !== room.cells.length) throw new Error('办公室地图房间单元重复');
    roomKeys.add(room.key);
    roomIds.add(room.roomId);
    roomCells.set(room.key, cells);
  }
  if ([...requiredRooms].some(key => !roomKeys.has(key))) throw new Error('办公室地图房间缺失');

  const doorIds = new Set<string>();
  const closedDoors = new Set<string>();
  for (const door of map.doors) {
    if (!ID.test(door?.id) || doorIds.has(door.id) || !validCell(door.cell, map) || !Array.isArray(door.roomKeys) ||
        door.roomKeys.length < 1 || door.roomKeys.length > 2 || new Set(door.roomKeys).size !== door.roomKeys.length ||
        door.roomKeys.some(key => !roomKeys.has(key)) || typeof door.open !== 'boolean' ||
        (door.open && map.collision[door.cell.row][door.cell.col] !== '0')) throw new Error('办公室门引用无效');
    doorIds.add(door.id);
    if (!door.open) closedDoors.add(cellKey(door.cell));
  }

  const anchorIds = new Set<string>();
  const footprints = new Set<string>();
  let workSeats = 0;
  let meetingSeats = 0;
  for (const anchor of map.anchors) {
    const ownedCells = roomCells.get(anchor?.roomKey);
    const standDistance = Math.abs(anchor.stand?.col - anchor.approach?.col) + Math.abs(anchor.stand?.row - anchor.approach?.row);
    if (!ID.test(anchor?.id) || anchorIds.has(anchor.id) || !ownedCells || !['workSeat', 'meetingSeat'].includes(anchor.kind) ||
        !validCell(anchor.stand, map) || !validCell(anchor.approach, map) || standDistance > 1 ||
        map.collision[anchor.stand.row][anchor.stand.col] !== '0' || map.collision[anchor.approach.row][anchor.approach.col] !== '0' ||
        !ownedCells.has(cellKey(anchor.stand)) || !ownedCells.has(cellKey(anchor.approach)) ||
        !finite(anchor.sit?.worldX) || !finite(anchor.sit?.worldY) || !['NE', 'SE', 'SW', 'NW'].includes(anchor.facing) ||
        !Array.isArray(anchor.footprint) || anchor.footprint.length < 1 || anchor.footprint.some(cell => !validCell(cell, map) || !ownedCells.has(cellKey(cell)))) {
      throw new Error('办公室地图锚点无效');
    }
    for (const cell of anchor.footprint) {
      const key = cellKey(cell);
      if (footprints.has(key)) throw new Error('办公室锚点占地重叠');
      footprints.add(key);
    }
    anchorIds.add(anchor.id);
    if (anchor.kind === 'workSeat') workSeats += 1;
    else meetingSeats += 1;
  }
  if (workSeats !== 20 || meetingSeats !== 6) throw new Error('办公室锚点容量无效');

  const propIds = new Set<string>();
  for (const prop of map.props) {
    if (!ID.test(prop?.id) || propIds.has(prop.id) || !ID.test(prop.frameId) || !validCell(prop.cell, map) ||
        !['ground', 'propsBack', 'propsFront'].includes(prop.layer) || !finite(prop.depthOffset) ||
        prop.depthOffset < -128 || prop.depthOffset > 128) throw new Error('办公室道具引用无效');
    propIds.add(prop.id);
  }

  const spawnKeys = new Set<string>();
  for (const spawn of map.spawns) {
    const key = cellKey(spawn);
    if (!validCell(spawn, map) || map.collision[spawn.row][spawn.col] !== '0' || closedDoors.has(key) ||
        footprints.has(key) || spawnKeys.has(key)) throw new Error('办公室出生点无效');
    spawnKeys.add(key);
  }

  const reachable = new Set(spawnKeys);
  const queue = map.spawns.map(cell => ({ ...cell }));
  while (queue.length) {
    const cell = queue.shift()!;
    for (const next of [{ col: cell.col + 1, row: cell.row }, { col: cell.col - 1, row: cell.row },
      { col: cell.col, row: cell.row + 1 }, { col: cell.col, row: cell.row - 1 }]) {
      const key = cellKey(next);
      if (!validCell(next, map) || reachable.has(key) || closedDoors.has(key) || map.collision[next.row][next.col] !== '0') continue;
      reachable.add(key);
      queue.push(next);
    }
  }
  if (map.anchors.some(anchor => !reachable.has(cellKey(anchor.stand)) || !reachable.has(cellKey(anchor.approach)))) {
    throw new Error('办公室锚点不可达');
  }
  return map;
}

export function validateOfficeAssets(value: unknown): OfficeAssets {
  const assets = value as OfficeAssets;
  const roles = ['pm', 'developer', 'tester', 'fallback'];
  const activities = ['idle', 'walk', 'dock', 'sit', 'work', 'think', 'blocked'];
  const directions = ['NE', 'SE', 'SW', 'NW'];
  const kinds = ['tile', 'propBack', 'propFront', 'agent', 'effect'];
  if (!assets || assets.version !== '0.3' || assets.rightsReview?.status !== 'approved' ||
      typeof assets.rightsReview.reviewer !== 'string' || !assets.rightsReview.reviewer ||
      typeof assets.rightsReview.distributionScope !== 'string' || !assets.rightsReview.distributionScope ||
      !Array.isArray(assets.atlases) || assets.atlases.length !== 2 ||
      !Array.isArray(assets.animations) || assets.animations.length < 20) {
    throw new Error('办公室运行资产未通过本地来源审批');
  }

  const atlasIds = new Set<string>();
  const frameIds = new Set<string>();
  const frameKinds = new Map<string, string>();
  for (const atlas of assets.atlases) {
    if (!['agents', 'props'].includes(atlas.id) || atlasIds.has(atlas.id) || !LOCAL_ASSET.test(atlas.image) || !SHA256.test(atlas.sha256) ||
        !Number.isInteger(atlas.width) || !Number.isInteger(atlas.height) || atlas.width < 1 || atlas.width > 4096 ||
        atlas.height < 1 || atlas.height > 4096 || !atlas.source || !atlas.author || !atlas.license ||
        !Array.isArray(atlas.frames) || atlas.frames.length < 1) throw new Error('办公室运行资产清单无效');
    atlasIds.add(atlas.id);
    for (const frame of atlas.frames) {
      if (!ID.test(frame?.id) || frameIds.has(frame.id) || ![frame.x, frame.y, frame.width, frame.height, frame.pivotX, frame.pivotY].every(Number.isInteger) ||
          frame.x < 0 || frame.y < 0 || frame.width < 1 || frame.height < 1 || frame.x + frame.width > atlas.width || frame.y + frame.height > atlas.height ||
          frame.pivotX < 0 || frame.pivotY < 0 || frame.pivotX > frame.width || frame.pivotY > frame.height || !kinds.includes(frame.kind)) {
        throw new Error('办公室图集帧无效');
      }
      frameIds.add(frame.id);
      frameKinds.set(frame.id, frame.kind);
    }
  }
  if (!atlasIds.has('agents') || !atlasIds.has('props')) throw new Error('办公室运行图集缺失');

  const animationIds = new Set<string>();
  const animationKeys = new Set<string>();
  for (const animation of assets.animations) {
    if (!ID.test(animation?.id) || animationIds.has(animation.id) || !roles.includes(animation.role) || !activities.includes(animation.activity) ||
        !directions.includes(animation.direction) || !Array.isArray(animation.frameIds) || animation.frameIds.length < 1 ||
        animation.frameIds.some(id => !frameIds.has(id) || frameKinds.get(id) !== 'agent') ||
        !finite(animation.fps) || animation.fps <= 0 || animation.fps > 24 || typeof animation.loop !== 'boolean') {
      throw new Error('办公室动画引用无效');
    }
    animationIds.add(animation.id);
    animationKeys.add(`${animation.role}:${animation.activity}:${animation.direction}`);
  }
  for (const role of ['pm', 'developer', 'tester']) {
    for (const direction of directions) {
      for (const activity of ['idle', 'walk', 'dock', 'sit', 'work']) {
        if (!animationKeys.has(`${role}:${activity}:${direction}`)) throw new Error('办公室角色方向动画缺失');
      }
    }
  }
  if (!frameIds.has(assets.fallbacks?.unknownRole) || !frameIds.has(assets.fallbacks?.unknownActivity) || !frameIds.has(assets.fallbacks?.missingFrame)) {
    throw new Error('办公室备用帧无效');
  }
  return assets;
}

export function worldPointOf(point: WorldPoint) {
  if (!finite(point.worldX) || !finite(point.worldY)) throw new Error('办公室世界坐标无效');
  return { x: point.worldX, y: point.worldY };
}
