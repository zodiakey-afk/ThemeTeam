class SafeFragment {
  constructor(value) { this.value = value; }
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function html(parts, ...values) {
  return parts.reduce((result, part, index) => result + part + (index < values.length
    ? values[index] instanceof SafeFragment ? values[index].value : escapeHTML(values[index]) : ''), '');
}

// Only internally rendered and already escaped SVG fragments may be composed as markup.
function trusted(value) { return new SafeFragment(value); }

function safeGeometry(room) {
  const result = { ...room };
  for (const key of ['x', 'y', 'width', 'height']) {
    const number = Number(room[key]);
    result[key] = Number.isFinite(number) ? Math.max(0, Math.min(2048, number)) : 0;
  }
  return result;
}

function showError(error) {
  let banner = document.getElementById('requestError');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'requestError';
    banner.setAttribute('role', 'alert');
    document.body.prepend(banner);
  }
  banner.textContent = String(error);
}

window.addEventListener('unhandledrejection', event => {
  event.preventDefault();
  showError(event.reason);
});

const stateUrl = '/api/state';
let state = null;

const els = {
  roomList: document.getElementById('roomList'),
  teamList: document.getElementById('teamList'),
  officeCanvas: document.getElementById('officeCanvas'),
  taskBoard: document.getElementById('taskBoard'),
  phasePanel: document.getElementById('phasePanel'),
  documentList: document.getElementById('documentList'),
  memoryList: document.getElementById('memoryList'),
  expansionList: document.getElementById('expansionList'),
  eventFeed: document.getElementById('eventFeed'),
  selectionCard: document.getElementById('selectionCard'),
  canvasStats: document.getElementById('canvasStats'),
  themeToggle: document.getElementById('themeToggle'),
  themeBadge: document.getElementById('themeBadge'),
  agentForm: document.getElementById('agentForm'),
  modelProfiles: document.getElementById('modelProfiles'),
  saveWorkspace: document.getElementById('saveWorkspace'),
  reloadWorkspace: document.getElementById('reloadWorkspace'),
  createMeeting: document.getElementById('createMeeting'),
  archiveMeeting: document.getElementById('archiveMeeting'),
  expandOffice: document.getElementById('expandOffice'),
};

const statusLabels = {
  todo: 'To Do',
  in_progress: 'In Progress',
  in_review: 'In Review',
  done: 'Done',
};

function shortId(id) {
  return id.replace(/^(agent|task|room|team)_/, '').toUpperCase();
}

function roomLookup(id) {
  return state.rooms.find((room) => room.id === id);
}

function agentLookup(id) {
  return state.agents.find((agent) => agent.id === id);
}

function modelLookup(id) {
  return state.modelProfiles.find((model) => model.id === id);
}

function meetingLookup(id) {
  return state.meetings.find((meeting) => meeting.id === id);
}

function renderPhasePanel() {
  const activeMeeting = state.meetings[0];
  const meetingSummary = activeMeeting
    ? html`<div class="event-item"><strong>${activeMeeting.title}</strong><div class="muted">${activeMeeting.status} · ${activeMeeting.roomId} · ${activeMeeting.participants.map(shortId).join(', ')}</div><div class="muted">${activeMeeting.summary || '暂无摘要'}</div></div>`
    : '<div class="event-item">暂无会议</div>';
  const docPreview = state.documents[0]
    ? html`<div class="event-item"><strong>${state.documents[0].title}</strong><div class="muted">${state.documents[0].category} · ${state.documents[0].version}</div><div class="muted">${state.documents[0].content}</div></div>`
    : '<div class="event-item">暂无文档</div>';
  const memoryPreview = state.memoryItems[0]
    ? html`<div class="event-item"><strong>${state.memoryItems[0].scope}</strong><div class="muted">${state.memoryItems[0].sourceType} · ${state.memoryItems[0].text}</div></div>`
    : '<div class="event-item">暂无记忆</div>';
  const expansionPreview = state.rooms
    .filter((room) => room.type === 'expansionRoom')
    .map((room) => html`<div class="event-item"><strong>${room.name}</strong><div class="muted">${room.unlocked ? '已解锁' : '锁定'} · ${room.visualPreset}</div></div>`)
    .join('') || '<div class="event-item">暂无扩容楼层</div>';

  els.phasePanel.innerHTML = [meetingSummary, docPreview, memoryPreview].join('');
  els.documentList.innerHTML = state.documents.length
    ? state.documents.map((doc) => html`<div class="event-item"><strong>${doc.title}</strong><div class="muted">${doc.category} · ${doc.version}</div><div class="muted">来源：${doc.sourceRef}</div></div>`).join('')
    : '<div class="event-item">暂无文档</div>';
  els.memoryList.innerHTML = state.memoryItems.length
    ? state.memoryItems.map((memory) => html`<div class="event-item"><strong>${memory.scope}</strong><div class="muted">${memory.sourceType} · ${memory.approvedByHuman ? '已审批' : '待审批'}</div><div class="muted">${memory.text}</div></div>`).join('')
    : '<div class="event-item">暂无记忆</div>';
  els.expansionList.innerHTML = expansionPreview;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json();
}

function renderRooms() {
  els.roomList.innerHTML = '';
  state.rooms.forEach((room) => {
    const button = document.createElement('button');
    button.className = `room-btn${state.selection?.id === room.id ? ' active' : ''}`;
    button.innerHTML = html`<strong>${room.name}</strong><div class="muted">${room.type} · ${room.occupantIds.length} 人</div>`;
    button.addEventListener('click', () => selectEntity('room', room.id));
    els.roomList.appendChild(button);
  });
}

function renderTeams() {
  els.teamList.innerHTML = '';
  state.teams.forEach((team) => {
    const button = document.createElement('button');
    button.className = `team-btn${state.activeTeamId === team.id ? ' active' : ''}`;
    button.innerHTML = html`<strong>${team.name}</strong><div class="muted">Leader: ${shortId(team.leaderAgentId)} · 容量 ${team.capacity}</div>`;
    button.addEventListener('click', () => api('/api/select', { method: 'POST', body: JSON.stringify({ kind: 'team', id: team.id }) }).then(loadState));
    els.teamList.appendChild(button);
  });
}

function roomSprite(source) {
  const room = safeGeometry(source);
  const shadow = `rgba(47, 37, 22, 0.22)`;
  const selected = state.selection?.kind === 'room' && state.selection?.id === room.id;
  const accent = selected ? '#dbeafe' : '#b7a06e';
  const lift = selected ? -8 : 0;
  return html`
    <g transform="translate(${room.x} ${room.y + lift})" data-room-id="${room.id}" class="room-node">
      <ellipse cx="${room.width / 2}" cy="${room.height + 26}" rx="${room.width * 0.38}" ry="14" fill="${shadow}" opacity="0.35"/>
      <rect x="0" y="0" width="${room.width}" height="${room.height}" rx="16" fill="#${room.type === 'meetingRoom' ? 'b07c9c' : room.type === 'bossOffice' ? 'b77b53' : room.type === 'lounge' ? 'a97b4f' : room.type === 'archive' ? '7a8e66' : '6d8a59'}" stroke="#4e331f" stroke-width="4"/>
      <rect x="10" y="10" width="${room.width - 20}" height="${room.height - 18}" rx="12" fill="${accent}" opacity="0.5" stroke="#6c4a2e" stroke-width="3"/>
      <text x="18" y="34" fill="#2f2516" font-size="18" font-weight="700">${room.name}</text>
      <text x="18" y="58" fill="#4b3c25" font-size="12">${room.type} · ${room.occupantIds.length} 人</text>
      <rect x="${room.width - 44}" y="12" width="22" height="34" fill="#7a5a33" stroke="#3d2a18" stroke-width="3"/>
    </g>`;
}

function agentSprite(agent) {
  const source = roomLookup(agent.seatId);
  if (!source) return '';
  const room = safeGeometry(source);
  const roomIndex = room.occupantIds.indexOf(agent.id);
  const offsetX = 28 + roomIndex * 42;
  const offsetY = room.height - 36;
  const colors = {
    pm: '#4aa3df',
    developer: '#58c07a',
    tester: '#f1a24e',
  };
  const color = Object.hasOwn(colors, agent.roleTemplate) ? colors[agent.roleTemplate] : '#b67ae0';
  return html`
    <g transform="translate(${room.x + offsetX} ${room.y + offsetY})" class="agent-node" data-agent-id="${agent.id}">
      <ellipse cx="16" cy="30" rx="16" ry="7" fill="rgba(47,37,22,0.28)"/>
      <circle cx="16" cy="12" r="11" fill="#3d577b"/>
      <circle cx="16" cy="12" r="7" fill="${color}"/>
      <rect x="10" y="22" width="12" height="18" fill="${color}" stroke="#2f2516" stroke-width="2"/>
      <rect x="5" y="24" width="22" height="6" fill="#f7ecd1" opacity="0.8"/>
      <text x="-6" y="52" fill="#2f2516" font-size="10" font-weight="700">${agent.name}</text>
    </g>`;
}

function renderOffice() {
  const roomNodes = state.rooms.map(roomSprite).join('');
  const agentNodes = state.agents.map(agentSprite).join('');
  const focusSource = state.selection?.kind === 'room' ? roomLookup(state.selection.id) : null;
  const focus = focusSource ? safeGeometry(focusSource) : null;
  const focusRect = focus ? html`<rect x="${focus.x - 8}" y="${focus.y - 8}" width="${focus.width + 16}" height="${focus.height + 16}" rx="18" fill="none" stroke="#fce7f3" stroke-width="4" stroke-dasharray="8 6"/>` : '';

  els.officeCanvas.innerHTML = html`
    <svg viewBox="0 0 1040 780" xmlns="http://www.w3.org/2000/svg" aria-label="Office Canvas">
      <defs>
        <linearGradient id="sceneBg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#d7c79a"/>
          <stop offset="100%" stop-color="#c0aa78"/>
        </linearGradient>
        <pattern id="floorGrid" width="28" height="28" patternUnits="userSpaceOnUse">
          <rect width="28" height="28" fill="#c8b07d"/>
          <path d="M0 0H28V28" stroke="#d9c79b" stroke-width="2" opacity="0.55"/>
          <path d="M0 28H28" stroke="#ae8d58" stroke-width="2" opacity="0.28"/>
          <path d="M28 0V28" stroke="#ae8d58" stroke-width="2" opacity="0.28"/>
        </pattern>
      </defs>
      <rect width="1040" height="780" fill="url(#sceneBg)"/>
      <rect x="48" y="48" width="944" height="684" rx="24" fill="url(#floorGrid)" stroke="#7c6540" stroke-width="4"/>
      <path d="M82 174H950" stroke="#7d6540" stroke-width="4" stroke-dasharray="8 8" opacity="0.5"/>
      <path d="M82 352H950" stroke="#7d6540" stroke-width="4" stroke-dasharray="8 8" opacity="0.5"/>
      <path d="M470 78V708" stroke="#7d6540" stroke-width="4" stroke-dasharray="8 8" opacity="0.35"/>
      ${trusted(focusRect)}
      ${trusted(roomNodes)}
      ${trusted(agentNodes)}
      <g opacity="0.5">
        <ellipse cx="540" cy="744" rx="400" ry="20" fill="rgba(47,37,22,0.32)"/>
      </g>
    </svg>
  `;

  els.officeCanvas.querySelectorAll('[data-room-id]').forEach((node) => {
    node.style.cursor = 'pointer';
    node.addEventListener('click', () => selectEntity('room', node.getAttribute('data-room-id')));
  });
  els.officeCanvas.querySelectorAll('[data-agent-id]').forEach((node) => {
    node.style.cursor = 'pointer';
    node.addEventListener('click', () => selectEntity('agent', node.getAttribute('data-agent-id')));
  });
}

function renderTaskBoard() {
  const columns = [
    { key: 'todo', title: 'To Do' },
    { key: 'in_progress', title: 'In Progress' },
    { key: 'in_review', title: 'In Review' },
    { key: 'done', title: 'Done' },
  ];
  els.taskBoard.innerHTML = '';
  columns.forEach((column) => {
    const wrap = document.createElement('div');
    wrap.className = 'task-column';
    wrap.dataset.status = column.key;
    wrap.innerHTML = html`<h3>${column.title}</h3>`;
    const tasks = state.tasks.filter((task) => task.status === column.key);
    tasks.forEach((task) => {
      const card = document.createElement('div');
      card.className = 'task-card';
      card.draggable = true;
      card.dataset.taskId = task.id;
      card.innerHTML = html`<strong>${task.title}</strong><div class="muted">${task.priority} · ${task.description}</div><div class="muted">${task.assigneeIds.map(shortId).join(', ') || '未指派'}</div>`;
      card.addEventListener('dragstart', (event) => {
        event.dataTransfer.setData('text/task-id', task.id);
        card.classList.add('dragging');
      });
      card.addEventListener('dragend', () => card.classList.remove('dragging'));
      card.addEventListener('click', () => selectEntity('task', task.id));
      wrap.appendChild(card);
    });
    wrap.addEventListener('dragover', (event) => event.preventDefault());
    wrap.addEventListener('drop', async (event) => {
      event.preventDefault();
      const taskId = event.dataTransfer.getData('text/task-id');
      if (taskId) {
        state = await api(`/api/tasks/${encodeURIComponent(taskId)}/status`, { method: 'POST', body: JSON.stringify({ status: column.key }) });
        await renderAll();
      }
    });
    els.taskBoard.appendChild(wrap);
  });
}

function renderEvents() {
  els.eventFeed.innerHTML = '';
  state.events.slice(0, 8).forEach((item) => {
    const div = document.createElement('div');
    div.className = 'event-item';
    div.textContent = item;
    els.eventFeed.appendChild(div);
  });
}

function renderSelection() {
  const selection = state.selection || { kind: 'workspace', id: 'workspace' };
  if (selection.kind === 'room') {
    const room = roomLookup(selection.id);
    els.selectionCard.innerHTML = room
      ? html`<strong>${room.name}</strong><div class="muted">${room.type} · level ${room.level}</div><div class="muted">Occupants: ${room.occupantIds.map(shortId).join(', ') || '无'}</div>`
      : '<div class="muted">未选中房间</div>';
  } else if (selection.kind === 'agent') {
    const agent = agentLookup(selection.id);
    const model = agent ? modelLookup(agent.modelProfileId) : null;
    els.selectionCard.innerHTML = agent
      ? html`<strong>${agent.name}</strong><div class="muted">${agent.roleTemplate} · ${agent.status}</div><div class="muted">模型：${model ? model.name : '-'}</div><div class="muted">工位：${shortId(agent.seatId)}</div><button class="primary-btn" id="moveToMeeting">移动到会议室</button>`
      : '<div class="muted">未选中 Agent</div>';
    const moveBtn = document.getElementById('moveToMeeting');
    if (moveBtn) {
      moveBtn.addEventListener('click', async () => {
        state = await api(`/api/agents/${encodeURIComponent(agent.id)}/move`, { method: 'POST', body: JSON.stringify({ roomId: 'room_meeting' }) });
        await renderAll();
      });
    }
  } else if (selection.kind === 'task') {
    const task = state.tasks.find((item) => item.id === selection.id);
    els.selectionCard.innerHTML = task
      ? html`<strong>${task.title}</strong><div class="muted">${statusLabels[task.status] || task.status}</div><div class="muted">${task.description}</div><button class="primary-btn" id="focusTask">推进状态</button>`
      : '<div class="muted">未选中任务</div>';
    const taskBtn = document.getElementById('focusTask');
    if (taskBtn && task) {
      taskBtn.addEventListener('click', async () => {
        const next = task.status === 'todo' ? 'in_progress' : task.status === 'in_progress' ? 'in_review' : 'done';
        state = await api(`/api/tasks/${encodeURIComponent(task.id)}/status`, { method: 'POST', body: JSON.stringify({ status: next }) });
        await renderAll();
      });
    }
  } else {
    els.selectionCard.innerHTML = html`<strong>${state.name}</strong><div class="muted">默认主题：${state.themeMode}</div><div class="muted">已部署 Agent：${state.agents.length}</div><div class="muted">会议：${state.meetings.length} · 文档：${state.documents.length}</div>`;
  }
}

function renderStats() {
  const totalTasks = state.tasks.length;
  const activeTasks = state.tasks.filter((task) => task.status !== 'done').length;
  const working = state.agents.filter((agent) => agent.status === 'Working').length;
  els.canvasStats.innerHTML = [
    `Agent ${state.agents.length}`,
    `Room ${state.rooms.length}`,
    `Task ${totalTasks}`,
    `Active ${activeTasks}`,
    `Working ${working}`,
  ].map((item) => html`<span class="stat-chip">${item}</span>`).join('');
}

function renderTheme() {
  document.body.dataset.theme = state.themeMode === 'modern' ? 'modern' : 'retro';
  els.themeToggle.textContent = state.themeMode === 'modern' ? '切回像素主题' : '切换现代主题';
  els.themeBadge.textContent = state.themeMode === 'modern'
    ? '当前：现代信息面板主题'
    : '默认：像素经营桌面 + 2.5D 办公画布';
}

function renderModelOptions() {
  els.modelProfiles.innerHTML = state.modelProfiles.map((profile) => html`<option value="${profile.id}">${profile.name} · ${profile.provider}</option>`).join('');
}

async function selectEntity(kind, id) {
  state = await api('/api/select', { method: 'POST', body: JSON.stringify({ kind, id }) });
  await renderAll();
}

async function loadState() {
  state = await api(stateUrl);
  await renderAll();
}

async function renderAll() {
  renderTheme();
  renderModelOptions();
  renderRooms();
  renderTeams();
  renderStats();
  renderOffice();
  renderTaskBoard();
  renderPhasePanel();
  renderEvents();
  renderSelection();
}

els.themeToggle.addEventListener('click', async () => {
  const next = state.themeMode === 'modern' ? 'retro' : 'modern';
  state = await api('/api/theme', { method: 'POST', body: JSON.stringify({ themeMode: next }) });
  await renderAll();
});

els.agentForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(els.agentForm);
  const payload = Object.fromEntries(form.entries());
  state = await api('/api/agents', { method: 'POST', body: JSON.stringify(payload) });
  els.agentForm.reset();
  await renderAll();
});

els.saveWorkspace.addEventListener('click', async () => {
  state = await api('/api/save', { method: 'POST', body: '{}' });
  await renderAll();
});

els.reloadWorkspace.addEventListener('click', async () => {
  state = await api('/api/reload', { method: 'POST', body: '{}' });
  await renderAll();
});

els.createMeeting.addEventListener('click', async () => {
  state = await api('/api/meetings', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Phase 2 设计评审',
      roomId: 'room_meeting',
      participants: state.agents.map((agent) => agent.id),
      moderatorId: state.activeTeamId ? state.teams.find((team) => team.id === state.activeTeamId)?.leaderAgentId : null,
      roundsLimit: 3,
      summary: '确认会议、扩容和动效的交互边界。',
      status: 'active',
      linkedTaskIds: state.tasks.slice(0, 1).map((task) => task.id),
    }),
  });
  await renderAll();
});

els.archiveMeeting.addEventListener('click', async () => {
  const meeting = state.meetings[0];
  if (!meeting) return;
  state = await api(`/api/meetings/${encodeURIComponent(meeting.id)}/close`, {
    method: 'POST',
    body: JSON.stringify({ summary: '已收束为会议纪要，并同步生成文档与记忆。' }),
  });
  await renderAll();
});

els.expandOffice.addEventListener('click', async () => {
  state = await api('/api/rooms/room_b1/unlock', { method: 'POST', body: '{}' });
  await renderAll();
});

loadState().catch((error) => {
  els.officeCanvas.textContent = String(error);
});
