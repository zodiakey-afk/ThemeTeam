| 文档 | P1 M2 WBS |
|---|---|
| 版本 | v1.0 |
| 日期 | 2026-09-24 |
| 状态 | 计划候选，等待 G2/G3 |
| 关联 | M2 / W07-W10；m2-lld.md；m2-api-v1.json |

| 任务 | 描述 | 依赖 | 产出 | 验证 |
|---|---|---|---|---|
| W07.1 | SQLite schema/repository | D5 | migration/schema/repository | BB-M2-01..04 |
| W07.2 | JSON import/backup/rollback | W07.1 | migration CLI/service | BB-M2-05..08 |
| W07.3 | FastAPI v1 loopback adapter | W07.1 | API routes/errors | BB-M2-09..13 |
| W08.1 | outbox/event envelope | W07.1 | event writer/publisher | BB-M2-14..17 |
| W08.2 | WebSocket cursor/replay/resync | W08.1 | subscription service | BB-M2-18..21 |
| W08.3 | idempotency/version conflicts | W07.1 | command middleware | BB-M2-22..24 |
| W09.1 | runtime registry/credential boundary | W07.3 | profile binding | BB-M2-25..27 |
| W09.2 | dispatcher SQLite run lifecycle | W08.3 | run/approval/audit | BB-M2-28..34 |
| W09.3 | Codex/Mock adapter integration | W09.2 | real task boundary | BB-M2-35..38 |
| W10.1 | task board v1 command integration | W09.2 | task/run UI | BB-M2-39..42 |
| W10.2 | artifact/document archive | W09.2 | artifact API/document links | BB-M2-43..45 |
| W10.3 | restart/disconnect E2E | W08.2,W10.2 | end-to-end evidence | BB-M2-46..50 |
