import { useEffect, useId, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { ArrowLeft, Building2, Check, ChevronRight, ClipboardList, FileText, LayoutGrid, Menu, MessageSquare, Plus, RefreshCw, Save, Search, Settings, Users, UserRound, X } from 'lucide-react';
import type { Selection, Task, View } from './types';
import type { WorkspaceController } from './workspace';
import { OfficeCanvas } from './office/OfficeCanvas';

const columns = [['todo', '待办'], ['in_progress', '进行中'], ['in_review', '待验收'], ['done', '已完成']] as const;
const statusName = (status: string) => columns.find(([key]) => key === status)?.[1] || status;
const selectionKey = (s: Selection) => `${s.kind}:${s.id}`;
export function App({ controller }: { controller: WorkspaceController }) {
  const state = useStore(controller.store);
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
  const disabled = state.pending > 0 || state.uncertain;
  const name = snapshot?.teams.find(t => t.id === snapshot.activeTeamId)?.name || '工作区';
  const nav = [
    { id: 'office', label: '办公室', icon: Building2 }, { id: 'tasks', label: '任务', icon: ClipboardList }, { id: 'agents', label: '团队', icon: Users },
    { id: 'meetings', label: '会议', icon: MessageSquare }, { id: 'documents', label: '文档', icon: FileText },
    { id: 'settings', label: '设置', icon: Settings },
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
    void controller.load();
    return () => { unsubscribe(); controller.dispose(); };
  }, [controller]);
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
      ? await controller.createAgent({
          name: data.get('name'), roleTemplate: data.get('role'), modelProfileId: data.get('model'),
          runtimeProfileId: data.get('runtime') || null, projectDirectoryProfileId: data.get('projectDirectory') || null,
        })
      : await controller.createTask({ title: data.get('title'), description: data.get('description'), priority: data.get('priority'),
        assigneeIds: data.get('owner') ? [data.get('owner')] : [] });
    if (outcome === 'success' && element.isConnected) { element.reset(); setForm(null); }
  }
  function owners(item: Task) {
    return item.assigneeIds.map(id => {
      const owner = snapshot?.agents.find(a => a.id === id);
      return <button key={id} className="owner" data-entity={selectionKey({ kind: 'agent', id })} title={`查看 ${owner?.name || id}`} onClick={() => choose({ kind: 'agent', id })}>
        <UserRound size={14} />{owner?.name || id}
      </button>;
    });
  }

  return <div className="workspace" ref={workspaceRoot} onClickCapture={event => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button[data-entity]');
    if (button) selectionTrigger.current = button;
  }}>
    <header className="topbar">
      <button className="icon mobile-menu" aria-label="导航" title="导航" onClick={() => setNavOpen(!navOpen)}><Menu size={20} /></button>
      <div className="brand"><LayoutGrid size={22} /><strong>ThemeTeam</strong></div>
      <span className="workspace-name">{name}</span>
      <span className={`save-status ${state.dirty ? 'dirty' : ''}`} role="status">{state.pending ? '同步中' : state.uncertain ? '结果未知' : state.dirty ? '未保存' : '已同步'}</span>
      <button className="icon" title="重新读取" aria-label="重新读取" disabled={state.pending > 0} onClick={() => void controller.load()}><RefreshCw size={18} /></button>
      <button className="icon" title="从磁盘重新加载" aria-label="从磁盘重新加载" disabled={disabled || !snapshot} onClick={() => {
        if (!state.dirty || window.confirm('重新加载将丢弃未保存的修改。继续？')) void controller.reload();
      }}><ArrowLeft size={18} /></button>
      <button className="primary save-button" disabled={disabled || !snapshot} onClick={() => void controller.save()}><Save size={16} /><span>保存</span></button>
    </header>
    {state.error && <div className="error-bar" role="alert">{state.error}</div>}
    <div className={`shell ${state.inspectorOpen ? 'with-inspector' : ''}`}>
      <aside className={`navigation ${navOpen ? 'nav-open' : ''}`}>
        <div className="section-label">工作区</div>
        <nav aria-label="工作区视图">{nav.map(({ id, label, icon: Icon }) => <button key={id} className={view === id ? 'nav-item active' : 'nav-item'}
          onClick={() => { setView(id); setQuery(''); setNavOpen(false); }} aria-current={view === id ? 'page' : undefined}><Icon size={18} />{label}</button>)}</nav>
        <div className="section-label rooms-label">房间</div>
        {snapshot?.rooms.filter(r => r.level === 1).map(r => <button className="room-link" key={r.id} data-entity={selectionKey({ kind: 'room', id: r.id })} onClick={() => choose({ kind: 'room', id: r.id })}>
          <span className="room-dot" />{r.name}<span className="room-count">{r.occupantIds.length}</span>
        </button>)}
        <div className="navigation-foot">M1 运行场景</div>
      </aside>
      <main className={`content ${view === 'office' ? 'office-content' : ''}`}>
        <div className="content-head">
          <div><div className="eyebrow">{name}</div><h1 tabIndex={-1} ref={heading}>{nav.find(n => n.id === view)?.label}</h1></div>
          <div className="head-actions">
            {view !== 'office' && <label className="search"><Search size={16} /><input aria-label="搜索" placeholder="搜索" value={query} onChange={e => setQuery(e.target.value)} /></label>}
            {(view === 'tasks' || view === 'agents') && <button className="primary" disabled={disabled || !snapshot} onClick={event => { formTrigger.current = event.currentTarget; setForm(view === 'tasks' ? 'task' : 'agent'); }}><Plus size={17} />{view === 'tasks' ? '新建任务' : '新建成员'}</button>}
          </div>
        </div>
        {!snapshot && <div className="empty">{state.pending ? '正在读取工作区…' : '工作区未连接'}{!state.pending && <button onClick={() => void controller.load()}><RefreshCw size={16} />重试</button>}</div>}
        {snapshot && view === 'office' && <OfficeCanvas controller={controller} onCreateAgent={() => setForm('agent')} />}
        {snapshot && view === 'tasks' && <>
          <div className="summary-line"><span>{snapshot.tasks.length} 项任务</span><span>{snapshot.agents.length} 位成员</span><span>{snapshot.tasks.filter(t => t.status === 'done').length} 项完成</span></div>
          <div className="board">{columns.map(([status, title]) => {
            const tasks = snapshot.tasks.filter(t => t.status === status && matching(`${t.title} ${t.description}`));
            return <section className="lane" key={status}><h2><span className={`status-dot ${status}`} />{title}<span>{tasks.length}</span></h2>
              {tasks.map(item => <article className={`task-card ${selected?.id === item.id ? 'selected' : ''}`} key={item.id}>
                <div className="task-meta"><span className={`priority ${item.priority}`}>{item.priority === 'high' ? '高优先级' : item.priority === 'low' ? '低优先级' : '普通'}</span><span>{item.id.slice(-6)}</span></div>
                <button className="task-title" data-entity={selectionKey({ kind: 'task', id: item.id })} onClick={() => choose({ kind: 'task', id: item.id })}>{item.title}</button>
                <p>{item.description || '—'}</p><div className="task-owners">{item.assigneeIds.length ? owners(item) : <span className="muted">未指派</span>}</div>
                <div className="task-controls">
                  <select aria-label={`${item.title} 状态`} disabled={disabled} value={item.status} onChange={e => void controller.setTaskStatus(item.id, e.target.value)}>{columns.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
                  {(() => {
                    const owner = item.assigneeIds.map(id => snapshot.agents.find(agent => agent.id === id)).find(Boolean);
                    const runtime = owner?.runtimeProfileId ? snapshot.runtimeProfiles?.find(profile => profile.id === owner.runtimeProfileId) : undefined;
                    const directory = owner?.projectDirectoryProfileId ? snapshot.projectDirectories?.find(profile => profile.id === owner.projectDirectoryProfileId) : undefined;
                    return runtime && directory && !directory.readOnly ? <button className="task-run-button" disabled={disabled} onClick={() => void controller.runTask({
                      taskId: item.id, runtimeProfileId: runtime.id, projectDirectoryProfileId: directory.id,
                      prompt: `${item.title}\n${item.description || ''}\nWrite task outputs only under the controlled artifact directory.`,
                    })}><Check size={14} />运行</button> : <span className="task-run-hint">未绑定可执行 Agent</span>;
                  })()}
                </div>
              </article>)}{tasks.length === 0 && <div className="lane-empty">暂无任务</div>}
            </section>;
          })}</div>
          {snapshot.tasks.some(t => !columns.some(([key]) => key === t.status)) && <section className="record-list"><h2>其他状态</h2>{snapshot.tasks.filter(t => !columns.some(([key]) => key === t.status)).map(t => <button key={t.id} className="record" data-entity={selectionKey({ kind: 'task', id: t.id })} onClick={() => choose({ kind: 'task', id: t.id })}>{t.title}<span>{t.status}</span></button>)}</section>}
        </>}
        {snapshot && view === 'agents' && <div className="record-list">{snapshot.agents.filter(a => matching(`${a.name} ${a.roleTemplate}`)).map(a => <button key={a.id} className="record" data-entity={selectionKey({ kind: 'agent', id: a.id })} onClick={() => choose({ kind: 'agent', id: a.id })}>
          <span className={`avatar ${a.roleTemplate}`}><UserRound size={25} /></span><span className="record-main"><strong>{a.name}</strong><small>{a.roleTemplate} · {a.id}</small></span><span className="record-status">{a.status}</span><ChevronRight size={16} />
        </button>)}</div>}
        {snapshot && view === 'meetings' && <div className="record-list">{snapshot.meetings.filter(m => matching(m.title)).map(m => <button className="record" key={m.id} data-entity={selectionKey({ kind: 'meeting', id: m.id })} onClick={() => choose({ kind: 'meeting', id: m.id })}><MessageSquare size={21} /><span className="record-main"><strong>{m.title}</strong><small>{m.participants.length} 位成员 · {m.status}</small></span><ChevronRight size={16} /></button>)}</div>}
        {snapshot && view === 'documents' && <div className="record-list">{snapshot.documents.filter(d => matching(d.title)).map(d => <button className="record" key={d.id} data-entity={selectionKey({ kind: 'document', id: d.id })} onClick={() => choose({ kind: 'document', id: d.id })}><FileText size={21} /><span className="record-main"><strong>{d.title}</strong><small>{d.category} · {d.version}</small></span><ChevronRight size={16} /></button>)}</div>}
        {snapshot && view === 'settings' && <section className="settings-view">
          <h2>运行设置</h2>
          <p className="muted">配置模型、Agent CLI 和工程目录。密钥只保存为引用，不进入工作区快照。</p>
          <div className="settings-grid">
            <article className="settings-section">
              <h3>Agent CLI Runtime</h3>
              {(snapshot.runtimeProfiles || []).map(profile => <div className="settings-row" key={profile.id}>
                <strong>{profile.name}</strong><span>{profile.kind} · {profile.enabled ? '已启用' : '已禁用'}</span>
                {profile.kind === 'codex-cli' && <button className="settings-probe" disabled={disabled} onClick={() => void controller.probeRuntime(profile.id)}><RefreshCw size={14} />探测 Codex CLI</button>}
              </div>)}
              <form className="settings-form" onSubmit={async event => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);
                await controller.createRuntimeProfile({
                  name: formData.get('name'), kind: formData.get('kind'), executable: formData.get('executable'),
                  enabled: true, projectDirectoryProfileId: formData.get('projectDirectory') || null,
                  approvalPolicy: 'manual', timeoutSeconds: Number(formData.get('timeoutSeconds') || 300), capabilities: ['coding', 'web'],
                });
                event.currentTarget.reset();
              }}>
                <input name="name" aria-label="运行时名称" placeholder="运行时名称" required />
                <select name="kind" aria-label="CLI 类型"><option value="model-api">受控 Mock</option><option value="codex-cli">Codex CLI</option><option value="claude-cli">Claude CLI</option><option value="opencode-cli">OpenCode CLI</option></select>
                <input name="executable" aria-label="可执行文件" placeholder="可执行文件，例如 codex" required />
                <select name="projectDirectory" aria-label="默认工程目录"><option value="">不绑定目录</option>{(snapshot.projectDirectories || []).map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select>
                <input name="timeoutSeconds" aria-label="超时秒数" type="number" min="30" defaultValue="300" />
                <button className="primary" type="submit"><Plus size={16} />新增 Runtime</button>
              </form>
            </article>
            <article className="settings-section">
              <h3>工程目录</h3>
              {(snapshot.projectDirectories || []).map(profile => <div className="settings-row" key={profile.id}>
                <strong>{profile.name}</strong><span>{profile.path} · {profile.readOnly ? '只读' : '可写'}</span>
              </div>)}
              <form className="settings-form" onSubmit={async event => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);
                await controller.createProjectDirectory({
                  name: formData.get('name'), path: formData.get('path'), pathKind: 'local',
                  allowed: true, readOnly: formData.get('readOnly') === 'on', temporaryCopyPolicy: 'none',
                });
                event.currentTarget.reset();
              }}>
                <input name="name" aria-label="工程名称" placeholder="工程名称" required />
                <input name="path" aria-label="工程路径" placeholder="C:\\repos\\project" required />
                <label className="settings-check"><input name="readOnly" type="checkbox" />只读工程目录</label>
                <button className="primary" type="submit"><Plus size={16} />新增目录</button>
              </form>
            </article>
            <article className="settings-section">
              <h3>受控示例项目</h3>
              <p className="muted">仅使用受控 Mock Runtime 生成本地项目，不执行任意外部 CLI。</p>
              <form className="settings-form" onSubmit={async event => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);
                const runtime = formData.get('runtime') || 'runtime_mock';
                const directory = formData.get('projectDirectory') || snapshot.projectDirectories?.[0]?.id;
                if (!directory) { setRuntimeMessage('请先配置工程目录'); return; }
                const outcome = await controller.runMockProject({
                  runtimeProfileId: runtime, projectDirectoryProfileId: directory,
                  projectName: formData.get('projectName') || 'bazi-prediction-demo', template: 'bazi-prediction',
                });
                setRuntimeMessage(outcome === 'success'
                  ? '八字预测示例项目已生成到所选工程目录的 projects 文件夹'
                  : '示例项目生成失败，请检查 runtime 和工程目录配置');
              }}>
                <input name="projectName" aria-label="示例项目名称" defaultValue="bazi-prediction-demo" />
                <select name="runtime" aria-label="示例运行时">
                  {(snapshot.runtimeProfiles || []).filter(item => item.enabled).map(item => <option value={item.id} key={item.id}>{item.name} · {item.kind}</option>)}
                </select>
                <select name="projectDirectory" aria-label="示例工程目录">
                  {(snapshot.projectDirectories || []).filter(item => item.allowed && !item.readOnly).map(item => <option value={item.id} key={item.id}>{item.name}</option>)}
                </select>
                <button className="primary" type="submit"><Plus size={16} />生成八字示例项目</button>
                {runtimeMessage && <p className="form-error">{runtimeMessage}</p>}
              </form>
            </article>
          </div>
        </section>}
      </main>
      {state.inspectorOpen && selected && <aside className="inspector" aria-label="选中对象详情">
        <div className="inspector-toolbar"><button className="icon" aria-label="返回上个对象" title="返回上个对象" onClick={() => { controller.back(); focusSelection(); }}><ArrowLeft size={18} /></button><span>选中对象</span><button className="icon" aria-label="关闭详情" title="关闭详情" onClick={() => { controller.closeInspector(); focusSelection(true); }}><X size={18} /></button></div>
        <div className="inspector-body"><span className="section-label">{selected.kind.toUpperCase()}</span><h2>{selectedTitle}</h2><p className="entity-id">{selected.id}</p>
          {agent && <><dl><dt>角色</dt><dd>{agent.roleTemplate}</dd><dt>记录状态</dt><dd>{agent.status}</dd><dt>模型配置</dt><dd>{snapshot?.modelProfiles.find(m => m.id === agent.modelProfileId)?.name || agent.modelProfileId}</dd><dt>房间</dt><dd>{snapshot?.rooms.find(r => r.id === agent.seatId)?.name || agent.seatId}</dd></dl><h3>关联任务</h3>{snapshot?.tasks.filter(t => t.assigneeIds.includes(agent.id)).map(t => <button key={t.id} className="related" onClick={() => choose({ kind: 'task', id: t.id })}>{t.title}<ChevronRight size={16} /></button>)}</>}
          {task && <><div className="detail-status">{statusName(task.status)}</div><p className="body-text">{task.description || '—'}</p><h3>负责人</h3><div className="task-owners">{owners(task)}</div></>}
          {meeting && <><div className="detail-status">{meeting.status}</div><p className="body-text">{meeting.summary}</p><h3>参与成员</h3>{meeting.participants.map(id => <button key={id} className="related" onClick={() => choose({ kind: 'agent', id })}>{snapshot?.agents.find(a => a.id === id)?.name || id}<ChevronRight size={16} /></button>)}</>}
          {doc && <><div className="detail-status">{doc.version} · {doc.visibilityScope}</div><p className="body-text">{doc.content}</p></>}
          {room && <><div className="detail-status">{room.unlocked ? '已开放' : '锁定'}</div><h3>房间成员</h3>{room.occupantIds.map(id => <button key={id} className="related" onClick={() => choose({ kind: 'agent', id })}>{snapshot?.agents.find(a => a.id === id)?.name || id}<ChevronRight size={16} /></button>)}</>}
        </div>
      </aside>}
    </div>
    <footer className="footer"><span className="connection-dot" />{snapshot ? '本地工作区' : '未连接'}<span>手动管理</span><span className="footer-right">{snapshot?.lastSavedAt ? `上次保存 ${new Date(snapshot.lastSavedAt).toLocaleTimeString()}` : '尚未保存'}</span></footer>
    <dialog ref={dialog} onCancel={() => setForm(null)} onClose={() => setForm(null)} aria-labelledby={formTitleId}>
      <form onSubmit={submit} key={form}>
        <div className="dialog-head"><h2 id={formTitleId}>{form === 'agent' ? '新建成员' : '新建任务'}</h2><button type="button" className="icon" aria-label="取消" title="取消" onClick={() => setForm(null)}><X size={19} /></button></div>
        {form === 'agent' ? <><label>名称<input name="name" required maxLength={512} autoFocus /></label><label>角色<select name="role" aria-label="角色"><option value="developer">Developer</option><option value="pm">PM</option><option value="tester">QA</option></select></label><label>模型配置<select name="model" aria-label="模型配置">{snapshot?.modelProfiles.map(m => <option value={m.id} key={m.id}>{m.name}</option>)}</select></label><label>Agent CLI<select name="runtime" aria-label="Agent CLI"><option value="">仅模型/受控模式</option>{(snapshot?.runtimeProfiles || []).filter(item => item.enabled).map(item => <option value={item.id} key={item.id}>{item.name} · {item.kind}</option>)}</select></label><label>工程目录<select name="projectDirectory" aria-label="工程目录"><option value="">不绑定</option>{(snapshot?.projectDirectories || []).filter(item => item.allowed).map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label></>
          : <><label>标题<input name="title" required maxLength={512} autoFocus /></label><label>描述<textarea name="description" rows={3} maxLength={65536} /></label><div className="form-row"><label>优先级<select name="priority" aria-label="优先级"><option value="medium">普通</option><option value="high">高</option><option value="low">低</option></select></label><label>负责人<select name="owner" aria-label="负责人"><option value="">未指派</option>{snapshot?.agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label></div></>}
        {state.error && <p role="alert" className="form-error">{state.error}</p>}
        <div className="dialog-actions"><button type="button" onClick={() => setForm(null)}>取消</button><button className="primary" type="submit" disabled={disabled}><Check size={16} />创建</button></div>
      </form>
    </dialog>
  </div>;
}
