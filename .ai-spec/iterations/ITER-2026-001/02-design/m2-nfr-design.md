| 文档 | D7 M2 NFR 设计与威胁模型 |
|---|---|
| 版本 | v1.0 |
| 日期 | 2026-09-24 |
| 状态 | 修订候选，等待独立技术复审 |
| 关联 | M2 / m2-nfr.md；m2-lld.md |

## NFR mapping

| NFR | 设计机制 | 验证 |
|---|---|---|
| M2-NFR-01 | SQLite transaction、migration temp DB、atomic replace、backup | migration/restart/fault injection |
| M2-NFR-02 | outbox seq、cursor replay、gap response、snapshot resync | disconnect/reorder/duplicate harness |
| M2-NFR-03 | local service、indexed queries、monotonic timing | 200-task latency sample |
| M2-NFR-04 | ProjectDirectoryGuard、run artifact root、argv only、process group | parallel isolation and path traversal |
| M2-NFR-05 | allowlist executable、secret redaction、server approval state、CSP | malicious corpus and secret scan |
| M2-NFR-06 | startup recovery transaction and interrupted status | forced restart |
| M2-NFR-07 | unique source/correlation and idempotency key | concurrent replay |
| M2-NFR-08 | audit_events + correlationId + redaction | query and log inspection |

## Threat model

| Threat | Control |
|---|---|
| Prompt attempts to escape project root | prompt cannot provide cwd/artifact root; server resolves registered profile. |
| Shell injection | adapter receives argv array; `shell=false`; executable allowlist. |
| Forged approval | approval command checks server-side run and policy; payload flags ignored/rejected. |
| Credential leakage | credentials remain external; snapshot/SQLite/log output scan and redaction. |
| Duplicate command | idempotency key and expectedVersion. |
| Stale event | seq/entityVersion/cursor replay and resync. |
| Artifact traversal | artifact paths are relative to canonical run root; no absolute path in API. |

## Authorization model

- The server resolves a local `owner` actor at startup; client-submitted role/actor fields are ignored.
- `owner` may configure profiles, approve/reject runs, execute/cancel/retry runs and query all audit events.
- `operator` may create tasks and runs within its team scope, cancel its own runs and read result metadata.
- `observer` is read-only.
- Every mutating command writes `actorId`, role, action, decision and `correlationId` to `audit_events`.
- `credentialRef` is an opaque alias; no API accepts a credential value.
- Executable allowlists are enforced by adapter kind and canonical executable name; shell command strings are never accepted.
