| 文档 | M1 收尾与 M2 Agent CLI 开发计划 |
|---|---|
| 版本 | v0.2 |
| 日期 | 2026-09-23 |
| 状态 | 已合并入 `docs/next-development-plan-unified.md`；待项目负责人确认 |
| 关联 | `docs/agent-cli-architecture.md`；`docs/next-development-plan-unified.md`；M1 v0.4；M2/M3 |

> 本文件保留 P1-P5 的任务细节；跨里程碑映射和统一关键路径以 `docs/next-development-plan-unified.md` 为准。

## P0 M1 缺陷收口

1. 完成家具 atlas 真实 bbox 打包并进行用户目视确认。
2. 重跑完整 `verify`、正式 NFR、双 DPR 长稳和最新运行视觉复审。
3. 完成完整可运行回滚包与 G4/G5/G6/G7 签署。

## P1 设置与配置模型

1. 设计并冻结 `AgentRuntimeProfile`、`CredentialRef` 和版本化 snapshot/config schema。
2. 新增 `ProjectDirectoryProfile`，配置工程目录、realpath、只读/可写策略、临时副本策略和默认工程。
3. 将本机运行配置与业务 WorkspaceState 分离；业务快照只保存 profile ID，不保存绝对路径、密钥或 token。
4. 实现设置页：模型、Agent CLI、工程目录、凭据与安全四个 tab。
5. 实现 CLI executable/version/login 探测和工程目录权限/工程标识校验，结果只读展示。

## P2 CLI Adapter 基础

1. 定义统一 `AgentRuntimeAdapter`：probe、start、cancel、stream、result、dispose。
2. 实现 `ProcessSupervisor`：从 `ProjectDirectoryProfile` 解析工作目录，使用参数数组、超时、进程组清理和输出限制。
3. 先实现一个 mock adapter 和一个受控本地 CLI adapter，冻结事件协议。
4. 再分别接入 Codex、Claude Code、OpenCode；每种 adapter 独立契约和测试。

## P3 Agent 创建与团队页面

1. 扩展 Agent：`runtimeProfileId`、`projectDirectoryProfileId`，兼容旧数据。
2. 团队页“新建成员”表单增加模型配置、Agent CLI 配置和工程目录配置。
3. 办公室增加“新增员工”快捷入口，复用团队页表单。
4. 详情面板显示模型、runtime、版本、连接状态和权限策略。

## P4 任务执行闭环

1. 任务派发给 Agent runtime，建立 queued/running/waiting/succeeded/failed/cancelled 状态机。
2. stdout/stderr、结构化事件和 artifact 分离存储。
3. 任务状态只由 dispatcher 确认，不由 Phaser 动画回调决定。
4. 增加取消、超时、崩溃恢复、重试和人工审批。

## P5 容量与办公室扩展

1. 20 人以上容量检测和未定位提示。
2. 自动新增工位、地图重排和碰撞 oracle 更新。
3. 21/40/60 人性能与布局压力测试。
4. P5 完成后对应原计划 **M3 / Phase 2 的具身协同与团队扩容前置子阶段**，不等于原计划 M5；完整 M3 仍需会议室 GroupChat、Moderator、Leader 拆解和协同状态。

## 验收重点

- 无密钥进入 snapshot、日志、截图或前端状态。
- 参数无 shell 拼接，CLI executable 来自 allowlist。
- 两个 runtime 作业和两个 root 完全隔离。
- 中断/超时后无孤儿进程、锁文件或残留工作目录。
- 旧 Agent、旧 WorkspaceState 和当前 M1 场景继续可用。
