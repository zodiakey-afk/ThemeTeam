| 文档 | D1 M2 迭代差异简报 |
|---|---|
| 版本 | v1.0 |
| 日期 | 2026-09-24 |
| 状态 | 修订候选，等待独立技术复审 |
| 关联 | M2 / W07-W10；m2-scope.md；m2-user-stories.md |

## 需求

- M2-01 至 M2-08：单团队真实任务闭环。
- M2-NFR-01 至 M2-NFR-08：持久化、恢复、安全、隔离、可观测性。

## 既有模块

| 模块 | 当前 | M2 变化 |
|---|---|---|
| `themeteam/web/server.py` | `http.server` loopback API | FastAPI 作为新版 `/api/v1` 入口；旧 API 保留兼容。 |
| `themeteam/core/store.py` | JSON workspace snapshot | 兼容 facade 改为调用 SQLite repository；JSON 仅迁移输入/备份。 |
| `themeteam/core/models.py` | dataclass snapshot | 保留 DTO 兼容；新增 domain persistence DTO。 |
| `themeteam/core/dispatcher.py` | 独立 run JSON store | run、approval、audit、outbox 进入 SQLite；artifact 仍在文件系统。 |
| `frontend/src/workspace.ts` | 快照 + 串行 HTTP | 增加 `/api/v1` 命令确认和 WebSocket cursor 恢复；旧入口继续可用。 |
| `frontend/src/office/*` | 消费快照 | 只消费确认后的状态投影，不直接改变领域事实。 |

## 契约变化

- 新增 `/api/v1/*`，不破坏 `/api/*`。
- 新增 `commandId`、`idempotencyKey`、`correlationId`、`expectedVersion`。
- 新增统一事件 envelope：`eventId/schemaVersion/workspaceId/seq/entityVersion/type/entityId/correlationId/occurredAt/payload`。
- 新增运行、审批、artifact、审计查询契约。

## 数据变化

- 新增 SQLite `schema_version`、业务实体表、`runs`、`approvals`、`audit_events`、`outbox_events`。
- JSON 导入先写临时 SQLite 文件并执行引用/计数/hash 校验，校验通过后原子替换。
- 保留 `.json.bak`；导入失败不改变当前 SQLite 或原 JSON。

## 既有测试影响

- W01/W02/W03/M1 回归必须继续通过。
- 新增 `BB-M2-*`、`WB-M2-*` 和 M2 迁移/事件/执行矩阵。
- 旧 HTTP 测试继续作为兼容回归；新 API 使用独立测试 fixture。
