| 文档 | T1 M2 测试执行报告 |
|---|---|
| 版本 | v1.0 |
| 日期 | 2026-10-07 |
| 状态 | 验收完成；M2 核心实现条件通过，G4/G5/G6/G7 仍按流程 pending |
| 关联 | M2 / W07-W10；m2-spec-v1.md |

## 已执行证据

| 检查 | 结果 | 命令/证据 |
|---|---|---|
| M2 FastAPI/SQLite/WebSocket smoke | PASS，19/19 | `python -m unittest tests.test_m2_service -v` |
| Real M2 server startup smoke | PASS | `docs/evidence/m2-server-start-smoke.json` |
| Backend regression | PASS，83/83 x 2；1 个 symlink case skipped by Windows ACL | `python tests/run_isolated.py --rounds 2` |
| Python compile | PASS | `python -m py_compile run.py themeteam/core/sqlite_store.py themeteam/core/m2_service.py themeteam/web/api_v1.py themeteam/core/dispatcher.py` |
| Frontend typecheck | PASS | `cd frontend; npm.cmd run typecheck` |
| Frontend unit | PASS，48/48 | `cd frontend; npm.cmd run test:unit` |
| Frontend build | PASS | `cd frontend; npm.cmd run build` |
| Workspace integrity | PASS | Default workspace SHA-256 unchanged by isolated regression |
| WebSocket protocol reconnect/gap | PASS | `docs/evidence/m2-websocket-acceptance.json` |
| Migration fault matrix | PASS | `05-testing/evidence/m2-migration-fault-matrix.json` |
| 50 次持久化写入与重启校验 | PASS，50/50 | `05-testing/evidence/m2-persistence.json` |
| 本地命令延迟画像 | PASS，200 samples；P95 39.039 ms | `05-testing/evidence/m2-latency.json` |
| 安全边界画像 | PASS | `05-testing/evidence/m2-security.json` |
| 可观测性/关联性 | PASS，250/250 | `05-testing/evidence/m2-observability.json` |
| CAS/FK hardening | PASS | `05-testing/evidence/m2-cas-fk-hardening.json` |
| Secret audit | PASS with scope | `docs/evidence/secret-audit-20261007.json` |

## M2 smoke coverage

- JSON source copied to a temporary fixture and migrated to SQLite.
- Migration backup and schema metadata created.
- Idempotent task command replay returns the same task and one event.
- Manual runtime creates `waiting` run; approval starts the run.
- Mock runtime writes only under the run artifact root.
- Run result exposes relative artifact metadata.
- Snapshot endpoint returns a workspace cursor.
- Normalized entity tables and task-assignee relations are populated during migration.
- WebSocket replay returns committed `task.created` events from `lastSeenSeq`.
- WebSocket pushes newly committed events and replays them after reconnect from the prior cursor.
- M2 task view creates tasks and reads/controls runs through `/api/v1`.
- `python run.py --m2` starts FastAPI on loopback, initializes a temporary SQLite database, serves snapshot and task creation, and leaves no default SQLite file.
- Model profile creation preserves only an opaque `credentialRef`; no secret value is accepted or persisted.
- Expected-version conflict, documents filtering, body caps, repeated approval and WebSocket resync are covered by the expanded M2 suite.
- Run identity/version/correlation and artifact hash/size are covered by the expanded M2 suite.

## Current limitations

- FastAPI `/api/v1` is the active path for current M2 Agent/runtime/project-directory forms; legacy `/api/*` methods remain compatibility exports only.
- WebSocket protocol replay, reconnect replay and cursor-gap resync have executable evidence; browser UI rendering is not claimed by this harness.
- SQLite normalized entity tables, run/artifact tables, migration fault handling, `integrity_check`, FK audit and artifact uniqueness have executable evidence.
- Real Codex workspace-write smoke remains environment-sensitive and must be rerun under the same user ACL.
- Claude/OpenCode executable smoke is not available in the current environment.
- Independent implementation review, QA sign-off and project-owner release approval are still required by the CodingSpec gates.
- P1 remediation regression: workspace version chaining, M2 configuration fact-source, invalid-enum rejection and authorization boundary are covered by the expanded M2 suite.
- The latest expanded M2 suite is 19/19; the latest full backend regression is 83/83 x 2.
- CAS/FK hardening regression covers two SQLite connections, stale terminal callback rejection, declared key FKs and projection updates while runs reference tasks.
- Correlation, restart-retry, M2 startup snapshot, unknown-result protection and worker shutdown are covered by the latest regression set.
- Remaining boundary: JSON array references not represented by relational tables remain protected by application validation.
- Secret audit found zero strict credential-format matches in the working tree and all reachable Git history; keyword hits are classified design/redaction/test references only.
