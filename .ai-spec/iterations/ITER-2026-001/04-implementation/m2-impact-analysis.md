| 文档 | C3 M2 影响分析 |
|---|---|
| 版本 | v1.0 |
| 日期 | 2026-09-24 |
| 状态 | 实施中 |
| 关联 | M2 / W07-W10；m2-implementation-notes.md |

| 影响面 | 当前变化 | 风险/兼容措施 |
|---|---|---|
| Persistence | 新增 SQLite workspace/run/outbox/audit store | 旧 JSON 不覆盖；迁移使用临时 DB、backup、hash 校验。 |
| API | 新增 FastAPI `/api/v1` | 旧 `http.server` `/api/*` 保留，未切换默认入口。 |
| Runtime | dispatcher 支持审批、环境不可用和 artifactStatus | 旧 Mock/Codex adapter 契约保留；现有 tests 回归通过。 |
| Frontend | 尚未切换默认入口 | M1/W03 行为不变；前端切换单独作为 W10。 |
| Security | actor envelope、路径和 artifact 约束进入 M2 service | 仍需独立安全/对抗评审和完整 secret corpus。 |
| Data | outbox/idempotency/audit 记录新增 | 需继续补齐 normalized FK schema 和 retention 证据。 |
