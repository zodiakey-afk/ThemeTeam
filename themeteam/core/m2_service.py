from __future__ import annotations

import json
import os
import threading
from copy import deepcopy
from pathlib import Path
from typing import Any
from uuid import uuid4

from .agent_runtime import RuntimeRejected
from .dispatcher import TaskDispatcher
from .models import Document
from .sqlite_store import SqliteWorkspace, new_id, now_iso
from .validation import ConflictError


def _correlation_id() -> str:
    return f"corr_{uuid4().hex[:16]}"


class M2Service:
    """M2 application boundary over the SQLite fact source."""

    def __init__(self, workspace: SqliteWorkspace):
        self.workspace = workspace
        self._command_lock = threading.RLock()
        self.dispatcher = TaskDispatcher(
            workspace.run_store(),
            on_status=self._on_task_status,
            on_finished=self._on_run_finished,
            retry_spec_resolver=self._resolve_retry_spec,
        )

    def close(self) -> None:
        self.dispatcher.shutdown()
        self.workspace.close()

    def _resolve_retry_spec(self, run: dict[str, Any]) -> dict[str, Any] | None:
        snapshot = self.workspace.snapshot()
        runtime = next(
            (item for item in snapshot.get("runtimeProfiles", [])
             if item["id"] == run.get("runtimeProfileId")),
            None,
        )
        project = next(
            (item for item in snapshot.get("projectDirectories", [])
             if item["id"] == run.get("projectDirectoryProfileId")),
            None,
        )
        if runtime is None or project is None:
            return None
        task = next((item for item in snapshot.get("tasks", []) if item["id"] == run.get("taskId")), None)
        if task is None:
            return None
        retry_prompt = (
            f"{task.get('title', '')}\n{task.get('description', '')}\n"
            "Write task outputs only under the controlled artifact directory."
        )
        return {
            "runtime": runtime,
            "project": project,
            "prompt": retry_prompt,
            "cwd": run.get("cwd") or project.get("path"),
            "argv": None,
            "correlationId": run.get("correlationId"),
        }

    def snapshot(self) -> dict[str, Any]:
        return self.workspace.snapshot()

    def snapshot_bundle(self) -> dict[str, Any]:
        return self.workspace.snapshot_bundle()

    def authorize(self, action: str) -> None:
        self.workspace.authorize(action)

    def cursor(self) -> int:
        return self.workspace.last_seq()

    def events_since(self, cursor: int) -> list[dict[str, Any]]:
        return self.workspace.events_since(cursor)

    def _cached_run_result(self, key: str) -> dict[str, Any] | None:
        cached = self.workspace.idempotent_result(key)
        if cached is None:
            return None
        run = cached.get("run") if isinstance(cached, dict) else None
        run_id = run.get("runId") if isinstance(run, dict) else None
        if run_id:
            cached["run"] = self.dispatcher.run_store.get(run_id)
        return cached

    def create_task(self, payload: dict[str, Any], envelope: dict[str, Any]) -> dict[str, Any]:
        title = payload["title"]
        assignees = list(payload.get("assigneeIds", []))
        task_id = new_id("task")

        def mutate(snapshot: dict[str, Any]) -> dict[str, Any]:
            agents = {agent["id"] for agent in snapshot["agents"]}
            if any(agent_id not in agents for agent_id in assignees):
                raise KeyError("unknown assignee")
            task = {
                "id": task_id,
                "title": title,
                "description": payload.get("description", ""),
                "status": "todo",
                "priority": payload.get("priority", "medium"),
                "assigneeIds": assignees,
                "sourceType": "manual",
                "dueAt": None,
                "parentTaskId": None,
            }
            snapshot["tasks"].insert(0, task)
            snapshot["events"].insert(0, f"[{now_iso()}] 创建任务：{title}")
            return snapshot

        result = self.workspace.command(
            command_id=envelope["commandId"],
            idempotency_key=envelope["idempotencyKey"],
            correlation_id=envelope["correlationId"],
            mutate=mutate,
            event_type="task.created",
            entity_id=task_id,
            expected_version=envelope.get("expectedVersion"),
        )
        task = result["workspace"]["tasks"][0]
        return {"task": task, "version": result["version"], "correlationId": result["correlationId"]}

    def create_agent(self, payload: dict[str, Any], envelope: dict[str, Any]) -> dict[str, Any]:
        agent_id = new_id("agent")

        def mutate(snapshot: dict[str, Any]) -> dict[str, Any]:
            model_id = payload["modelProfileId"]
            if not any(item["id"] == model_id for item in snapshot.get("modelProfiles", [])):
                raise KeyError("unknown model profile")
            runtime_id = payload.get("runtimeProfileId")
            if runtime_id is not None and not any(
                item["id"] == runtime_id for item in snapshot.get("runtimeProfiles", [])
            ):
                raise KeyError("unknown runtime profile")
            project_id = payload.get("projectDirectoryProfileId")
            if project_id is not None and not any(
                item["id"] == project_id for item in snapshot.get("projectDirectories", [])
            ):
                raise KeyError("unknown project directory")
            seat_id = payload.get("seatId", "room_work")
            if not any(item["id"] == seat_id for item in snapshot.get("rooms", [])):
                raise KeyError("unknown seat")
            agent = {
                "id": agent_id,
                "name": payload["name"],
                "roleTemplate": payload.get("roleTemplate", "developer"),
                "modelProfileId": model_id,
                "seatId": seat_id,
                "status": "Idle",
                "appearancePresetId": "default",
                "teamId": snapshot.get("activeTeamId", "team_alpha"),
                "leaderFlag": False,
                "animationPackId": "default",
                "skinId": "default",
                "runtimeProfileId": runtime_id,
                "projectDirectoryProfileId": project_id,
            }
            snapshot.setdefault("agents", []).append(agent)
            return snapshot

        result = self.workspace.command(
            command_id=envelope["commandId"],
            idempotency_key=envelope["idempotencyKey"],
            correlation_id=envelope["correlationId"],
            mutate=mutate,
            event_type="agent.created",
            entity_id=agent_id,
            expected_version=envelope.get("expectedVersion"),
        )
        return {
            "agent": next(item for item in result["workspace"]["agents"] if item["id"] == agent_id),
            "version": result["version"],
            "correlationId": result["correlationId"],
        }

    def create_runtime_profile(self, payload: dict[str, Any], envelope: dict[str, Any]) -> dict[str, Any]:
        timeout_seconds = payload.get("timeoutSeconds", 300)
        approval_policy = payload.get("approvalPolicy", "manual")
        capabilities = list(payload.get("capabilities", []))

        def mutate(snapshot: dict[str, Any]) -> dict[str, Any]:
            profile = {
                "id": new_id("runtime"),
                "name": payload["name"],
                "kind": payload["kind"],
                "executable": payload["executable"],
                "enabled": True,
                "workingDirectoryPolicy": "project-profile",
                "projectDirectoryProfileId": payload.get("projectDirectoryProfileId"),
                "credentialRef": payload.get("credentialRef"),
                "approvalPolicy": approval_policy,
                "timeoutSeconds": timeout_seconds,
                "capabilities": capabilities,
            }
            snapshot.setdefault("runtimeProfiles", []).append(profile)
            return snapshot

        result = self.workspace.command(
            command_id=envelope["commandId"],
            idempotency_key=envelope["idempotencyKey"],
            correlation_id=envelope["correlationId"],
            mutate=mutate,
            event_type="runtime_profile.created",
            entity_id=envelope["commandId"],
            expected_version=envelope.get("expectedVersion"),
        )
        return {
            "runtimeProfile": result["workspace"]["runtimeProfiles"][-1],
            "version": result["version"],
            "correlationId": result["correlationId"],
        }

    def create_project_directory(self, payload: dict[str, Any], envelope: dict[str, Any]) -> dict[str, Any]:
        path = Path(payload["path"]).expanduser().resolve(strict=True)
        if not path.is_dir():
            raise ConflictError("project directory does not exist")

        def mutate(snapshot: dict[str, Any]) -> dict[str, Any]:
            profile = {
                "id": new_id("project"),
                "name": payload["name"],
                "path": str(path),
                "pathKind": payload.get("pathKind", "local"),
                "allowed": True,
                "readOnly": payload.get("readOnly", False),
                "temporaryCopyPolicy": payload.get("temporaryCopyPolicy", "none"),
            }
            snapshot.setdefault("projectDirectories", []).append(profile)
            return snapshot

        result = self.workspace.command(
            command_id=envelope["commandId"],
            idempotency_key=envelope["idempotencyKey"],
            correlation_id=envelope["correlationId"],
            mutate=mutate,
            event_type="project_directory.created",
            entity_id=envelope["commandId"],
            expected_version=envelope.get("expectedVersion"),
        )
        return {
            "projectDirectory": result["workspace"]["projectDirectories"][-1],
            "version": result["version"],
            "correlationId": result["correlationId"],
        }

    def create_model_profile(self, payload: dict[str, Any], envelope: dict[str, Any]) -> dict[str, Any]:
        def mutate(snapshot: dict[str, Any]) -> dict[str, Any]:
            profile = {
                "id": new_id("model"),
                "name": payload["name"],
                "provider": payload["provider"],
                "modelName": payload["modelName"],
                "contextWindow": payload.get("contextWindow", 0),
                "capabilityTags": list(payload.get("capabilityTags", [])),
                "costLabel": payload.get("costLabel", "standard"),
                "credentialRef": payload.get("credentialRef"),
            }
            snapshot.setdefault("modelProfiles", []).append(profile)
            return snapshot

        result = self.workspace.command(
            command_id=envelope["commandId"],
            idempotency_key=envelope["idempotencyKey"],
            correlation_id=envelope["correlationId"],
            mutate=mutate,
            event_type="model_profile.created",
            entity_id=envelope["commandId"],
            expected_version=envelope.get("expectedVersion"),
        )
        return {
            "modelProfile": result["workspace"]["modelProfiles"][-1],
            "version": result["version"],
            "correlationId": result["correlationId"],
        }

    def start_run(self, payload: dict[str, Any], envelope: dict[str, Any]) -> dict[str, Any]:
        with self._command_lock:
            cached = self._cached_run_result(envelope["idempotencyKey"])
            if cached is not None:
                return cached
            return self._start_run_locked(payload, envelope)

    def _start_run_locked(self, payload: dict[str, Any], envelope: dict[str, Any]) -> dict[str, Any]:
        expected_version = envelope.get("expectedVersion")
        if expected_version is not None and expected_version != self.workspace.workspace_version():
            raise ConflictError("workspace version conflict")
        snapshot = self.workspace.snapshot()
        task = next((item for item in snapshot["tasks"] if item["id"] == payload["taskId"]), None)
        runtime = next((item for item in snapshot.get("runtimeProfiles", []) if item["id"] == payload["runtimeProfileId"]), None)
        project = next((item for item in snapshot.get("projectDirectories", []) if item["id"] == payload["projectDirectoryProfileId"]), None)
        if task is None or runtime is None or project is None:
            raise KeyError("task/runtime/project")
        if runtime.get("projectDirectoryProfileId") not in (None, project["id"]):
            raise ConflictError("runtime/project profile mismatch")
        if not project.get("allowed", False) or project.get("readOnly", False):
            raise ConflictError("project directory is not executable")
        with self.workspace.connection:
            handle = self.dispatcher.start(
                task_id=task["id"],
                runtime=runtime,
                project=project,
                prompt=payload["prompt"],
                cwd=Path(project["path"]),
                defer_launch=True,
                correlation_id=envelope["correlationId"],
            )
            run = self.dispatcher.run_store.get(handle.run_id)
            result = {"run": run, "correlationId": envelope["correlationId"]}
            committed = self.workspace.append_event(
                command_id=envelope["commandId"],
                idempotency_key=envelope["idempotencyKey"],
                correlation_id=envelope["correlationId"],
                event_type="run.created",
                entity_id=run["runId"],
                result=result,
                commit=False,
            )
        if run["status"] == "queued":
            try:
                self.dispatcher.launch(run["runId"])
                run = self.dispatcher.run_store.get(run["runId"])
                committed = self.workspace.replace_idempotent_result(
                    envelope["idempotencyKey"],
                    {"run": run, "version": self.workspace.last_seq(), "correlationId": envelope["correlationId"]},
                )
            except Exception as exc:
                current = self.dispatcher.run_store.get(run["runId"])
                run, applied = self.dispatcher.run_store.finish_cas(
                    run["runId"],
                    int(current.get("version", 1)),
                    status="environment_unavailable",
                    error=type(exc).__name__,
                    artifactStatus="failed",
                    finishedAt=now_iso(),
                )
                if applied:
                    self._append_system_event("run.updated", run["runId"], envelope["correlationId"])
                committed = self.workspace.replace_idempotent_result(
                    envelope["idempotencyKey"],
                    {"run": run, "version": self.workspace.last_seq(), "correlationId": envelope["correlationId"]},
                )
        return committed

    def approve_run(self, run_id: str, envelope: dict[str, Any]) -> dict[str, Any]:
        with self._command_lock:
            cached = self._cached_run_result(envelope["idempotencyKey"])
            if cached is not None:
                return cached
            expected = envelope.get("expectedVersion")
            with self.workspace.connection:
                run = self.dispatcher.approve(run_id, expected_version=expected, defer_commit=True)
                committed = self.workspace.append_event(
                    command_id=envelope["commandId"],
                    idempotency_key=envelope["idempotencyKey"],
                    correlation_id=envelope["correlationId"],
                    event_type="approval.updated",
                    entity_id=run_id,
                    result={"run": run, "correlationId": envelope["correlationId"]},
                    commit=False,
                )
            try:
                self.dispatcher.launch(run_id)
                run = self.dispatcher.run_store.get(run_id)
                committed = self.workspace.replace_idempotent_result(
                    envelope["idempotencyKey"],
                    {"run": run, "version": self.workspace.last_seq(), "correlationId": envelope["correlationId"]},
                )
            except Exception as exc:
                current = self.dispatcher.run_store.get(run_id)
                run, applied = self.dispatcher.run_store.finish_cas(
                    run_id,
                    int(current.get("version", 1)),
                    status="environment_unavailable",
                    error=type(exc).__name__,
                    artifactStatus="failed",
                    finishedAt=now_iso(),
                )
                if applied:
                    self._append_system_event("run.updated", run_id, envelope["correlationId"])
                committed = self.workspace.replace_idempotent_result(
                    envelope["idempotencyKey"],
                    {"run": run, "version": self.workspace.last_seq(), "correlationId": envelope["correlationId"]},
                )
            return committed

    def reject_run(self, run_id: str, reason: str, envelope: dict[str, Any]) -> dict[str, Any]:
        with self._command_lock:
            cached = self._cached_run_result(envelope["idempotencyKey"])
            if cached is not None:
                return cached
            with self.workspace.connection:
                run = self.dispatcher.reject(
                    run_id,
                    reason,
                    expected_version=envelope.get("expectedVersion"),
                    defer_commit=True,
                )
                return self.workspace.append_event(
                    command_id=envelope["commandId"],
                    idempotency_key=envelope["idempotencyKey"],
                    correlation_id=envelope["correlationId"],
                    event_type="approval.updated",
                    entity_id=run_id,
                    result={"run": run, "correlationId": envelope["correlationId"]},
                    commit=False,
                )

    def cancel_run(self, run_id: str, envelope: dict[str, Any]) -> dict[str, Any]:
        with self._command_lock:
            cached = self._cached_run_result(envelope["idempotencyKey"])
            if cached is not None:
                return cached
            with self.workspace.connection:
                run = self.dispatcher.cancel(
                    run_id,
                    expected_version=envelope.get("expectedVersion"),
                    defer_commit=True,
                )
                return self.workspace.append_event(
                    command_id=envelope["commandId"],
                    idempotency_key=envelope["idempotencyKey"],
                    correlation_id=envelope["correlationId"],
                    event_type="run.updated",
                    entity_id=run_id,
                    result={"run": run, "correlationId": envelope["correlationId"]},
                    commit=False,
                )

    def retry_run(self, run_id: str, envelope: dict[str, Any]) -> dict[str, Any]:
        with self._command_lock:
            cached = self._cached_run_result(envelope["idempotencyKey"])
            if cached is not None:
                return cached
            with self.workspace.connection:
                handle = self.dispatcher.retry(
                    run_id,
                    expected_version=envelope.get("expectedVersion"),
                    defer_launch=True,
                )
                run = self.dispatcher.run_store.get(handle.run_id)
                committed = self.workspace.append_event(
                    command_id=envelope["commandId"],
                    idempotency_key=envelope["idempotencyKey"],
                    correlation_id=envelope["correlationId"],
                    event_type="run.created",
                    entity_id=run["runId"],
                    result={"run": run, "correlationId": envelope["correlationId"]},
                    commit=False,
                )
            if run["status"] == "queued":
                try:
                    self.dispatcher.launch(run["runId"])
                    run = self.dispatcher.run_store.get(run["runId"])
                    committed = self.workspace.replace_idempotent_result(
                        envelope["idempotencyKey"],
                        {"run": run, "version": self.workspace.last_seq(), "correlationId": envelope["correlationId"]},
                    )
                except Exception as exc:
                    current = self.dispatcher.run_store.get(run["runId"])
                    run, applied = self.dispatcher.run_store.finish_cas(
                        run["runId"],
                        int(current.get("version", 1)),
                        status="environment_unavailable",
                        error=type(exc).__name__,
                        artifactStatus="failed",
                        finishedAt=now_iso(),
                    )
                    if applied:
                        self._append_system_event("run.updated", run["runId"], envelope["correlationId"])
                    committed = self.workspace.replace_idempotent_result(
                        envelope["idempotencyKey"],
                        {"run": run, "version": self.workspace.last_seq(), "correlationId": envelope["correlationId"]},
                    )
            return committed

    def list_documents(self, source_ref: str | None = None, task_id: str | None = None) -> dict[str, Any]:
        documents = self.snapshot()["documents"]
        if source_ref is not None:
            documents = [item for item in documents if item.get("sourceRef") == source_ref]
        if task_id is not None:
            documents = [item for item in documents if task_id in item.get("linkedTaskIds", [])]
        normalized = []
        for document in documents:
            normalized.append({
                "id": document["id"],
                "workspaceId": "workspace_main",
                "sourceRef": document.get("sourceRef", document["id"]),
                "contentRef": f"local://documents/{document['id']}",
                "archiveStatus": "committed",
                "version": 1,
                "title": document.get("title", ""),
                "category": document.get("category", "other"),
                "linkedTaskIds": list(document.get("linkedTaskIds", [])),
                "visibilityScope": document.get("visibilityScope", "team"),
                "correlationId": document.get("correlationId"),
            })
        return {"documents": normalized, "version": self.workspace.last_seq()}

    def list_runs(self, task_id: str | None = None) -> dict[str, Any]:
        return {"runs": self.dispatcher.run_store.list(task_id), "cursor": self.workspace.last_seq()}

    def list_artifacts(self, run_id: str) -> dict[str, Any]:
        run = self.dispatcher.run_store.get(run_id)
        root = Path(run["artifactDir"]).resolve()
        if not root.is_dir():
            return {"runId": run_id, "artifacts": []}
        artifacts = []
        for path in root.rglob("*"):
            if path.is_file():
                artifacts.append(path.relative_to(root).as_posix())
        return {"runId": run_id, "artifacts": artifacts}

    def _append_system_event(self, event_type: str, entity_id: str, correlation_id: str) -> None:
        self.workspace.command(
            command_id=new_id("system"),
            idempotency_key=new_id("idem"),
            correlation_id=correlation_id,
            mutate=lambda snapshot: snapshot,
            event_type=event_type,
            entity_id=entity_id,
        )

    def _on_task_status(self, task_id: str, status: str) -> None:
        correlation_id = _correlation_id()

        def mutate(snapshot: dict[str, Any]) -> dict[str, Any]:
            for task in snapshot["tasks"]:
                if task["id"] == task_id:
                    task["status"] = status
                    break
            return snapshot

        self.workspace.command(
            command_id=new_id("status"),
            idempotency_key=new_id("idem"),
            correlation_id=correlation_id,
            mutate=mutate,
            event_type="task.updated",
            entity_id=task_id,
        )

    def _on_run_finished(self, run: dict[str, Any]) -> None:
        correlation_id = run.get("correlationId") or _correlation_id()

        def mutate(snapshot: dict[str, Any]) -> dict[str, Any]:
            task = next((item for item in snapshot["tasks"] if item["id"] == run["taskId"]), None)
            if task is None:
                return snapshot
            source_ref = f"run:{run['runId']}"
            if any(doc.get("sourceRef") == source_ref for doc in snapshot["documents"]):
                return snapshot
            content = (
                f"运行状态：{run['status']}\n"
                f"退出码：{run.get('exitCode')}\n"
                f"运行 ID：{run['runId']}\n"
                f"artifact 状态：{run.get('artifactStatus', 'unknown')}\n"
                f"产物文件：\n{chr(10).join(run.get('artifacts', [])) or '（无产物文件）'}\n\n"
                f"标准输出：\n{run.get('stdout') or '（无）'}\n\n"
                f"标准错误：\n{run.get('stderr') or '（无）'}"
            )
            snapshot["documents"].insert(0, {
                "id": new_id("doc"),
                "category": "task-result",
                "title": f"{task['title']} · {run['status']}",
                "content": content,
                "sourceRef": source_ref,
                "correlationId": correlation_id,
                "version": "v1.0",
                "linkedTaskIds": [task["id"]],
                "linkedMeetingIds": [],
                "visibilityScope": "team",
                "createdAt": now_iso(),
            })
            return snapshot

        self.workspace.command(
            command_id=new_id("archive"),
            idempotency_key=f"archive:{run['runId']}",
            correlation_id=correlation_id,
            mutate=mutate,
            event_type="artifact.completed",
            entity_id=run["runId"],
        )
