| 文档 | C2 M2 实现说明 |
|---|---|
| 版本 | v1.0 |
| 日期 | 2026-09-24 |
| 状态 | 实施中 |
| 关联 | M2_G3；W07-W10；m2-api-v1.json；m2-events-v1.json |

## Implementation sequence

| Task | Scope | Verification |
|---|---|---|
| W07 | SQLite schema, JSON migration, repository and FastAPI v1 foundation | BB-M2-01..11 |
| W08 | outbox, cursor replay, idempotency and WebSocket subscription | BB-M2-07..11 |
| W09 | SQLite-backed run/approval/audit projection and existing dispatcher integration | BB-M2-12..18 |
| W10 | task/run API projection, artifact metadata, legacy compatibility and frontend refresh path | BB-M2-19..24 |

## Explicit non-goals

M3 meetings, M4 document parsing/vector retrieval and M5 multi-team/desktop packaging are not changed by this implementation.
