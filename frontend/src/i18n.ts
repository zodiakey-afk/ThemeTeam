export type Language = 'zh' | 'en';

export type MessageKey =
  | 'nav.workspace' | 'nav.office' | 'nav.tasks' | 'nav.agents' | 'nav.meetings' | 'nav.documents' | 'nav.settings'
  | 'nav.rooms' | 'nav.view'
  | 'status.syncing' | 'status.unknown' | 'status.dirty' | 'status.synced' | 'status.connected' | 'status.disconnected'
  | 'action.refresh' | 'action.reload' | 'action.save' | 'action.retry' | 'action.cancel' | 'action.create' | 'action.language'
  | 'action.addAgent' | 'action.approve' | 'action.run' | 'action.move' | 'action.focus' | 'action.overview'
  | 'action.zoomIn' | 'action.zoomOut' | 'action.more' | 'action.close' | 'action.back'
  | 'office.workspaceMode' | 'office.demoMode' | 'office.target' | 'office.canvas' | 'office.ready'
  | 'office.loading' | 'office.dragHint' | 'office.demoNotSaved' | 'office.retryScene'
  | 'office.contextLost' | 'office.textureFailed' | 'office.mapFailed' | 'office.selectMember'
  | 'office.clearSelection' | 'office.moveDemoFirst' | 'office.invalidTarget' | 'office.alreadyThere'
  | 'office.roomLocked' | 'office.unreachable' | 'office.targetOccupied' | 'office.arriving' | 'office.replan'
  | 'office.replanSuccess' | 'office.seated' | 'office.returned' | 'office.focusMember' | 'office.sceneActions'
  | 'office.closeSceneActions' | 'office.workSeat' | 'office.meetingSeat' | 'office.zoomed'
  | 'office.bossOffice' | 'office.meetingRoom' | 'office.workArea' | 'office.lounge'
  | 'office.selected' | 'office.unplaced' | 'office.focusRequired' | 'office.pathTimeout'
  | 'office.targetReservationLost' | 'office.blocked' | 'office.previewEnabled' | 'office.assetIntegrity'
  | 'office.mapUnknownProp' | 'office.occupied'
  | 'office.unreachableResult' | 'office.blockedResult' | 'office.reservationLost'
  | 'ui.workspaceName' | 'ui.loadingWorkspace' | 'ui.reloadConfirm' | 'ui.search'
  | 'ui.selectedObject' | 'ui.closeDetails' | 'ui.owner' | 'ui.participants'
  | 'ui.timeoutSeconds' | 'ui.readOnly' | 'ui.writable' | 'ui.controlledMock' | 'ui.selectedDetails'
  | 'task.todo' | 'task.inProgress' | 'task.inReview' | 'task.done' | 'task.other'
  | 'task.count' | 'task.memberCount' | 'task.completedCount' | 'task.unassigned' | 'task.recentRun'
  | 'task.unbound' | 'task.priorityHigh' | 'task.priorityLow' | 'task.priorityNormal' | 'task.noTasks'
  | 'task.artifacts' | 'task.exitCode' | 'task.statusLabel'
  | 'run.waiting' | 'run.queued' | 'run.running' | 'run.succeeded' | 'run.failed' | 'run.cancelled'
  | 'run.timedOut' | 'run.interrupted' | 'run.environmentUnavailable' | 'run.rejected'
  | 'agent.developer' | 'agent.pm' | 'agent.tester' | 'room.open' | 'room.locked' | 'room.members'
  | 'settings.title' | 'settings.description' | 'settings.runtime' | 'settings.directories' | 'settings.example'
  | 'settings.enabled' | 'settings.disabled' | 'settings.probe' | 'settings.runtimeName' | 'settings.cliType'
  | 'settings.executable' | 'settings.defaultDirectory' | 'settings.noDirectory' | 'settings.addRuntime'
  | 'settings.directoryName' | 'settings.directoryPath' | 'settings.readOnly' | 'settings.addDirectory'
  | 'settings.exampleDescription' | 'settings.projectName' | 'settings.exampleRuntime' | 'settings.exampleDirectory'
  | 'settings.generateExample' | 'settings.configureDirectory' | 'settings.exampleGenerated' | 'settings.exampleFailed'
  | 'form.newAgent' | 'form.newTask' | 'form.name' | 'form.role' | 'form.model' | 'form.runtime' | 'form.directory'
  | 'form.noBinding' | 'form.title' | 'form.description' | 'form.priority' | 'form.owner' | 'form.create'
  | 'footer.localWorkspace' | 'footer.manual' | 'footer.lastSaved' | 'footer.notSaved'
  | 'error.notConnected' | 'error.invalidResponse';

const messages: Record<Language, Record<MessageKey, string>> = {
  zh: {
    'nav.workspace': '工作区', 'nav.office': '办公室', 'nav.tasks': '任务', 'nav.agents': '团队',
    'nav.meetings': '会议', 'nav.documents': '文档', 'nav.settings': '设置',
    'nav.rooms': '房间', 'nav.view': '工作区视图',
    'status.syncing': '同步中', 'status.unknown': '结果未知', 'status.dirty': '未保存', 'status.synced': '已同步',
    'status.connected': '已连接', 'status.disconnected': '未连接',
    'action.refresh': '重新读取', 'action.reload': '从磁盘重新加载', 'action.save': '保存', 'action.retry': '重试',
    'action.cancel': '取消', 'action.create': '创建', 'action.language': '语言', 'action.addAgent': '新增员工', 'action.approve': '批准',
    'action.run': 'M2 运行', 'action.move': '移动', 'action.focus': '聚焦选中成员', 'action.overview': '办公室总览',
    'action.zoomIn': '放大画布', 'action.zoomOut': '缩小画布', 'action.more': '更多场景操作', 'action.close': '关闭',
    'action.back': '返回上个对象',
    'office.workspaceMode': '工作区', 'office.demoMode': '演示', 'office.target': '目标', 'office.canvas': '可交互等轴办公室场景',
    'office.ready': '办公室场景已就绪', 'office.loading': '正在加载办公室场景', 'office.dragHint': '拖拽空白区域平移画布',
    'office.demoNotSaved': '演示位置不会保存', 'office.retryScene': '重试场景',
    'office.contextLost': '办公室渲染上下文已丢失，请重试场景', 'office.textureFailed': '办公室纹理加载失败，请重试场景',
    'office.mapFailed': '办公室本地资源加载失败', 'office.selectMember': '请选择成员和有效目标',
    'office.clearSelection': '已清除成员选择', 'office.moveDemoFirst': '先开启演示模式，再执行本地移动',
    'office.invalidTarget': '请选择成员和有效目标', 'office.alreadyThere': '{name} 已在该位置', 'office.roomLocked': '目标房间已锁定或不可用',
    'office.unreachable': '{name} 无法到达目标', 'office.targetOccupied': '目标已被 {name} 占用', 'office.arriving': '{name} 正在前往 {target}',
    'office.replan': '{name} 第 {attempt} 次重规划未找到替代路径，继续等待', 'office.replanSuccess': '{name} 第 {attempt} 次重规划成功',
    'office.seated': '{name} 已入座，{activity}', 'office.returned': '已返回工作区记录视图',
    'office.focusMember': '聚焦成员', 'office.sceneActions': '成员场景操作', 'office.closeSceneActions': '关闭场景操作',
    'office.workSeat': '工位', 'office.meetingSeat': '会议席', 'office.zoomed': '缩放 {percent}%',
    'office.bossOffice': '老板办公室', 'office.meetingRoom': '会议室', 'office.workArea': '工位区', 'office.lounge': '休息区',
    'office.selected': '已选中 {name}', 'office.unplaced': '{count} 位成员未定位，仍可在目录中访问',
    'office.focusRequired': '请先选择一位成员', 'office.pathTimeout': '路径规划超时',
    'office.targetReservationLost': '{name} 的目标预留已失效', 'office.blocked': '{name} 通道持续受阻，已停在安全位置',
    'office.previewEnabled': '演示模式已开启，本地移动不会写入工作区',
    'office.assetIntegrity': '办公室纹理校验失败：{id}', 'office.mapUnknownProp': '办公室地图引用了未知道具帧',
    'office.occupied': '已占用',
    'office.unreachableResult': '{name} 无法到达目标', 'office.blockedResult': '{name} 通道持续受阻，已停在安全位置',
    'office.reservationLost': '{name} 的目标预留已失效',
    'ui.workspaceName': '工作区', 'ui.loadingWorkspace': '正在读取工作区…',
    'ui.reloadConfirm': '重新加载将丢弃未保存的修改。继续？', 'ui.search': '搜索',
    'ui.selectedObject': '选中对象', 'ui.closeDetails': '关闭详情', 'ui.owner': '负责人', 'ui.participants': '参与成员',
    'ui.timeoutSeconds': '超时秒数', 'ui.readOnly': '只读', 'ui.writable': '可写', 'ui.controlledMock': '受控 Mock',
    'ui.selectedDetails': '选中对象详情',
    'task.todo': '待办', 'task.inProgress': '进行中', 'task.inReview': '待验收', 'task.done': '已完成', 'task.other': '其他状态',
    'task.count': '{count} 项任务', 'task.memberCount': '{count} 位成员', 'task.completedCount': '{count} 项完成',
    'task.unassigned': '未指派', 'task.recentRun': '最近运行', 'task.unbound': '未绑定可执行 Agent',
    'task.priorityHigh': '高优先级', 'task.priorityLow': '低优先级', 'task.priorityNormal': '普通', 'task.noTasks': '暂无任务',
    'task.artifacts': '产物：{items}', 'task.exitCode': 'Run {runId} · exit {code}', 'task.statusLabel': '{title} 状态',
    'run.waiting': '待审批', 'run.queued': '排队中', 'run.running': '运行中', 'run.succeeded': '已成功',
    'run.failed': '失败', 'run.cancelled': '已取消', 'run.timedOut': '已超时', 'run.interrupted': '已中断',
    'run.environmentUnavailable': '运行环境不可用', 'run.rejected': '已拒绝',
    'agent.developer': '开发', 'agent.pm': '项目经理', 'agent.tester': '测试',
    'room.open': '已开放', 'room.locked': '锁定', 'room.members': '房间成员',
    'settings.title': '运行设置', 'settings.description': '配置模型、Agent CLI 和工程目录。密钥只保存为引用，不进入工作区快照。',
    'settings.runtime': 'Agent CLI Runtime', 'settings.directories': '工程目录', 'settings.example': '受控示例项目',
    'settings.enabled': '已启用', 'settings.disabled': '已禁用', 'settings.probe': '探测 Codex CLI',
    'settings.runtimeName': '运行时名称', 'settings.cliType': 'CLI 类型', 'settings.executable': '可执行文件',
    'settings.defaultDirectory': '默认工程目录', 'settings.noDirectory': '不绑定目录', 'settings.addRuntime': '新增 Runtime',
    'settings.directoryName': '工程名称', 'settings.directoryPath': '工程路径', 'settings.readOnly': '只读工程目录',
    'settings.addDirectory': '新增目录', 'settings.exampleDescription': '仅使用受控 Mock Runtime 生成本地项目，不执行任意外部 CLI。',
    'settings.projectName': '示例项目名称', 'settings.exampleRuntime': '示例运行时', 'settings.exampleDirectory': '示例工程目录',
    'settings.generateExample': '生成八字示例项目', 'settings.configureDirectory': '请先配置工程目录',
    'settings.exampleGenerated': '八字预测示例项目已生成到所选工程目录的 projects 文件夹', 'settings.exampleFailed': '示例项目生成失败，请检查 runtime 和工程目录配置',
    'form.newAgent': '新建成员', 'form.newTask': '新建任务', 'form.name': '名称', 'form.role': '角色', 'form.model': '模型配置',
    'form.runtime': 'Agent CLI', 'form.directory': '工程目录', 'form.noBinding': '不绑定', 'form.title': '标题',
    'form.description': '描述', 'form.priority': '优先级', 'form.owner': '负责人', 'form.create': '创建',
    'footer.localWorkspace': '本地工作区', 'footer.manual': '手动管理', 'footer.lastSaved': '上次保存 {time}', 'footer.notSaved': '尚未保存',
    'error.notConnected': '工作区未连接', 'error.invalidResponse': '工作区响应结构无效',
  },
  en: {
    'nav.workspace': 'Workspace', 'nav.office': 'Office', 'nav.tasks': 'Tasks', 'nav.agents': 'Team',
    'nav.meetings': 'Meetings', 'nav.documents': 'Documents', 'nav.settings': 'Settings',
    'nav.rooms': 'Rooms', 'nav.view': 'Workspace view',
    'status.syncing': 'Syncing', 'status.unknown': 'Unknown result', 'status.dirty': 'Unsaved', 'status.synced': 'Synced',
    'status.connected': 'Connected', 'status.disconnected': 'Disconnected',
    'action.refresh': 'Refresh', 'action.reload': 'Reload from disk', 'action.save': 'Save', 'action.retry': 'Retry',
    'action.cancel': 'Cancel', 'action.create': 'Create', 'action.language': 'Language', 'action.addAgent': 'Add member', 'action.approve': 'Approve',
    'action.run': 'Run M2', 'action.move': 'Move', 'action.focus': 'Focus selected member', 'action.overview': 'Office overview',
    'action.zoomIn': 'Zoom in', 'action.zoomOut': 'Zoom out', 'action.more': 'More scene actions', 'action.close': 'Close',
    'action.back': 'Back to previous object',
    'office.workspaceMode': 'Workspace', 'office.demoMode': 'Demo', 'office.target': 'Target', 'office.canvas': 'Interactive isometric office scene',
    'office.ready': 'Office scene ready', 'office.loading': 'Loading office scene', 'office.dragHint': 'Drag empty space to pan the canvas',
    'office.demoNotSaved': 'Demo positions are not saved', 'office.retryScene': 'Retry scene',
    'office.contextLost': 'Office rendering context was lost. Retry the scene', 'office.textureFailed': 'Office textures failed to load. Retry the scene',
    'office.mapFailed': 'Office local assets failed to load', 'office.selectMember': 'Select a member and a valid target',
    'office.clearSelection': 'Member selection cleared', 'office.moveDemoFirst': 'Enable Demo mode before moving locally',
    'office.invalidTarget': 'Select a member and a valid target', 'office.alreadyThere': '{name} is already there', 'office.roomLocked': 'The target room is locked or unavailable',
    'office.unreachable': '{name} cannot reach the target', 'office.targetOccupied': 'The target is occupied by {name}', 'office.arriving': '{name} is moving to {target}',
    'office.replan': '{name} could not find an alternate route on attempt {attempt}; waiting', 'office.replanSuccess': '{name} found an alternate route on attempt {attempt}',
    'office.seated': '{name} is seated, {activity}', 'office.returned': 'Returned to workspace record view',
    'office.focusMember': 'Focus member', 'office.sceneActions': 'Member scene actions', 'office.closeSceneActions': 'Close scene actions',
    'office.workSeat': 'Workstation', 'office.meetingSeat': 'Meeting seat', 'office.zoomed': 'Zoom {percent}%',
    'office.bossOffice': 'Manager office', 'office.meetingRoom': 'Meeting room', 'office.workArea': 'Work area', 'office.lounge': 'Lounge',
    'office.selected': '{name} selected', 'office.unplaced': '{count} members could not be placed; they remain available in the directory',
    'office.focusRequired': 'Select a member first', 'office.pathTimeout': 'Path planning timed out',
    'office.targetReservationLost': '{name} lost its target reservation', 'office.blocked': '{name} stopped in a safe position after a blocked route',
    'office.previewEnabled': 'Demo mode enabled; local movement is not saved to the workspace',
    'office.assetIntegrity': 'Office texture integrity check failed: {id}', 'office.mapUnknownProp': 'The office map references an unknown prop frame',
    'office.occupied': 'Occupied',
    'office.unreachableResult': '{name} cannot reach the target', 'office.blockedResult': '{name} stopped in a safe position after a blocked route',
    'office.reservationLost': '{name} lost its target reservation',
    'ui.workspaceName': 'Workspace', 'ui.loadingWorkspace': 'Loading workspace…',
    'ui.reloadConfirm': 'Reloading will discard unsaved changes. Continue?', 'ui.search': 'Search',
    'ui.selectedObject': 'Selected object', 'ui.closeDetails': 'Close details', 'ui.owner': 'Owner', 'ui.participants': 'Participants',
    'ui.timeoutSeconds': 'Timeout seconds', 'ui.readOnly': 'Read-only', 'ui.writable': 'Writable', 'ui.controlledMock': 'Controlled Mock',
    'ui.selectedDetails': 'Selected object details',
    'task.todo': 'To do', 'task.inProgress': 'In progress', 'task.inReview': 'In review', 'task.done': 'Done', 'task.other': 'Other status',
    'task.count': '{count} tasks', 'task.memberCount': '{count} members', 'task.completedCount': '{count} completed',
    'task.unassigned': 'Unassigned', 'task.recentRun': 'Latest run', 'task.unbound': 'No executable Agent bound',
    'task.priorityHigh': 'High priority', 'task.priorityLow': 'Low priority', 'task.priorityNormal': 'Normal', 'task.noTasks': 'No tasks',
    'task.artifacts': 'Artifacts: {items}', 'task.exitCode': 'Run {runId} · exit {code}', 'task.statusLabel': '{title} status',
    'run.waiting': 'Awaiting approval', 'run.queued': 'Queued', 'run.running': 'Running', 'run.succeeded': 'Succeeded',
    'run.failed': 'Failed', 'run.cancelled': 'Cancelled', 'run.timedOut': 'Timed out', 'run.interrupted': 'Interrupted',
    'run.environmentUnavailable': 'Runtime unavailable', 'run.rejected': 'Rejected',
    'agent.developer': 'Developer', 'agent.pm': 'Project manager', 'agent.tester': 'QA',
    'room.open': 'Open', 'room.locked': 'Locked', 'room.members': 'Room members',
    'settings.title': 'Runtime settings', 'settings.description': 'Configure models, Agent CLIs, and project directories. Secrets are stored only as references and never enter the workspace snapshot.',
    'settings.runtime': 'Agent CLI Runtime', 'settings.directories': 'Project directories', 'settings.example': 'Controlled example project',
    'settings.enabled': 'Enabled', 'settings.disabled': 'Disabled', 'settings.probe': 'Probe Codex CLI',
    'settings.runtimeName': 'Runtime name', 'settings.cliType': 'CLI type', 'settings.executable': 'Executable',
    'settings.defaultDirectory': 'Default project directory', 'settings.noDirectory': 'No directory binding', 'settings.addRuntime': 'Add runtime',
    'settings.directoryName': 'Directory name', 'settings.directoryPath': 'Directory path', 'settings.readOnly': 'Read-only directory',
    'settings.addDirectory': 'Add directory', 'settings.exampleDescription': 'Uses only the controlled Mock Runtime to generate a local project; no arbitrary external CLI is executed.',
    'settings.projectName': 'Example project name', 'settings.exampleRuntime': 'Example runtime', 'settings.exampleDirectory': 'Example directory',
    'settings.generateExample': 'Generate Bazi example project', 'settings.configureDirectory': 'Configure a project directory first',
    'settings.exampleGenerated': 'Bazi example project generated in the selected directory projects folder', 'settings.exampleFailed': 'Example generation failed. Check the runtime and project directory',
    'form.newAgent': 'New member', 'form.newTask': 'New task', 'form.name': 'Name', 'form.role': 'Role', 'form.model': 'Model profile',
    'form.runtime': 'Agent CLI', 'form.directory': 'Project directory', 'form.noBinding': 'No binding', 'form.title': 'Title',
    'form.description': 'Description', 'form.priority': 'Priority', 'form.owner': 'Owner', 'form.create': 'Create',
    'footer.localWorkspace': 'Local workspace', 'footer.manual': 'Manual management', 'footer.lastSaved': 'Last saved {time}', 'footer.notSaved': 'Not saved yet',
    'error.notConnected': 'Workspace is not connected', 'error.invalidResponse': 'Invalid workspace response structure',
  },
};

export function translate(language: Language, key: MessageKey, values: Record<string, string | number> = {}): string {
  return messages[language][key].replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? `{${name}}`));
}
