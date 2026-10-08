| 文档 | ADR-M2-001 SQLite 事实源与 outbox 事件 |
|---|---|
| 版本 | v1.0 |
| 日期 | 2026-09-24 |
| 状态 | 冻结候选，等待独立技术评审 |
| 关联 | M2 / W07-W08；m2-data-model.md；m2-events-v1.json |

## Context

M2 同时需要可靠持久化、重启恢复、幂等命令和实时状态投影。继续让 JSON snapshot、run JSON 和前端动画分别作为事实源会产生重复状态和恢复竞态。

## Decision

使用 SQLite 作为结构化业务事实源；使用同事务 outbox 记录事件；使用 WebSocket 发布事件；文件系统只保存 artifact 和文档内容。保留 JSON 作为导入输入和回滚备份。

## Alternatives

| 方案 | 结论 |
|---|---|
| 继续 JSON + 轮询 | 拒绝：无法提供事务、游标和幂等事件语义。 |
| SQLite + SSE | 后置：单向传输不足以覆盖当前命令确认/恢复设计，且不能与 WebSocket 同时作为权威流。 |
| 外部消息队列 | 拒绝：M2 单机本地范围不需要额外服务和部署复杂度。 |

## Consequences

- 需要一次性迁移、备份和回滚演练。
- 旧 API 必须通过 projection 兼容。
- SQLite 锁和 outbox 发布器成为新的运行时职责。
