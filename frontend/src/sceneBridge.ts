import type { StoreApi } from 'zustand/vanilla';
import type { ClientState, Selection, Snapshot } from './types';

export type NavigationReason = 'select-different' | 'select-same' | 'clear' | 'close' | 'back' | 'prune' | 'deleted';
export type CameraAction = 'capture' | 'keep' | 'restore' | 'drop';
export interface RootNavigationTransition {
  sequence: number;
  reason: NavigationReason;
  from: Selection | null;
  to: Selection | null;
  cameraAction: CameraAction;
}
export interface SceneAdapter {
  update(snapshot: Snapshot | null, selection: Selection | null): void;
  navigate?(transition: RootNavigationTransition): void;
  destroy(): void;
}
export type NavigationSubscription = (listener: (transition: RootNavigationTransition) => void) => () => void;

export function connectScene(
  store: StoreApi<ClientState>,
  adapter: SceneAdapter,
  subscribeNavigation?: NavigationSubscription,
) {
  let stopped = false;
  const state = store.getState();
  adapter.update(state.snapshot, state.selection);
  const unsubscribeNavigation = subscribeNavigation?.(transition => {
    if (!stopped) adapter.navigate?.(transition);
  });
  const unsubscribe = store.subscribe((next, previous) => {
    if (!stopped && !next.disposed && (next.snapshot !== previous.snapshot || next.selection !== previous.selection)) {
      adapter.update(next.snapshot, next.selection);
    }
  });
  return () => {
    if (stopped) return;
    stopped = true;
    unsubscribeNavigation?.();
    unsubscribe();
    adapter.destroy();
  };
}
