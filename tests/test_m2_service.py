from __future__ import annotations

import json
import shutil
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from fastapi.testclient import TestClient

from themeteam.core.m2_service import M2Service
from themeteam.core.sqlite_store import SqliteWorkspace, migrate_json_to_sqlite, new_id, now_iso
from themeteam.core.agent_runtime import make_python_argv
from themeteam.web.api_v1 import create_m2_app


ROOT = Path(__file__).resolve().parents[1]
SEED = ROOT / "themeteam" / "core" / "workspace_state.json"


class M2ServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = TemporaryDirectory(prefix="themeteam-m2-")
        self.root = Path(self.temp.name)
        self.db = self.root / "workspace.sqlite"
        self.json_source = self.root / "workspace_state.json"
        shutil.copy2(SEED, self.json_source)
        migrate_json_to_sqlite(self.json_source, self.db)
        self.sqlite = SqliteWorkspace(self.db)
        self.service = M2Service(self.sqlite)
        self.client = TestClient(create_m2_app(self.service))
        self.headers = {"host": "127.0.0.1", "content-type": "application/json"}

    def tearDown(self) -> None:
        self.service.close()
        self.temp.cleanup()

    def command(self, path: str, payload: dict) -> dict:
        response = self.client.post(path, json=payload, headers=self.headers)
        self.assertLess(response.status_code, 400, response.text)
        return response.json()

    def test_migration_creates_backup_and_workspace_projection(self) -> None:
        backup = self.json_source.with_suffix(self.json_source.suffix + ".bak")
        self.assertTrue(self.db.is_file())
        self.assertEqual(self.service.snapshot()["id"], "workspace_main")
        self.assertIsNotNone(self.sqlite.connection.execute("SELECT 1 FROM schema_meta").fetchone())
        self.assertTrue(backup.is_file())

    def test_task_command_is_idempotent(self) -> None:
        body = {
            "commandId": "cmd_task_1",
            "idempotencyKey": "idem_task_1",
            "correlationId": "corr_task_1",
            "payload": {
                "title": "M2 smoke task",
                "description": "deterministic",
                "priority": "medium",
                "assigneeIds": ["agent_dev"],
            },
        }
        first = self.command("/api/v1/tasks", body)
        second = self.command("/api/v1/tasks", body)
        self.assertEqual(first["task"]["id"], second["task"]["id"])
        titles = [task["title"] for task in self.service.snapshot()["tasks"]]
        self.assertEqual(titles.count("M2 smoke task"), 1)
        events = self.service.events_since(0)
        self.assertEqual(len([event for event in events if event["type"] == "task.created"]), 1)

    def test_returned_workspace_version_is_accepted_by_next_command(self) -> None:
        first = self.command(
            "/api/v1/tasks",
            {
                "commandId": "cmd_version_1",
                "idempotencyKey": "idem_version_1",
                "correlationId": "corr_version_1",
                "payload": {"title": "version one", "assigneeIds": []},
            },
        )
        second = self.client.post(
            "/api/v1/tasks",
            json={
                "commandId": "cmd_version_2",
                "idempotencyKey": "idem_version_2",
                "correlationId": "corr_version_2",
                "expectedVersion": first["version"],
                "payload": {"title": "version two", "assigneeIds": []},
            },
            headers=self.headers,
        )
        self.assertEqual(second.status_code, 200, second.text)

    def test_agent_configuration_uses_m2_fact_source(self) -> None:
        response = self.client.post(
            "/api/v1/agents",
            json={
                "commandId": "cmd_agent_1",
                "idempotencyKey": "idem_agent_1",
                "correlationId": "corr_agent_1",
                "payload": {
                    "name": "M2 Agent",
                    "roleTemplate": "developer",
                    "modelProfileId": "model_primary",
                    "runtimeProfileId": "runtime_mock",
                    "projectDirectoryProfileId": "project_theme_team",
                    "seatId": "room_work",
                },
            },
            headers=self.headers,
        )
        self.assertEqual(response.status_code, 200, response.text)
        agent_id = response.json()["agent"]["id"]
        self.assertIn(agent_id, {agent["id"] for agent in self.service.snapshot()["agents"]})

    def test_invalid_enum_is_rejected_before_sqlite_replace(self) -> None:
        invalid = json.loads(self.json_source.read_text(encoding="utf-8"))
        invalid["tasks"][0]["status"] = "not-a-task-status"
        invalid_source = self.root / "invalid-enum.json"
        invalid_source.write_text(json.dumps(invalid), encoding="utf-8")
        invalid_target = self.root / "invalid-enum.sqlite"
        invalid_target.write_bytes(b"existing")
        with self.assertRaises(ValueError):
            migrate_json_to_sqlite(invalid_source, invalid_target)
        self.assertEqual(invalid_target.read_bytes(), b"existing")

    def test_runtime_profile_rejects_invalid_contract_values(self) -> None:
        response = self.client.post(
            "/api/v1/runtime-profiles",
            json={
                "commandId": "cmd_runtime_invalid",
                "idempotencyKey": "idem_runtime_invalid",
                "correlationId": "corr_runtime_invalid",
                "payload": {
                    "name": "bad runtime",
                    "kind": "unknown-cli",
                    "executable": "bad",
                    "timeoutSeconds": 1,
                    "capabilities": [""],
                },
            },
            headers=self.headers,
        )
        self.assertEqual(response.status_code, 400)

    def test_json_import_clears_runtime_records(self) -> None:
        with self.sqlite.connection:
            self.sqlite.connection.execute(
                "INSERT INTO runs(id, workspace_id, task_id, status, payload_json, version, created_at) "
                "VALUES ('run_import_old', 'workspace_main', 'task_canvas', 'failed', '{}', 1, 'now')"
            )
            self.sqlite.connection.execute(
                "INSERT INTO outbox_events(workspace_id, seq, event_id, entity_id, type, payload_json, occurred_at) "
                "VALUES ('workspace_main', 1, 'event_import_old', 'task_canvas', 'task.updated', '{}', 'now')"
            )
            self.sqlite.connection.execute(
                "INSERT INTO audit_events(id, workspace_id, actor_id, correlation_id, type, payload_json, occurred_at) "
                "VALUES ('audit_import_old', 'workspace_main', 'actor_owner', 'corr_import_old', 'task.updated', '{}', 'now')"
            )
            self.sqlite.connection.execute(
                "INSERT INTO idempotency_keys(workspace_id, idempotency_key, command_id, result_json, created_at) "
                "VALUES ('workspace_main', 'idem_import_old', 'cmd_import_old', '{}', 'now')"
            )
        self.sqlite.import_json(self.json_source)
        for table in ("runs", "outbox_events", "audit_events", "idempotency_keys"):
            self.assertEqual(
                self.sqlite.connection.execute(
                    f"SELECT COUNT(*) FROM {table} WHERE workspace_id='workspace_main'"
                    if table != "runs"
                    else "SELECT COUNT(*) FROM runs WHERE workspace_id='workspace_main'"
                ).fetchone()[0],
                0,
            )

    def test_finish_cas_is_database_conditional_across_connections(self) -> None:
        run_id = "run_cas_release"
        record = {
            "runId": run_id,
            "id": run_id,
            "taskId": "task_canvas",
            "status": "waiting",
            "createdAt": now_iso(),
            "artifactDir": str(self.root / "artifacts" / run_id),
            "artifacts": [],
            "artifactStatus": "pending",
            "version": 1,
        }
        self.sqlite.run_store().create(record)
        second = SqliteWorkspace(self.db)
        try:
            first_store = self.sqlite.run_store()
            second_store = second.run_store()
            first, first_applied = first_store.finish_cas(
                run_id, 1, status="succeeded", finishedAt=now_iso()
            )
            stale, stale_applied = second_store.finish_cas(
                run_id, 1, status="failed", finishedAt=now_iso()
            )
            self.assertTrue(first_applied)
            self.assertFalse(stale_applied)
            self.assertEqual(first["status"], "succeeded")
            self.assertEqual(stale["status"], "succeeded")
            self.assertEqual(second_store.get(run_id)["version"], 2)
        finally:
            second.close()

    def test_required_sqlite_foreign_keys_are_declared(self) -> None:
        required = {
            "runs": {"workspace_id", "task_id"},
            "approvals": {"run_id"},
            "audit_events": {"workspace_id", "actor_id"},
            "outbox_events": {"workspace_id"},
            "idempotency_keys": {"workspace_id"},
        }
        for table, columns in required.items():
            rows = self.sqlite.connection.execute(
                f"PRAGMA foreign_key_list({table})"
            ).fetchall()
            declared = {row["from"] for row in rows}
            self.assertTrue(columns <= declared, (table, columns, declared))
        violations = self.sqlite.connection.execute("PRAGMA foreign_key_check").fetchall()
        self.assertEqual(violations, [])

    def test_model_profile_route_keeps_only_opaque_credential_reference(self) -> None:
        response = self.client.post(
            "/api/v1/model-profiles",
            json={
                "commandId": "cmd_model_1",
                "idempotencyKey": "idem_model_1",
                "correlationId": "corr_model_1",
                "payload": {
                    "name": "M2 local profile",
                    "provider": "Local",
                    "modelName": "local-test",
                    "contextWindow": 4096,
                    "capabilityTags": ["coding"],
                    "costLabel": "low",
                    "credentialRef": "cred_alias_only",
                },
            },
            headers=self.headers,
        )
        self.assertEqual(response.status_code, 200)
        profile = response.json()["modelProfile"]
        self.assertEqual(profile["modelName"], "local-test")
        self.assertEqual(profile["credentialRef"], "cred_alias_only")
        self.assertNotIn("secret", json.dumps(profile).lower())

    def test_manual_run_waits_for_approval_and_writes_artifact(self) -> None:
        task = self.command(
            "/api/v1/tasks",
            {
                "commandId": "cmd_task_2",
                "idempotencyKey": "idem_task_2",
                "correlationId": "corr_task_2",
                "payload": {
                    "title": "M2 approval task",
                    "description": "approval",
                    "priority": "high",
                    "assigneeIds": ["agent_dev"],
                },
            },
        )["task"]
        run = self.command(
            "/api/v1/runs",
            {
                "commandId": "cmd_run_1",
                "idempotencyKey": "idem_run_1",
                "correlationId": "corr_run_1",
                "payload": {
                    "taskId": task["id"],
                    "runtimeProfileId": "runtime_mock",
                    "projectDirectoryProfileId": "project_theme_team",
                    "prompt": "M2 approval smoke",
                },
            },
        )["run"]
        self.assertEqual(run["status"], "waiting")
        self.assertEqual(run["approvalStatus"], "pending")
        self.assertEqual(run["artifactStatus"], "pending")

        approved = self.command(
            f"/api/v1/runs/{run['runId']}/approve",
            {
                "commandId": "cmd_approve_1",
                "idempotencyKey": "idem_approve_1",
                "correlationId": "corr_approve_1",
                "payload": {},
            },
        )["run"]
        self.assertEqual(approved["approvalStatus"], "approved")
        self.assertTrue(self.service.dispatcher.wait(run["runId"], timeout=5))
        finished = self.service.dispatcher.run_store.get(run["runId"])
        self.assertEqual(finished["status"], "succeeded")
        self.assertEqual(finished["artifactStatus"], "complete")
        artifact_response = self.client.get(f"/api/v1/artifacts/{run['runId']}", headers=self.headers)
        self.assertEqual(artifact_response.status_code, 200)
        self.assertIn("result.txt", artifact_response.json()["artifacts"])
        row = self.sqlite.connection.execute(
            "SELECT sha256, size_bytes FROM artifacts WHERE run_id=? AND relative_path='result.txt'",
            (run["runId"],),
        ).fetchone()
        self.assertTrue(row["sha256"])
        self.assertGreater(row["size_bytes"], 0)
        document = next(
            item for item in self.service.snapshot()["documents"]
            if item.get("sourceRef") == f"run:{run['runId']}"
        )
        self.assertEqual(document.get("correlationId"), run["correlationId"])
        listed = self.client.get(
            f"/api/v1/documents?sourceRef=run:{run['runId']}",
            headers=self.headers,
        ).json()["documents"]
        self.assertEqual(listed[0].get("correlationId"), run["correlationId"])

    def test_retry_reconstructs_spec_after_service_restart(self) -> None:
        project_profile = self.command(
            "/api/v1/project-directories",
            {
                "commandId": "cmd_retry_project",
                "idempotencyKey": "idem_retry_project",
                "correlationId": "corr_retry_project",
                "payload": {
                    "name": "retry fixture",
                    "path": str(self.root),
                    "pathKind": "local",
                    "readOnly": False,
                    "temporaryCopyPolicy": "none",
                },
            },
        )["projectDirectory"]
        runtime_profile = self.command(
            "/api/v1/runtime-profiles",
            {
                "commandId": "cmd_retry_runtime",
                "idempotencyKey": "idem_retry_runtime",
                "correlationId": "corr_retry_runtime",
                "payload": {
                    "name": "retry runtime",
                    "kind": "model-api",
                    "executable": "mock",
                    "approvalPolicy": "automatic",
                    "timeoutSeconds": 30,
                    "projectDirectoryProfileId": project_profile["id"],
                    "capabilities": ["coding"],
                },
            },
        )["runtimeProfile"]
        handle = self.service.dispatcher.start(
            task_id="task_canvas",
            runtime=runtime_profile,
            project={
                "id": project_profile["id"],
                "path": str(self.root),
                "readOnly": False,
            },
            prompt="restart retry",
            argv=make_python_argv("raise SystemExit(3)"),
            cwd=self.root,
            correlation_id="corr_restart_retry",
        )
        self.assertTrue(self.service.dispatcher.wait(handle.run_id, timeout=5))
        failed = self.service.dispatcher.run_store.get(handle.run_id)
        self.assertEqual(failed["status"], "failed")
        old_version = failed["version"]
        self.service.close()
        self.sqlite = SqliteWorkspace(self.db)
        self.service = M2Service(self.sqlite)
        retried = self.service.retry_run(
            handle.run_id,
            {
                "commandId": "cmd_restart_retry",
                "idempotencyKey": "idem_restart_retry",
                "correlationId": "corr_restart_retry_cmd",
                "expectedVersion": old_version,
            },
        )["run"]
        self.assertEqual(retried["retryOf"], handle.run_id)
        self.assertTrue(self.service.dispatcher.wait(retried["runId"], timeout=5))
        self.assertEqual(self.service.dispatcher.run_store.get(retried["runId"])["status"], "succeeded")

    def test_events_have_workspace_cursor(self) -> None:
        response = self.client.get("/api/v1/workspaces/workspace_main/snapshot", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn("snapshot", payload)
        self.assertIn("cursor", payload)

    def test_normalized_entities_and_websocket_replay(self) -> None:
        tables = {
            row[0]
            for row in self.sqlite.connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()
        }
        self.assertTrue({"agents", "tasks", "task_assignees", "runtime_profiles", "project_directories", "artifacts"} <= tables)
        self.assertEqual(
            self.sqlite.connection.execute("SELECT COUNT(*) FROM agents").fetchone()[0],
            len(self.service.snapshot()["agents"]),
        )
        task = self.command(
            "/api/v1/tasks",
            {
                "commandId": "cmd_ws_task",
                "idempotencyKey": "idem_ws_task",
                "correlationId": "corr_ws_task",
                "payload": {"title": "websocket", "assigneeIds": []},
            },
        )["task"]
        self.assertTrue(task["id"])
        with self.client.websocket_connect(
            "/api/v1/workspaces/workspace_main/events?lastSeenSeq=0",
            headers={"host": "127.0.0.1"},
        ) as websocket:
            events = []
            for _ in range(20):
                event = websocket.receive_json()
                events.append(event)
                if any(item.get("entityId") == task["id"] for item in events):
                    break
            self.assertTrue(any(item.get("type") == "task.created" for item in events))

    def test_websocket_pushes_events_after_reconnect_cursor(self) -> None:
        with self.client.websocket_connect(
            "/api/v1/workspaces/workspace_main/events?lastSeenSeq=0",
            headers={"host": "127.0.0.1"},
        ) as websocket:
            command = {
                "commandId": "cmd_ws_push",
                "idempotencyKey": "idem_ws_push",
                "correlationId": "corr_ws_push",
                "payload": {"title": "push-event", "assigneeIds": []},
            }
            response = self.client.post("/api/v1/tasks", json=command, headers=self.headers)
            self.assertEqual(response.status_code, 200)
            event = websocket.receive_json()
            if event["type"] == "subscription.ready":
                event = websocket.receive_json()
            self.assertEqual(event["type"], "task.created")
            cursor = event["seq"]

        with self.client.websocket_connect(
            f"/api/v1/workspaces/workspace_main/events?lastSeenSeq={cursor - 1}",
            headers={"host": "127.0.0.1"},
        ) as websocket:
            replay = websocket.receive_json()
            if replay["type"] == "subscription.ready":
                replay = websocket.receive_json()
            self.assertEqual(replay["seq"], cursor)
            self.assertEqual(replay["type"], "task.created")

    def test_documents_filter_and_expected_version_conflict(self) -> None:
        response = self.client.get("/api/v1/documents?taskId=task_canvas", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertIn("documents", response.json())
        stale = self.client.post(
            "/api/v1/tasks",
            json={
                "commandId": "cmd_stale",
                "idempotencyKey": "idem_stale",
                "correlationId": "corr_stale",
                "expectedVersion": -1,
                "payload": {"title": "stale", "assigneeIds": []},
            },
            headers=self.headers,
        )
        self.assertEqual(stale.status_code, 409)

    def test_websocket_gap_emits_resync_required(self) -> None:
        with self.client.websocket_connect(
            "/api/v1/workspaces/workspace_main/events?lastSeenSeq=-10",
            headers={"host": "127.0.0.1"},
        ) as websocket:
            event = websocket.receive_json()
            self.assertEqual(event["type"], "resync_required")

    def test_body_cap_and_repeated_approval_are_safe(self) -> None:
        oversized = self.client.post(
            "/api/v1/tasks",
            content=b"x" * (1_048_577),
            headers={**self.headers, "content-length": str(1_048_577)},
        )
        self.assertEqual(oversized.status_code, 413)

        task = self.command(
            "/api/v1/tasks",
            {
                "commandId": "cmd_repeat_task",
                "idempotencyKey": "idem_repeat_task",
                "correlationId": "corr_repeat_task",
                "payload": {"title": "repeat approval", "assigneeIds": []},
            },
        )["task"]
        run = self.command(
            "/api/v1/runs",
            {
                "commandId": "cmd_repeat_run",
                "idempotencyKey": "idem_repeat_run",
                "correlationId": "corr_repeat_run",
                "payload": {
                    "taskId": task["id"],
                    "runtimeProfileId": "runtime_mock",
                    "projectDirectoryProfileId": "project_theme_team",
                    "prompt": "repeat",
                },
            },
        )["run"]
        approve = {
            "commandId": "cmd_repeat_approve",
            "idempotencyKey": "idem_repeat_approve",
            "correlationId": "corr_repeat_approve",
            "payload": {},
        }
        first = self.command(f"/api/v1/runs/{run['runId']}/approve", approve)["run"]
        second = self.command(f"/api/v1/runs/{run['runId']}/approve", approve)["run"]
        self.assertEqual(first["runId"], second["runId"])
        self.assertTrue(self.service.dispatcher.wait(run["runId"], timeout=5))

    def test_run_response_has_stable_identity_and_version(self) -> None:
        task = self.command(
            "/api/v1/tasks",
            {
                "commandId": "cmd_schema_task",
                "idempotencyKey": "idem_schema_task",
                "correlationId": "corr_schema_task",
                "payload": {"title": "schema", "assigneeIds": []},
            },
        )["task"]
        result = self.command(
            "/api/v1/runs",
            {
                "commandId": "cmd_schema_run",
                "idempotencyKey": "idem_schema_run",
                "correlationId": "corr_schema_run",
                "payload": {
                    "taskId": task["id"],
                    "runtimeProfileId": "runtime_mock",
                    "projectDirectoryProfileId": "project_theme_team",
                    "prompt": "schema",
                },
            },
        )
        run = result["run"]
        self.assertEqual(run["id"], run["runId"])
        self.assertIsInstance(run["version"], int)
        self.assertEqual(run["correlationId"], "corr_schema_run")


if __name__ == "__main__":
    unittest.main()
