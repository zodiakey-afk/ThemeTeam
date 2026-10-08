import Phaser from 'phaser';
import EasyStar from 'easystarjs';
import { RootLocalGame } from './RootLocalGame';
import type { Agent, Selection, Snapshot } from '../types';
import type { RootNavigationTransition } from '../sceneBridge';
import type { Facing, GridPoint, OfficeAnchor, OfficeAssets, OfficeDestination, OfficeMap, OfficeSafeRect, OfficeSceneAdapter, OfficeTranslator } from './types';
import { canEnterGridCell, facingForStep, projectGrid, validateOfficeAssets, validateOfficeMap } from './domain';

type FeedbackKind = 'info' | 'success' | 'error';
interface Callbacks {
  t: OfficeTranslator;
  onReady(destinations: OfficeDestination[]): void;
  onFeedback(message: string, kind: FeedbackKind): void;
  onPreviewChange(enabled: boolean): void;
  onContextMenu(request: { agentId: string; x: number; y: number }): void;
  getSafeRect?(): OfficeSafeRect;
}
interface AgentView {
  record: Agent;
  sprite: Phaser.GameObjects.Sprite;
  bubble: Phaser.GameObjects.Text;
  cell: GridPoint;
  workspaceCell: GridPoint;
  homeAnchorId: string | null;
  occupiedAnchorId: string | null;
  phase: 'standing' | 'planning' | 'walking' | 'waiting' | 'docking' | 'seated' | 'undocking' | 'obstructed';
  facing: Facing;
  path: GridPoint[];
  segmentElapsed: number;
  segmentFrom: GridPoint;
  segmentTo: GridPoint;
  waitElapsed: number;
  replanAttempts: number;
  motionId: number;
  targetAnchorId: string | null;
}
interface PathPlan {
  engine: InstanceType<typeof EasyStar.js>;
  requestId: number;
  motionId: number;
  anchorId: string;
  rootGeneration: number;
  mapRevision: string;
  elapsed: number;
}
interface OfficeTestHook {
  owner: symbol;
  setPreview(enabled: boolean): void;
  selectAgent(agentId: string): void;
  selectAndMove(agentId: string, anchorId: string): void;
  setStressMotion(count: number): void;
  setDynamicBlocked(agentId: string, blocked: boolean): void;
  focusSelected(): void;
  zoomBy(delta: number): void;
  snapshot(): { agents: number; visibleBubbles: number; plans: number; reservations: number; stressAgents: number;
    phases: Record<string, number>; cameraZoom: number; cameraScroll: { x: number; y: number }; activeTouches: number; pinching: boolean;
    selectedId: string | null; preview: boolean; safeRect: OfficeSafeRect;
    propStates: { id: string; frame: string; cell: GridPoint; depth: number }[];
    agentStates: { id: string; phase: string; target: string | null; occupied: string | null; cell: GridPoint; replanAttempts: number;
      frame: string; tint: number; spriteDepth: number; frontOccluderDepth: number | null; homeOccluderDepth: number | null;
      screen: { x: number; y: number }; hit: { x: number; y: number } }[] };
}
const MAP_URL = '/assets/office/office-map.v0.3.json';
const ASSET_URL = '/assets/office/office-assets.v0.3.json';
const ZOOM_STOPS = [0.5, 0.75, 1, 1.5, 2] as const;
const AGENT_SCALE = 0.9;
const AGENT_ORIGIN_Y = 94 / 96;
const PROP_ORIGIN_Y = 124 / 128;
const PROP_STYLE: Record<string, { scaleX: number; scaleY: number; yOffset?: number }> = {
  'floor-mint': { scaleX: 0.35, scaleY: 0.35 },
  'floor-blue': { scaleX: 0.35, scaleY: 0.35 },
  'wall-nw': { scaleX: 0.65, scaleY: 0.65 },
  'wall-ne': { scaleX: 0.65, scaleY: 0.65 },
  desk: { scaleX: 0.62, scaleY: 0.62 },
  chair: { scaleX: 0.48, scaleY: 0.48 },
  crt: { scaleX: 0.48, scaleY: 0.48, yOffset: -20 },
  'meeting-table': { scaleX: 1.2, scaleY: 1.2 },
  whiteboard: { scaleX: 0.76, scaleY: 0.76 },
  'boss-console': { scaleX: 0.72, scaleY: 0.72 },
  'coffee-counter': { scaleX: 0.66, scaleY: 0.66 },
  'water-cooler': { scaleX: 0.55, scaleY: 0.55 },
  plant: { scaleX: 0.5, scaleY: 0.5 },
  selection: { scaleX: 0.36, scaleY: 0.36 },
  'error-target': { scaleX: 0.36, scaleY: 0.36 },
  'path-dot': { scaleX: 0.4, scaleY: 0.4 },
  'door-open': { scaleX: 0.55, scaleY: 0.55 },
};
let officeRootSequence = 0;
const samePoint = (a: GridPoint, b: GridPoint) => a.col === b.col && a.row === b.row;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));


type VisualRole = 'pm' | 'developer' | 'tester';
type VisualActivity = 'idle' | 'work' | 'think' | 'blocked';
function roleOf(agent: Agent): VisualRole | null {
  const role = agent.roleTemplate.toLocaleLowerCase();
  if (role.includes('pm') || role.includes('manager') || role.includes('product')) return 'pm';
  if (role.includes('test') || role.includes('qa')) return 'tester';
  if (role.includes('dev') || role.includes('engineer')) return 'developer';
  return null;
}
function activityOf(agent: Agent): VisualActivity | null {
  const status = agent.status.toLocaleLowerCase();
  if (status.includes('work') || status.includes('review')) return 'work';
  if (status.includes('think')) return 'think';
  if (status.includes('block') || status.includes('error')) return 'blocked';
  if (status.includes('idle') || status.includes('offline')) return 'idle';
  return null;
}
async function verifyAssetFiles(assets: OfficeAssets, signal: AbortSignal, t: OfficeTranslator) {
  for (const atlas of assets.atlases) {
    const response = await fetch(atlas.image, { signal });
    if (!response.ok) throw new Error(`Asset atlas failed to load: ${atlas.id}`);
    const digest = await crypto.subtle.digest('SHA-256', await response.arrayBuffer());
    const actual = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
    if (actual !== atlas.sha256) throw new Error(t('office.assetIntegrity', { id: atlas.id }));
  }
}

export function createOfficeSceneAdapter(container: HTMLElement, callbacks: Callbacks): OfficeSceneAdapter {
  let game: Phaser.Game | null = null;
  let gameCanvas: HTMLCanvasElement | null = null;
  let scene: OfficeScene | null = null;
  let destroyed = false;
  let latestSnapshot: Snapshot | null = null;
  let latestSelection: Selection | null = null;
  let pendingNavigation: RootNavigationTransition | null = null;
  let preview = false;
  let selectCallback: ((selection: Selection | null) => void) | null = null;
  const abort = new AbortController();
  const testWindow = window as typeof window & { __THEMETEAM_OFFICE_TEST__?: OfficeTestHook };
  const testMode = new URLSearchParams(window.location.search).get('officeTest') === '1';
  const testHookOwner = Symbol('office-test-hook');
  const testContainer = container as HTMLElement & { __officeTest?: OfficeTestHook };
  const rootGeneration = ++officeRootSequence;
  const pixelRatio = clamp(window.devicePixelRatio || 1, 1, 2);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const handleContextLost = (event: Event) => {
    event.preventDefault();
    scene?.setPreview(false);
    scene?.scene.pause();
    callbacks.onFeedback(callbacks.t('office.contextLost'), 'error');
  };

  class OfficeScene extends Phaser.Scene {
    private map!: OfficeMap;
    private assets!: OfficeAssets;
    private agents = new Map<string, AgentView>();
    private anchors = new Map<string, OfficeAnchor>();
    private reservations = new Map<string, string>();
    private selectionMarker?: Phaser.GameObjects.Image;
    private selectedId: string | null = null;
    private plans = new Map<string, PathPlan>();
    private stressAgents = new Set<string>();
    private forcedDynamicBlocks = new Set<string>();
    private motionSequence = 0;
    private previousCamera: { scrollX: number; scrollY: number; zoom: number } | null = null;
    private pendingFocusId: string | null = null;
    private dragging = false;
    private dragStart = { x: 0, y: 0, scrollX: 0, scrollY: 0 };
    private touchPoints = new Map<number, { x: number; y: number }>();
    private pinch: { distance: number; zoom: number; world: { x: number; y: number } } | null = null;
    private spaceKey?: Phaser.Input.Keyboard.Key;
    private resizeObserver?: ResizeObserver;
    private resizeFrame = 0;
    private contextMenu = (event: Event) => event.preventDefault();
    private touchPointerDown = (event: PointerEvent) => this.handleTouchPointerDown(event);
    private touchPointerMove = (event: PointerEvent) => this.handleTouchPointerMove(event);
    private touchPointerUp = (event: PointerEvent) => this.handleTouchPointerUp(event);
    private pointerCancel = () => this.resetGesture();
    private pendingSelection: { agentId: string; pointerId: number; x: number; y: number } | null = null;
    private pendingContext: { agentId: string; pointerId: number; x: number; y: number } | null = null;
    private pendingBlank: { pointerId: number; x: number; y: number } | null = null;
    private followingSelected = false;
    private assetLoadFailed = false;
    private lastNavigationSequence = 0;

    constructor(private mapInput: OfficeMap, private assetInput: OfficeAssets) {
      super({ key: 'office-main' });
    }
    preload() {
      this.load.on('loaderror', () => { this.assetLoadFailed = true; });
      for (const atlas of this.assetInput.atlases) this.load.image(atlas.id, atlas.image);
    }
    create() {
      scene = this;
      if (this.assetLoadFailed) {
        callbacks.onFeedback(callbacks.t('office.textureFailed'), 'error');
        this.scene.pause();
        return;
      }
      this.map = this.mapInput;
      this.assets = this.assetInput;
      for (const atlas of this.assets.atlases) {
        const texture = this.textures.get(atlas.id);
        for (const frame of atlas.frames) if (!texture.has(frame.id)) texture.add(frame.id, 0, frame.x, frame.y, frame.width, frame.height);
      }
      for (const anchor of this.map.anchors) this.anchors.set(anchor.id, anchor);
      this.drawMap();
      this.configureCameraAndInput();

      const selectionStyle = PROP_STYLE.selection;
      this.selectionMarker = this.add.image(0, 0, 'props', 'selection').setOrigin(0.5, PROP_ORIGIN_Y)
        .setScale(selectionStyle.scaleX, selectionStyle.scaleY).setDepth(900000).setVisible(false);
      this.resizeObserver = new ResizeObserver(() => {
        cancelAnimationFrame(this.resizeFrame);
        this.resizeFrame = requestAnimationFrame(() => {
          const width = Math.max(1, container.clientWidth);
          const height = Math.max(1, container.clientHeight);
          const backingWidth = Math.round(width * pixelRatio);
          const backingHeight = Math.round(height * pixelRatio);
          if (this.scale.width !== backingWidth || this.scale.height !== backingHeight) this.scale.resize(backingWidth, backingHeight);
          requestAnimationFrame(() => this.keepSelectedVisible());
        });
      });
      this.resizeObserver.observe(container);
      container.addEventListener('contextmenu', this.contextMenu);
      callbacks.onReady(this.destinationList());
      this.applyUpdate(latestSnapshot, latestSelection);
      if (pendingNavigation) this.applyNavigation(pendingNavigation);
      callbacks.onFeedback(callbacks.t('office.ready'), 'success');
      if (testMode) testContainer.__officeTest = testWindow.__THEMETEAM_OFFICE_TEST__ = {
        owner: testHookOwner,
        setPreview: enabled => this.setPreview(enabled),
        selectAgent: agentId => selectCallback?.({ kind: 'agent', id: agentId }),
        selectAndMove: (agentId, anchorId) => {
          this.selectedId = agentId;
          this.updateSelection();
          this.moveSelected(anchorId);
        },
        setStressMotion: count => {
          this.stressAgents.clear();
          const candidates = [...this.agents.values()]
            .sort((left, right) => Number(left.bubble.visible) - Number(right.bubble.visible))
            .slice(0, Math.max(0, count));
          for (const view of candidates) {
            if (view.phase === 'seated') {
              view.occupiedAnchorId = null;
              view.phase = 'standing';
              const position = this.project(view.cell);
              view.sprite.setPosition(position.x, position.y);
              this.setPose(view, 'idle');
            }
            if (view.phase === 'standing') this.stressAgents.add(view.record.id);
          }
        },
        setDynamicBlocked: (agentId, blocked) => {
          if (blocked) this.forcedDynamicBlocks.add(agentId);
          else this.forcedDynamicBlocks.delete(agentId);
        },
        focusSelected: () => this.focusSelected(),
        zoomBy: delta => this.zoomBy(delta),
        snapshot: () => {
          const phases: Record<string, number> = {};
          let visibleBubbles = 0;
          for (const view of this.agents.values()) {
            phases[view.phase] = (phases[view.phase] || 0) + 1;
            if (view.bubble.visible) visibleBubbles += 1;
          }
          const safeRect = callbacks.getSafeRect?.() || { left: 0, top: 0, right: container.clientWidth, bottom: container.clientHeight };
          return { agents: this.agents.size, visibleBubbles, plans: this.plans.size, reservations: this.reservations.size,
            stressAgents: this.stressAgents.size, phases, cameraZoom: this.cameras.main.zoom / pixelRatio,
            cameraScroll: { x: this.cameras.main.scrollX, y: this.cameras.main.scrollY }, activeTouches: this.touchPoints.size,
            pinching: this.pinch !== null, selectedId: this.selectedId, preview, safeRect,
            propStates: this.children.list
              .filter((item): item is Phaser.GameObjects.Image => item instanceof Phaser.GameObjects.Image && item.texture.key === 'props')
              .map(item => ({ id: item.name, frame: item.frame.name, cell: { col: 0, row: 0 }, depth: item.depth })),
            agentStates: [...this.agents.values()].map(view => ({ id: view.record.id,
              phase: view.phase, target: view.targetAnchorId, occupied: view.occupiedAnchorId, cell: { ...view.cell },
              replanAttempts: view.replanAttempts, frame: view.sprite.frame.name, tint: view.sprite.tintTopLeft, spriteDepth: view.sprite.depth,
              frontOccluderDepth: (() => {
                const anchor = view.occupiedAnchorId ? this.map.anchors.find(item => item.id === view.occupiedAnchorId) : null;
                const prop = anchor ? this.map.props.find(item => item.layer === 'propsFront' &&
                  item.cell.col === anchor.stand.col && item.cell.row === anchor.stand.row) : null;
                return prop ? this.project(prop.cell).y + prop.depthOffset + 40 : null;
              })(),
              homeOccluderDepth: (() => {
                const anchor = view.homeAnchorId ? this.map.anchors.find(item => item.id === view.homeAnchorId) : null;
                const prop = anchor ? this.map.props.find(item => item.layer === 'propsFront' &&
                  item.cell.col === anchor.stand.col && item.cell.row === anchor.stand.row) : null;
                return prop ? this.project(prop.cell).y + prop.depthOffset + 40 : null;
              })(),
              screen: { x: (view.sprite.x - this.cameras.main.worldView.x) * this.cameras.main.zoom / pixelRatio,
                y: (view.sprite.y - this.cameras.main.worldView.y) * this.cameras.main.zoom / pixelRatio },
              hit: { x: (view.sprite.x - this.cameras.main.worldView.x) * this.cameras.main.zoom / pixelRatio,
                y: (view.sprite.y - view.sprite.displayHeight * 0.48 - this.cameras.main.worldView.y) * this.cameras.main.zoom / pixelRatio } })) };
        },
      };
    }
    private project(point: GridPoint) {
      return projectGrid(point, this.map);
    }
    private drawMap() {
      const roomColors: Record<string, number> = { boss: 0xffe6a9, meeting: 0xb8d9ee, work: 0xb9dfd0, coffee: 0xf0c5a7 };
      const roomLabels: Record<string, string> = {
        boss: callbacks.t('office.bossOffice'),
        meeting: callbacks.t('office.meetingRoom'),
        work: callbacks.t('office.workArea'),
        coffee: callbacks.t('office.lounge'),
      };
      for (const room of this.map.roomBindings) {
        for (const cell of room.cells) {
          const p = this.project(cell);
          const frame = room.key === 'meeting' ? 'floor-blue' : 'floor-mint';
          const style = PROP_STYLE[frame];
          this.add.image(p.x, p.y, 'props', frame)
            .setOrigin(0.5, PROP_ORIGIN_Y).setScale(style.scaleX, style.scaleY)
            .setTint(roomColors[room.key] || 0xffffff).setDepth(p.y - 2000);
        }
        const center = room.cells[Math.floor(room.cells.length / 2)];
        const p = this.project(center);
        this.add.text(p.x, p.y - 26, roomLabels[room.key] || room.roomType.toLocaleUpperCase(), {
          fontFamily: 'Segoe UI, sans-serif', fontSize: '14px', fontStyle: 'bold', color: '#24433a', backgroundColor: '#f8fbf7e8', padding: { x: 7, y: 4 },
        }).setOrigin(0.5).setDepth(800000);
      }
      const footprintCells = new Set(this.map.anchors.flatMap(anchor => anchor.footprint.map(cell => `${cell.col},${cell.row}`)));
      const wallCells = new Set<string>();
      for (let row = 0; row < this.map.dimensions.rows; row += 1) {
        for (let col = 0; col < this.map.dimensions.columns; col += 1) {
          if (this.map.collision[row][col] === '1' && !footprintCells.has(`${col},${row}`)) wallCells.add(`${col},${row}`);
        }
      }
      for (let row = 0; row < this.map.dimensions.rows; row += 1) {
        for (let col = 0; col < this.map.dimensions.columns; col += 1) {
          if (!wallCells.has(`${col},${row}`)) continue;
          const p = this.project({ col, row });
          const left = wallCells.has(`${col - 1},${row}`), right = wallCells.has(`${col + 1},${row}`);
          const up = wallCells.has(`${col},${row - 1}`), down = wallCells.has(`${col},${row + 1}`);
          const horizontal = left || right;
          const vertical = up || down;
          const orientations = horizontal && vertical ? ['horizontal', 'vertical'] as const
            : horizontal ? ['horizontal'] as const : ['vertical'] as const;
          orientations.forEach((orientation, index) => {
            const start = orientation === 'horizontal' ? { x: p.x - 32, y: p.y - 16 } : { x: p.x + 32, y: p.y - 16 };
            const end = orientation === 'horizontal' ? { x: p.x + 32, y: p.y + 16 } : { x: p.x - 32, y: p.y + 16 };
            const height = 48;
            const wall = this.add.graphics().setDepth(p.y + 20 + index);
            wall.fillStyle(0x2f7b86, 0.82).lineStyle(2, 0x244c56, 0.96);
            wall.beginPath().moveTo(start.x, start.y - height).lineTo(end.x, end.y - height)
              .lineTo(end.x, end.y).lineTo(start.x, start.y).closePath().fillPath().strokePath();
            wall.lineStyle(2, 0xa8d7d2, 0.9).beginPath().moveTo(start.x, start.y - height + 3)
              .lineTo(end.x, end.y - height + 3).strokePath();
            wall.fillStyle(0xd9e5e1, 0.98).beginPath().moveTo(start.x, start.y - 6).lineTo(end.x, end.y - 6)
              .lineTo(end.x, end.y).lineTo(start.x, start.y).closePath().fillPath();
          });
        }
      }
      for (const prop of this.map.props) {
        const p = this.project(prop.cell);
        const style = PROP_STYLE[prop.frameId] || { scaleX: 0.55, scaleY: 0.55 };
        const largeFurnitureDepth = prop.frameId === 'meeting-table' || prop.frameId === 'boss-console' ? 128 : 0;
        const image = this.add.image(p.x, p.y + (style.yOffset || 0), 'props', prop.frameId)
          .setName(prop.id)
          .setOrigin(0.5, PROP_ORIGIN_Y)
          .setScale(style.scaleX, style.scaleY);
        image.setDepth(p.y + prop.depthOffset + largeFurnitureDepth + (prop.layer === 'propsFront' ? 40 : -10));
      }
      for (const door of this.map.doors) {
        const p = this.project(door.cell);
        const style = PROP_STYLE['door-open'];
        this.add.image(p.x, p.y, 'props', 'door-open').setOrigin(0.5, PROP_ORIGIN_Y)
          .setScale(style.scaleX, style.scaleY).setDepth(p.y + 25);
      }
    }
    private resetGesture() {
      for (const pointerId of this.touchPoints.keys()) {
        if (this.game.canvas.hasPointerCapture(pointerId)) this.game.canvas.releasePointerCapture(pointerId);
      }
      this.dragging = false;
      this.pendingSelection = null;
      this.pendingContext = null;
      this.pendingBlank = null;
      this.touchPoints.clear();
      this.pinch = null;
    }
    private pointerPosition(event: PointerEvent) {
      const rect = this.game.canvas.getBoundingClientRect();
      return {
        x: (event.clientX - rect.left) * this.scale.width / Math.max(1, rect.width),
        y: (event.clientY - rect.top) * this.scale.height / Math.max(1, rect.height),
      };
    }
    private agentAt(point: { x: number; y: number }) {
      const world = this.cameras.main.getWorldPoint(point.x, point.y);
      return [...this.agents.values()].find(view => view.sprite.getBounds().contains(world.x, world.y)) || null;
    }
    private touchPair() {
      const [first, second] = [...this.touchPoints.values()];
      if (!first || !second) return null;
      return {
        distance: Math.max(1, Math.hypot(second.x - first.x, second.y - first.y)),
        center: { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 },
      };
    }
    private beginPinch() {
      const pair = this.touchPair();
      if (!pair) return;
      const camera = this.cameras.main;
      this.dragging = false;
      this.pendingSelection = null;
      this.pendingContext = null;
      this.pendingBlank = null;
      this.followingSelected = false;
      this.pinch = { distance: pair.distance, zoom: camera.zoom, world: camera.getWorldPoint(pair.center.x, pair.center.y) };
    }
    private updatePinch() {
      const pair = this.touchPair();
      if (!pair || !this.pinch) return;
      const camera = this.cameras.main;
      camera.stopFollow();
      camera.setZoom(clamp(this.pinch.zoom * pair.distance / this.pinch.distance,
        ZOOM_STOPS[0] * pixelRatio, ZOOM_STOPS.at(-1)! * pixelRatio));
      const after = camera.getWorldPoint(pair.center.x, pair.center.y);
      camera.scrollX += this.pinch.world.x - after.x;
      camera.scrollY += this.pinch.world.y - after.y;
    }
    private handleTouchPointerDown(event: PointerEvent) {
      if (event.pointerType !== 'touch') return;
      event.preventDefault();
      const point = this.pointerPosition(event);
      try { this.game.canvas.setPointerCapture(event.pointerId); } catch { /* Synthetic or already-cancelled pointers can be uncapturable. */ }
      this.touchPoints.set(event.pointerId, point);
      if (this.touchPoints.size >= 2) this.beginPinch();
      else if (!this.agentAt(point)) {
        this.dragging = true;
        this.pendingBlank = { pointerId: event.pointerId, ...point };
        this.dragStart = { ...point, scrollX: this.cameras.main.scrollX, scrollY: this.cameras.main.scrollY };
      }
    }
    private handleTouchPointerMove(event: PointerEvent) {
      if (event.pointerType !== 'touch' || !this.touchPoints.has(event.pointerId)) return;
      event.preventDefault();
      const point = this.pointerPosition(event);
      if (this.pendingSelection?.pointerId === event.pointerId &&
          Math.hypot(point.x - this.pendingSelection.x, point.y - this.pendingSelection.y) > 6) this.pendingSelection = null;
      if (this.pendingBlank?.pointerId === event.pointerId &&
          Math.hypot(point.x - this.pendingBlank.x, point.y - this.pendingBlank.y) > 6) {
        this.pendingBlank = null;
        this.followingSelected = false;
      }
      this.touchPoints.set(event.pointerId, point);
      if (this.touchPoints.size >= 2) {
        if (!this.pinch) this.beginPinch();
        this.updatePinch();
        return;
      }
      if (!this.dragging) return;
      const camera = this.cameras.main;
      camera.stopFollow();
      camera.scrollX = this.dragStart.scrollX - (point.x - this.dragStart.x) / camera.zoom;
      camera.scrollY = this.dragStart.scrollY - (point.y - this.dragStart.y) / camera.zoom;
    }
    private handleTouchPointerUp(event: PointerEvent) {
      if (event.pointerType !== 'touch') return;
      event.preventDefault();
      const point = this.pointerPosition(event);
      const pending = this.pendingSelection;
      if (pending?.pointerId === event.pointerId && Math.hypot(point.x - pending.x, point.y - pending.y) <= 6) {
        this.commitSelection(pending.agentId);
      } else if (this.pendingBlank?.pointerId === event.pointerId &&
          Math.hypot(point.x - this.pendingBlank.x, point.y - this.pendingBlank.y) <= 6) {
        this.clearSelection();
      }
      this.resetGesture();
    }
    private commitSelection(agentId: string) {
      const view = this.agents.get(agentId);
      if (!view) return;
      callbacks.onFeedback(callbacks.t('office.selected', { name: view.record.name }), 'info');
      container.focus();
      selectCallback?.({ kind: 'agent', id: agentId });
    }
    private clearSelection() {
      if (!this.selectedId) return;
      this.followingSelected = false;
      callbacks.onFeedback(callbacks.t('office.clearSelection'), 'info');
      selectCallback?.(null);
    }
    private configureCameraAndInput() {
      const corners = [
        this.project({ col: 0, row: 0 }),
        this.project({ col: this.map.dimensions.columns - 1, row: 0 }),
        this.project({ col: 0, row: this.map.dimensions.rows - 1 }),
        this.project({ col: this.map.dimensions.columns - 1, row: this.map.dimensions.rows - 1 }),
      ];
      const minX = Math.min(...corners.map(p => p.x)) - 160;
      const maxX = Math.max(...corners.map(p => p.x)) + 160;
      const minY = Math.min(...corners.map(p => p.y)) - 180;
      const maxY = Math.max(...corners.map(p => p.y)) + 180;
      this.cameras.main.setBounds(minX, minY, maxX - minX, maxY - minY);
      this.overview();
      this.spaceKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
      this.game.canvas.addEventListener('pointerdown', this.touchPointerDown);
      this.game.canvas.addEventListener('pointermove', this.touchPointerMove);
      this.game.canvas.addEventListener('pointerup', this.touchPointerUp);
      this.game.canvas.addEventListener('pointercancel', this.pointerCancel);
      this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        if (pointer.wasTouch) return;
        const active = document.activeElement;
        const editable = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement ||
          active instanceof HTMLSelectElement || (active instanceof HTMLElement && active.isContentEditable);
        const spaceDrag = !!this.spaceKey?.isDown && !editable;
      if (pointer.middleButtonDown() || pointer.rightButtonDown() || spaceDrag) {
          this.followingSelected = false;
          this.dragging = true;
          this.dragStart = { x: pointer.x, y: pointer.y, scrollX: this.cameras.main.scrollX, scrollY: this.cameras.main.scrollY };
        } else if (pointer.leftButtonDown() && !this.pendingSelection && !this.pendingContext) {
          this.pendingBlank = { pointerId: pointer.id, x: pointer.x, y: pointer.y };
          this.dragStart = { x: pointer.x, y: pointer.y, scrollX: this.cameras.main.scrollX, scrollY: this.cameras.main.scrollY };
        }
      });
      this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
        if (pointer.wasTouch) return;
        if (this.pendingSelection?.pointerId === pointer.id &&
            Math.hypot(pointer.x - this.pendingSelection.x, pointer.y - this.pendingSelection.y) > 6) this.pendingSelection = null;
        if (this.pendingContext?.pointerId === pointer.id &&
            Math.hypot(pointer.x - this.pendingContext.x, pointer.y - this.pendingContext.y) > 6) this.pendingContext = null;
        if (this.pendingBlank?.pointerId === pointer.id &&
            Math.hypot(pointer.x - this.pendingBlank.x, pointer.y - this.pendingBlank.y) > 6) {
          this.pendingBlank = null;
          this.followingSelected = false;
          this.dragging = true;
        }
        if (!this.dragging || !pointer.isDown) return;
        const camera = this.cameras.main;
        camera.stopFollow();
        camera.scrollX = this.dragStart.scrollX - (pointer.x - this.dragStart.x) / camera.zoom;
        camera.scrollY = this.dragStart.scrollY - (pointer.y - this.dragStart.y) / camera.zoom;
      });
      this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
        if (pointer.wasTouch) return;
        const selection = this.pendingSelection;
        const context = this.pendingContext;
        if (pointer.leftButtonReleased() && selection?.pointerId === pointer.id &&
            Math.hypot(pointer.x - selection.x, pointer.y - selection.y) <= 6) this.commitSelection(selection.agentId);
        else if (pointer.leftButtonReleased() && this.pendingBlank?.pointerId === pointer.id &&
            Math.hypot(pointer.x - this.pendingBlank.x, pointer.y - this.pendingBlank.y) <= 6) this.clearSelection();
        if (pointer.rightButtonReleased() && context?.pointerId === pointer.id &&
            Math.hypot(pointer.x - context.x, pointer.y - context.y) <= 6) {
          this.commitSelection(context.agentId);
          callbacks.onContextMenu({ agentId: context.agentId, x: pointer.x, y: pointer.y });
        }
        this.dragging = false;
        this.pendingSelection = null;
        this.pendingContext = null;
        this.pendingBlank = null;
      });
      this.input.on('pointerupoutside', () => this.resetGesture());
      this.input.on('gameout', () => this.resetGesture());
      this.input.on('wheel', (pointer: Phaser.Input.Pointer, _objects: unknown, _dx: number, dy: number) => this.zoomBy(dy > 0 ? -1 : 1, pointer));
    }    private destinationList(): OfficeDestination[] {
      return this.map.anchors.map(anchor => ({
        id: anchor.id,
        label: `${anchor.kind === 'workSeat' ? callbacks.t('office.workSeat') : callbacks.t('office.meetingSeat')} ${anchor.id.split('-').at(-1)}`,
        kind: anchor.kind,
        roomKey: anchor.roomKey,
        occupied: [...this.agents.values()].some(agent => agent.occupiedAnchorId === anchor.id),
      }));
    }
    applyUpdate(snapshot: Snapshot | null, selection: Selection | null) {
      this.selectedId = selection?.kind === 'agent' ? selection.id : null;
      if (!snapshot) return;
      const ordered = [...snapshot.agents].sort((a, b) => a.id.localeCompare(b.id));
      const retained = new Set(ordered.slice(0, this.map.spawns.length).map(agent => agent.id));
      for (const [id, view] of this.agents) if (!retained.has(id)) {
        const plan = this.plans.get(id);
        if (plan) plan.engine.cancelPath(plan.requestId);
        this.plans.delete(id);
        if (view.targetAnchorId) this.reservations.delete(view.targetAnchorId);
        view.sprite.destroy(); view.bubble.destroy(); this.agents.delete(id);
      }
      ordered.slice(0, this.map.spawns.length).forEach((agent, index) => {
        const existing = this.agents.get(agent.id);
        if (existing) {
          existing.record = agent;
          if (!['walking', 'waiting', 'docking', 'undocking', 'planning'].includes(existing.phase)) {
            this.setPose(existing, existing.phase === 'seated' ? activityOf(agent) : 'idle');
          }
          return;
        }
        const home = this.map.anchors.filter(anchor => anchor.kind === 'workSeat')[index] || null;
        const spawn = home?.approach || this.map.spawns[index];
        const position = home ? { x: home.sit.worldX, y: home.sit.worldY } : this.project(spawn);
        const facing = home?.facing || 'SE';
        const visualRole = roleOf(agent);
        const initialFrame = visualRole ? `${visualRole}-idle-${facing}` : this.assets.fallbacks.unknownRole;
        const sprite = this.add.sprite(position.x, position.y, 'agents', initialFrame).setOrigin(0.5, AGENT_ORIGIN_Y).setScale(AGENT_SCALE);
        const bubble = this.add.text(position.x, position.y - 92, '', {
          fontFamily: 'Segoe UI, sans-serif', fontSize: '12px', color: '#17322b', backgroundColor: '#ffffffeb', padding: { x: 6, y: 4 },
        }).setOrigin(0.5, 1).setVisible(false);
        const view: AgentView = {
          record: agent, sprite, bubble, cell: spawn, workspaceCell: { ...spawn }, homeAnchorId: home?.id || null, occupiedAnchorId: home?.id || null,
          phase: home ? 'seated' : 'standing', facing, path: [], segmentElapsed: 0, segmentFrom: spawn, segmentTo: spawn, waitElapsed: 0,
          replanAttempts: 0, motionId: 0, targetAnchorId: null,
        };
        sprite.setInteractive(new Phaser.Geom.Rectangle(6, 4, 52, 88), Phaser.Geom.Rectangle.Contains)
          .on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            const candidate = { agentId: view.record.id, pointerId: pointer.id, x: pointer.x, y: pointer.y };
            if (pointer.leftButtonDown()) this.pendingSelection = candidate;
            else if (pointer.rightButtonDown()) this.pendingContext = candidate;
          });
        this.agents.set(agent.id, view);
        this.setPose(view, home ? activityOf(agent) : 'idle');
      });
      this.updateSelection();
      if (this.pendingFocusId && this.pendingFocusId === this.selectedId) {
        this.focusSelected();
        this.pendingFocusId = null;
      }
      callbacks.onReady(this.destinationList());
      this.enforceBubbleLimit();
      if (ordered.length > this.map.spawns.length) callbacks.onFeedback(callbacks.t('office.unplaced', { count: ordered.length - this.map.spawns.length }), 'error');
    }
    private setPose(view: AgentView, activity: string | null) {
      const role = roleOf(view.record);
      const knownActivity = activity as VisualActivity | null;
      const animation = role && knownActivity ? this.assets.animations.find(item => item.role === role && item.activity === knownActivity && item.direction === view.facing) : null;
      const frame = animation?.frameIds[0] || (role ? this.assets.fallbacks.unknownActivity : this.assets.fallbacks.unknownRole);
      if (view.sprite.texture.has(frame)) view.sprite.setFrame(frame);
      if (!role || !animation) view.sprite.setTint(0xe04f68);
      else view.sprite.clearTint();
      view.bubble.setText('').setVisible(false);
      if (activity === 'work' || activity === 'think' || activity === 'blocked') {
        const label = preview ? (activity === 'work' ? 'WORK DEMO' : activity === 'think' ? 'THINK DEMO' : 'BLOCKED DEMO') : view.record.status;
        view.bubble.setText(label.slice(0, 36)).setVisible(true);
      }
      this.positionDecorations(view);
    }
    private enforceBubbleLimit() {
      const visible = [...this.agents.values()].filter(view => view.bubble.text.length > 0);
      visible.forEach(view => view.bubble.setVisible(true));
      visible.sort((a, b) => Number(b.record.id === this.selectedId) - Number(a.record.id === this.selectedId) || a.record.id.localeCompare(b.record.id));
      visible.slice(5).forEach(view => view.bubble.setVisible(false));
    }
    private positionDecorations(view: AgentView) {
      view.sprite.setDepth(view.sprite.y + 10);
      view.bubble.setPosition(view.sprite.x, view.sprite.y - 92).setDepth(view.sprite.y + 100);
    }
    private updateSelection() {
      const selected = this.selectedId ? this.agents.get(this.selectedId) : null;
      this.selectionMarker?.setVisible(!!selected);
      if (selected) this.selectionMarker?.setPosition(selected.sprite.x, selected.sprite.y + 4);
    }
    private keepSelectedVisible() {
      const selected = this.selectedId ? this.agents.get(this.selectedId) : null;
      if (!selected) return;
      const camera = this.cameras.main;
      const safe = callbacks.getSafeRect?.() || { left: 0, top: 0, right: container.clientWidth, bottom: container.clientHeight };
      const width = Math.max(1, container.clientWidth);
      const height = Math.max(1, container.clientHeight);
      const left = clamp(safe.left, 0, width) * pixelRatio;
      const top = clamp(safe.top, 0, height) * pixelRatio;
      const right = clamp(safe.right, left / pixelRatio, width) * pixelRatio;
      const bottom = clamp(safe.bottom, top / pixelRatio, height) * pixelRatio;
      const safeCenterX = (left + right) / 2;
      const safeCenterY = (top + bottom) / 2;
      const viewportCenterX = camera.width / 2;
      const viewportCenterY = camera.height / 2;
      const offsetX = (viewportCenterX - safeCenterX) / camera.zoom;
      const offsetY = (viewportCenterY - safeCenterY) / camera.zoom;
      const safeLeftWorld = camera.getWorldPoint(left, viewportCenterY).x;
      const safeRightWorld = camera.getWorldPoint(right, viewportCenterY).x;
      const safeTopWorld = camera.getWorldPoint(viewportCenterX, top).y;
      const safeBottomWorld = camera.getWorldPoint(viewportCenterX, bottom).y;
      const targetX = selected.sprite.x + offsetX;
      const targetY = selected.sprite.y - 40 + offsetY;
      if (selected.sprite.x < safeLeftWorld || selected.sprite.x > safeRightWorld ||
          selected.sprite.y - 40 < safeTopWorld || selected.sprite.y - 40 > safeBottomWorld) {
        camera.centerOn(targetX, targetY);
      }
    }
    applyNavigation(transition: RootNavigationTransition) {
      if (transition.sequence <= this.lastNavigationSequence) return;
      this.lastNavigationSequence = transition.sequence;
      if ((transition.reason === 'select-different' || transition.reason === 'select-same') && transition.cameraAction !== 'drop') {
        const camera = this.cameras.main;
        if (!this.previousCamera) this.previousCamera = { scrollX: camera.scrollX, scrollY: camera.scrollY, zoom: camera.zoom };
        this.pendingFocusId = transition.to?.kind === 'agent' ? transition.to.id : null;
        this.followingSelected = !!this.pendingFocusId;
      } else if ((transition.reason === 'back' || transition.reason === 'close') && this.previousCamera) {
        this.cameras.main.setZoom(this.previousCamera.zoom).setScroll(this.previousCamera.scrollX, this.previousCamera.scrollY);
        this.previousCamera = null;
      } else if (transition.reason === 'clear' || transition.reason === 'prune' || transition.reason === 'deleted') {
        this.previousCamera = null;
        this.pendingFocusId = null;
        this.followingSelected = false;
      }
    }
    overview() {
      if (!this.map) return;
      this.followingSelected = false;
      const camera = this.cameras.main;
      const bounds = camera.getBounds();
      const fitZoom = Math.min(camera.width / bounds.width, camera.height / bounds.height) / pixelRatio;
      const zoom = 1;
      camera.stopFollow();
      camera.setZoom(zoom * pixelRatio);
      camera.centerOn(bounds.centerX, bounds.centerY);
    }
    focusSelected(duration = preview && !reducedMotion.matches ? 220 : 0) {
      const selected = this.selectedId ? this.agents.get(this.selectedId) : null;
      if (!selected) { callbacks.onFeedback(callbacks.t('office.focusRequired'), 'error'); return; }
      this.followingSelected = true;
      this.cameras.main.pan(selected.sprite.x, selected.sprite.y - 40, duration, 'Sine.easeOut');
    }
    followSelected() { this.focusSelected(); }
    stopFollowing() { this.followingSelected = false; this.cameras.main.stopFollow(); }
    zoomBy(direction: number, pointer?: Phaser.Input.Pointer) {
      const camera = this.cameras.main;
      const logicalZoom = camera.zoom / pixelRatio;
      const currentIndex = ZOOM_STOPS.reduce((best, stop, index) =>
        Math.abs(stop - logicalZoom) < Math.abs(ZOOM_STOPS[best] - logicalZoom) ? index : best, 0);
      const next = ZOOM_STOPS[clamp(currentIndex + direction, 0, ZOOM_STOPS.length - 1)];
      const before = pointer ? camera.getWorldPoint(pointer.x, pointer.y) : null;
      camera.setZoom(next * pixelRatio);
      if (pointer && before) {
        const after = camera.getWorldPoint(pointer.x, pointer.y);
        camera.scrollX += before.x - after.x;
        camera.scrollY += before.y - after.y;
      }
      callbacks.onFeedback(callbacks.t('office.zoomed', { percent: Math.round(next * 100) }), 'info');
    }
    private stopObstructed(view: AgentView, message: string) {
      if (view.targetAnchorId) this.reservations.delete(view.targetAnchorId);
      view.targetAnchorId = null;
      view.path = [];
      view.waitElapsed = 0;
      view.phase = 'obstructed';
      this.setPose(view, 'idle');
      callbacks.onFeedback(message, 'error');
      callbacks.onReady(this.destinationList());
    }
    private isStaticReachable(from: GridPoint, to: GridPoint) {
      const blockedDoors = new Set(this.map.doors.filter(door => !door.open).map(door => `${door.cell.col},${door.cell.row}`));
      const blockedRooms = new Set(this.map.roomBindings.filter(room => !room.movementEnabled)
        .flatMap(room => room.cells.map(cell => `${cell.col},${cell.row}`)));
      const key = (cell: GridPoint) => `${cell.col},${cell.row}`;
      const queue = [{ ...from }];
      const visited = new Set([key(from)]);
      while (queue.length) {
        const cell = queue.shift()!;
        if (samePoint(cell, to)) return true;
        for (const next of [{ col: cell.col + 1, row: cell.row }, { col: cell.col - 1, row: cell.row },
          { col: cell.col, row: cell.row + 1 }, { col: cell.col, row: cell.row - 1 }]) {
          const nextKey = key(next);
          if (next.col < 0 || next.row < 0 || next.col >= this.map.dimensions.columns || next.row >= this.map.dimensions.rows ||
              visited.has(nextKey) || this.map.collision[next.row][next.col] !== '0' || blockedDoors.has(nextKey) ||
              (blockedRooms.has(nextKey) && !samePoint(next, from))) continue;
          visited.add(nextKey);
          queue.push(next);
        }
      }
      return false;
    }
    private planRoute(view: AgentView, target: OfficeAnchor, motionId: number, replan: boolean) {
      const anchorId = target.id;
      const occupiedAnchor = view.occupiedAnchorId ? this.anchors.get(view.occupiedAnchorId) : null;
      const start = { ...(occupiedAnchor?.stand || view.cell) };
      const grid = this.map.collision.map(row => [...row].map(Number));
      for (const other of this.agents.values()) {
        if (other.record.id === view.record.id) continue;
        grid[other.cell.row][other.cell.col] = 1;
      }
      grid[start.row][start.col] = 0;
      grid[target.approach.row][target.approach.col] = 0;
      const previousPlan = this.plans.get(view.record.id);
      if (previousPlan) previousPlan.engine.cancelPath(previousPlan.requestId);
      this.plans.delete(view.record.id);
      view.phase = 'planning';
      const engine = new EasyStar.js();
      engine.setGrid(grid);
      engine.setAcceptableTiles([0]);
      engine.disableDiagonals();
      engine.setIterationsPerCalculation(200);
      const requestId = engine.findPath(start.col, start.row, target.approach.col, target.approach.row, path => {
        const activePlan = this.plans.get(view.record.id);
        if (!activePlan || activePlan.rootGeneration !== rootGeneration || activePlan.mapRevision !== this.map.mapRevision ||
            activePlan.motionId !== motionId || activePlan.anchorId !== anchorId ||
            view.motionId !== motionId || view.targetAnchorId !== anchorId) return;
        this.plans.delete(view.record.id);
        if (!path) {
          if (replan) {
            view.phase = 'waiting';
            view.waitElapsed = 0;
            callbacks.onFeedback(callbacks.t('office.replan', { name: view.record.name, attempt: view.replanAttempts }), 'info');
          } else {
            this.stopObstructed(view, callbacks.t('office.unreachableResult', { name: view.record.name }));
          }
          return;
        }
        view.path = path.slice(1).map(point => ({ col: point.x, row: point.y }));
        view.segmentElapsed = 0;
        view.waitElapsed = 0;
        view.segmentFrom = { ...start };
        view.segmentTo = view.path[0] || { ...start };
        view.phase = view.occupiedAnchorId ? 'undocking' : view.path.length ? 'walking' : 'docking';
        callbacks.onFeedback(replan
          ? callbacks.t('office.replanSuccess', { name: view.record.name, attempt: view.replanAttempts })
          : callbacks.t('office.arriving', { name: view.record.name, target: anchorId }), 'info');
      });
      this.plans.set(view.record.id, { engine, requestId, motionId, anchorId, rootGeneration, mapRevision: this.map.mapRevision, elapsed: 0 });
    }
    moveSelected(anchorId: string) {
      if (!preview) { callbacks.onFeedback(callbacks.t('office.moveDemoFirst'), 'error'); return; }
      const view = this.selectedId ? this.agents.get(this.selectedId) : null;
      const target = this.anchors.get(anchorId);
      if (!view || !target) { callbacks.onFeedback(callbacks.t('office.invalidTarget'), 'error'); return; }
      if (view.occupiedAnchorId === anchorId && view.phase === 'seated') {
        callbacks.onFeedback(callbacks.t('office.alreadyThere', { name: view.record.name }), 'info'); return;
      }
      const binding = this.map.roomBindings.find(room => room.key === target.roomKey);
      const snapshotRoom = binding && latestSnapshot?.rooms.find(room => room.id === binding.roomId);
      if (!binding?.movementEnabled || !snapshotRoom?.unlocked) {
        callbacks.onFeedback(callbacks.t('office.roomLocked'), 'error'); return;
      }
      const routeStart = view.occupiedAnchorId ? this.anchors.get(view.occupiedAnchorId)?.stand || view.cell : view.cell;
      if (!this.isStaticReachable(routeStart, target.approach)) {
        callbacks.onFeedback(callbacks.t('office.unreachable', { name: view.record.name }), 'error'); return;
      }
      const occupied = [...this.agents.values()].find(agent => agent.record.id !== view.record.id &&
        (agent.occupiedAnchorId === anchorId || agent.targetAnchorId === anchorId));
      if (occupied || (this.reservations.has(anchorId) && this.reservations.get(anchorId) !== view.record.id)) {
        callbacks.onFeedback(callbacks.t('office.targetOccupied', { name: occupied?.record.name || callbacks.t('nav.agents') }), 'error'); return;
      }
      if (view.targetAnchorId) this.reservations.delete(view.targetAnchorId);
      const motionId = ++this.motionSequence;
      view.motionId = motionId;
      view.targetAnchorId = anchorId;
      view.replanAttempts = 0;
      this.reservations.set(anchorId, view.record.id);
      this.planRoute(view, target, motionId, false);
    }    update(_time: number, rawDelta: number) {
      const delta = Math.min(rawDelta, 50);
      for (const [agentId, plan] of this.plans) {
        const view = this.agents.get(agentId);
        if (!view || view.phase !== 'planning' || view.motionId !== plan.motionId || view.targetAnchorId !== plan.anchorId) {
          plan.engine.cancelPath(plan.requestId);
          this.plans.delete(agentId);
          continue;
        }
        plan.elapsed += delta;
        if (plan.elapsed > 1000) {
          plan.engine.cancelPath(plan.requestId);
          this.plans.delete(agentId);
          this.stopObstructed(view, callbacks.t('office.pathTimeout'));
        } else {
          plan.engine.calculate();
        }
      }
      for (const view of this.agents.values()) {
        if (testMode && this.stressAgents.has(view.record.id) && view.phase === 'standing') {
          const candidates = [{ col: view.cell.col + 1, row: view.cell.row }, { col: view.cell.col, row: view.cell.row + 1 },
            { col: view.cell.col - 1, row: view.cell.row }, { col: view.cell.col, row: view.cell.row - 1 }];
          const next = candidates.find(cell => cell.col >= 0 && cell.row >= 0 && cell.col < this.map.dimensions.columns &&
            cell.row < this.map.dimensions.rows && this.map.collision[cell.row][cell.col] === '0');
          if (next) {
            view.path = [next];
            view.segmentElapsed = 0;
            view.segmentFrom = { ...view.cell };
            view.segmentTo = { ...next };
            view.phase = 'walking';
          }
        }
        if (view.phase === 'walking' || view.phase === 'waiting') {
          const next = view.path[0];
          const occupants = [...this.agents.values()].map(other => ({ id: other.record.id, cell: other.cell, phase: other.phase,
            segmentFrom: other.segmentFrom, segmentTo: other.segmentTo }));
          const dynamicallyBlocked = this.forcedDynamicBlocks.has(view.record.id) ||
            (next ? !canEnterGridCell(view.record.id, view.cell, next, occupants) : false);
          if (next && dynamicallyBlocked && !(testMode && this.stressAgents.has(view.record.id))) {
            view.phase = 'waiting';
            view.waitElapsed += delta;
            if (view.waitElapsed >= 2000) {
              const target = view.targetAnchorId ? this.anchors.get(view.targetAnchorId) : null;
              if (target && view.replanAttempts < 2) {
                view.replanAttempts += 1;
                view.waitElapsed = 0;
                this.planRoute(view, target, view.motionId, true);
              } else {
                this.stopObstructed(view, callbacks.t('office.blockedResult', { name: view.record.name }));
              }
            }
          } else {
            view.phase = 'walking';
            view.waitElapsed = 0;
            this.advanceWalking(view, delta);
          }
        } else if (view.phase === 'undocking') this.advanceUndocking(view, delta);
        else if (view.phase === 'docking') this.advanceDocking(view, delta);
        this.positionDecorations(view);
      }
      this.updateSelection();
      if (this.followingSelected) this.keepSelectedVisible();
    }
    private advanceWalking(view: AgentView, delta: number) {
      const next = view.path[0];
      if (!next) { view.phase = 'docking'; view.segmentElapsed = 0; return; }
      if (!samePoint(view.segmentTo, next)) {
        view.segmentFrom = { ...view.cell };
        view.segmentTo = { ...next };
        view.segmentElapsed = 0;
      }
      view.facing = facingForStep(view.segmentFrom, next);
      view.segmentElapsed += delta;
      const progress = clamp(view.segmentElapsed / 250, 0, 1);
      const from = this.project(view.segmentFrom);
      const to = this.project(next);
      view.sprite.setPosition(Phaser.Math.Linear(from.x, to.x, progress), Phaser.Math.Linear(from.y, to.y, progress));
      const role = roleOf(view.record);
      const frame = role ? `${role}-${Math.floor(view.segmentElapsed / 125) % 2 ? 'walk2' : 'walk1'}-${view.facing}` : this.assets.fallbacks.unknownRole;
      if (view.sprite.texture.has(frame)) view.sprite.setFrame(frame);
      if (!role) view.sprite.setTint(0xe04f68);
      else view.sprite.clearTint();
      if (progress >= 1) {
        const previousCell = { ...view.segmentFrom };
        view.cell = { ...next };
        view.path.shift();
        view.segmentElapsed = 0;
        view.segmentFrom = { ...next };
        view.segmentTo = view.path[0] || { ...next };
        if (!view.path.length && testMode && this.stressAgents.has(view.record.id)) {
          view.path = [previousCell];
          view.segmentTo = previousCell;
        } else if (!view.path.length) view.phase = 'docking';
      }
    }
    private advanceUndocking(view: AgentView, delta: number) {
      const anchor = view.occupiedAnchorId ? this.anchors.get(view.occupiedAnchorId) : null;
      if (!anchor) {
        view.phase = view.path.length ? 'walking' : 'docking';
        return;
      }
      view.segmentElapsed += delta;
      const progress = clamp(view.segmentElapsed / 300, 0, 1);
      const stand = this.project(anchor.stand);
      view.sprite.setPosition(Phaser.Math.Linear(anchor.sit.worldX, stand.x, progress), Phaser.Math.Linear(anchor.sit.worldY, stand.y, progress));
      view.facing = anchor.facing;
      if (progress >= 1) {
        view.cell = { ...anchor.stand };
        view.segmentFrom = { ...anchor.stand };
        view.segmentTo = view.path[0] || { ...anchor.stand };
        view.segmentElapsed = 0;
        view.occupiedAnchorId = null;
        view.phase = view.path.length ? 'walking' : 'docking';
        callbacks.onReady(this.destinationList());
      }
    }
    private advanceDocking(view: AgentView, delta: number) {
      const target = view.targetAnchorId ? this.anchors.get(view.targetAnchorId) : null;
      if (!target) { view.phase = 'standing'; return; }
      if (this.reservations.get(target.id) !== view.record.id) {
        this.stopObstructed(view, callbacks.t('office.reservationLost', { name: view.record.name }));
        return;
      }
      view.segmentElapsed += delta;
      const progress = clamp(view.segmentElapsed / 300, 0, 1);
      const from = this.project(target.approach);
      view.sprite.setPosition(Phaser.Math.Linear(from.x, target.sit.worldX, progress), Phaser.Math.Linear(from.y, target.sit.worldY, progress));
      view.facing = target.facing;
      if (progress >= 1) {
        view.phase = 'seated';
        view.replanAttempts = 0;
        view.cell = { ...target.approach };
        view.occupiedAnchorId = target.id;
        view.targetAnchorId = null;
        this.reservations.delete(target.id);
        this.setPose(view, target.kind === 'workSeat' ? 'work' : 'think');
        this.enforceBubbleLimit();
        callbacks.onFeedback(callbacks.t('office.seated', { name: view.record.name, activity: target.kind === 'workSeat' ? 'WORK DEMO' : 'MEETING DEMO' }), 'success');
        callbacks.onReady(this.destinationList());
      }
    }
    private restoreWorkspaceState(view: AgentView) {
      const home = view.homeAnchorId ? this.anchors.get(view.homeAnchorId) : null;
      view.cell = { ...view.workspaceCell };
      view.segmentFrom = { ...view.workspaceCell };
      view.segmentTo = { ...view.workspaceCell };
      view.segmentElapsed = 0;
      view.occupiedAnchorId = home?.id || null;
      view.facing = home?.facing || 'SE';
      view.phase = home ? 'seated' : 'standing';
      if (home) view.sprite.setPosition(home.sit.worldX, home.sit.worldY);
      else {
        const position = this.project(view.workspaceCell);
        view.sprite.setPosition(position.x, position.y);
      }
      this.setPose(view, home ? activityOf(view.record) : 'idle');
    }
    setPreview(enabled: boolean) {
      preview = enabled;
      if (!enabled) {
        for (const view of this.agents.values()) {
          const plan = this.plans.get(view.record.id);
          if (plan) plan.engine.cancelPath(plan.requestId);
          this.plans.delete(view.record.id);
          if (view.targetAnchorId) this.reservations.delete(view.targetAnchorId);
          view.motionId += 1;
          view.path = [];
          view.waitElapsed = 0;
          view.replanAttempts = 0;
          view.targetAnchorId = null;
          this.restoreWorkspaceState(view);
        }
        this.reservations.clear();
        callbacks.onReady(this.destinationList());
      }
      callbacks.onPreviewChange(enabled);
      callbacks.onFeedback(enabled ? callbacks.t('office.previewEnabled') : callbacks.t('office.returned'), 'info');
    }
    shutdownOwned() {
      delete testContainer.__officeTest;
      if (testWindow.__THEMETEAM_OFFICE_TEST__?.owner === testHookOwner) delete testWindow.__THEMETEAM_OFFICE_TEST__;
      cancelAnimationFrame(this.resizeFrame);
      this.resizeObserver?.disconnect();
      container.removeEventListener('contextmenu', this.contextMenu);
      this.input.removeAllListeners();
      this.reservations.clear();
      this.stressAgents.clear();
      this.forcedDynamicBlocks.clear();
      this.resetGesture();
      this.game.canvas.removeEventListener('pointerdown', this.touchPointerDown);
      this.game.canvas.removeEventListener('pointermove', this.touchPointerMove);
      this.game.canvas.removeEventListener('pointerup', this.touchPointerUp);
      this.game.canvas.removeEventListener('pointercancel', this.pointerCancel);
      for (const plan of this.plans.values()) plan.engine.cancelPath(plan.requestId);
      this.plans.clear();
      for (const view of this.agents.values()) { view.sprite.destroy(); view.bubble.destroy(); }
      this.agents.clear();
    }
  }

  (async () => {
    try {
      const [mapResponse, assetResponse] = await Promise.all([
        fetch(MAP_URL, { signal: abort.signal }),
        fetch(ASSET_URL, { signal: abort.signal }),
      ]);
      if (!mapResponse.ok || !assetResponse.ok) throw new Error(callbacks.t('office.mapFailed'));
      const map = validateOfficeMap(await mapResponse.json());
      const assets = validateOfficeAssets(await assetResponse.json());
      const propFrames = new Set(assets.atlases.find(atlas => atlas.id === 'props')?.frames.map(frame => frame.id) || []);
      if (map.props.some(prop => !propFrames.has(prop.frameId))) throw new Error(callbacks.t('office.mapUnknownProp'));
      await verifyAssetFiles(assets, abort.signal, callbacks.t);
      if (destroyed) return;
      const SceneClass = class extends OfficeScene { constructor() { super(map, assets); } };
      game = new RootLocalGame({
        type: Phaser.AUTO,
        parent: container,
        width: Math.max(1, Math.round(container.clientWidth * pixelRatio)),
        height: Math.max(1, Math.round(container.clientHeight * pixelRatio)),
        backgroundColor: '#dce8e2',
        pixelArt: true,
        antialias: false,
        loader: { imageLoadType: 'HTMLImageElement' },
        render: { transparent: false, preserveDrawingBuffer: true },
        scale: { mode: Phaser.Scale.NONE, autoCenter: Phaser.Scale.CENTER_BOTH },
        scene: SceneClass,
        audio: { noAudio: true },
      });
      gameCanvas = game.canvas;
      gameCanvas.addEventListener('webglcontextlost', handleContextLost);
    } catch (error) {
      if (!destroyed && (error as Error).name !== 'AbortError') callbacks.onFeedback(error instanceof Error ? error.message : String(error), 'error');
    }
  })();

  return {
    bindSelect(callback) { selectCallback = callback; },
    update(snapshot, selection) {
      latestSnapshot = snapshot;
      latestSelection = selection;
      scene?.applyUpdate(snapshot, selection);
    },
    navigate(transition) {
      pendingNavigation = transition;
      scene?.applyNavigation(transition);
    },
    overview() { scene?.overview(); },
    focusSelected() { scene?.focusSelected(); },
    followSelected() { scene?.followSelected(); },
    stopFollowing() { scene?.stopFollowing(); },
    zoomBy(delta) { scene?.zoomBy(delta); },
    setPreview(enabled) {
      preview = enabled;
      if (scene) scene.setPreview(enabled);
      else callbacks.onPreviewChange(enabled);
    },
    moveSelected(anchorId) { scene?.moveSelected(anchorId); },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      abort.abort();
      selectCallback = null;
      gameCanvas?.removeEventListener('webglcontextlost', handleContextLost);
      gameCanvas = null;
      scene?.shutdownOwned();
      game?.destroy(true);
      scene = null;
      game = null;
      container.replaceChildren();
    },
  };
}
