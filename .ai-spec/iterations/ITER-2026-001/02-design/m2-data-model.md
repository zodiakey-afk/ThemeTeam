| 文档 | D5 M2 数据模型与迁移方案 |
|---|---|
| 版本 | v1.0 |
| 日期 | 2026-10-07 |
| 状态 | 修订候选，CAS/FK hardening 已实现，等待独立复审 |
| 关联 | M2 / W07；m2-hld.md；m2-api-v1.json |

## SQLite tables

| 表 | 关键字段 | 约束 |
|---|---|---|
| `schema_meta` | `schema_version`, `workspace_id`, `json_source_hash` | 单行版本记录。 |
| `workspaces` | `id`, `name`, `theme_mode`, `active_team_id`, `version` | `id` unique。 |
| `teams` | `id`, `workspace_id`, `name`, `leader_agent_id`, `version` | workspace FK。 |
| `rooms` | `id`, `workspace_id`, `name`, `unlocked`, `version` | workspace FK。 |
| `model_profiles` | `id`, `workspace_id`, `provider`, `model_name`, `credential_ref`, `capabilities_json`, `version` | `credential_ref` opaque; no secret value. |
| `runtime_profiles` | `id`, `workspace_id`, `kind`, `executable`, `approval_policy`, `timeout_seconds`, `enabled`, `version` | kind/approval CHECK; executable validated by adapter allowlist. |
| `project_directories` | `id`, `workspace_id`, `canonical_path`, `path_kind`, `allowed`, `read_only`, `version` | canonical path unique per workspace; realpath checked. |
| `agents` | `id`, `workspace_id`, `runtime_profile_id`, `project_directory_profile_id`, `model_profile_id`, `version` | profile IDs FK; compatible profile required for execution. |
| `tasks` | `id`, `workspace_id`, `status`, `version` | status CHECK。 |
| `documents` | `id`, `workspace_id`, `source_ref`, `content_ref`, `version`, `archive_status` | run/archive source refs unique per workspace. |
| `artifacts` | `id`, `run_id`, `relative_path`, `sha256`, `size_bytes`, `status` | `(run_id, relative_path)` unique; no absolute path exposed. |
| `runs` | `id`, `workspace_id`, `task_id`, `retry_of`, `status`, `payload_json`, `version` | workspace/task/retry FK；终态更新使用数据库条件 CAS。 |
| `approvals` | `id`, `run_id`, `action`, `status`, `decided_at`, `decided_by`, `reason` | one active approval per run/action; status CHECK. |
| `audit_events` | `id`, `workspace_id`, `actor_id`, `correlation_id`, `type`, `payload_json`, `occurred_at` | payload redacted before insert; actor FK. |
| `outbox_events` | `seq`, `event_id`, `entity_id`, `type`, `payload_json`, `published_at` | `event_id` unique; seq monotonic. |
| `idempotency_keys` | `workspace_id`, `key`, `command_id`, `result_json`, `created_at` | `UNIQUE(workspace_id, key)`; result replay is scoped to workspace. |
| `actors` | `id`, `workspace_id`, `role`, `created_at` | role CHECK; owner actor seeded locally. |
| `actor_scopes` | `actor_id`, `team_id`, `can_read`, `can_write`, `can_approve` | composite PK; server-only authorization source. |

## Migration

1. Acquire migration lock and copy source JSON to timestamped `.json.bak`.
2. Parse strict JSON and validate required fields/references.
3. Create `workspace.sqlite.tmp` with schema version 1.
4. Insert actors, model/runtime/project profiles and entities in FK order; normalize local settings into profile rows without copying credentials.
5. Compare entity counts and canonical hash of normalized export.
6. `PRAGMA integrity_check`; close DB; atomic replace target DB.
7. Store source hash in `schema_meta`; mark migration complete.
8. On any failure, delete temp DB and keep original JSON/SQLite untouched.

Rollback restores the previous SQLite file and leaves the JSON backup. No destructive JSON rewrite is allowed.

## Archive and retention

- run result archive is idempotent by `(workspace_id, source_ref=run:<runId>)`.
- archive lifecycle is `candidate -> committed -> superseded|deleted`; only `committed` documents appear in the normal document query.
- artifact lifecycle is `pending -> complete|partial|failed`; `complete` requires directory scan, relative-path validation, SHA-256 and size capture; `partial` is used when the process terminates after some files are valid; `failed` is used when root validation or scan fails.
- audit/outbox events are retained for the local workspace until explicit user deletion/export; no time-based purge runs in M2.
- stdout/stderr are bounded and redacted; prompt plaintext is not persisted.
- artifact files remain under the registered project directory; database stores only relative path, hash, size and status.

## Foreign-key and uniqueness matrix

- Every business table carries `workspace_id` and references `workspaces(id)`.
- `teams.leader_agent_id -> agents(id)` is deferred until agent import completes; invalid final references reject migration.
- `agents.model_profile_id -> model_profiles(id)`, `agents.runtime_profile_id -> runtime_profiles(id)`, and `agents.project_directory_profile_id -> project_directories(id)` are nullable only for legacy unbound agents.
- `tasks.assignee_ids` is normalized into `task_assignees(task_id, agent_id)` with a composite primary key.
- `runs.task_id -> tasks(id)`, `runs.retry_of -> runs(id)`, `approvals.run_id -> runs(id)`, `artifacts.run_id -> runs(id)`.
- `documents` has `UNIQUE(workspace_id, source_ref)` for run/archive sources; manual documents use a generated source key.
- `audit_events` and `outbox_events` have immutable IDs; `outbox_events.seq` is unique per workspace.
- `idempotency_keys` has `UNIQUE(workspace_id, key)`.
- `runs.workspace_id -> workspaces(id)`, `runs.task_id -> tasks(id)`, and `runs.retry_of -> runs(id)` are enforced.
- `approvals.run_id -> runs(id)`, `audit_events.workspace_id -> workspaces(id)`, `audit_events.actor_id -> actors(id)`,
  `outbox_events.workspace_id -> workspaces(id)`, and `idempotency_keys.workspace_id -> workspaces(id)` are enforced.
- Normal command projection updates use upsert and preserve tasks referenced by runs; full replacement is reserved for initialization/import.
