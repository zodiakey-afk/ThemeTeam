from __future__ import annotations

import json
import hashlib
import os
import threading
import time
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
    TERMINAL = {
        "succeeded",
        "failed",
        "cancelled",
        "timed_out",
        "interrupted",
        "environment_unavailable",
        "rejected",
    }

    def __init__(self, path: Path) -> None:
        self.path = Path(path)
        self._lock = threading.RLock()
        self._runs: dict[str, dict[str, Any]] = {}
        self._load()
        self._recover_incomplete()

    def create(self, record: dict[str, Any], *, commit: bool = True) -> dict[str, Any]:
        with self._lock:
            self._runs[record["runId"]] = deepcopy(record)
            self._save()
            return deepcopy(record)

    def update(self, run_id: str, *, commit: bool = True, **changes: Any) -> dict[str, Any]:
        with self._lock:
            if run_id not in self._runs:
                raise KeyError(run_id)
            self._runs[run_id].update(deepcopy(changes))
            self._runs[run_id]["version"] = int(self._runs[run_id].get("version", 1)) + 1
            self._save()
            return deepcopy(self._runs[run_id])

    def finish_cas(self, run_id: str, expected_version: int, *, commit: bool = True, **changes: Any) -> tuple[dict[str, Any], bool]:
        with self._lock:
            if run_id not in self._runs:
                raise KeyError(run_id)
            current = self._runs[run_id]
            if current.get("status") in self.TERMINAL or int(current.get("version", 1)) != expected_version:
                return deepcopy(current), False
            current.update(deepcopy(changes))
            current["version"] = int(current.get("version", 1)) + 1
            self._save()
            return deepcopy(current), True

    def transition_cas(
        self,
        run_id: str,
        expected_version: int,
        allowed_statuses: set[str],
        *,
        commit: bool = True,
        **changes: Any,
    ) -> tuple[dict[str, Any], bool]:
        with self._lock:
            if run_id not in self._runs:
                raise KeyError(run_id)
            current = self._runs[run_id]
            if (
                int(current.get("version", 1)) != expected_version
                or current.get("status") not in allowed_statuses
            ):
                return deepcopy(current), False
            current.update(deepcopy(changes))
            current["version"] = expected_version + 1
            self._save()
            return deepcopy(current), True

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
            if record.get("status") == "waiting" and record.get("approvalStatus") == "approved":
                record.update(status="environment_unavailable", finishedAt=_now(), error="approved run could not resume after dispatcher restart")
                changed = True
                continue
            if record.get("status") in {"queued", "running"}:
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

    def __init__(
        self,
        run_store: TaskRunStore,
        supervisor: ProcessSupervisor | None = None,
        on_status=None,
        on_finished=None,
        retry_spec_resolver=None,
    ) -> None:
        self.run_store = run_store
        self.supervisor = supervisor or ProcessSupervisor()
        self.on_status = on_status
        self.on_finished = on_finished
        self.retry_spec_resolver = retry_spec_resolver
        self._threads: dict[str, threading.Thread] = {}
        self._completed_threads: dict[str, threading.Thread] = {}
        self._cancel: dict[str, threading.Event] = {}
        self._specs: dict[str, dict[str, Any]] = {}
        self._lock = threading.RLock()
        self._shutting_down = False

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
        defer_launch: bool = False,
        correlation_id: str | None = None,
    ) -> dict[str, Any]:
        if not runtime.get("enabled", True):
            raise RuntimeRejected("runtime profile disabled")
        if project.get("readOnly"):
            raise RuntimeRejected("task execution requires a writable project directory")
        safe_cwd = ProjectDirectoryGuard([Path(project["path"])]).validate(Path(cwd), read_only=False)
        run_id = _run_id()
        artifact_dir = safe_cwd / ".themeteam-artifacts" / run_id
        requires_approval = runtime.get("approvalPolicy", "automatic") == "manual"
        record = {
            "id": run_id,
            "runId": run_id,
            "taskId": task_id,
            "runtimeProfileId": runtime.get("id"),
            "projectDirectoryProfileId": project.get("id"),
            "cwd": str(safe_cwd),
            "artifactDir": str(artifact_dir),
            "promptHash": hashlib.sha256(prompt.encode("utf-8")).hexdigest(),
            "correlationId": correlation_id,
            "status": "waiting" if requires_approval else "queued",
            "approvalStatus": "pending" if requires_approval else "not_required",
            "retryOf": retry_of,
            "createdAt": _now(),
            "startedAt": None,
            "finishedAt": None,
            "exitCode": None,
            "stdout": "",
            "stderr": "",
            "error": None,
            "artifacts": [],
            "artifactStatus": "pending",
            "cancelRequested": False,
            "version": 1,
        }
        self.run_store.create(record, commit=not defer_launch)
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
        if not requires_approval and not defer_launch:
            self._launch(run_id)
        return RunHandle(run_id)

    def launch(self, run_id: str) -> None:
        with self._lock:
            if self._shutting_down:
                raise RuntimeRejected("dispatcher is shutting down")
            if run_id in self._threads:
                return
            self._launch(run_id)

    def cancel(self, run_id: str, expected_version: int | None = None, *, defer_commit: bool = False) -> dict[str, Any]:
        with self._lock:
            record = self.run_store.get(run_id)
            if record["status"] in TaskRunStore.TERMINAL:
                return record
            if expected_version is not None and int(record.get("version", 1)) != expected_version:
                from .validation import ConflictError
                raise ConflictError("run version conflict")
            event = self._cancel.get(run_id)
            if event is None:
                raise KeyError(run_id)
            event.set()
            updated, applied = self.run_store.transition_cas(
                run_id,
                int(record.get("version", 1)),
                {"waiting", "queued", "running"},
                commit=not defer_commit,
                status="cancelled",
                cancelRequested=True,
            )
            if not applied:
                from .validation import ConflictError
                raise ConflictError("run version conflict")
            return updated

    def approve(self, run_id: str, expected_version: int | None = None, *, defer_commit: bool = False) -> dict[str, Any]:
        with self._lock:
            record = self.run_store.get(run_id)
            if record["status"] != "waiting" or record.get("approvalStatus") != "pending":
                raise RuntimeRejected("run is not waiting for approval")
            if expected_version is not None and int(record.get("version", 1)) != expected_version:
                from .validation import ConflictError
                raise ConflictError("run version conflict")
            updated, applied = self.run_store.transition_cas(
                run_id,
                int(record.get("version", 1)),
                {"waiting"},
                commit=not defer_commit,
                approvalStatus="approved",
                approvedAt=_now(),
            )
            if not applied:
                from .validation import ConflictError
                raise ConflictError("run version conflict")
            if not defer_commit:
                self._launch(run_id)
            return updated

    def reject(self, run_id: str, reason: str = "rejected by owner", expected_version: int | None = None, *, defer_commit: bool = False) -> dict[str, Any]:
        with self._lock:
            record = self.run_store.get(run_id)
            if record["status"] != "waiting":
                raise RuntimeRejected("run is not waiting for approval")
            if expected_version is not None and int(record.get("version", 1)) != expected_version:
                from .validation import ConflictError
                raise ConflictError("run version conflict")
            updated, applied = self.run_store.transition_cas(
                run_id,
                int(record.get("version", 1)),
                {"waiting"},
                commit=not defer_commit,
                status="rejected",
                approvalStatus="rejected",
                rejectionReason=reason[:512],
                finishedAt=_now(),
            )
            if not applied:
                from .validation import ConflictError
                raise ConflictError("run version conflict")
            return updated

    def wait(self, run_id: str, timeout: float = 30) -> bool:
        with self._lock:
            thread = self._threads.get(run_id) or self._completed_threads.get(run_id)
        if thread is None:
            return self.run_store.get(run_id)["status"] in TaskRunStore.TERMINAL
        thread.join(timeout=timeout)
        finished = not thread.is_alive()
        if finished:
            with self._lock:
                self._completed_threads.pop(run_id, None)
        return finished

    def retry(self, run_id: str, expected_version: int | None = None, *, defer_launch: bool = False) -> dict[str, Any]:
        old = self.run_store.get(run_id)
        if old["status"] not in {
            "failed",
            "timed_out",
            "cancelled",
            "interrupted",
            "environment_unavailable",
        }:
            raise RuntimeRejected("only failed runs can be retried")
        if expected_version is not None and int(old.get("version", 1)) != expected_version:
            from .validation import ConflictError
            raise ConflictError("run version conflict")
        spec = self._specs.get(run_id)
        if spec is None and self.retry_spec_resolver is not None:
            spec = self.retry_spec_resolver(old)
            if spec is not None:
                self._specs[run_id] = deepcopy(spec)
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
            defer_launch=defer_launch,
            correlation_id=spec.get("correlationId"),
        )

    def shutdown(self) -> None:
        with self._lock:
            self._shutting_down = True
        deadline = time.monotonic() + 10
        while True:
            with self._lock:
                active = list(self._threads.items())
            for run_id, _thread in active:
                try:
                    self.cancel(run_id)
                except (KeyError, RuntimeRejected):
                    pass
            for _run_id, thread in active:
                remaining = max(0.0, deadline - time.monotonic())
                thread.join(timeout=min(1.0, remaining))
            with self._lock:
                if not self._threads and not any(thread.is_alive() for thread in self._completed_threads.values()):
                    break
                if time.monotonic() >= deadline:
                    break

    def _launch(self, run_id: str) -> None:
        spec = self._specs.get(run_id)
        if spec is None:
            raise RuntimeRejected("run specification unavailable")
        record = self.run_store.update(run_id, status="queued")
        Path(record["artifactDir"]).mkdir(parents=True, exist_ok=False)
        if self.on_status:
            self.on_status(record["taskId"], "in_progress")
        thread = threading.Thread(
            target=self._execute,
            args=(
                run_id,
                spec["runtime"],
                spec["project"],
                spec["prompt"],
                Path(spec["cwd"]),
                Path(record["artifactDir"]),
                spec["argv"],
                self._cancel[run_id],
            ),
            name=f"task-run-{run_id}",
            daemon=True,
        )
        with self._lock:
            self._threads[run_id] = thread
        thread.start()

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
            current = self.run_store.get(run_id)
            status = "cancelled" if cancel_event.is_set() or current.get("cancelRequested") else result.status
            try:
                artifacts = [str(path.relative_to(artifact_dir)) for path in artifact_dir.rglob("*") if path.is_file()]
                artifact_status = "complete"
            except OSError:
                artifacts = []
                artifact_status = "failed"
            expected_version = int(current.get("version", 1))
            finished, applied = self.run_store.finish_cas(
                run_id,
                expected_version,
                status=status,
                finishedAt=_now(),
                exitCode=result.exit_code,
                stdout=result.stdout,
                stderr=result.stderr,
                artifacts=artifacts,
                artifactStatus=artifact_status,
            )
            if not applied:
                return
            if self.on_status:
                self.on_status(finished["taskId"], "done" if status == "succeeded" else "in_review")
            if self.on_finished:
                self.on_finished(finished)
        except Exception as exc:
            current = self.run_store.get(run_id)
            environment_failure = isinstance(exc, RuntimeRejected)
            current_version = int(current.get("version", 1))
            finished, applied = self.run_store.finish_cas(
                run_id,
                current_version,
                status="cancelled" if cancel_event.is_set() else "environment_unavailable" if environment_failure else "failed",
                finishedAt=_now(),
                error=type(exc).__name__,
                artifactStatus="failed",
            )
            if not applied:
                return
            if self.on_status:
                self.on_status(finished["taskId"], "in_review")
            if self.on_finished:
                self.on_finished(finished)
        finally:
            with self._lock:
                self._cancel.pop(run_id, None)
                thread = self._threads.pop(run_id, None)
                if thread is not None:
                    self._completed_threads[run_id] = thread

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
