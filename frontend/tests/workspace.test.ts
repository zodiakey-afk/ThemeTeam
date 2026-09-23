import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWorkspaceController } from '../src/workspace';
import { connectScene } from '../src/sceneBridge';
import type { Snapshot } from '../src/types';

function fixture(): Snapshot {
  return { id: 'workspace', name: 'Test', themeMode: 'retro', activeTeamId: 'team', selection: { kind: 'agent', id: 'a' },
    teams: [{ id: 'team', name: 'Team', leaderAgentId: 'a', capacity: 8, defaultModelProfileId: 'model', tags: [] }],
    agents: ['a', 'b'].map(id => ({ id, name: id, roleTemplate: 'developer', modelProfileId: 'model', seatId: 'room',
      status: 'Idle', appearancePresetId: 'default', teamId: 'team', leaderFlag: false, animationPackId: 'default', skinId: 'default' })),
    tasks: [{ id: 'task', title: 'Task', description: '', status: 'todo', priority: 'medium', assigneeIds: ['a'], sourceType: 'manual', dueAt: null, parentTaskId: null }],
    rooms: [{ id: 'room', name: 'Room', type: 'workstation', level: 1, x: 1, y: 1, width: 8, height: 8, occupantIds: ['a', 'b'], unlocked: true, visualPreset: 'retro' }],
    meetings: [], documents: [], memoryItems: [], modelProfiles: [{ id: 'model', name: 'Model', provider: 'Local', contextWindow: 100, capabilityTags: [], costLabel: 'local' }],
    events: [], lastSavedAt: null };
}
const ok = (data = fixture()) => new Response(JSON.stringify(data), { status: 200 });
afterEach(() => vi.useRealTimers());

describe('frozen W03 client contracts', () => {
  it('BB01 isolates roots and ignores backend selection', async () => {
    const fetcher = vi.fn(async () => ok());
    const a = createWorkspaceController(fetcher), b = createWorkspaceController(fetcher);
    await a.load(); await b.load();
    expect(a.store.getState().selection).toBeNull();
    a.select({ kind: 'agent', id: 'a' }); b.select({ kind: 'agent', id: 'b' });
    expect(a.store.getState().selection?.id).toBe('a'); expect(b.store.getState().selection?.id).toBe('b');
    expect(fetcher).toHaveBeenCalledTimes(2);
    a.dispose(); b.dispose();
  });
  it('BB02 serializes commands and handles definitive rejection', async () => {
    const calls: string[] = [];
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return String(input) === '/api/tasks' ? new Response(JSON.stringify({ error: { code: 'invalid_payload', message: 'Invalid task' } }), { status: 400 }) : ok();
    });
    const c = createWorkspaceController(fetcher);
    const results = await Promise.all([c.load(), c.createTask({ title: 'bad' }), c.save()]);
    expect(calls).toEqual(['/api/state', '/api/tasks', '/api/save']);
    expect(results).toEqual(['success', 'rejected', 'success']);
    expect(c.store.getState()).toMatchObject({ pending: 0, dirty: false, uncertain: false }); c.dispose();
  });
  it('BB02U unknown write freezes queued save/reload even after late commit', async () => {
    vi.useFakeTimers();
    let finish!: (value: Response) => void;
    const fetcher = vi.fn((input: RequestInfo | URL) => String(input) === '/api/tasks' ? new Promise<Response>(resolve => { finish = resolve; }) : Promise.resolve(ok()));
    const c = createWorkspaceController(fetcher, 50);
    await c.load();
    const first = c.createTask({ title: 'maybe' }); const saved = c.save(); const reloaded = c.reload();
    await vi.advanceTimersByTimeAsync(51);
    expect(await first).toBe('unknown'); expect(await saved).toBe('unknown'); expect(await reloaded).toBe('unknown');
    finish(ok()); await Promise.resolve();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(c.store.getState()).toMatchObject({ pending: 0, dirty: true, uncertain: true });
    await c.load(); expect(c.store.getState().uncertain).toBe(true);
    expect(await c.createAgent({ name: 'not sent' })).toBe('unknown');
    expect(fetcher).toHaveBeenCalledTimes(3); c.dispose();
  });
  it('BB02R invalid successful write response is uncertain without data loss', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(ok()).mockResolvedValueOnce(new Response('{}', { status: 201 }));
    const c = createWorkspaceController(fetcher);
    await c.load(); const before = c.store.getState().snapshot;
    expect(await c.createTask({ title: 'maybe' })).toBe('unknown');
    expect(c.store.getState().snapshot).toBe(before); expect(c.store.getState().dirty).toBe(true); c.dispose();
  });
  it.each([
    ['write', 500, 'internal_error', 'unknown'],
    ['write', 500, 'storage_error', 'unknown'],
    ['save', 500, 'storage_error', 'rejected'],
    ['reload', 500, 'storage_error', 'rejected'],
    ['write', 409, 'conflict', 'rejected'],
    ['write', 400, 'unrecognized_error', 'unknown'],
  ])('BB02R classifies %s HTTP %s %s as %s', async (effect, status, code, outcome) => {
    const fetcher = vi.fn().mockResolvedValueOnce(ok())
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code, message: 'Rejected command' } }), { status }))
      .mockImplementation(async () => ok());
    const c = createWorkspaceController(fetcher);
    await c.load();
    const command = effect === 'save' ? c.save() : effect === 'reload' ? c.reload() : c.createTask({ title: 'test' });
    const queued = c.createAgent({ name: 'next' });
    expect(await command).toBe(outcome);
    expect(await queued).toBe(outcome === 'unknown' ? 'unknown' : 'success');
    expect(fetcher).toHaveBeenCalledTimes(outcome === 'unknown' ? 2 : 3);
    expect(c.store.getState()).toMatchObject({ uncertain: outcome === 'unknown', pending: 0 });
    c.dispose();
  });
  it('BB02R network failure and unreadable JSON freeze writes without retry', async () => {
    for (const response of [() => Promise.reject(new TypeError('network')), () => Promise.resolve(new Response('{'))]) {
      const fetcher = vi.fn().mockResolvedValueOnce(ok()).mockImplementation(response);
      const c = createWorkspaceController(fetcher);
      await c.load(); const before = c.store.getState().snapshot;
      expect(await c.createTask({ title: 'test' })).toBe('unknown');
      expect(await c.save()).toBe('unknown');
      expect(c.store.getState()).toMatchObject({ snapshot: before, uncertain: true, dirty: true, pending: 0 });
      expect(fetcher).toHaveBeenCalledTimes(2); c.dispose();
    }
  });
  it.each([
    { error: { code: 'invalid_payload' } },
    { error: { code: 'invalid_payload', message: 42 } },
    { error: { code: 'invalid_payload', message: 'bad', extra: true } },
    { error: { code: 'invalid_payload', message: 'bad' }, extra: true },
    { error: null },
  ])('BB02R malformed 4xx envelope remains uncertain: %j', async body => {
    const fetcher = vi.fn().mockResolvedValueOnce(ok())
      .mockResolvedValueOnce(new Response(JSON.stringify(body), { status: 400 }));
    const c = createWorkspaceController(fetcher); await c.load();
    const before = c.store.getState().snapshot;
    const write = c.createTask({ title: 'test' }), save = c.save();
    expect(await write).toBe('unknown'); expect(await save).toBe('unknown');
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(c.store.getState()).toMatchObject({ snapshot: before, uncertain: true, dirty: true, pending: 0 }); c.dispose();
  });
  it('BB02R malformed storage rejection cannot release queued save', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(ok()).mockResolvedValueOnce(new Response(
      JSON.stringify({ error: { code: 'storage_error', message: [] } }), { status: 500 }));
    const c = createWorkspaceController(fetcher); await c.load();
    const first = c.save(), second = c.save();
    expect(await first).toBe('unknown'); expect(await second).toBe('unknown');
    expect(fetcher).toHaveBeenCalledTimes(2); c.dispose();
  });
  it('BB02U queued timeout starts at dispatch, not enqueue', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn(() => new Promise<Response>(resolve => setTimeout(() => resolve(ok()), 40)));
    const c = createWorkspaceController(fetcher, 50);
    const first = c.load(), second = c.createTask({ title: 'second' });
    await vi.advanceTimersByTimeAsync(81);
    expect(await first).toBe('success'); expect(await second).toBe('success');
    expect(c.store.getState()).toMatchObject({ uncertain: false, dirty: true, pending: 0 }); c.dispose();
  });
  it('BB03 aborts/disposes without late publication or queued network calls', async () => {
    let signal: AbortSignal | null | undefined;
    const fetcher = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => { signal = init?.signal; return new Promise<Response>(() => undefined); });
    const c = createWorkspaceController(fetcher);
    const first = c.load(); const second = c.createTask({ title: 'never' });
    await Promise.resolve(); c.dispose();
    expect(await first).toBe('disposed'); expect(await second).toBe('disposed');
    expect(signal?.aborted).toBe(true); expect(fetcher).toHaveBeenCalledTimes(1);
    expect(c.store.getState()).toMatchObject({ pending: 0, snapshot: null });
  });
  it('BB03 covers timeout during body parsing, not only response headers', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn(async () => ({ ok: true, status: 200, json: () => new Promise(() => undefined) }) as Response);
    const c = createWorkspaceController(fetcher, 10);
    const result = c.load(); await vi.advanceTimersByTimeAsync(11);
    expect(await result).toBe('rejected'); expect(c.store.getState().pending).toBe(0); c.dispose();
  });
  it('BB04 one bridge subscription, updates only snapshot/selection, destroy once', async () => {
    const c = createWorkspaceController(async () => ok());
    const adapter = { update: vi.fn(), destroy: vi.fn() };
    const dispose = connectScene(c.store, adapter);
    expect(adapter.update).toHaveBeenCalledTimes(1);
    await c.load(); c.select({ kind: 'agent', id: 'a' });
    expect(adapter.update).toHaveBeenCalledTimes(3);
    c.closeInspector(); expect(adapter.update).toHaveBeenCalledTimes(3);
    dispose(); dispose(); c.select({ kind: 'agent', id: 'b' });
    expect(adapter.destroy).toHaveBeenCalledTimes(1); expect(adapter.update).toHaveBeenCalledTimes(3); c.dispose();
  });
  it('WB-M1-03 emits root navigation before committing the matching selection update', async () => {
    const c = createWorkspaceController(async () => ok());
    await c.load();
    const order: string[] = [];
    const adapter = {
      update: vi.fn((_snapshot, selection) => order.push(`update:${selection?.id || 'none'}`)),
      navigate: vi.fn(transition => {
        order.push(`navigate:${transition.reason}:${transition.to?.id || 'none'}`);
        expect(c.store.getState().selection).toBeNull();
      }),
      destroy: vi.fn(),
    };
    const disconnect = connectScene(c.store, adapter, c.subscribeNavigation);
    order.length = 0;
    c.select({ kind: 'agent', id: 'a' });
    expect(order).toEqual(['navigate:select-different:a', 'update:a']);
    expect(adapter.navigate.mock.calls[0][0]).toMatchObject({ sequence: 1, from: null, to: { kind: 'agent', id: 'a' }, cameraAction: 'capture' });
    disconnect(); c.dispose();
  });
  it('BB-M1-18 keeps navigation sequences and delivery isolated per root', async () => {
    const a = createWorkspaceController(async () => ok()), b = createWorkspaceController(async () => ok());
    await a.load(); await b.load();
    const eventsA: unknown[] = [], eventsB: unknown[] = [];
    const disconnectA = connectScene(a.store, { update: vi.fn(), navigate: event => eventsA.push(event), destroy: vi.fn() }, a.subscribeNavigation);
    const disconnectB = connectScene(b.store, { update: vi.fn(), navigate: event => eventsB.push(event), destroy: vi.fn() }, b.subscribeNavigation);
    a.select({ kind: 'agent', id: 'a' });
    a.select({ kind: 'agent', id: 'a' });
    b.select({ kind: 'agent', id: 'b' });
    a.closeInspector();
    expect(eventsA).toMatchObject([
      { sequence: 1, reason: 'select-different', to: { id: 'a' } },
      { sequence: 2, reason: 'select-same', to: { id: 'a' } },
      { sequence: 3, reason: 'close', to: { id: 'a' } },
    ]);
    expect(eventsB).toMatchObject([{ sequence: 1, reason: 'select-different', to: { id: 'b' } }]);
    disconnectA(); disconnectB(); a.dispose(); b.dispose();
  });
  it('BB-M1-18 clears selection and history without affecting business data', async () => {
    const c = createWorkspaceController(async () => ok());
    await c.load();
    const transitions: unknown[] = [];
    const disconnect = c.subscribeNavigation(event => transitions.push(event));
    c.select({ kind: 'task', id: 'task' });
    c.select({ kind: 'agent', id: 'a' });
    const snapshot = c.store.getState().snapshot;
    c.clearSelection();
    expect(c.store.getState()).toMatchObject({ snapshot, selection: null, previousSelection: null, inspectorOpen: false });
    expect(transitions.at(-1)).toMatchObject({ reason: 'clear', from: { kind: 'agent', id: 'a' }, to: null, cameraAction: 'drop' });
    disconnect(); c.dispose();
  });
  it('BB01S task-owner-back and close-reopen retain local context', async () => {
    const c = createWorkspaceController(async () => ok()); await c.load();
    c.select({ kind: 'task', id: 'task' }); c.select({ kind: 'agent', id: 'a' });
    c.closeInspector(); expect(c.store.getState()).toMatchObject({ selection: { id: 'a' }, inspectorOpen: false });
    c.select({ kind: 'agent', id: 'a' }); c.back();
    expect(c.store.getState()).toMatchObject({ selection: { id: 'task' }, previousSelection: null, inspectorOpen: true });
    c.select({ kind: 'agent', id: 'missing' }); expect(c.store.getState().selection?.id).toBe('task'); c.dispose();
  });
  it('BB05 partial GET retains prior snapshot and does not mark dirty', async () => {
    const c = createWorkspaceController(vi.fn().mockResolvedValueOnce(ok()).mockResolvedValueOnce(new Response('{}')));
    await c.load(); const before = c.store.getState().snapshot;
    expect(await c.load()).toBe('rejected');
    expect(c.store.getState()).toMatchObject({ snapshot: before, dirty: false, uncertain: false, pending: 0 }); c.dispose();
  });
  it('BB05R empty or non-JSON API responses become a readable connection error', async () => {
    for (const response of [
      new Response('', { status: 502 }),
      new Response('<html>bad gateway</html>', { status: 502 }),
    ]) {
      const c = createWorkspaceController(vi.fn().mockResolvedValueOnce(response));
      expect(await c.load()).toBe('rejected');
      expect(c.store.getState().error).toMatch(/服务端返回(为空|不是有效 JSON)/);
      expect(c.store.getState().uncertain).toBe(false);
      c.dispose();
    }
  });
  it('BB07S reload prunes missing selection and history', async () => {
    const empty = fixture(); empty.agents = []; empty.tasks = [];
    const c = createWorkspaceController(vi.fn().mockResolvedValueOnce(ok()).mockResolvedValueOnce(ok(empty)));
    await c.load(); c.select({ kind: 'task', id: 'task' }); c.select({ kind: 'agent', id: 'a' });
    await c.reload(); expect(c.store.getState()).toMatchObject({ selection: null, previousSelection: null, inspectorOpen: false }); c.dispose();
  });
});
