from __future__ import annotations

import hashlib
import json
import os
import sqlite3
import tempfile
import threading
from contextlib import nullcontext
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable
from uuid import uuid4

from .models import WorkspaceState, workspace_state_from_dict
from .validation import ConflictError, ForbiddenError


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex[:12]}"


def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)


def sha256_json(value: Any) -> str:
    return hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()


class SqliteRunStore:
    """TaskRunStore-compatible persistence backed by the M2 SQLite database."""

    TERMINAL = {"succeeded", "failed", "cancelled", "timed_out", "interrupted", "environment_unavailable", "rejected"}

    def __init__(self, connection: sqlite3.Connection, lock: threading.RLock) -> None:
        self.connection = connection
        self._lock = lock
        self._recover_incomplete()

    def create(self, record: dict[str, Any], *, commit: bool = True) -> dict[str, Any]:
        context = self.connection if commit else nullcontext()
        with self._lock, context:
            self.connection.execute(
                "INSERT INTO runs (id, workspace_id, task_id, retry_of, status, payload_json, version, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?, 1, ?)",
                (
                    record["runId"],
                    "workspace_main",
                    record["taskId"],
                    record.get("retryOf"),
                    record["status"],
                    canonical_json(record),
                    record.get("createdAt", now_iso()),
                ),
            )
            return deepcopy(record)

    def update(self, run_id: str, *, commit: bool = True, **changes: Any) -> dict[str, Any]:
        context = self.connection if commit else nullcontext()
        with self._lock, context:
            current = self.get(run_id)
            current.update(deepcopy(changes))
            current["version"] = int(current.get("version", 1)) + 1
            self.connection.execute(
                "UPDATE runs SET status=?, payload_json=?, version=version+1 WHERE id=?",
                (current["status"], canonical_json(current), run_id),
            )
            artifacts = current.get("artifacts")
            if isinstance(artifacts, list):
                self.connection.execute("DELETE FROM artifacts WHERE run_id=?", (run_id,))
                for relative_path in artifacts:
                    absolute = Path(current.get("artifactDir", "")) / relative_path
                    digest = ""
                    size = 0
                    if absolute.is_file():
                        digest = hashlib.sha256(absolute.read_bytes()).hexdigest()
                        size = absolute.stat().st_size
                    self.connection.execute(
                        "INSERT OR IGNORE INTO artifacts(id, run_id, relative_path, sha256, size_bytes, status) "
                        "VALUES (?, ?, ?, ?, ?, ?)",
                        (new_id("artifact"), run_id, str(relative_path), digest, size, current.get("artifactStatus", "pending")),
                    )
            return current

    def finish(self, run_id: str, *, commit: bool = True, **changes: Any) -> dict[str, Any]:
        context = self.connection if commit else nullcontext()
        with self._lock, context:
            current = self.get(run_id)
            if current["status"] in self.TERMINAL:
                changes.pop("status", None)
                changes.pop("finishedAt", None)
            current.update(deepcopy(changes))
            current["version"] = int(current.get("version", 1)) + 1
            self.connection.execute(
                "UPDATE runs SET status=?, payload_json=?, version=version+1 WHERE id=?",
                (current["status"], canonical_json(current), run_id),
            )
            artifacts = current.get("artifacts")
            if isinstance(artifacts, list):
                self.connection.execute("DELETE FROM artifacts WHERE run_id=?", (run_id,))
                for relative_path in artifacts:
                    absolute = Path(current.get("artifactDir", "")) / relative_path
                    digest = hashlib.sha256(absolute.read_bytes()).hexdigest() if absolute.is_file() else ""
                    size = absolute.stat().st_size if absolute.is_file() else 0
                    self.connection.execute(
                        "INSERT OR IGNORE INTO artifacts(id, run_id, relative_path, sha256, size_bytes, status) "
                        "VALUES (?, ?, ?, ?, ?, ?)",
                        (new_id("artifact"), run_id, str(relative_path), digest, size, current.get("artifactStatus", "pending")),
                    )
            return current

    def finish_cas(
        self,
        run_id: str,
        expected_version: int,
        *,
        commit: bool = True,
        **changes: Any,
    ) -> tuple[dict[str, Any], bool]:
        context = self.connection if commit else nullcontext()
        with self._lock, context:
            current = self.get(run_id)
            if current["status"] in self.TERMINAL or int(current.get("version", 1)) != expected_version:
                return current, False
            current.update(deepcopy(changes))
            current["version"] = int(current.get("version", 1)) + 1
            updated = self.connection.execute(
                "UPDATE runs SET status=?, payload_json=?, version=version+1 "
                "WHERE id=? AND version=? "
                "AND status NOT IN ('succeeded','failed','cancelled','timed_out',"
                "'interrupted','environment_unavailable','rejected')",
                (current["status"], canonical_json(current), run_id, expected_version),
            )
            if updated.rowcount != 1:
                return self.get(run_id), False
            artifacts = current.get("artifacts")
            if isinstance(artifacts, list):
                self.connection.execute("DELETE FROM artifacts WHERE run_id=?", (run_id,))
                for relative_path in artifacts:
                    absolute = Path(current.get("artifactDir", "")) / relative_path
                    digest = hashlib.sha256(absolute.read_bytes()).hexdigest() if absolute.is_file() else ""
                    size = absolute.stat().st_size if absolute.is_file() else 0
                    self.connection.execute(
                        "INSERT OR IGNORE INTO artifacts(id, run_id, relative_path, sha256, size_bytes, status) "
                        "VALUES (?, ?, ?, ?, ?, ?)",
                        (new_id("artifact"), run_id, str(relative_path), digest, size, current.get("artifactStatus", "pending")),
                    )
            return current, True

    def transition_cas(
        self,
        run_id: str,
        expected_version: int,
        allowed_statuses: set[str],
        *,
        commit: bool = True,
        **changes: Any,
    ) -> tuple[dict[str, Any], bool]:
        context = self.connection if commit else nullcontext()
        with self._lock, context:
            current = self.get(run_id)
            if (
                int(current.get("version", 1)) != expected_version
                or current.get("status") not in allowed_statuses
            ):
                return current, False
            current.update(deepcopy(changes))
            current["version"] = expected_version + 1
            placeholders = ",".join("?" for _ in allowed_statuses)
            params = [
                current["status"],
                canonical_json(current),
                run_id,
                expected_version,
                *sorted(allowed_statuses),
            ]
            updated = self.connection.execute(
                "UPDATE runs SET status=?, payload_json=?, version=version+1 "
                f"WHERE id=? AND version=? AND status IN ({placeholders})",
                params,
            )
            if updated.rowcount != 1:
                return self.get(run_id), False
            return current, True

    def get(self, run_id: str) -> dict[str, Any]:
        row = self.connection.execute("SELECT payload_json FROM runs WHERE id=?", (run_id,)).fetchone()
        if row is None:
            raise KeyError(run_id)
        return json.loads(row[0])

    def list(self, task_id: str | None = None) -> list[dict[str, Any]]:
        if task_id is None:
            rows = self.connection.execute("SELECT payload_json FROM runs ORDER BY created_at").fetchall()
        else:
            rows = self.connection.execute(
                "SELECT payload_json FROM runs WHERE task_id=? ORDER BY created_at", (task_id,)
            ).fetchall()
        return [json.loads(row[0]) for row in rows]

    def _recover_incomplete(self) -> None:
        with self._lock, self.connection:
            rows = self.connection.execute(
                "SELECT id, payload_json FROM runs WHERE status IN ('queued','running') OR (status='waiting' AND json_extract(payload_json, '$.approvalStatus')='approved')"
            ).fetchall()
            for run_id, raw in rows:
                record = json.loads(raw)
                if record.get("status") == "waiting":
                    record.update(status="environment_unavailable", finishedAt=now_iso(), error="approved run could not resume after dispatcher restart")
                else:
                    record.update(status="interrupted", finishedAt=now_iso(), error="dispatcher restarted")
                record["version"] = int(record.get("version", 1)) + 1
                self.connection.execute(
                    "UPDATE runs SET status=?, payload_json=?, version=version+1 WHERE id=?",
                    (record["status"], canonical_json(record), run_id),
                )


class SqliteWorkspace:
    """SQLite fact source and transaction boundary for M2."""

    SCHEMA_VERSION = 1

    def __init__(
        self,
        db_path: Path,
        *,
        json_source: Path | None = None,
        snapshot: dict[str, Any] | None = None,
        actor_id: str = "actor_owner",
    ):
        self.db_path = Path(db_path)
        self.json_source = Path(json_source) if json_source else None
        self.actor_id = actor_id
        self._lock = threading.RLock()
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.connection = sqlite3.connect(self.db_path, check_same_thread=False)
        self.connection.row_factory = sqlite3.Row
        self.connection.execute("PRAGMA foreign_keys=ON")
        self.connection.execute("PRAGMA busy_timeout=5000")
        self._initialize(snapshot)

    @classmethod
    def from_json(cls, json_path: Path, db_path: Path) -> "SqliteWorkspace":
        data = json.loads(Path(json_path).read_text(encoding="utf-8"))
        return cls(db_path, json_source=json_path, snapshot=data)

    def close(self) -> None:
        with self._lock:
            self.connection.close()

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            row = self.connection.execute(
                "SELECT snapshot_json FROM workspaces WHERE id='workspace_main'"
            ).fetchone()
            if row is None:
                raise ValueError("workspace not initialized")
            return json.loads(row[0])

    def snapshot_bundle(self) -> dict[str, Any]:
        with self._lock:
            self.connection.execute("BEGIN")
            try:
                row = self.connection.execute(
                    "SELECT snapshot_json, version FROM workspaces WHERE id='workspace_main'"
                ).fetchone()
                if row is None:
                    raise ValueError("workspace not initialized")
                seq = self.connection.execute(
                    "SELECT COALESCE(MAX(seq), 0) AS last_seq FROM outbox_events WHERE workspace_id='workspace_main'"
                ).fetchone()["last_seq"]
                return {
                    "snapshot": json.loads(row["snapshot_json"]),
                    "snapshotVersion": int(row["version"]),
                    "cursor": int(seq),
                }
            finally:
                self.connection.rollback()

    def state(self) -> WorkspaceState:
        return workspace_state_from_dict(self.snapshot())

    def authorize(self, action: str) -> None:
        row = self.connection.execute(
            "SELECT role FROM actors WHERE id=? AND workspace_id='workspace_main'",
            (self.actor_id,),
        ).fetchone()
        if row is None:
            raise ForbiddenError("actor is not registered")
        permissions = {
            "owner": {"read", "write", "run", "cancel", "approve"},
            "operator": {"read", "write", "run", "cancel"},
            "observer": {"read"},
        }
        if action not in permissions.get(row["role"], set()):
            raise ForbiddenError("actor is not authorized")

    def run_store(self) -> SqliteRunStore:
        return SqliteRunStore(self.connection, self._lock)

    def next_seq(self) -> int:
        row = self.connection.execute(
            "SELECT COALESCE(MAX(seq), 0) + 1 AS next_seq FROM outbox_events WHERE workspace_id='workspace_main'"
        ).fetchone()
        return int(row["next_seq"])

    def events_since(self, last_seq: int = 0, limit: int = 500) -> list[dict[str, Any]]:
        rows = self.connection.execute(
            "SELECT payload_json FROM outbox_events WHERE workspace_id='workspace_main' AND seq>? "
            "ORDER BY seq LIMIT ?",
            (last_seq, limit),
        ).fetchall()
        return [json.loads(row[0]) for row in rows]

    def events_until(self, last_seq: int, until_seq: int, limit: int = 500) -> list[dict[str, Any]]:
        rows = self.connection.execute(
            "SELECT payload_json FROM outbox_events "
            "WHERE workspace_id='workspace_main' AND seq>? AND seq<=? "
            "ORDER BY seq LIMIT ?",
            (last_seq, until_seq, limit),
        ).fetchall()
        return [json.loads(row[0]) for row in rows]

    def last_seq(self) -> int:
        row = self.connection.execute(
            "SELECT COALESCE(MAX(seq), 0) AS last_seq FROM outbox_events WHERE workspace_id='workspace_main'"
        ).fetchone()
        return int(row["last_seq"])

    def first_seq(self) -> int:
        row = self.connection.execute(
            "SELECT COALESCE(MIN(seq), 0) AS first_seq FROM outbox_events WHERE workspace_id='workspace_main'"
        ).fetchone()
        return int(row["first_seq"])

    def workspace_version(self) -> int:
        row = self.connection.execute(
            "SELECT version FROM workspaces WHERE id='workspace_main'"
        ).fetchone()
        if row is None:
            raise ValueError("workspace not initialized")
        return int(row["version"])

    def idempotent_result(self, key: str) -> dict[str, Any] | None:
        row = self.connection.execute(
            "SELECT result_json FROM idempotency_keys WHERE workspace_id='workspace_main' AND idempotency_key=?",
            (key,),
        ).fetchone()
        return json.loads(row["result_json"]) if row is not None else None

    def record_idempotent_result(
        self,
        key: str,
        command_id: str,
        result: dict[str, Any],
        *,
        commit: bool = True,
    ) -> dict[str, Any]:
        context = self.connection if commit else nullcontext()
        with self._lock, context:
            existing = self.idempotent_result(key)
            if existing is not None:
                return existing
            self.connection.execute(
                "INSERT INTO idempotency_keys (workspace_id, idempotency_key, command_id, result_json, created_at) "
                "VALUES ('workspace_main', ?, ?, ?, ?)",
                (key, command_id, canonical_json(result), now_iso()),
            )
            return deepcopy(result)

    def replace_idempotent_result(self, key: str, result: dict[str, Any]) -> dict[str, Any]:
        with self._lock, self.connection:
            self.connection.execute(
                "UPDATE idempotency_keys SET result_json=? WHERE workspace_id='workspace_main' AND idempotency_key=?",
                (canonical_json(result), key),
            )
            return deepcopy(result)

    def append_event(
        self,
        *,
        command_id: str,
        idempotency_key: str,
        correlation_id: str,
        event_type: str,
        entity_id: str,
        result: dict[str, Any],
        actor_id: str | None = None,
        commit: bool = True,
    ) -> dict[str, Any]:
        context = self.connection if commit else nullcontext()
        with self._lock, context:
            self.authorize("write")
            actor_id = actor_id or self.actor_id
            existing = self.idempotent_result(idempotency_key)
            if existing is not None:
                return existing
            seq = self.next_seq()
            event = {
                "eventId": new_id("event"),
                "schemaVersion": "1.0",
                "workspaceId": "workspace_main",
                "teamId": self.snapshot().get("activeTeamId"),
                "seq": seq,
                "entityVersion": seq,
                "type": event_type,
                "entityId": entity_id,
                "correlationId": correlation_id,
                "occurredAt": now_iso(),
                "payload": {"commandId": command_id},
            }
            enriched = deepcopy(result)
            enriched["version"] = self.workspace_version()
            self.connection.execute(
                "INSERT INTO idempotency_keys (workspace_id, idempotency_key, command_id, result_json, created_at) "
                "VALUES ('workspace_main', ?, ?, ?, ?)",
                (idempotency_key, command_id, canonical_json(enriched), now_iso()),
            )
            self.connection.execute(
                "INSERT INTO audit_events (id, workspace_id, actor_id, correlation_id, type, payload_json, occurred_at) "
                "VALUES (?, 'workspace_main', ?, ?, ?, ?, ?)",
                (new_id("audit"), actor_id, correlation_id, event_type, canonical_json(event["payload"]), now_iso()),
            )
            self.connection.execute(
                "INSERT INTO outbox_events (workspace_id, seq, event_id, entity_id, type, payload_json, occurred_at) "
                "VALUES ('workspace_main', ?, ?, ?, ?, ?, ?)",
                (seq, event["eventId"], entity_id, event_type, canonical_json(event), event["occurredAt"]),
            )
            return enriched

    def command(
        self,
        *,
        command_id: str,
        idempotency_key: str,
        correlation_id: str,
        mutate,
        event_type: str,
        entity_id: str,
        actor_id: str | None = None,
        expected_version: int | None = None,
    ) -> dict[str, Any]:
        with self._lock:
            self.authorize("write")
            actor_id = actor_id or self.actor_id
            existing = self.connection.execute(
                "SELECT result_json FROM idempotency_keys WHERE workspace_id='workspace_main' AND idempotency_key=?",
                (idempotency_key,),
            ).fetchone()
            if existing is not None:
                return json.loads(existing["result_json"])
            if expected_version is not None and expected_version != self.workspace_version():
                raise ConflictError("workspace version conflict")
            current = self.snapshot()
            result = mutate(deepcopy(current))
            seq = self.next_seq()
            event = {
                "eventId": new_id("event"),
                "schemaVersion": "1.0",
                "workspaceId": "workspace_main",
                "teamId": result.get("activeTeamId"),
                "seq": seq,
                "entityVersion": seq,
                "type": event_type,
                "entityId": entity_id,
                "correlationId": correlation_id,
                "occurredAt": now_iso(),
                "payload": {"commandId": command_id},
            }
            with self.connection:
                self._update_snapshot_projection(result)
                response = {
                    "workspace": result,
                    "version": self.workspace_version(),
                    "correlationId": correlation_id,
                }
                self.connection.execute(
                    "INSERT INTO idempotency_keys (workspace_id, idempotency_key, command_id, result_json, created_at) "
                    "VALUES ('workspace_main', ?, ?, ?, ?)",
                    (idempotency_key, command_id, canonical_json(response), now_iso()),
                )
                self.connection.execute(
                    "INSERT INTO audit_events (id, workspace_id, actor_id, correlation_id, type, payload_json, occurred_at) "
                    "VALUES (?, 'workspace_main', ?, ?, ?, ?, ?)",
                    (new_id("audit"), actor_id, correlation_id, event_type, canonical_json(event["payload"]), now_iso()),
                )
                self.connection.execute(
                    "INSERT INTO outbox_events (workspace_id, seq, event_id, entity_id, type, payload_json, occurred_at) "
                    "VALUES ('workspace_main', ?, ?, ?, ?, ?, ?)",
                    (seq, event["eventId"], entity_id, event_type, canonical_json(event), event["occurredAt"]),
                )
            return response

    def import_json(self, source: Path) -> dict[str, Any]:
        data = json.loads(Path(source).read_text(encoding="utf-8"))
        workspace_state_from_dict(data)
        _write_json_backup(Path(source))
        result = self._replace_snapshot(data, clear_runtime_records=True)
        with self.connection:
            self.connection.execute(
                "UPDATE schema_meta SET json_source_hash=? WHERE workspace_id='workspace_main'",
                (sha256_json(data),),
            )
        return result

    def _initialize(self, snapshot: dict[str, Any] | None) -> None:
        with self._lock:
            self._create_schema()
            row = self.connection.execute(
                "SELECT 1 FROM workspaces WHERE id='workspace_main'"
            ).fetchone()
            if row is None:
                if snapshot is None and self.json_source and self.json_source.exists():
                    snapshot = json.loads(self.json_source.read_text(encoding="utf-8"))
                if snapshot is None:
                    raise ValueError("SQLite workspace requires a snapshot for initialization")
                workspace_state_from_dict(snapshot)
                with self.connection:
                    self._replace_snapshot(snapshot)
                    self.connection.execute(
                        "UPDATE schema_meta SET json_source_hash=? WHERE workspace_id='workspace_main'",
                        (sha256_json(snapshot),),
                    )

    def _create_schema(self) -> None:
        with self.connection:
            self.connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS schema_meta (
                    workspace_id TEXT PRIMARY KEY,
                    schema_version INTEGER NOT NULL,
                    json_source_hash TEXT
                );
                CREATE TABLE IF NOT EXISTS workspaces (
                    id TEXT PRIMARY KEY,
                    snapshot_json TEXT NOT NULL,
                    version INTEGER NOT NULL DEFAULT 1
                );
                CREATE TABLE IF NOT EXISTS workspace_entities (
                    workspace_id TEXT NOT NULL,
                    entity_type TEXT NOT NULL,
                    entity_id TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    version INTEGER NOT NULL DEFAULT 1,
                    PRIMARY KEY (workspace_id, entity_type, entity_id)
                );
                CREATE TABLE IF NOT EXISTS runs (
                    id TEXT PRIMARY KEY,
                    workspace_id TEXT NOT NULL,
                    task_id TEXT NOT NULL,
                    retry_of TEXT,
                    status TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    version INTEGER NOT NULL DEFAULT 1,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
                    FOREIGN KEY(task_id) REFERENCES tasks(id),
                    FOREIGN KEY(retry_of) REFERENCES runs(id)
                );
                CREATE TABLE IF NOT EXISTS artifacts (
                    id TEXT PRIMARY KEY,
                    run_id TEXT NOT NULL,
                    relative_path TEXT NOT NULL,
                    sha256 TEXT NOT NULL,
                    size_bytes INTEGER NOT NULL,
                    status TEXT NOT NULL CHECK(status IN ('pending','complete','partial','failed')),
                    UNIQUE(run_id, relative_path),
                    FOREIGN KEY(run_id) REFERENCES runs(id) ON DELETE CASCADE
                );
                CREATE TABLE IF NOT EXISTS teams (
                    id TEXT PRIMARY KEY,
                    workspace_id TEXT NOT NULL,
                    leader_agent_id TEXT,
                    payload_json TEXT NOT NULL,
                    FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
                    FOREIGN KEY(leader_agent_id) REFERENCES agents(id)
                );
                CREATE TABLE IF NOT EXISTS rooms (
                    id TEXT PRIMARY KEY,
                    workspace_id TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
                );
                CREATE TABLE IF NOT EXISTS model_profiles (
                    id TEXT PRIMARY KEY,
                    workspace_id TEXT NOT NULL,
                    credential_ref TEXT,
                    payload_json TEXT NOT NULL,
                    FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
                );
                CREATE TABLE IF NOT EXISTS runtime_profiles (
                    id TEXT PRIMARY KEY,
                    workspace_id TEXT NOT NULL,
                    kind TEXT NOT NULL,
                    executable TEXT NOT NULL,
                    approval_policy TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
                );
                CREATE TABLE IF NOT EXISTS project_directories (
                    id TEXT PRIMARY KEY,
                    workspace_id TEXT NOT NULL,
                    canonical_path TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    UNIQUE(workspace_id, canonical_path),
                    FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
                );
                CREATE TABLE IF NOT EXISTS agents (
                    id TEXT PRIMARY KEY,
                    workspace_id TEXT NOT NULL,
                    model_profile_id TEXT,
                    runtime_profile_id TEXT,
                    project_directory_profile_id TEXT,
                    payload_json TEXT NOT NULL,
                    FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
                    FOREIGN KEY(model_profile_id) REFERENCES model_profiles(id),
                    FOREIGN KEY(runtime_profile_id) REFERENCES runtime_profiles(id),
                    FOREIGN KEY(project_directory_profile_id) REFERENCES project_directories(id)
                );
                CREATE TABLE IF NOT EXISTS tasks (
                    id TEXT PRIMARY KEY,
                    workspace_id TEXT NOT NULL,
                    status TEXT NOT NULL CHECK(status IN ('todo','in_progress','in_review','done')),
                    payload_json TEXT NOT NULL,
                    FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
                );
                CREATE TABLE IF NOT EXISTS task_assignees (
                    task_id TEXT NOT NULL,
                    agent_id TEXT NOT NULL,
                    PRIMARY KEY(task_id, agent_id),
                    FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
                    FOREIGN KEY(agent_id) REFERENCES agents(id)
                );
                CREATE TABLE IF NOT EXISTS meetings (
                    id TEXT PRIMARY KEY,
                    workspace_id TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
                );
                CREATE TABLE IF NOT EXISTS documents (
                    id TEXT PRIMARY KEY,
                    workspace_id TEXT NOT NULL,
                    source_ref TEXT NOT NULL,
                    correlation_id TEXT,
                    archive_status TEXT NOT NULL DEFAULT 'committed',
                    payload_json TEXT NOT NULL,
                    UNIQUE(workspace_id, source_ref),
                    FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
                );
                CREATE TABLE IF NOT EXISTS memory_items (
                    id TEXT PRIMARY KEY,
                    workspace_id TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
                );
                CREATE TABLE IF NOT EXISTS actors (
                    id TEXT PRIMARY KEY,
                    workspace_id TEXT NOT NULL,
                    role TEXT NOT NULL CHECK(role IN ('owner','operator','observer')),
                    created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS actor_scopes (
                    actor_id TEXT NOT NULL,
                    team_id TEXT NOT NULL,
                    can_read INTEGER NOT NULL,
                    can_write INTEGER NOT NULL,
                    can_approve INTEGER NOT NULL,
                    PRIMARY KEY(actor_id, team_id),
                    FOREIGN KEY(actor_id) REFERENCES actors(id)
                );
                CREATE TABLE IF NOT EXISTS approvals (
                    id TEXT PRIMARY KEY,
                    run_id TEXT NOT NULL,
                    action TEXT NOT NULL,
                    status TEXT NOT NULL CHECK(status IN ('pending','approved','rejected')),
                    decided_at TEXT,
                    decided_by TEXT,
                    reason TEXT,
                    UNIQUE(run_id, action),
                    FOREIGN KEY(run_id) REFERENCES runs(id) ON DELETE CASCADE
                );
                CREATE TABLE IF NOT EXISTS audit_events (
                    id TEXT PRIMARY KEY,
                    workspace_id TEXT NOT NULL,
                    actor_id TEXT NOT NULL,
                    correlation_id TEXT NOT NULL,
                    type TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    occurred_at TEXT NOT NULL,
                    FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
                    FOREIGN KEY(actor_id) REFERENCES actors(id)
                );
                CREATE TABLE IF NOT EXISTS outbox_events (
                    workspace_id TEXT NOT NULL,
                    seq INTEGER NOT NULL,
                    event_id TEXT NOT NULL UNIQUE,
                    entity_id TEXT NOT NULL,
                    type TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    occurred_at TEXT NOT NULL,
                    published_at TEXT,
                    PRIMARY KEY(workspace_id, seq),
                    FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
                );
                CREATE TABLE IF NOT EXISTS idempotency_keys (
                    workspace_id TEXT NOT NULL,
                    idempotency_key TEXT NOT NULL,
                    command_id TEXT NOT NULL,
                    result_json TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    PRIMARY KEY(workspace_id, idempotency_key),
                    FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
                );
                """
            )
            self.connection.execute(
                "INSERT OR IGNORE INTO schema_meta(workspace_id, schema_version) VALUES ('workspace_main', ?)",
                (self.SCHEMA_VERSION,),
            )
            self.connection.execute(
                "INSERT OR IGNORE INTO actors(id, workspace_id, role, created_at) VALUES ('actor_owner', 'workspace_main', 'owner', ?)",
                (now_iso(),),
            )

    def _replace_snapshot(
        self,
        snapshot: dict[str, Any],
        *,
        clear_runtime_records: bool = False,
    ) -> dict[str, Any]:
        snapshot = workspace_state_from_dict(snapshot).to_dict()
        payload = canonical_json(snapshot)
        with self.connection:
            if clear_runtime_records:
                self.connection.execute(
                    "DELETE FROM artifacts WHERE run_id IN "
                    "(SELECT id FROM runs WHERE workspace_id='workspace_main')"
                )
                self.connection.execute(
                    "DELETE FROM approvals WHERE run_id IN "
                    "(SELECT id FROM runs WHERE workspace_id='workspace_main')"
                )
                self.connection.execute("DELETE FROM runs WHERE workspace_id='workspace_main'")
                self.connection.execute("DELETE FROM audit_events WHERE workspace_id='workspace_main'")
                self.connection.execute("DELETE FROM outbox_events WHERE workspace_id='workspace_main'")
                self.connection.execute("DELETE FROM idempotency_keys WHERE workspace_id='workspace_main'")
            self.connection.execute(
                "INSERT INTO workspaces(id, snapshot_json, version) VALUES ('workspace_main', ?, 1) "
                "ON CONFLICT(id) DO UPDATE SET snapshot_json=excluded.snapshot_json, version=workspaces.version+1",
                (payload,),
            )
            self.connection.execute("DELETE FROM workspace_entities WHERE workspace_id='workspace_main'")
            for table in ("task_assignees", "actor_scopes"):
                self.connection.execute(f"DELETE FROM {table}")
            for table in (
                "teams",
                "agents",
                "tasks",
                "meetings",
                "documents",
                "memory_items",
                "rooms",
                "model_profiles",
                "runtime_profiles",
                "project_directories",
            ):
                self.connection.execute(f"DELETE FROM {table} WHERE workspace_id='workspace_main'")

            for item in snapshot.get("rooms", []):
                self.connection.execute(
                    "INSERT INTO rooms(id, workspace_id, payload_json) VALUES (?, 'workspace_main', ?)",
                    (item["id"], canonical_json(item)),
                )
            for item in snapshot.get("modelProfiles", []):
                self.connection.execute(
                    "INSERT INTO model_profiles(id, workspace_id, credential_ref, payload_json) VALUES (?, 'workspace_main', ?, ?)",
                    (item["id"], item.get("credentialRef"), canonical_json(item)),
                )
            for item in snapshot.get("runtimeProfiles", []):
                self.connection.execute(
                    "INSERT INTO runtime_profiles(id, workspace_id, kind, executable, approval_policy, payload_json) "
                    "VALUES (?, 'workspace_main', ?, ?, ?, ?)",
                    (
                        item["id"],
                        item.get("kind", "model-api"),
                        item.get("executable", ""),
                        item.get("approvalPolicy", "manual"),
                        canonical_json(item),
                    ),
                )
            for item in snapshot.get("projectDirectories", []):
                canonical_path = str(Path(item["path"]).expanduser().resolve())
                self.connection.execute(
                    "INSERT INTO project_directories(id, workspace_id, canonical_path, payload_json) VALUES (?, 'workspace_main', ?, ?)",
                    (item["id"], canonical_path, canonical_json(item)),
                )
            for item in snapshot.get("agents", []):
                self.connection.execute(
                    "INSERT INTO agents(id, workspace_id, model_profile_id, runtime_profile_id, project_directory_profile_id, payload_json) "
                    "VALUES (?, 'workspace_main', ?, ?, ?, ?)",
                    (
                        item["id"],
                        item.get("modelProfileId"),
                        item.get("runtimeProfileId"),
                        item.get("projectDirectoryProfileId"),
                        canonical_json(item),
                    ),
                )
            for item in snapshot.get("teams", []):
                self.connection.execute(
                    "INSERT INTO teams(id, workspace_id, leader_agent_id, payload_json) VALUES (?, 'workspace_main', ?, ?)",
                    (item["id"], item.get("leaderAgentId"), canonical_json(item)),
                )
            for item in snapshot.get("tasks", []):
                self.connection.execute(
                    "INSERT INTO tasks(id, workspace_id, status, payload_json) VALUES (?, 'workspace_main', ?, ?)",
                    (item["id"], item.get("status", "todo"), canonical_json(item)),
                )
                for agent_id in item.get("assigneeIds", []):
                    self.connection.execute(
                        "INSERT INTO task_assignees(task_id, agent_id) VALUES (?, ?)",
                        (item["id"], agent_id),
                    )
            for item in snapshot.get("meetings", []):
                self.connection.execute(
                    "INSERT INTO meetings(id, workspace_id, payload_json) VALUES (?, 'workspace_main', ?)",
                    (item["id"], canonical_json(item)),
                )
            for item in snapshot.get("documents", []):
                self.connection.execute(
                    "INSERT INTO documents(id, workspace_id, source_ref, correlation_id, archive_status, payload_json) "
                    "VALUES (?, 'workspace_main', ?, ?, 'committed', ?)",
                    (item["id"], item.get("sourceRef", item["id"]), item.get("correlationId"), canonical_json(item)),
                )
            for item in snapshot.get("memoryItems", []):
                self.connection.execute(
                    "INSERT INTO memory_items(id, workspace_id, payload_json) VALUES (?, 'workspace_main', ?)",
                    (item["id"], canonical_json(item)),
                )
            groups = {
                "teams": snapshot.get("teams", []),
                "rooms": snapshot.get("rooms", []),
                "agents": snapshot.get("agents", []),
                "tasks": snapshot.get("tasks", []),
                "meetings": snapshot.get("meetings", []),
                "documents": snapshot.get("documents", []),
                "memoryItems": snapshot.get("memoryItems", []),
                "modelProfiles": snapshot.get("modelProfiles", []),
                "runtimeProfiles": snapshot.get("runtimeProfiles", []),
                "projectDirectories": snapshot.get("projectDirectories", []),
            }
            for entity_type, values in groups.items():
                for value in values:
                    self.connection.execute(
                        "INSERT INTO workspace_entities(workspace_id, entity_type, entity_id, payload_json) VALUES ('workspace_main', ?, ?, ?)",
                        (entity_type, value["id"], canonical_json(value)),
                    )
        return deepcopy(snapshot)

    def _update_snapshot_projection(self, snapshot: dict[str, Any]) -> None:
        """Update the normalized projection without deleting rows referenced by runs."""
        snapshot = workspace_state_from_dict(snapshot).to_dict()
        payload = canonical_json(snapshot)
        self.connection.execute(
            "UPDATE workspaces SET snapshot_json=?, version=version+1 WHERE id='workspace_main'",
            (payload,),
        )
        groups = {
            "teams": snapshot.get("teams", []),
            "rooms": snapshot.get("rooms", []),
            "agents": snapshot.get("agents", []),
            "tasks": snapshot.get("tasks", []),
            "meetings": snapshot.get("meetings", []),
            "documents": snapshot.get("documents", []),
            "memoryItems": snapshot.get("memoryItems", []),
            "modelProfiles": snapshot.get("modelProfiles", []),
            "runtimeProfiles": snapshot.get("runtimeProfiles", []),
            "projectDirectories": snapshot.get("projectDirectories", []),
        }
        self.connection.execute("DELETE FROM task_assignees")
        for entity_type, values in groups.items():
            ids = tuple(value["id"] for value in values)
            placeholders = ",".join("?" for _ in ids) or "NULL"
            self.connection.execute(
                "DELETE FROM workspace_entities WHERE workspace_id='workspace_main' "
                "AND entity_type=? AND entity_id NOT IN (" + placeholders + ")",
                (entity_type, *ids),
            )
        for entity_type, values in groups.items():
            self.connection.executemany(
                "INSERT INTO workspace_entities(workspace_id, entity_type, entity_id, payload_json) "
                "VALUES ('workspace_main', ?, ?, ?) "
                "ON CONFLICT(workspace_id, entity_type, entity_id) "
                "DO UPDATE SET payload_json=excluded.payload_json, version=version+1",
                [(entity_type, value["id"], canonical_json(value)) for value in values],
            )
        current_ids = {
            key: {item["id"] for item in values}
            for key, values in groups.items()
        }
        self.connection.execute(
            "DELETE FROM tasks WHERE workspace_id='workspace_main' "
            "AND id NOT IN (SELECT task_id FROM runs)"
            f" AND id NOT IN ({','.join('?' for _ in current_ids['tasks']) or 'NULL'})",
            tuple(current_ids["tasks"]),
        )
        for table, key in (
            ("teams", "teams"),
            ("agents", "agents"),
            ("meetings", "meetings"),
            ("documents", "documents"),
            ("memory_items", "memoryItems"),
            ("rooms", "rooms"),
            ("model_profiles", "modelProfiles"),
            ("runtime_profiles", "runtimeProfiles"),
            ("project_directories", "projectDirectories"),
        ):
            ids = tuple(current_ids[key])
            placeholders = ",".join("?" for _ in ids) or "NULL"
            self.connection.execute(
                f"DELETE FROM {table} WHERE workspace_id='workspace_main' "
                f"AND id NOT IN ({placeholders})",
                ids,
            )
        for item in groups["rooms"]:
            self.connection.execute(
                "INSERT INTO rooms(id, workspace_id, payload_json) VALUES (?, 'workspace_main', ?) "
                "ON CONFLICT(id) DO UPDATE SET payload_json=excluded.payload_json",
                (item["id"], canonical_json(item)),
            )
        for item in groups["modelProfiles"]:
            self.connection.execute(
                "INSERT INTO model_profiles(id, workspace_id, credential_ref, payload_json) VALUES (?, 'workspace_main', ?, ?) "
                "ON CONFLICT(id) DO UPDATE SET credential_ref=excluded.credential_ref, payload_json=excluded.payload_json",
                (item["id"], item.get("credentialRef"), canonical_json(item)),
            )
        for item in groups["runtimeProfiles"]:
            self.connection.execute(
                "INSERT INTO runtime_profiles(id, workspace_id, kind, executable, approval_policy, payload_json) "
                "VALUES (?, 'workspace_main', ?, ?, ?, ?) "
                "ON CONFLICT(id) DO UPDATE SET kind=excluded.kind, executable=excluded.executable, "
                "approval_policy=excluded.approval_policy, payload_json=excluded.payload_json",
                (item["id"], item.get("kind", "model-api"), item.get("executable", ""),
                 item.get("approvalPolicy", "manual"), canonical_json(item)),
            )
        for item in groups["projectDirectories"]:
            self.connection.execute(
                "INSERT INTO project_directories(id, workspace_id, canonical_path, payload_json) VALUES (?, 'workspace_main', ?, ?) "
                "ON CONFLICT(id) DO UPDATE SET canonical_path=excluded.canonical_path, payload_json=excluded.payload_json",
                (item["id"], str(Path(item["path"]).expanduser().resolve()), canonical_json(item)),
            )
        for item in groups["agents"]:
            self.connection.execute(
                "INSERT INTO agents(id, workspace_id, model_profile_id, runtime_profile_id, project_directory_profile_id, payload_json) "
                "VALUES (?, 'workspace_main', ?, ?, ?, ?) "
                "ON CONFLICT(id) DO UPDATE SET model_profile_id=excluded.model_profile_id, "
                "runtime_profile_id=excluded.runtime_profile_id, project_directory_profile_id=excluded.project_directory_profile_id, "
                "payload_json=excluded.payload_json",
                (item["id"], item.get("modelProfileId"), item.get("runtimeProfileId"),
                 item.get("projectDirectoryProfileId"), canonical_json(item)),
            )
        for item in groups["teams"]:
            self.connection.execute(
                "INSERT INTO teams(id, workspace_id, leader_agent_id, payload_json) VALUES (?, 'workspace_main', ?, ?) "
                "ON CONFLICT(id) DO UPDATE SET leader_agent_id=excluded.leader_agent_id, payload_json=excluded.payload_json",
                (item["id"], item.get("leaderAgentId"), canonical_json(item)),
            )
        for item in groups["tasks"]:
            self.connection.execute(
                "INSERT INTO tasks(id, workspace_id, status, payload_json) VALUES (?, 'workspace_main', ?, ?) "
                "ON CONFLICT(id) DO UPDATE SET status=excluded.status, payload_json=excluded.payload_json",
                (item["id"], item.get("status", "todo"), canonical_json(item)),
            )
            self.connection.executemany(
                "INSERT INTO task_assignees(task_id, agent_id) VALUES (?, ?)",
                [(item["id"], agent_id) for agent_id in item.get("assigneeIds", [])],
            )
        for item in groups["meetings"]:
            self.connection.execute(
                "INSERT INTO meetings(id, workspace_id, payload_json) VALUES (?, 'workspace_main', ?) "
                "ON CONFLICT(id) DO UPDATE SET payload_json=excluded.payload_json",
                (item["id"], canonical_json(item)),
            )
        for item in groups["documents"]:
            self.connection.execute(
                "INSERT INTO documents(id, workspace_id, source_ref, correlation_id, archive_status, payload_json) "
                "VALUES (?, 'workspace_main', ?, ?, 'committed', ?) "
                "ON CONFLICT(id) DO UPDATE SET source_ref=excluded.source_ref, "
                "correlation_id=excluded.correlation_id, payload_json=excluded.payload_json",
                (item["id"], item.get("sourceRef", item["id"]), item.get("correlationId"), canonical_json(item)),
            )
        for item in groups["memoryItems"]:
            self.connection.execute(
                "INSERT INTO memory_items(id, workspace_id, payload_json) VALUES (?, 'workspace_main', ?) "
                "ON CONFLICT(id) DO UPDATE SET payload_json=excluded.payload_json",
                (item["id"], canonical_json(item)),
            )


def migrate_json_to_sqlite(json_path: Path, db_path: Path) -> dict[str, Any]:
    source = Path(json_path)
    target = Path(db_path)
    data = json.loads(source.read_text(encoding="utf-8"))
    workspace_state_from_dict(data)
    target.parent.mkdir(parents=True, exist_ok=True)
    _write_json_backup(source)
    temporary = target.with_suffix(target.suffix + ".tmp")
    temporary.unlink(missing_ok=True)
    db = None
    try:
        db = SqliteWorkspace(temporary, json_source=source, snapshot=data)
        db.close()
        db = None
        os.replace(temporary, target)
    finally:
        if db is not None:
            db.close()
        temporary.unlink(missing_ok=True)
    return data


def _write_json_backup(source: Path) -> Path:
    backup = source.with_suffix(source.suffix + ".bak")
    temporary = backup.with_suffix(backup.suffix + ".tmp")
    temporary.write_bytes(source.read_bytes())
    os.replace(temporary, backup)
    return backup
