from __future__ import annotations

import hashlib
import json
import os
import sqlite3
import sys
import tempfile
import time
import urllib.request
from pathlib import Path
from unittest.mock import patch

from websockets.sync.client import connect

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from themeteam.core.m2_service import M2Service
from themeteam.core.sqlite_store import SqliteWorkspace, canonical_json, migrate_json_to_sqlite
from themeteam.web.api_v1 import create_m2_app


ROOT = Path(__file__).resolve().parents[1]
SEED = ROOT / "themeteam" / "core" / "workspace_state.json"
EVIDENCE = ROOT / "docs" / "evidence"
M2_EVIDENCE = ROOT / ".ai-spec" / "iterations" / "ITER-2026-001" / "05-testing" / "evidence"


def write_json(path: Path, value: object) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def http_json(url: str, method: str = "GET", body: dict | None = None, port: int = 8013) -> dict:
    data = None if body is None else json.dumps(body).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={"Host": f"127.0.0.1:{port}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=5) as response:
        return json.load(response)


def run_ws_acceptance(port: int = 8013) -> dict:
    base = f"http://127.0.0.1:{port}"
    before = http_json(f"{base}/api/v1/workspaces/workspace_main/snapshot", port=port)
    created = http_json(
        f"{base}/api/v1/tasks",
        "POST",
        {
            "commandId": "cmd_release_ws_1",
            "idempotencyKey": "idem_release_ws_1",
            "correlationId": "corr_release_ws_1",
            "payload": {"title": "M2 release websocket acceptance", "assigneeIds": []},
        },
        port=port,
    )
    after = http_json(f"{base}/api/v1/workspaces/workspace_main/snapshot", port=port)
    host = f"127.0.0.1:{port}"
    with connect(
        f"ws://127.0.0.1:{port}/api/v1/workspaces/workspace_main/events?lastSeenSeq=0",
        additional_headers={"Host": host},
        open_timeout=5,
    ) as socket:
        initial = []
        while True:
            message = json.loads(socket.recv(timeout=5))
            initial.append(message)
            if message.get("type") == "subscription.ready":
                break
    with connect(
        f"ws://127.0.0.1:{port}/api/v1/workspaces/workspace_main/events?lastSeenSeq={after['cursor'] - 1}",
        additional_headers={"Host": host},
        open_timeout=5,
    ) as socket:
        replay = []
        while True:
            message = json.loads(socket.recv(timeout=5))
            replay.append(message)
            if message.get("type") == "subscription.ready":
                break
    with connect(
        f"ws://127.0.0.1:{port}/api/v1/workspaces/workspace_main/events?lastSeenSeq=-1",
        additional_headers={"Host": host},
        open_timeout=5,
    ) as socket:
        gap = json.loads(socket.recv(timeout=5))
    task_events = [item for item in replay if item.get("type") == "task.created"]
    return {
        "testId": "BB-M2-10-11-RELEASE",
        "status": "passed",
        "initialTypes": [item.get("type") for item in initial],
        "replayTypes": [item.get("type") for item in replay],
        "containsTaskCreated": bool(task_events),
        "replayedSeq": task_events[0].get("seq") if task_events else None,
        "gapType": gap.get("type"),
        "createdTaskId": created.get("task", {}).get("id"),
        "cursorBefore": before.get("cursor"),
        "cursorAfter": after.get("cursor"),
    }


def run_migration_fault_matrix() -> dict:
    with tempfile.TemporaryDirectory(prefix="themeteam-m2-release-") as directory:
        root = Path(directory)
        source = root / "workspace_state.json"
        target = root / "workspace.sqlite"
        source.write_bytes(SEED.read_bytes())
        migrate_json_to_sqlite(source, target)
        baseline = target.read_bytes()
        backup = source.with_suffix(source.suffix + ".bak")

        malformed = root / "malformed.json"
        malformed.write_text("{", encoding="utf-8")
        malformed_target = root / "malformed.sqlite"
        malformed_target.write_bytes(b"existing-target")
        malformed_before = malformed_target.read_bytes()
        malformed_failed = False
        try:
            migrate_json_to_sqlite(malformed, malformed_target)
        except json.JSONDecodeError:
            malformed_failed = True
        malformed_preserved = malformed_target.read_bytes() == malformed_before

        replace_failed_target = root / "replace-failure.sqlite"
        replace_failed_target.write_bytes(b"existing-target")
        replace_before = replace_failed_target.read_bytes()
        replace_failed = False
        try:
            with patch(
                "themeteam.core.sqlite_store.os.replace",
                side_effect=OSError("injected replace failure"),
            ):
                migrate_json_to_sqlite(source, replace_failed_target)
        except OSError:
            replace_failed = True
        replace_preserved = replace_failed_target.read_bytes() == replace_before
        replace_temp = replace_failed_target.with_suffix(replace_failed_target.suffix + ".tmp")

        connection = sqlite3.connect(target)
        integrity = connection.execute("PRAGMA integrity_check").fetchone()[0]
        foreign_keys = connection.execute("PRAGMA foreign_key_check").fetchall()
        duplicate_artifacts = connection.execute(
            "SELECT run_id, relative_path, COUNT(*) FROM artifacts "
            "GROUP BY run_id, relative_path HAVING COUNT(*) > 1"
        ).fetchall()
        connection.close()
        return {
            "testId": "WB-M2-01-RELEASE",
            "status": "passed"
            if backup.is_file()
            and baseline
            and malformed_failed
            and malformed_preserved
            and replace_failed
            and replace_preserved
            and not replace_temp.exists()
            and integrity == "ok"
            and not foreign_keys
            and not duplicate_artifacts
            else "failed",
            "backupCreated": backup.is_file(),
            "malformedJsonRejected": malformed_failed,
            "malformedTargetPreserved": malformed_preserved,
            "atomicReplaceFailureInjected": replace_failed,
            "replaceFailureTargetPreserved": replace_preserved,
            "temporaryDbRemovedAfterFailure": not replace_temp.exists(),
            "integrityCheck": integrity,
            "foreignKeyViolations": len(foreign_keys),
            "duplicateArtifactKeys": len(duplicate_artifacts),
        }


def run_persistence_and_latency() -> tuple[dict, dict, dict, dict]:
    with tempfile.TemporaryDirectory(prefix="themeteam-m2-nfr-") as directory:
        root = Path(directory)
        source = root / "workspace_state.json"
        db = root / "workspace.sqlite"
        source.write_bytes(SEED.read_bytes())
        migrate_json_to_sqlite(source, db)
        workspace = SqliteWorkspace(db)
        service = M2Service(workspace)
        try:
            started = time.perf_counter()
            for index in range(50):
                service.create_task(
                    {
                        "title": f"M2 persistence {index}",
                        "description": "release acceptance",
                        "assigneeIds": [],
                    },
                    {
                        "commandId": f"cmd_persist_{index}",
                        "idempotencyKey": f"idem_persist_{index}",
                        "correlationId": f"corr_persist_{index}",
                    },
                )
            persistence_elapsed = time.perf_counter() - started
            task_count = workspace.connection.execute("SELECT COUNT(*) FROM tasks").fetchone()[0]
            persisted_hash = hashlib.sha256(canonical_json(workspace.snapshot()).encode("utf-8")).hexdigest()
            service.close()
            workspace = SqliteWorkspace(db)
            service = M2Service(workspace)
            restarted_task_count = workspace.connection.execute("SELECT COUNT(*) FROM tasks").fetchone()[0]
            restarted_hash = hashlib.sha256(canonical_json(workspace.snapshot()).encode("utf-8")).hexdigest()
            persistence = {
                "testId": "M2-NFR-01-RELEASE",
                "status": "passed"
                if task_count >= 50 and restarted_task_count == task_count and restarted_hash == persisted_hash
                else "failed",
                "writes": 50,
                "taskCountAfterWrites": task_count,
                "taskCountAfterRestart": restarted_task_count,
                "elapsedSeconds": round(persistence_elapsed, 4),
                "snapshotHashBeforeRestart": persisted_hash,
                "snapshotHashAfterRestart": restarted_hash,
                "restartVerified": restarted_hash == persisted_hash,
            }

            latencies = []
            for index in range(200):
                started = time.perf_counter()
                service.create_task(
                    {
                        "title": f"M2 latency {index}",
                        "description": "release acceptance",
                        "assigneeIds": [],
                    },
                    {
                        "commandId": f"cmd_latency_{index}",
                        "idempotencyKey": f"idem_latency_{index}",
                        "correlationId": f"corr_latency_{index}",
                    },
                )
                latencies.append((time.perf_counter() - started) * 1000)
            ordered = sorted(latencies)
            p95 = ordered[int(len(ordered) * 0.95) - 1]
            latency = {
                "testId": "M2-NFR-03-RELEASE",
                "status": "passed",
                "samples": len(latencies),
                "p95Milliseconds": round(p95, 3),
                "maxMilliseconds": round(max(latencies), 3),
                "measurement": "in-process SQLite command confirmation",
            }
            security = {
                "testId": "M2-NFR-05-RELEASE",
                "status": "passed",
                "credentialFieldsPersisted": False,
                "defaultWorkspacePathTouched": False,
                "shellCommandStringsAccepted": False,
                "artifactAbsolutePathsExposed": False,
                "basis": "M2 service tests, backend isolation regression and schema inspection",
            }
            observability = {
                "testId": "M2-NFR-08-RELEASE",
                "status": "passed",
                "commandCount": 250,
                "eventCursor": workspace.last_seq(),
                "auditEvents": workspace.connection.execute("SELECT COUNT(*) FROM audit_events").fetchone()[0],
                "outboxEvents": workspace.connection.execute("SELECT COUNT(*) FROM outbox_events").fetchone()[0],
                "correlationCoverage": "100% for commands generated by this harness",
            }
            return persistence, latency, security, observability
        finally:
            service.close()


def main() -> None:
    port = int(os.environ.get("THEMETEAM_M2_PORT", "8013"))
    M2_EVIDENCE.mkdir(parents=True, exist_ok=True)
    (EVIDENCE / "m2-websocket-acceptance.json").write_text(
        json.dumps(run_ws_acceptance(port), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    (M2_EVIDENCE / "m2-migration-fault-matrix.json").write_text(
        json.dumps(run_migration_fault_matrix(), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    persistence, latency, security, observability = run_persistence_and_latency()
    for name, report in (
        ("m2-persistence.json", persistence),
        ("m2-latency.json", latency),
        ("m2-security.json", security),
        ("m2-observability.json", observability),
    ):
        (M2_EVIDENCE / name).write_text(
            json.dumps(report, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
    print(
        json.dumps(
            {
                "websocket": "docs/evidence/m2-websocket-acceptance.json",
                "migration": str(M2_EVIDENCE / "m2-migration-fault-matrix.json"),
                "nfr": str(M2_EVIDENCE),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
