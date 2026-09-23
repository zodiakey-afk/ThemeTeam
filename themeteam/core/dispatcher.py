from __future__ import annotations

import json
import hashlib
import os
import threading
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional, Sequence
from uuid import uuid4

from .agent_runtime import (
    ClaudeCliAdapter,
    CodexCliAdapter,
    OpenCodeCliAdapter,
    ProcessResult,
    ProcessSupervisor,
    ProjectDirectoryGuard,
    RuntimeRejected,
    make_python_argv,
)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _run_id() -> str:
    return f"run_{uuid4().hex[:10]}"


class TaskRunStore:
    TERMINAL = {"succeeded", "failed", "cancelled", "timed_out", "interrupted"}

    def __init__(self, path: Path) -> None:
        self.path = Path(path)
        self._lock = threading.RLock()
        self._runs: dict[str, dict[str, Any]] = {}
        self._load()
        self._recover_incomplete()

    def create(self, record: dict[str, Any]) -> dict[str, Any]:
        with self._lock:
            self._runs[record["runId"]] = deepcopy(record)
            self._save()
            return deepcopy(record)

    def update(self, run_id: str, **changes: Any) -> dict[str, Any]:
        with self._lock:
            if run_id not in self._runs:
                raise KeyError(run_id)
            self._runs[run_id].update(deepcopy(changes))
            self._save()
            return deepcopy(self._runs[run_id])

    def get(self, run_id: str) -> dict[str, Any]:
        with self._lock:
            if run_id not in self._runs:
                raise KeyError(run_id)
            return deepcopy(self._runs[run_id])

    def list(self, task_id: str | None = None) -> list[dict[str, Any]]:
        with self._lock:
            values = list(self._runs.values())
            if task_id is not None:
                values = [item for item in values if item.get("taskId") == task_id]
            return deepcopy(values)

    def _load(self) -> None:
        if not self.path.is_file():
            return
        data = json.loads(self.path.read_text(encoding="utf-8"))
        if type(data) is not dict or type(data.get("runs", [])) is not list:
            raise ValueError("Invalid task run store")
        self._runs = {item["runId"]: item for item in data["runs"] if type(item) is dict and "runId" in item}

    def _recover_incomplete(self) -> None:
        changed = False
        for record in self._runs.values():
            if record.get("status") in {"queued", "running", "waiting"}:
                record.update(status="interrupted", finishedAt=_now(), error="dispatcher restarted")
                changed = True
        if changed:
            self._save()

    def _save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        payload = json.dumps({"version": 1, "runs": list(self._runs.values())}, ensure_ascii=False, indent=2, allow_nan=False)
        temporary = self.path.with_suffix(self.path.suffix + ".tmp")
        temporary.write_text(payload, encoding="utf-8")
        os.replace(temporary, self.path)


class RunHandle:
    def __init__(self, run_id: str) -> None:
        self.run_id = run_id


class TaskDispatcher:
    """Owns task execution lifecycle; the office scene never changes task state."""

    def __init__(self, run_store: TaskRunStore, supervisor: ProcessSupervisor | None = None, on_status=None) -> None:
        self.run_store = run_store
        self.supervisor = supervisor or ProcessSupervisor()
        self.on_status = on_status
        self._threads: dict[str, threading.Thread] = {}
        self._cancel: dict[str, threading.Event] = {}
        self._specs: dict[str, dict[str, Any]] = {}
        self._lock = threading.RLock()

    def start(
        self,
        *,
        task_id: str,
        runtime: dict[str, Any],
        project: dict[str, Any],
        prompt: str,
        cwd: Path,
        argv: Optional[Sequence[str]] = None,
        retry_of: str | None = None,
    ) -> dict[str, Any]:
        if not runtime.get("enabled", True):
            raise RuntimeRejected("runtime profile disabled")
        if project.get("readOnly"):
            raise RuntimeRejected("task execution requires a writable project directory")
        safe_cwd = ProjectDirectoryGuard([Path(project["path"])]).validate(Path(cwd), read_only=False)
        run_id = _run_id()
        artifact_dir = safe_cwd / ".themeteam-artifacts" / run_id
        artifact_dir.mkdir(parents=True, exist_ok=False)
        record = {
            "runId": run_id,
            "taskId": task_id,
            "runtimeProfileId": runtime.get("id"),
            "projectDirectoryProfileId": project.get("id"),
            "cwd": str(safe_cwd),
            "artifactDir": str(artifact_dir),
            "promptHash": hashlib.sha256(prompt.encode("utf-8")).hexdigest(),
            "status": "queued",
            "retryOf": retry_of,
            "createdAt": _now(),
            "startedAt": None,
            "finishedAt": None,
            "exitCode": None,
            "stdout": "",
            "stderr": "",
            "error": None,
            "artifacts": [],
        }
        self.run_store.create(record)
        if self.on_status:
            self.on_status(task_id, "in_progress")
        self._specs[run_id] = {
            "runtime": deepcopy(runtime),
            "project": deepcopy(project),
            "prompt": prompt,
            "cwd": str(safe_cwd),
            "argv": list(argv) if argv else None,
        }
        cancel_event = threading.Event()
        with self._lock:
            self._cancel[run_id] = cancel_event
        thread = threading.Thread(
            target=self._execute,
            args=(run_id, runtime, project, prompt, safe_cwd, artifact_dir, list(argv) if argv else None, cancel_event),
            name=f"task-run-{run_id}",
            daemon=True,
        )
        with self._lock:
            self._threads[run_id] = thread
        thread.start()
        return RunHandle(run_id)

    def cancel(self, run_id: str) -> dict[str, Any]:
        with self._lock:
            event = self._cancel.get(run_id)
            if event is None:
                record = self.run_store.get(run_id)
                if record["status"] in TaskRunStore.TERMINAL:
                    return record
                raise KeyError(run_id)
            event.set()
        return self.run_store.update(run_id, status="cancelled")

    def wait(self, run_id: str, timeout: float = 30) -> bool:
        with self._lock:
            thread = self._threads.get(run_id)
        if thread is None:
            return self.run_store.get(run_id)["status"] in TaskRunStore.TERMINAL
        thread.join(timeout=timeout)
        return not thread.is_alive()

    def retry(self, run_id: str) -> dict[str, Any]:
        old = self.run_store.get(run_id)
        if old["status"] not in {"failed", "timed_out", "cancelled", "interrupted"}:
            raise RuntimeRejected("only failed runs can be retried")
        spec = self._specs.get(run_id)
        if spec is None:
            raise RuntimeRejected("retry specification unavailable after dispatcher restart")
        return self.start(
            task_id=old["taskId"],
            runtime=spec["runtime"],
            project=spec["project"],
            prompt=spec["prompt"],
            cwd=Path(spec["cwd"]),
            argv=spec["argv"],
            retry_of=run_id,
        )

    def shutdown(self) -> None:
        for run_id in list(self._threads):
            self.cancel(run_id)
        for thread in list(self._threads.values()):
            thread.join(timeout=5)

    def _execute(self, run_id: str, runtime: dict[str, Any], project: dict[str, Any], prompt: str,
                 cwd: Path, artifact_dir: Path, argv: list[str] | None, cancel_event: threading.Event) -> None:
        self.run_store.update(run_id, status="running", startedAt=_now())
        try:
            adapter = self._adapter(runtime, project)
            if argv is None:
                argv = adapter.build_task_argv(prompt, cwd, artifact_dir)
            self._specs[run_id]["argv"] = list(argv)
            environment = adapter.safe_environment()
            environment["THEMETEAM_ARTIFACT_DIR"] = str(artifact_dir)
            result = self.supervisor.run(
                argv,
                cwd=cwd,
                timeout_seconds=float(runtime.get("timeoutSeconds", 1800)),
                cancel_event=cancel_event,
                env=environment,
            )
            status = result.status
            artifacts = [str(path.relative_to(artifact_dir)) for path in artifact_dir.rglob("*") if path.is_file()]
            self.run_store.update(
                run_id,
                status=status,
                finishedAt=_now(),
                exitCode=result.exit_code,
                stdout=result.stdout,
                stderr=result.stderr,
                artifacts=artifacts,
            )
            if self.on_status:
                self.on_status(run_id and self.run_store.get(run_id)["taskId"], "done" if status == "succeeded" else "in_review")
        except Exception as exc:
            self.run_store.update(run_id, status="failed", finishedAt=_now(), error=type(exc).__name__)
            if self.on_status:
                self.on_status(self.run_store.get(run_id)["taskId"], "in_review")
        finally:
            with self._lock:
                self._cancel.pop(run_id, None)
                self._threads.pop(run_id, None)

    def _adapter(self, runtime: dict[str, Any], project: dict[str, Any]):
        kind = runtime.get("kind")
        guard = ProjectDirectoryGuard([Path(project["path"])])
        if kind == "codex-cli":
            return CodexCliAdapter(runtime, guard, self.supervisor)
        if kind == "claude-cli":
            return ClaudeCliAdapter(runtime, guard, self.supervisor)
        if kind == "opencode-cli":
            return OpenCodeCliAdapter(runtime, guard, self.supervisor)
        if kind == "model-api" and runtime.get("executable") == "mock":
            return MockRuntimeAdapter(runtime, guard, self.supervisor)
        raise RuntimeRejected("runtime adapter unavailable")


class MockRuntimeAdapter:
    KIND = "model-api"

    def __init__(self, profile: dict[str, Any], directory_guard: ProjectDirectoryGuard, supervisor: ProcessSupervisor):
        self.profile = profile
        self.directory_guard = directory_guard
        self.supervisor = supervisor

    @staticmethod
    def safe_environment() -> dict[str, str]:
        return {}

    def build_task_argv(self, prompt: str, cwd: Path, artifact_dir: Path) -> list[str]:
        artifact = str(artifact_dir / "result.txt").replace("\\", "\\\\")
        return make_python_argv(f"from pathlib import Path; Path(r'{artifact}').write_text({prompt!r}, encoding='utf-8')")
