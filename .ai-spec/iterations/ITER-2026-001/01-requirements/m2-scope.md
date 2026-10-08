| 文档 | R4 M2 范围说明 |
|---|---|
| 版本 | v1.0 |
| 日期 | 2026-09-24 |
| 状态 | 已确认 |
| 关联 | M2 / W07-W10；docs/plan.md |

## In scope

- FastAPI loopback API，与现有 HTTP API 兼容迁移。
- SQLite schema、JSON 导入、备份、校验、回滚。
- runs、approvals、audit_events、outbox_events、artifacts 元数据。
- HTTP 命令、WebSocket 事件订阅、游标补偿和快照重取。
- runtime/project profile 绑定、任务指派、dispatcher 生命周期。
- Mock runtime 确定性验收、Codex workspace-write 真实 adapter。
- 取消、超时、重试、重启恢复、人工审批和结果归档。
- 任务页运行状态与 M1 画布状态投影联动。

## Out of scope

- M3 会议室 GroupChat、Moderator、Leader 拆解和回座。
- M4 文件导入、解析、检索、记忆和审批知识流。
- M5 多团队、多楼层、离线模型和桌面发行。
- 破坏性删除旧 JSON 或要求旧入口立即退役。

## 兼容策略

- 旧 `/api/state` 与 CRUD 入口在迁移期间保留。
- 新能力使用 `/api/v1` 命名空间；旧接口通过兼容 adapter 读取 SQLite 投影。
- 旧 JSON 只作为导入源和备份，不作为 M2 运行时第二事实源。
