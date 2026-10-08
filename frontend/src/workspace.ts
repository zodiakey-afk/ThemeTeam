import { createStore } from 'zustand/vanilla';
import { validateSnapshot, validateError } from './validators.mjs';
import type { ClientState, Outcome, Selection, Snapshot, TaskRun } from './types';
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
  const store = createStore<ClientState>(() => ({ snapshot: null, taskRuns: [], selection: null, previousSelection: null,
    inspectorOpen: false, pending: 0, error: null, dirty: false, uncertain: false, disposed: false }));
  let tail: Promise<unknown> = Promise.resolve();
  let active: AbortController | null = null;
  const m2Active = new Set<AbortController>();
  let m2Socket: WebSocket | null = null;
  let m2ReconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let m2SocketEnabled = false;
  let m2Cursor = 0;
  let m2Version: number | undefined;
  const m2EventIds = new Set<string>();
  const isM2Unknown = (error: unknown) => error instanceof Error && error.name === 'M2UnknownOutcome';
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
  function m2Envelope(payload: object, expectedVersion?: number) {
    const id = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return {
      commandId: `cmd_${id()}`,
      idempotencyKey: `idem_${id()}`,
      correlationId: `corr_${id()}`,
      ...(expectedVersion === undefined ? {} : { expectedVersion }),
      payload,
    };
  }
  async function m2Request(path: string, body?: object, expectedVersion?: number): Promise<unknown> {
    const abort = new AbortController();
    m2Active.add(abort);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let responseComplete = false;
    try {
      const data = await Promise.race([
        (async () => {
          const response = await fetcher(`/api/v1${path}`, {
            method: body === undefined ? 'GET' : 'POST',
            signal: abort.signal,
            headers: { 'Content-Type': 'application/json' },
            ...(body === undefined ? {} : { body: JSON.stringify(m2Envelope(body, expectedVersion)) }),
          });
          const data = await readJsonResponse(response);
          responseComplete = true;
          return { response, data };
        })(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            abort.abort();
            reject(new Error('M2 请求超时'));
          }, timeoutMs);
        }),
      ]);
      const response = data.response;
      const payload = data.data;
      if (!response.ok) throw new Error(
        payload && typeof payload === 'object' && 'error' in payload
          ? String((payload as { error: { code?: string } }).error?.code || `HTTP ${response.status}`)
          : `HTTP ${response.status}`,
      );
      return payload;
    } catch (error) {
      if (body !== undefined && !responseComplete && error instanceof Error && error.name !== 'M2UnknownOutcome') {
        error.name = 'M2UnknownOutcome';
      }
      throw error;
    } finally {
      clearTimeout(timer);
      m2Active.delete(abort);
    }
  }
  async function applyM2Snapshot(): Promise<Outcome> {
    if (store.getState().disposed) return 'disposed';
    try {
      const data = await m2Request('/workspaces/workspace_main/snapshot') as { snapshot?: Snapshot };
      if (store.getState().disposed) return 'disposed';
      if (!data.snapshot || !validateSnapshot(data.snapshot)) throw new Error('M2 快照结构无效');
      if (typeof (data as { snapshotVersion?: unknown }).snapshotVersion === 'number') {
        m2Version = (data as { snapshotVersion: number }).snapshotVersion;
      }
      if (typeof (data as { cursor?: unknown }).cursor === 'number') {
        m2Cursor = (data as { cursor: number }).cursor;
      }
      const current = store.getState();
      const selection = exists(data.snapshot, current.selection) ? current.selection : null;
      const previousSelection = exists(data.snapshot, current.previousSelection) ? current.previousSelection : null;
      store.setState({
        snapshot: data.snapshot,
        selection,
        previousSelection,
        inspectorOpen: !!selection && current.inspectorOpen,
        dirty: false,
      });
      return 'success';
    } catch (error) {
      if (!store.getState().disposed) store.setState({ error: `M2 工作区不可用：${String(error)}` });
      return 'rejected';
    }
  }
  async function createTaskM2(body: object): Promise<Outcome> {
    if (store.getState().disposed) return 'disposed';
    if (store.getState().uncertain) return 'unknown';
    try {
      await m2Request('/tasks', body);
      if (store.getState().disposed) return 'disposed';
      return applyM2Snapshot();
    } catch (error) {
      if (store.getState().disposed) return 'disposed';
      if (isM2Unknown(error)) {
        store.setState({ uncertain: true, dirty: true, error: (error as Error).message });
        return 'unknown';
      }
      if (!store.getState().disposed) store.setState({ error: `M2 创建任务失败：${String(error)}` });
      return 'rejected';
    }
  }
  async function refreshTaskRuns(taskId?: string): Promise<Outcome> {
    if (store.getState().disposed) return 'disposed';
    try {
      const data = await m2Request(`/runs${taskId ? `?taskId=${encodeURIComponent(taskId)}` : ''}`) as { runs?: TaskRun[] };
      if (store.getState().disposed) return 'disposed';
      store.setState({ taskRuns: Array.isArray(data.runs) ? data.runs : [] });
      return 'success';
    } catch (error) {
      if (store.getState().disposed) return 'disposed';
      if (!store.getState().disposed) store.setState({ error: `M2 运行服务不可用：${String(error)}` });
      return 'rejected';
    }
  }
  async function m2RunCommand(path: string, payload: object, expectedVersion?: number): Promise<Outcome> {
    if (store.getState().disposed) return 'disposed';
    if (store.getState().uncertain) return 'unknown';
    try {
      const data = await m2Request(path, payload, expectedVersion) as { run?: TaskRun };
      if (store.getState().disposed) return 'disposed';
      if (data.run) {
        const current = store.getState().taskRuns.filter(item => item.runId !== data.run!.runId);
        store.setState({ taskRuns: [...current, data.run] });
      }
      return 'success';
    } catch (error) {
      if (store.getState().disposed) return 'disposed';
      if (isM2Unknown(error)) {
        store.setState({ uncertain: true, dirty: true, error: (error as Error).message });
        return 'unknown';
      }
      if (!store.getState().disposed) store.setState({ error: `M2 运行命令失败：${String(error)}` });
      return 'rejected';
    }
  }
  async function m2ConfigCommand(path: string, payload: object): Promise<Outcome> {
    if (store.getState().disposed) return 'disposed';
    if (store.getState().uncertain) return 'unknown';
    try {
      await m2Request(path, payload);
      return applyM2Snapshot();
    } catch (error) {
      if (store.getState().disposed) return 'disposed';
      if (isM2Unknown(error)) {
        store.setState({ uncertain: true, dirty: true, error: (error as Error).message });
        return 'unknown';
      }
      store.setState({ error: `M2 配置写入失败：${String(error)}` });
      return 'rejected';
    }
  }
  async function applyM2Event(event: {
    eventId?: string;
    type?: string;
    seq?: number;
    payload?: { snapshotVersion?: number; lastSeq?: number };
  }) {
    if (store.getState().disposed) return;
    if (event.eventId && m2EventIds.has(event.eventId)) return;
    if (event.eventId) m2EventIds.add(event.eventId);
    if (typeof event.seq === 'number' && m2Cursor > 0 && event.seq > m2Cursor + 1) {
      await applyM2Snapshot();
      return;
    }
    if (typeof event.seq === 'number') m2Cursor = Math.max(m2Cursor, event.seq);
    if (event.type === 'resync_required') {
      await applyM2Snapshot();
      return;
    }
    if (event.type === 'subscription.ready') {
      m2Cursor = Math.max(m2Cursor, event.payload?.lastSeq || 0);
      if (typeof event.payload?.snapshotVersion === 'number') m2Version = event.payload.snapshotVersion;
      return;
    }
    if (event.type?.startsWith('run.') || event.type === 'approval.updated' || event.type === 'artifact.completed') {
      await refreshTaskRuns();
    } else if (event.type?.startsWith('task.') || event.type?.endsWith('.created')) {
      await applyM2Snapshot();
    }
  }
  function connectM2Events(): Outcome {
    if (store.getState().disposed) return 'disposed';
    m2SocketEnabled = true;
    if (m2Socket) return 'success';
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    m2Socket = new WebSocket(
      `${protocol}//${window.location.host}/api/v1/workspaces/workspace_main/events?lastSeenSeq=${m2Cursor}`,
    );
    m2Socket.onmessage = event => {
      try {
        void applyM2Event(JSON.parse(event.data) as {
          type?: string;
          eventId?: string;
          seq?: number;
          payload?: { snapshotVersion?: number; lastSeq?: number };
        });
      } catch {
        store.setState({ error: 'M2 事件格式无效' });
      }
    };
    m2Socket.onclose = () => {
      m2Socket = null;
      if (m2SocketEnabled && !store.getState().disposed) {
        clearTimeout(m2ReconnectTimer);
        m2ReconnectTimer = setTimeout(() => { void connectM2Events(); }, 1000);
      }
    };
    m2Socket.onerror = () => {
      store.setState({ error: 'M2 事件连接不可用' });
    };
    return 'success';
  }
  function disconnectM2Events(): void {
    m2SocketEnabled = false;
    clearTimeout(m2ReconnectTimer);
    m2Socket?.close();
    m2Socket = null;
  }
  return {
    store,
    load: () => request('/api/state', 'read'),
    save: () => request('/api/save', 'save'),
    reload: () => request('/api/reload', 'reload'),
    createAgent: (body: object) => request('/api/agents', 'write', body),
    createAgentM2: (body: object) => m2ConfigCommand('/agents', body),
    createRuntimeProfileM2: (body: object) => m2ConfigCommand('/runtime-profiles', body),
    createProjectDirectoryM2: (body: object) => m2ConfigCommand('/project-directories', body),
    createRuntimeProfile: (body: object) => request('/api/runtime-profiles', 'write', body),
    probeRuntime: (id: string) => request(`/api/runtime-profiles/${encodeURIComponent(id)}/probe`, 'write', {}),
    createProjectDirectory: (body: object) => request('/api/project-directories', 'write', body),
    runMockProject: (body: object) => request('/api/runtime/mock-project', 'write', body),
    runTask: (body: object) => request('/api/task-runs', 'write', body),
    runTaskM2: (body: object) => m2RunCommand('/runs', body),
    loadM2Snapshot: applyM2Snapshot,
    createTaskM2,
    listTaskRunsM2: (taskId?: string) => refreshTaskRuns(taskId),
    approveTaskRunM2: (runId: string) => {
      const run = store.getState().taskRuns.find(item => item.runId === runId);
      return m2RunCommand(`/runs/${encodeURIComponent(runId)}/approve`, {}, run?.version);
    },
    rejectTaskRunM2: (runId: string, reason: string) => m2RunCommand(`/runs/${encodeURIComponent(runId)}/reject`, { reason }),
    cancelTaskRunM2: (runId: string) => {
      const run = store.getState().taskRuns.find(item => item.runId === runId);
      return m2RunCommand(`/runs/${encodeURIComponent(runId)}/cancel`, {}, run?.version);
    },
    retryTaskRunM2: (runId: string) => {
      const run = store.getState().taskRuns.find(item => item.runId === runId);
      return m2RunCommand(`/runs/${encodeURIComponent(runId)}/retry`, {}, run?.version);
    },
    connectM2Events,
    disconnectM2Events,
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
      for (const abort of m2Active) abort.abort();
      m2Active.clear();
      disconnectM2Events();
      navigationListeners.clear();
      store.setState({ disposed: true, pending: 0 });
    },
  };
}
export type WorkspaceController = ReturnType<typeof createWorkspaceController>;
