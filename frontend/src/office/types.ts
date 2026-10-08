import type { SceneAdapter } from '../sceneBridge';
import type { Selection } from '../types';
import type { MessageKey } from '../i18n';

export interface GridPoint { col: number; row: number }
export interface WorldPoint { worldX: number; worldY: number }
export type Facing = 'NE' | 'SE' | 'SW' | 'NW';
export interface OfficeRoomBinding { key: string; roomId: string; roomType: string; movementEnabled: boolean; cells: GridPoint[] }
export interface OfficeAnchor {
  id: string; kind: 'workSeat' | 'meetingSeat'; roomKey: string; stand: GridPoint; approach: GridPoint;
  sit: WorldPoint; facing: Facing; footprint: GridPoint[];
}
export interface OfficeMap {
  version: '0.3'; mapRevision: string;
  dimensions: { columns: number; rows: number; tileWidth: number; tileHeight: number };
  origin: { x: number; y: number }; roomBindings: OfficeRoomBinding[]; collision: string[];
  doors: { id: string; cell: GridPoint; roomKeys: string[]; open: boolean }[];
  anchors: OfficeAnchor[];
  props: { id: string; frameId: string; cell: GridPoint; layer: string; depthOffset: number }[];
  spawns: GridPoint[]; renderLayers: string[];
}
export interface AtlasFrame {
  id: string; x: number; y: number; width: number; height: number; pivotX: number; pivotY: number; kind: string;
}
export interface OfficeAssets {
  version: '0.3';
  rightsReview: { status: 'approved' | 'pending' | 'rejected'; reviewer: string | null; reviewedAt: string | null; distributionScope: string };
  atlases: { id: 'agents' | 'props'; image: string; sha256: string; width: number; height: number; source: string; author: string; license: string; frames: AtlasFrame[] }[];
  animations: { id: string; role: string; activity: string; direction: Facing; frameIds: string[]; fps: number; loop: boolean }[];
  fallbacks: { unknownRole: string; unknownActivity: string; missingFrame: string };
}
export interface OfficeDestination { id: string; label: string; kind: OfficeAnchor['kind']; roomKey: string; occupied: boolean }
export interface OfficeSafeRect { left: number; top: number; right: number; bottom: number }
export interface OfficeSceneAdapter extends SceneAdapter {
  bindSelect(callback: (selection: Selection | null) => void): void;
  overview(): void; focusSelected(): void; followSelected(): void; stopFollowing(): void; zoomBy(delta: number): void;
  setPreview(enabled: boolean): void; moveSelected(anchorId: string): void;
}
export type OfficeTranslator = (key: MessageKey, values?: Record<string, string | number>) => string;
