| 文档 | ThemeTeam 合并开发路线 |
|---|---|
| 版本 | v1.2 |
| 日期 | 2026-09-23 |
| 状态 | P4/P5 工程闭环已实现并机器验证；完整路线与 M1 人工门禁仍待确认 |
| 关联 | `docs/plan.md` v1.4；`next-plan-agent-cli.md`；M1 v0.4 |

## 当前基线

- M1 办公室画布的机器验证、正式 NFR 和双 DPR 长稳已完成。
- 当前运行是 20 工位、6 会议席、100% 默认总览；手动缩放范围仍为 50%–200%。
- 视觉参考只保留为开发/验收资产，不属于正式运行导航。
- Agent 已支持可空 `runtimeProfileId` 和 `projectDirectoryProfileId`；设置页、工程目录选择和受控 Mock Runtime 已完成。
- G5 仍等待最新资源的独立复审；在复审前不宣称 M1 全门禁关闭。

## 原计划映射

| 当前 P 阶段 | 原计划里程碑 | 结论 |
|---|---|---|
| P0 | M1 / Phase 1 的办公室画布收尾 | 最终 atlas、正式 NFR、双 DPR 长稳、运行视觉复审和发布门禁 |
| P1-P4 | M2 / Phase 1 单团队可运行 MVP | 模型配置、Agent 招聘、CLI runtime、工程目录和任务执行闭环 |
| P5 | M3 / Phase 2 具身协同与团队扩容的前置子阶段 | 20 人以上容量、自动工位、地图重排；不等于完整会议/Leader Beta |
| 后续会议/Leader | M3 / Phase 2 | GroupChat、Moderator、Leader 拆解、忙碌成员协调和回座 |
| 文档/知识 | M4 / Phase 3 | 文档中心、解析、检索、三层记忆和审批 |
| 多团队/桌面发行 | M5 / Phase 4 | 多团队、多楼层、离线模型、桌面打包和发行准备 |

**P5 完成后对应原计划 M3 的前置完成，不是 M5。** 原 M5 包含多团队、桌面发行和完整扩容，必须等 M3、M4 能力完成后再验收。

## P0：M1 收尾

1. 基于最终 props atlas hash 完成独立视觉/对抗复审。
2. QA 签署 G4/G5，完成完整可运行回滚包。
3. 项目负责人审批 G6，用户确认 G7。

## P1：设置、配置模型与工程目录

1. 冻结 `AgentRuntimeProfile`、`ProjectDirectoryProfile`、`CredentialRef` 和版本化 schema。
2. 将本机运行配置与业务 WorkspaceState 分离；业务快照只保存 profile ID。
3. 设置页分为模型、Agent CLI、工程目录、凭据与安全四个区域。
4. 校验目录 realpath、允许根目录、权限、工程标识、只读/可写和临时副本策略。
5. 探测 CLI executable、版本和登录状态，结果只读展示，不回显密钥；当前已完成 Codex 版本 probe。

## P2：CLI Adapter 与工程目录绑定

1. 定义 `AgentRuntimeAdapter`：`probe/start/cancel/stream/result/dispose`。
2. 实现 `ProcessSupervisor`：独立工作目录、参数数组、超时、进程组清理和输出限制。已完成。
3. 先实现 mock runtime 与一个受控本地 CLI adapter，冻结事件协议。Codex 只读 probe 已完成。
4. 再分别接入 Codex、Claude Code、OpenCode，每个 adapter 独立契约和测试。统一 adapter 契约已完成；Claude/OpenCode 真实 executable smoke 仍待完成，Codex artifact smoke 受当前 Windows ACL 测试环境阻断。
5. 验收两个工程目录并行运行互不串扰，结束后无孤儿进程、锁文件和临时目录。并行隔离专项已通过；真实 CLI artifact smoke 仍需在同一用户 ACL 下重跑。

## P3：Agent 创建与团队/办公室入口

1. Agent 新增可空 `runtimeProfileId` 和 `projectDirectoryProfileId`，兼容旧数据。
2. 团队页“新建成员”表单增加模型、Agent CLI、工程目录、默认工位和能力标签。
3. 办公室工具栏增加“新增员工”快捷入口，复用团队页表单。
4. 详情面板显示模型、runtime、工程目录、版本、连接状态和权限策略。
5. 超过 20 人时明确显示未定位，不静默覆盖座位；自动扩容留给 P5。

## P4：任务执行闭环

1. 建立 `queued/running/waiting/succeeded/failed/cancelled` 状态机。
2. 每次运行记录 runtime profile、project directory profile、工作目录摘要和 artifact 目录，不记录 secret。
3. stdout/stderr、结构化事件和 artifact 分离存储。
4. 任务状态只由 dispatcher 确认，不由 Phaser 动画回调决定。
5. 增加取消、超时、崩溃恢复、重试和人工审批。

### 当前 P2/P3 进度

- 已完成：Codex executable allowlist、只读 argv、工作目录校验、超时/取消/输出限制/脱敏、设置页 probe 按钮。
- 已完成：真实 Codex CLI 只读 smoke；退出码 0，工作区文件未改变。
- 已完成：真实业务 prompt dispatcher、任务状态机、artifact 目录边界、取消/超时/重试/恢复、双工程并行隔离。
- 未完成：同一用户 ACL 下的真实 Codex artifact smoke、Claude/OpenCode 真实 executable smoke、登录状态细分、浏览器端产物预览和人工审批 UI。

### P4 当前结果（2026-09-23）

- 已完成：独立本机 settings store、TaskDispatcher、run 状态持久化、超时/取消/重试/重启恢复、Codex workspace-write 任务 argv、artifact 目录、任务页运行入口。
- 已完成：Claude/OpenCode adapter 统一契约骨架和双工程目录并行隔离测试。
- 尚未宣称：Claude/OpenCode 本机真实 CLI smoke、浏览器端完整任务产物预览和人工审批 UI。

## P5：容量与办公室扩展

1. 20 人以上容量检测和未定位提示。
2. 自动新增工位、地图重排、碰撞 oracle 更新和镜头边界更新。
3. 21/40/60 人性能、长稳和可读性压力测试。
4. 工程目录 profile 继续作为 Agent 执行上下文，不因扩容复制或泄漏凭据。

### P5 当前结果（2026-09-23）

- 已完成：工位满载后自动启用扩容房间，新增成员进入 `Unplaced`，已有工位不被覆盖。
- 尚未完成：地图重排、碰撞 oracle/镜头边界更新，以及 21/40/60 人正式性能和长稳验收。

## M3/M4/M5 后续

- **M3**：会议室 GroupChat、Moderator、Leader 拆解、忙碌成员协调、入场/发言/回座。
- **M4**：文档导入、解析、预览、检索、三层记忆、审批和权限。
- **M5**：多团队、多楼层、离线模型、桌面打包、升级恢复和发行准备。

## 统一验收原则

- 密钥不进入 workspace snapshot、日志、截图或前端状态。
- CLI executable 来自 allowlist，参数禁止 shell 拼接。
- 工程目录越界、符号链接绕过、无权限目录和临时副本泄漏均为阻断缺陷。
- 两个 runtime 作业、两个工程目录和两个前端 root 必须互不串扰。
- 旧 Agent、旧 WorkspaceState 和当前 M1 场景继续可用。
