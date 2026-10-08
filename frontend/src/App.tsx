import { useEffect, useId, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { ArrowLeft, Building2, Check, ChevronRight, ClipboardList, FileText, LayoutGrid, Menu, MessageSquare, Plus, RefreshCw, Save, Search, Settings, Users, UserRound, X } from 'lucide-react';
import type { Selection, Task, TaskRun, View } from './types';
import type { WorkspaceController } from './workspace';
import { OfficeCanvas } from './office/OfficeCanvas';
import { translate, type Language } from './i18n';

const columns = [['todo', 'task.todo'], ['in_progress', 'task.inProgress'], ['in_review', 'task.inReview'], ['done', 'task.done']] as const;
const selectionKey = (s: Selection) => `${s.kind}:${s.id}`;
export function App({ controller }: { controller: WorkspaceController }) {
  const state = useStore(controller.store);
  const [language, setLanguage] = useState<Language>(() => (localStorage.getItem('themeteam-language') === 'en' ? 'en' : 'zh'));
  const [view, setView] = useState<View>('office');
  const [query, setQuery] = useState('');
  const [navOpen, setNavOpen] = useState(false);
  const [form, setForm] = useState<'agent' | 'task' | null>(null);
  const [runtimeMessage, setRuntimeMessage] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const formTrigger = useRef<HTMLButtonElement | null>(null);
  const workspaceRoot = useRef<HTMLDivElement>(null);
  const selectionTrigger = useRef<HTMLButtonElement | null>(null);
  const formTitleId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const snapshot = state.snapshot;
  const t = (key: Parameters<typeof translate>[1], values?: Record<string, string | number>) => translate(language, key, values);
  const statusName = (status: string) => {
    const key = columns.find(([candidate]) => candidate === status)?.[1];
    return key ? t(key as Parameters<typeof translate>[1]) : status;
  };
  const runStatusName = (status: string) => {
    const keys: Record<string, Parameters<typeof translate>[1]> = {
      waiting: 'run.waiting', queued: 'run.queued', running: 'run.running', succeeded: 'run.succeeded',
      failed: 'run.failed', cancelled: 'run.cancelled', timed_out: 'run.timedOut',
      interrupted: 'run.interrupted', environment_unavailable: 'run.environmentUnavailable', rejected: 'run.rejected',
    };
    return keys[status] ? t(keys[status]) : status;
  };
  const roleName = (role: string) => {
    const keys: Record<string, Parameters<typeof translate>[1]> = {
      developer: 'agent.developer', pm: 'agent.pm', tester: 'agent.tester',
    };
    return keys[role] ? t(keys[role]) : role;
  };
  const disabled = state.pending > 0 || state.uncertain;
  const name = snapshot?.teams.find(t => t.id === snapshot.activeTeamId)?.name || t('ui.workspaceName');
  const nav = [
    { id: 'office', label: t('nav.office'), icon: Building2 }, { id: 'tasks', label: t('nav.tasks'), icon: ClipboardList }, { id: 'agents', label: t('nav.agents'), icon: Users },
    { id: 'meetings', label: t('nav.meetings'), icon: MessageSquare }, { id: 'documents', label: t('nav.documents'), icon: FileText },
    { id: 'settings', label: t('nav.settings'), icon: Settings },
  ] as const;
  const choose = (selection: Selection) => { controller.select(selection); setNavOpen(false); };
  function focusSelection(preferInvoker = false) {
    const selection = controller.store.getState().selection;
    requestAnimationFrame(() => {
      const invoker = selectionTrigger.current;
      if (preferInvoker && selection && invoker?.isConnected && workspaceRoot.current?.contains(invoker) &&
        invoker.dataset.entity === selectionKey(selection) && invoker.getClientRects().length > 0) {
        invoker.focus();
        return;
      }
      const target = selection && [...(workspaceRoot.current?.querySelectorAll<HTMLElement>('.content [data-entity], .navigation [data-entity]') || [])]
        .find(el => el.dataset.entity === selectionKey(selection) && el.getClientRects().length > 0);
      (target || heading.current)?.focus();
    });
  }
  useEffect(() => {
    const unsubscribe = controller.store.subscribe((next, previous) => {
      if (previous.selection && !next.selection && workspaceRoot.current?.contains(document.activeElement) &&
        document.activeElement?.closest('.inspector')) focusSelection();
    });
    void controller.loadM2Snapshot().then(outcome => {
      if (outcome !== 'success') void controller.load();
    });
    return () => { unsubscribe(); controller.dispose(); };
  }, [controller]);
  useEffect(() => {
    localStorage.setItem('themeteam-language', language);
  }, [language]);
  useEffect(() => {
    if (form) {
      dialog.current?.showModal();
      dialog.current?.querySelector<HTMLInputElement>('input')?.focus();
    } else {
      dialog.current?.close();
      if (formTrigger.current) {
        (formTrigger.current.isConnected && !formTrigger.current.disabled ? formTrigger.current : heading.current)?.focus();
        formTrigger.current = null;
      }
    }
  }, [form]);
  useEffect(() => {
    if (!snapshot) return;
    void controller.loadM2Snapshot();
    if (view !== 'tasks') return;
    void controller.listTaskRunsM2();
    controller.connectM2Events();
    const timer = window.setInterval(() => void controller.listTaskRunsM2(), 1500);
    return () => {
      window.clearInterval(timer);
      controller.disconnectM2Events();
    };
  }, [controller, snapshot?.id, view]);
  const matching = (value: string) => value.toLocaleLowerCase().includes(query.toLocaleLowerCase());
  const selected = state.selection;
  const agent = selected?.kind === 'agent' ? snapshot?.agents.find(a => a.id === selected.id) : undefined;
  const task = selected?.kind === 'task' ? snapshot?.tasks.find(t => t.id === selected.id) : undefined;
  const meeting = selected?.kind === 'meeting' ? snapshot?.meetings.find(m => m.id === selected.id) : undefined;
  const doc = selected?.kind === 'document' ? snapshot?.documents.find(d => d.id === selected.id) : undefined;
  const room = selected?.kind === 'room' ? snapshot?.rooms.find(r => r.id === selected.id) : undefined;
  const selectedTitle = agent?.name || task?.title || meeting?.title || doc?.title || room?.name;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    const data = new FormData(element);
    const outcome = form === 'agent'
      ? await controller.createAgentM2({
          name: data.get('name'), roleTemplate: data.get('role'), modelProfileId: data.get('model'),
          runtimeProfileId: data.get('runtime') || null, projectDirectoryProfileId: data.get('projectDirectory') || null,
        })
      : await controller.createTaskM2({ title: data.get('title'), description: data.get('description'), priority: data.get('priority'),
        assigneeIds: data.get('owner') ? [data.get('owner')] : [] });
    if (outcome === 'success' && element.isConnected) { element.reset(); setForm(null); }
  }
  function owners(item: Task) {
    return item.assigneeIds.map(id => {
      const owner = snapshot?.agents.find(a => a.id === id);
      return <button key={id} className="owner" data-entity={selectionKey({ kind: 'agent', id })} title={`${t('action.focus')} ${owner?.name || id}`} onClick={() => choose({ kind: 'agent', id })}>
        <UserRound size={14} />{owner?.name || id}
      </button>;
    });
  }

  return <div className="workspace" ref={workspaceRoot} onClickCapture={event => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button[data-entity]');
    if (button) selectionTrigger.current = button;
  }}>
    <header className="topbar">
      <button className="icon mobile-menu" aria-label={t('nav.view')} title={t('nav.view')} onClick={() => setNavOpen(!navOpen)}><Menu size={20} /></button>
      <div className="brand"><LayoutGrid size={22} /><strong>ThemeTeam</strong></div>
      <span className="workspace-name">{name}</span>
      <span className={`save-status ${state.dirty ? 'dirty' : ''}`} role="status">{state.pending ? t('status.syncing') : state.uncertain ? t('status.unknown') : state.dirty ? t('status.dirty') : t('status.synced')}</span>
      <div className="language-switch" role="group" aria-label={t('action.language')}>
        <button className={language === 'zh' ? 'active' : ''} aria-pressed={language === 'zh'} onClick={() => setLanguage('zh')}>中文</button>
        <button className={language === 'en' ? 'active' : ''} aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>EN</button>
      </div>
      <button className="icon" title={t('action.refresh')} aria-label={t('action.refresh')} disabled={state.pending > 0} onClick={() => void controller.loadM2Snapshot()}><RefreshCw size={18} /></button>
      <button className="icon" title={t('action.reload')} aria-label={t('action.reload')} disabled={disabled || !snapshot} onClick={() => {
        if (!state.dirty || window.confirm(t('ui.reloadConfirm'))) void controller.loadM2Snapshot();
      }}><ArrowLeft size={18} /></button>
      <button className="primary save-button" disabled={disabled || !snapshot} onClick={() => void controller.save()}><Save size={16} /><span>{t('action.save')}</span></button>
    </header>
    {state.error && <div className="error-bar" role="alert">{state.error}</div>}
    <div className={`shell ${state.inspectorOpen ? 'with-inspector' : ''}`}>
      <aside className={`navigation ${navOpen ? 'nav-open' : ''}`}>
        <div className="section-label">{t('nav.workspace')}</div>
        <nav aria-label={t('nav.view')}>{nav.map(({ id, label, icon: Icon }) => <button key={id} className={view === id ? 'nav-item active' : 'nav-item'}
          onClick={() => { setView(id); setQuery(''); setNavOpen(false); }} aria-current={view === id ? 'page' : undefined}><Icon size={18} />{label}</button>)}</nav>
        <div className="section-label rooms-label">{t('nav.rooms')}</div>
        {snapshot?.rooms.filter(r => r.level === 1).map(r => <button className="room-link" key={r.id} data-entity={selectionKey({ kind: 'room', id: r.id })} onClick={() => choose({ kind: 'room', id: r.id })}>
          <span className="room-dot" />{r.name}<span className="room-count">{r.occupantIds.length}</span>
        </button>)}
        <div className="navigation-foot">M1 {t('nav.office')}</div>
      </aside>
      <main className={`content ${view === 'office' ? 'office-content' : ''}`}>
        <div className="content-head">
          <div><div className="eyebrow">{name}</div><h1 tabIndex={-1} ref={heading}>{nav.find(n => n.id === view)?.label}</h1></div>
          <div className="head-actions">
            {view !== 'office' && <label className="search"><Search size={16} /><input aria-label={t('ui.search')} placeholder={t('ui.search')} value={query} onChange={e => setQuery(e.target.value)} /></label>}
            {(view === 'tasks' || view === 'agents') && <button className="primary" disabled={disabled || !snapshot} onClick={event => { formTrigger.current = event.currentTarget; setForm(view === 'tasks' ? 'task' : 'agent'); }}><Plus size={17} />{view === 'tasks' ? t('form.newTask') : t('form.newAgent')}</button>}
          </div>
        </div>
        {!snapshot && <div className="empty">{state.pending ? t('ui.loadingWorkspace') : t('error.notConnected')}{!state.pending && <button onClick={() => void controller.loadM2Snapshot()}><RefreshCw size={16} />{t('action.retry')}</button>}</div>}
        {snapshot && view === 'office' && <OfficeCanvas controller={controller} language={language} onCreateAgent={() => setForm('agent')} />}
        {snapshot && view === 'tasks' && <>
          <div className="summary-line"><span>{t('task.count', { count: snapshot.tasks.length })}</span><span>{t('task.memberCount', { count: snapshot.agents.length })}</span><span>{t('task.completedCount', { count: snapshot.tasks.filter(t => t.status === 'done').length })}</span></div>
          <div className="board">{columns.map(([status, title]) => {
            const tasks = snapshot.tasks.filter(t => t.status === status && matching(`${t.title} ${t.description}`));
            return <section className="lane" key={status}><h2><span className={`status-dot ${status}`} />{t(title as Parameters<typeof translate>[1])}<span>{tasks.length}</span></h2>
              {tasks.map(item => {
                const taskRuns = state.taskRuns.filter(run => run.taskId === item.id);
                const run: TaskRun | undefined = [...taskRuns].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
                const canCancel = !!run && ['waiting', 'queued', 'running'].includes(run.status);
                const canRetry = !!run && ['failed', 'timed_out', 'cancelled', 'interrupted', 'environment_unavailable'].includes(run.status);
                return <article className={`task-card ${selected?.id === item.id ? 'selected' : ''}`} key={item.id}>
                <div className="task-meta"><span className={`priority ${item.priority}`}>{item.priority === 'high' ? t('task.priorityHigh') : item.priority === 'low' ? t('task.priorityLow') : t('task.priorityNormal')}</span><span>{item.id.slice(-6)}</span></div>
                <button className="task-title" data-entity={selectionKey({ kind: 'task', id: item.id })} onClick={() => choose({ kind: 'task', id: item.id })}>{item.title}</button>
                <p>{item.description || '—'}</p><div className="task-owners">{item.assigneeIds.length ? owners(item) : <span className="muted">{t('task.unassigned')}</span>}</div>
                <div className="task-controls">
                  <select aria-label={t('task.statusLabel', { title: item.title })} disabled={disabled} value={item.status} onChange={e => void controller.setTaskStatus(item.id, e.target.value)}>{columns.map(([key, label]) => <option key={key} value={key}>{t(label as Parameters<typeof translate>[1])}</option>)}</select>
                  {(() => {
                    const owner = item.assigneeIds.map(id => snapshot.agents.find(agent => agent.id === id)).find(Boolean);
                    const runtime = owner?.runtimeProfileId ? snapshot.runtimeProfiles?.find(profile => profile.id === owner.runtimeProfileId) : undefined;
                    const directory = owner?.projectDirectoryProfileId ? snapshot.projectDirectories?.find(profile => profile.id === owner.projectDirectoryProfileId) : undefined;
                    return runtime && directory && !directory.readOnly ? <button className="task-run-button" disabled={disabled || !!run && ['waiting', 'queued', 'running'].includes(run.status)} onClick={() => void controller.runTaskM2({
                      taskId: item.id, runtimeProfileId: runtime.id, projectDirectoryProfileId: directory.id,
                      prompt: `${item.title}\n${item.description || ''}\nWrite task outputs only under the controlled artifact directory.`,
                    })}><Check size={14} />{t('action.run')}</button> : <span className="task-run-hint">{t('task.unbound')}</span>;
                  })()}
                </div>
                {run && <div className={`task-run ${run.status}`}>
                  <div className="task-run-head"><strong>{t('task.recentRun')}</strong><span>{runStatusName(run.status)}</span></div>
                  <small>{run.exitCode === null ? `Run ${run.runId.slice(-8)}` : t('task.exitCode', { runId: run.runId.slice(-8), code: run.exitCode })}</small>
                  {run.artifacts.length > 0 && <small>{t('task.artifacts', { items: run.artifacts.join(language === 'zh' ? '、' : ', ') })}</small>}
                  {run.error && <small className="run-error">{run.error}</small>}
                  <div className="task-run-actions">
                    {run.status === 'waiting' && <button className="task-run-control" disabled={disabled} onClick={() => void controller.approveTaskRunM2(run.runId)}><Check size={13} />{t('action.approve')}</button>}
                    {canCancel && <button className="task-run-control" disabled={disabled} onClick={() => void controller.cancelTaskRunM2(run.runId)}><X size={13} />{t('action.cancel')}</button>}
                    {canRetry && <button className="task-run-control" disabled={disabled} onClick={() => void controller.retryTaskRunM2(run.runId)}><RefreshCw size={13} />{t('action.retry')}</button>}
                  </div>
                </div>}
              </article>;
              })}{tasks.length === 0 && <div className="lane-empty">{t('task.noTasks')}</div>}
            </section>;
          })}</div>
          {snapshot.tasks.some(item => !columns.some(([key]) => key === item.status)) && <section className="record-list"><h2>{t('task.other')}</h2>{snapshot.tasks.filter(item => !columns.some(([key]) => key === item.status)).map(item => <button key={item.id} className="record" data-entity={selectionKey({ kind: 'task', id: item.id })} onClick={() => choose({ kind: 'task', id: item.id })}>{item.title}<span>{item.status}</span></button>)}</section>}
        </>}
        {snapshot && view === 'agents' && <div className="record-list">{snapshot.agents.filter(a => matching(`${a.name} ${a.roleTemplate}`)).map(a => <button key={a.id} className="record" data-entity={selectionKey({ kind: 'agent', id: a.id })} onClick={() => choose({ kind: 'agent', id: a.id })}>
          <span className={`avatar ${a.roleTemplate}`}><UserRound size={25} /></span><span className="record-main"><strong>{a.name}</strong><small>{roleName(a.roleTemplate)} · {a.id}</small></span><span className="record-status">{a.status}</span><ChevronRight size={16} />
        </button>)}</div>}
        {snapshot && view === 'meetings' && <div className="record-list">{snapshot.meetings.filter(m => matching(m.title)).map(m => <button className="record" key={m.id} data-entity={selectionKey({ kind: 'meeting', id: m.id })} onClick={() => choose({ kind: 'meeting', id: m.id })}><MessageSquare size={21} /><span className="record-main"><strong>{m.title}</strong><small>{language === 'zh' ? `${m.participants.length} 位成员` : `${m.participants.length} participants`} · {m.status}</small></span><ChevronRight size={16} /></button>)}</div>}
        {snapshot && view === 'documents' && <div className="record-list">{snapshot.documents.filter(d => matching(d.title)).map(d => <button className="record" key={d.id} data-entity={selectionKey({ kind: 'document', id: d.id })} onClick={() => choose({ kind: 'document', id: d.id })}><FileText size={21} /><span className="record-main"><strong>{d.title}</strong><small>{d.category} · {d.version}</small></span><ChevronRight size={16} /></button>)}</div>}
        {snapshot && view === 'settings' && <section className="settings-view">
          <h2>{t('settings.title')}</h2>
          <p className="muted">{t('settings.description')}</p>
          <div className="settings-grid">
            <article className="settings-section">
              <h3>{t('settings.runtime')}</h3>
              {(snapshot.runtimeProfiles || []).map(profile => <div className="settings-row" key={profile.id}>
                <strong>{profile.name}</strong><span>{profile.kind} · {profile.enabled ? t('settings.enabled') : t('settings.disabled')}</span>
                {profile.kind === 'codex-cli' && <button className="settings-probe" disabled={disabled} onClick={() => void controller.probeRuntime(profile.id)}><RefreshCw size={14} />{t('settings.probe')}</button>}
              </div>)}
              <form className="settings-form" onSubmit={async event => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);
                await controller.createRuntimeProfileM2({
                  name: formData.get('name'), kind: formData.get('kind'), executable: formData.get('executable'),
                  enabled: true, projectDirectoryProfileId: formData.get('projectDirectory') || null,
                  approvalPolicy: 'manual', timeoutSeconds: Number(formData.get('timeoutSeconds') || 300), capabilities: ['coding', 'web'],
                });
                event.currentTarget.reset();
              }}>
                <input name="name" aria-label={t('settings.runtimeName')} placeholder={t('settings.runtimeName')} required />
                <select name="kind" aria-label={t('settings.cliType')}><option value="model-api">{t('ui.controlledMock')}</option><option value="codex-cli">Codex CLI</option><option value="claude-cli">Claude CLI</option><option value="opencode-cli">OpenCode CLI</option></select>
                <input name="executable" aria-label={t('settings.executable')} placeholder={t('settings.executable')} required />
                <select name="projectDirectory" aria-label={t('settings.defaultDirectory')}><option value="">{t('settings.noDirectory')}</option>{(snapshot.projectDirectories || []).map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select>
                <input name="timeoutSeconds" aria-label={t('ui.timeoutSeconds')} type="number" min="30" defaultValue="300" />
                <button className="primary" type="submit"><Plus size={16} />{t('settings.addRuntime')}</button>
              </form>
            </article>
            <article className="settings-section">
              <h3>{t('settings.directories')}</h3>
              {(snapshot.projectDirectories || []).map(profile => <div className="settings-row" key={profile.id}>
                <strong>{profile.name}</strong><span>{profile.path} · {profile.readOnly ? t('ui.readOnly') : t('ui.writable')}</span>
              </div>)}
              <form className="settings-form" onSubmit={async event => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);
                await controller.createProjectDirectoryM2({
                  name: formData.get('name'), path: formData.get('path'), pathKind: 'local',
                  allowed: true, readOnly: formData.get('readOnly') === 'on', temporaryCopyPolicy: 'none',
                });
                event.currentTarget.reset();
              }}>
                <input name="name" aria-label={t('settings.directoryName')} placeholder={t('settings.directoryName')} required />
                <input name="path" aria-label={t('settings.directoryPath')} placeholder="C:\\repos\\project" required />
                <label className="settings-check"><input name="readOnly" type="checkbox" />{t('settings.readOnly')}</label>
                <button className="primary" type="submit"><Plus size={16} />{t('settings.addDirectory')}</button>
              </form>
            </article>
            <article className="settings-section">
              <h3>{t('settings.example')}</h3>
              <p className="muted">{t('settings.exampleDescription')}</p>
              <form className="settings-form" onSubmit={async event => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);
                const runtime = formData.get('runtime') || 'runtime_mock';
                const directory = formData.get('projectDirectory') || snapshot.projectDirectories?.[0]?.id;
                if (!directory) { setRuntimeMessage(t('settings.configureDirectory')); return; }
                const outcome = await controller.runMockProject({
                  runtimeProfileId: runtime, projectDirectoryProfileId: directory,
                  projectName: formData.get('projectName') || 'bazi-prediction-demo', template: 'bazi-prediction',
                });
                setRuntimeMessage(outcome === 'success'
                  ? t('settings.exampleGenerated')
                  : t('settings.exampleFailed'));
              }}>
                <input name="projectName" aria-label={t('settings.projectName')} defaultValue="bazi-prediction-demo" />
                <select name="runtime" aria-label={t('settings.exampleRuntime')}>
                  {(snapshot.runtimeProfiles || []).filter(item => item.enabled).map(item => <option value={item.id} key={item.id}>{item.name} · {item.kind}</option>)}
                </select>
                <select name="projectDirectory" aria-label={t('settings.exampleDirectory')}>
                  {(snapshot.projectDirectories || []).filter(item => item.allowed && !item.readOnly).map(item => <option value={item.id} key={item.id}>{item.name}</option>)}
                </select>
                <button className="primary" type="submit"><Plus size={16} />{t('settings.generateExample')}</button>
                {runtimeMessage && <p className="form-error">{runtimeMessage}</p>}
              </form>
            </article>
          </div>
        </section>}
      </main>
      {state.inspectorOpen && selected && <aside className="inspector" aria-label={t('ui.selectedDetails')}>
        <div className="inspector-toolbar"><button className="icon" aria-label={t('action.back')} title={t('action.back')} onClick={() => { controller.back(); focusSelection(); }}><ArrowLeft size={18} /></button><span>{t('ui.selectedObject')}</span><button className="icon" aria-label={t('ui.closeDetails')} title={t('ui.closeDetails')} onClick={() => { controller.closeInspector(); focusSelection(true); }}><X size={18} /></button></div>
        <div className="inspector-body"><span className="section-label">{selected.kind.toUpperCase()}</span><h2>{selectedTitle}</h2><p className="entity-id">{selected.id}</p>
          {task && <><div className="detail-status">{statusName(task.status)}</div><p className="body-text">{task.description || '—'}</p><h3>{t('ui.owner')}</h3><div className="task-owners">{owners(task)}</div></>}
          {meeting && <><div className="detail-status">{meeting.status}</div><p className="body-text">{meeting.summary}</p><h3>{t('ui.participants')}</h3>{meeting.participants.map(id => <button key={id} className="related" onClick={() => choose({ kind: 'agent', id })}>{snapshot?.agents.find(a => a.id === id)?.name || id}<ChevronRight size={16} /></button>)}</>}
          {doc && <><div className="detail-status">{doc.version} · {doc.visibilityScope}</div><p className="body-text">{doc.content}</p></>}
          {room && <><div className="detail-status">{room.unlocked ? t('room.open') : t('room.locked')}</div><h3>{t('room.members')}</h3>{room.occupantIds.map(id => <button key={id} className="related" onClick={() => choose({ kind: 'agent', id })}>{snapshot?.agents.find(a => a.id === id)?.name || id}<ChevronRight size={16} /></button>)}</>}
        </div>
      </aside>}
    </div>
    <footer className="footer"><span className="connection-dot" />{snapshot ? t('footer.localWorkspace') : t('status.disconnected')}<span>{t('footer.manual')}</span><span className="footer-right">{snapshot?.lastSavedAt ? t('footer.lastSaved', { time: new Date(snapshot.lastSavedAt).toLocaleTimeString() }) : t('footer.notSaved')}</span></footer>
    <dialog ref={dialog} onCancel={() => setForm(null)} onClose={() => setForm(null)} aria-labelledby={formTitleId}>
      <form onSubmit={submit} key={form}>
        <div className="dialog-head"><h2 id={formTitleId}>{form === 'agent' ? t('form.newAgent') : t('form.newTask')}</h2><button type="button" className="icon" aria-label={t('action.cancel')} title={t('action.cancel')} onClick={() => setForm(null)}><X size={19} /></button></div>
        {form === 'agent' ? <><label>{t('form.name')}<input name="name" required maxLength={512} autoFocus /></label><label>{t('form.role')}<select name="role" aria-label={t('form.role')}><option value="developer">{t('agent.developer')}</option><option value="pm">{t('agent.pm')}</option><option value="tester">{t('agent.tester')}</option></select></label><label>{t('form.model')}<select name="model" aria-label={t('form.model')}>{snapshot?.modelProfiles.map(m => <option value={m.id} key={m.id}>{m.name}</option>)}</select></label><label>{t('form.runtime')}<select name="runtime" aria-label={t('form.runtime')}><option value="">{t('form.noBinding')}</option>{(snapshot?.runtimeProfiles || []).filter(item => item.enabled).map(item => <option value={item.id} key={item.id}>{item.name} · {item.kind}</option>)}</select></label><label>{t('form.directory')}<select name="projectDirectory" aria-label={t('form.directory')}><option value="">{t('form.noBinding')}</option>{(snapshot?.projectDirectories || []).filter(item => item.allowed).map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label></>
          : <><label>{t('form.title')}<input name="title" required maxLength={512} autoFocus /></label><label>{t('form.description')}<textarea name="description" rows={3} maxLength={65536} /></label><div className="form-row"><label>{t('form.priority')}<select name="priority" aria-label={t('form.priority')}><option value="medium">{t('task.priorityNormal')}</option><option value="high">{t('task.priorityHigh')}</option><option value="low">{t('task.priorityLow')}</option></select></label><label>{t('form.owner')}<select name="owner" aria-label={t('form.owner')}><option value="">{t('task.unassigned')}</option>{snapshot?.agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label></div></>}
        {state.error && <p role="alert" className="form-error">{state.error}</p>}
        <div className="dialog-actions"><button type="button" onClick={() => setForm(null)}>{t('action.cancel')}</button><button className="primary" type="submit" disabled={disabled}><Check size={16} />{t('form.create')}</button></div>
      </form>
    </dialog>
  </div>;
}
