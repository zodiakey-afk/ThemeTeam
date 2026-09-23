| 文档 | Agent CLI 扩展接入架构设计 |
|---|---|
| 版本 | v0.3 |
| 日期 | 2026-09-23 |
| 状态 | P4 dispatcher、Codex 任务边界和 P5 overflow 基础已实现；真实 artifact smoke 受本机 ACL 环境阻断 |
| 关联 | M2；Agent 创建；设置页；Codex / Claude / OpenCode CLI |

# 目标

在现有 `ModelProfile` 之外引入独立的 `AgentRuntimeProfile`，支持为员工选择 Codex、Claude Code、OpenCode 或仅模型 API。新建员工时分别选择：

- 模型配置：模型、provider、上下文、能力标签。
- Agent CLI 配置：CLI 类型、可执行文件、工作目录策略、非敏感参数、权限策略。

模型负责推理能力描述，Agent CLI runtime 负责本地执行方式；二者不能继续混为一个 `modelProfileId`。

# 当前架构评估

当前链路为：

```text
React / Zustand WorkspaceController
  -> loopback REST API
  -> WorkspaceStore
  -> JSON WorkspaceState

OfficeCanvas / Phaser
  <- snapshot + selection，只负责空间表现
```

适合增量扩展的部分：

- `WorkspaceStore` 已集中管理实体和引用校验。
- `Agent` 已通过 ID 关联 `ModelProfile`，可新增 `runtimeProfileId`。
- 前端 controller 已有串行写入、超时和未知结果屏障。
- 场景不直接持有执行权限，可继续只显示运行状态。

当前缺口：

- Codex 只读 probe、ProcessSupervisor、工程目录 guard 和设置页探测入口已实现。
- Claude/OpenCode adapter、真实任务 dispatcher 和完整任务事件协议仍未实现。
- 没有 stdout/stderr 事件协议、取消、超时、恢复和进程所有权模型。
- JSON snapshot 当前会持久化所有字段，不适合存储 API key、token 或登录凭据。
- 现有 `status` 是展示字段，不是可靠的 CLI 作业状态机。

# 建议分层

```text
Settings UI
  -> ModelProfile API
  -> AgentRuntimeProfile API
  -> ProjectDirectoryProfile API
  -> CredentialRef API

Task Dispatcher
  -> RuntimeRegistry
     -> CodexCliAdapter
     -> ClaudeCliAdapter
     -> OpenCodeCliAdapter
     -> ModelApiAdapter
  -> ProcessSupervisor
  -> Event / Artifact Store
```

## ProjectDirectoryProfile

工程目录是 Agent 执行上下文的一等配置，但不进入业务 WorkspaceState。建议保存为本机 settings store 中的 profile：

```json
{
  "id": "project_theme_team",
  "name": "ThemeTeam 主工程",
  "path": "C:\\repos\\ThemeTeam",
  "pathKind": "local",
  "allowed": true,
  "readOnly": false,
  "defaultBranch": null
}
```

配置规则：

- UI 选择已登记的工程目录 profile，不接受任务文本里的任意路径。
- 保存与运行前都执行 realpath、目录存在性、允许根目录、读写权限和工程标识检查。
- 支持 `workspace`、`project-profile`、`temporary-copy` 三种工作目录策略。
- 任务可以引用已登记 profile，但不能通过 `..`、符号链接、环境变量或 shell 字符串绕过路径边界。
- 真实绝对路径只保存在本机配置；业务快照只保存 `projectDirectoryProfileId`。

## AgentRuntimeProfile

建议字段：

```json
{
  "id": "runtime_codex_default",
  "name": "Codex Local",
  "kind": "codex-cli",
  "executable": "codex",
  "enabled": true,
  "workingDirectoryPolicy": "project-profile",
  "projectDirectoryProfileId": "project_theme_team",
  "credentialRef": "cred_codex_default",
  "arguments": [],
  "environmentAllowlist": [],
  "capabilities": ["coding", "terminal", "files"],
  "approvalPolicy": "manual",
  "timeoutSeconds": 1800
}
```

`kind` 首批取值：`model-api`、`codex-cli`、`claude-cli`、`opencode-cli`。

运行时解析顺序固定为：

```text
Agent -> AgentRuntimeProfile -> ProjectDirectoryProfile -> validated working directory
```

# 安全边界

- API key、OAuth token、CLI session 文件不得进入 WorkspaceState、前端 snapshot、日志或任务描述。
- `credentialRef` 只保存引用；真实凭据放 OS credential manager 或独立权限受控配置文件。
- executable 不接受任意用户命令字符串；由 allowlist runtime kind 映射到验证后的可执行文件。
- 工程目录不接受任意任务输入；只能引用已登记且通过校验的 ProjectDirectoryProfile。
- 参数使用数组并逐项校验，禁止 shell 拼接。
- 每个作业使用独立工作目录、进程组、超时、取消 token 和输出大小限制。
- 默认禁止网络/工具授权；权限提升必须走人工审批策略。

# 设置页面

新增“设置”主导航，至少包含三个 tab：

1. **模型配置**：新增/编辑/禁用 ModelProfile；连接测试；不回显密钥。
2. **Agent CLI**：Codex / Claude / OpenCode executable 探测、版本、登录状态、工作目录策略、权限策略和超时。
3. **工程目录**：新增目录 profile、验证目录、选择默认 Agent、只读/可写策略和临时副本策略。
4. **凭据与安全**：只显示 credential alias、来源和有效性，不显示 secret；支持测试、替换和删除。

# 新建员工

当前入口已存在于“团队”页面右上角的“新建成员”，不是后续功能。但目前表单只支持名称、角色和模型配置。

下一阶段修改为：

- 团队页继续保留主入口。
- 办公室工具栏增加“新增员工”快捷命令，跳转/打开同一表单。
- 表单新增 `Agent CLI` 选择、默认工位、能力标签和运行权限摘要。
- 创建前验证模型 profile 与 runtime profile 均启用且兼容。
- 超过 20 人时明确显示未定位或进入后续自动扩容流程，不静默覆盖座位。

# 迁移与兼容

- `Agent.runtimeProfileId` 初始可空；旧 Agent 迁移为 `null` 或默认 `model-api` runtime。
- `Agent.projectDirectoryProfileId` 初始可空；旧 Agent 继承团队默认目录或使用 `null`。
- ModelProfile 保持现有字段兼容，新字段通过版本化 snapshot schema 引入。
- ModelProfile、AgentRuntimeProfile、ProjectDirectoryProfile 和 CredentialRef 与业务 workspace 分文件持久化，避免保存工作区时覆盖本机路径或 CLI 凭据配置。
- Phaser 只读取 agent status/runtime label，不直接启动 CLI。

## 当前已实现切片（2026-09-23）

- `themeteam/core/agent_runtime.py` 提供 `ProcessSupervisor`、`ProjectDirectoryGuard` 和 `CodexCliAdapter`。
- Codex adapter 仅允许 `codex`/`codex.exe`，使用 argv 数组、`shell=false`、`--ephemeral`、`--sandbox read-only`。
- 进程监督支持超时、取消、进程树清理、stdout/stderr 上限和敏感字段脱敏。
- 设置页通过 `/api/runtime-profiles/{id}/probe` 触发版本探测；只接受已登记、已启用、绑定工程目录的 Codex profile。
- 真实本机 Codex 只读 smoke 已通过，证据为 `docs/evidence/codex-cli-smoke.json`。
- 本切片不允许真实任务写入、任意 prompt 执行、任意 executable、模型 API key 注入或凭据读取。

## 尚未完成

- P4 stream/result 事件、人工审批 UI、浏览器端完整产物预览，以及在同一用户 ACL 下的真实 artifact smoke。
- Claude Code 与 OpenCode 本机 executable 探测、真实 smoke 和独立契约证据。
- ProjectDirectoryProfile 独立本机 settings store 迁移。
- P5 自动工位扩展、地图重排与 21/40/60 人性能验收。
