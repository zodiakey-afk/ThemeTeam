import { createStore } from 'zustand/vanilla';
import { validateSnapshot, validateError } from './validators.mjs';
import type { ClientState, Outcome, Selection, Snapshot } from './types';
import type { CameraAction, NavigationReason, RootNavigationTransition } from './sceneBridge';

const collections = { agent: 'agents', task: 'tasks', room: 'rooms', meeting: 'meetings', document: 'documents' } as const;
export function exists(snapshot: Snapshot | null, selection: Selection | null): selection is Selection {
  return !!snapshot && !!selection && snapshot[collections[selection.kind]].some(item => item.id === selection.id);
}
const same = (a: Selection | null, b: Selection | null) => a?.kind === b?.kind && a?.id === b?.id;

async function readJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text.trim()) throw new Error(`服务端返回为空（HTTP ${response.status}）`);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`服务端返回不是有效 JSON（HTTP ${response.status}）`);
  }
}

export function createWorkspaceController(fetcher: typeof fetch = fetch, timeoutMs = 10000) {
  const store = createStore<ClientState>(() => ({ snapshot: null, selection: null, previousSelection: null,
    inspectorOpen: false, pending: 0, error: null, dirty: false, uncertain: false, disposed: false }));
  let tail: Promise<unknown> = Promise.resolve();
  let active: AbortController | null = null;
  let navigationSequence = 0;
  const navigationListeners = new Set<(transition: RootNavigationTransition) => void>();

  function navigate(reason: NavigationReason, from: Selection | null, to: Selection | null, cameraAction: CameraAction) {
    const transition = { sequence: ++navigationSequence, reason, from, to, cameraAction } satisfies RootNavigationTransition;
    for (const listener of navigationListeners) {
      try { listener(transition); } catch { /* A scene observer cannot block business selection. */ }
    }
  }

  function request(path: string, effect: 'read' | 'write' | 'save' | 'reload', body?: object): Promise<Outcome> {
    if (store.getState().disposed) return Promise.resolve('disposed');
    store.setState(s => ({ pending: s.pending + 1 }));
    const job = async (): Promise<Outcome> => {
      if (store.getState().disposed) return 'disposed';
      if (store.getState().uncertain && effect !== 'read') {
        store.setState(s => ({ pending: s.pending - 1 }));
        return 'unknown';
      }
      active = new AbortController();
      const abort = active;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let onAbort: () => void = () => undefined;
      let definite = false;
      if (!store.getState().uncertain) store.setState({ error: null });
      try {
        const { response, data } = await Promise.race([
          (async () => {
            const response = await fetcher(path, { method: effect === 'read' ? 'GET' : 'POST', signal: abort.signal,
              headers: { 'Content-Type': 'application/json' }, ...(effect === 'read' ? {} : { body: JSON.stringify(body || {}) }) });
            return { response, data: await readJsonResponse(response) };
          })(),
          new Promise<never>((_, reject) => {
            onAbort = () => reject(new Error('请求中断或超时'));
            abort.signal.addEventListener('abort', onAbort, { once: true });
            timer = setTimeout(() => abort.abort(), timeoutMs);
          }),
        ]);
        if (!response.ok) {
          const error = validateError(data) ? data.error : null;
          const known = ['invalid_payload', 'forbidden', 'not_found', 'conflict', 'payload_too_large'];
          definite = !!error?.code && ((response.status >= 400 && response.status < 500 && known.includes(error.code)) ||
            (response.status === 500 && error.code === 'storage_error' && (effect === 'save' || effect === 'reload')));
          throw new Error(error?.code || `HTTP ${response.status}`);
        }
        const snapshotData = (data && typeof data === 'object' && 'workspace' in data &&
          validateSnapshot((data as { workspace: unknown }).workspace))
          ? (data as { workspace: Snapshot }).workspace
          : data;
        if (!validateSnapshot(snapshotData)) throw new Error('工作区响应结构无效');
        if (store.getState().disposed) return 'disposed';
        const current = store.getState();
        const selection = exists(snapshotData, current.selection) ? current.selection : null;
        const previousSelection = exists(snapshotData, current.previousSelection) ? current.previousSelection : null;
        if (current.selection && !selection) navigate('deleted', current.selection, null, 'drop');
        else if (current.previousSelection && !previousSelection) navigate('prune', current.previousSelection, selection, 'drop');
        store.setState({ snapshot: snapshotData, selection, previousSelection,
          inspectorOpen: !!selection && current.inspectorOpen,
          dirty: effect === 'save' || effect === 'reload' ? false : effect === 'write' ? true : current.dirty,
          error: current.uncertain ? current.error : null });
        return 'success';
      } catch (error) {
        if (store.getState().disposed) return 'disposed';
        const unknown = effect !== 'read' && !definite;
        store.setState(s => ({ error: unknown ? '操作结果未知，已暂停本会话写入。请在服务端确认结束后重新打开工作区。' : String(error),
          uncertain: s.uncertain || unknown, dirty: s.dirty || unknown }));
        return unknown ? 'unknown' : 'rejected';
      } finally {
        clearTimeout(timer);
        abort.signal.removeEventListener('abort', onAbort);
        if (active === abort) active = null;
        if (!store.getState().disposed) store.setState(s => ({ pending: Math.max(0, s.pending - 1) }));
      }
    };
    const result = tail.then(job);
    tail = result.catch(() => undefined);
    return result;
  }
  return {
    store,
    load: () => request('/api/state', 'read'),
    save: () => request('/api/save', 'save'),
    reload: () => request('/api/reload', 'reload'),
    createAgent: (body: object) => request('/api/agents', 'write', body),
    createRuntimeProfile: (body: object) => request('/api/runtime-profiles', 'write', body),
    probeRuntime: (id: string) => request(`/api/runtime-profiles/${encodeURIComponent(id)}/probe`, 'write', {}),
    createProjectDirectory: (body: object) => request('/api/project-directories', 'write', body),
    runMockProject: (body: object) => request('/api/runtime/mock-project', 'write', body),
    runTask: (body: object) => request('/api/task-runs', 'write', body),
    cancelTaskRun: (runId: string) => request('/api/task-runs/cancel', 'write', { runId }),
    retryTaskRun: (runId: string) => request('/api/task-runs/retry', 'write', { runId }),
    createTask: (body: object) => request('/api/tasks', 'write', body),
    setTaskStatus: (id: string, status: string) => request(`/api/tasks/${encodeURIComponent(id)}/status`, 'write', { status }),
    subscribeNavigation(listener: (transition: RootNavigationTransition) => void) {
      navigationListeners.add(listener);
      return () => navigationListeners.delete(listener);
    },
    select(selection: Selection) {
      const state = store.getState();
      if (state.disposed || !exists(state.snapshot, selection)) return;
      const isSame = same(state.selection, selection);
      navigate(isSame ? 'select-same' : 'select-different', state.selection, selection, isSame ? 'keep' : 'capture');
      store.setState({ selection, previousSelection: isSame ? state.previousSelection : state.selection, inspectorOpen: true });
    },
    clearSelection() {
      const state = store.getState();
      if (state.disposed || !state.selection) return;
      navigate('clear', state.selection, null, 'drop');
      store.setState({ selection: null, previousSelection: null, inspectorOpen: false });
    },
    closeInspector() {
      const state = store.getState();
      if (state.disposed) return;
      navigate('close', state.selection, state.selection, 'keep');
      store.setState({ inspectorOpen: false });
    },
    back() {
      const state = store.getState();
      if (state.disposed) return;
      const previous = exists(state.snapshot, state.previousSelection) ? state.previousSelection : null;
      navigate('back', state.selection, previous, 'restore');
      store.setState({ selection: previous, previousSelection: null, inspectorOpen: !!previous });
    },
    dispose() {
      if (store.getState().disposed) return;
      active?.abort();
      navigationListeners.clear();
      store.setState({ disposed: true, pending: 0 });
    },
  };
}
export type WorkspaceController = ReturnType<typeof createWorkspaceController>;
