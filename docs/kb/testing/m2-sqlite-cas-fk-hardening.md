| 文档 | KB-TST-0006 M2 SQLite CAS/FK hardening |
|---|---|
| 版本 | v1.0 |
| 日期 | 2026-10-07 |
| 状态 | active |
| 关联 | M2 / W07-W10；m2-test-report.md |

## Evidence

- `tests.test_m2_service`: 19/19 passed.
- `tests.run_isolated.py --rounds 2`: 83/83 passed in each round; one Windows symlink case skipped.
- Two SQLite connections racing the same run version produce one successful terminal update and one stale rejection.
- Required `runs`, `approvals`, `audit_events`, `outbox_events`, and `idempotency_keys` foreign keys are declared.
- `PRAGMA foreign_key_check` reports zero violations.
- Normal command projection uses incremental upsert and preserves tasks referenced by runs.
- CorrelationId is preserved from run to archived document and document query response.
- Retry after service restart reconstructs runtime/project context from persisted profiles without persisting prompt plaintext.
- Legacy JSON `TaskRunStore` supports the same conditional transition CAS contract as the SQLite dispatcher.

## Boundary

JSON array references such as room occupants and task assignees remain validated by application logic and normalized where applicable; they are not all represented as relational foreign keys.
