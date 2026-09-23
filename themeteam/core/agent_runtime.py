from __future__ import annotations

import os
import re
import shutil
import signal
import subprocess
import sys
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Sequence

from .validation import ConflictError


class RuntimeRejected(ConflictError):
    """The runtime or working directory failed a preflight safety check."""


@dataclass(frozen=True)
class ProcessResult:
    status: str
    exit_code: Optional[int]
    stdout: str
    stderr: str
    stdout_truncated: bool
    stderr_truncated: bool
    duration_ms: int
    cwd: str

    def to_dict(self) -> dict:
        return {
            "status": self.status,
            "exitCode": self.exit_code,
            "stdout": self.stdout,
            "stderr": self.stderr,
            "stdoutTruncated": self.stdout_truncated,
            "stderrTruncated": self.stderr_truncated,
            "durationMs": self.duration_ms,
            "cwd": self.cwd,
        }


class _BoundedReader:
    def __init__(self, limit: int) -> None:
        self.limit = limit
        self.data = bytearray()
        self.total = 0
        self.done = threading.Event()

    def read(self, stream) -> None:
        try:
            while True:
                chunk = stream.read(4096)
                if not chunk:
                    return
                self.total += len(chunk)
                if len(self.data) < self.limit:
                    self.data.extend(chunk[: self.limit - len(self.data)])
        finally:
            self.done.set()

    def text(self) -> str:
        return bytes(self.data).decode("utf-8", errors="replace")

    @property
    def truncated(self) -> bool:
        return self.total > self.limit


def _redact(text: str) -> str:
    patterns = (
        (r"(?i)(bearer\s+)[A-Za-z0-9._~+/=-]+", r"\1[REDACTED]"),
        (r"(?i)(api[_-]?key|token|secret|password)(\s*[:=]\s*)[^\s,;]+", r"\1\2[REDACTED]"),
        (r"\bsk-[A-Za-z0-9_-]{12,}\b", "[REDACTED_KEY]"),
        (r"(?i)(session\s+id\s*:\s*)[A-Za-z0-9-]+", r"\1[REDACTED]"),
    )
    for pattern, replacement in patterns:
        text = re.sub(pattern, replacement, text)
    return text


def _terminate_process_tree(process: subprocess.Popen) -> None:
    if process.poll() is not None:
        return
    try:
        if os.name == "nt":
            try:
                process.kill()
            except OSError:
                pass
            subprocess.run(
                ["taskkill", "/PID", str(process.pid), "/T", "/F"],
                stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                check=False,
                timeout=1,
            )
        else:
            os.killpg(process.pid, signal.SIGTERM)
            try:
                process.wait(timeout=1)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
    except (OSError, subprocess.TimeoutExpired):
        try:
            process.kill()
        except OSError:
            pass


class ProcessSupervisor:
    """Run one argv command with bounded output and owned process cleanup."""

    def __init__(self, *, output_limit: int = 65536) -> None:
        if output_limit < 1:
            raise ValueError("output_limit must be positive")
        self.output_limit = output_limit

    def run(
        self,
        argv: Sequence[str],
        *,
        cwd: Path,
        timeout_seconds: float,
        cancel_event: Optional[threading.Event] = None,
        env: Optional[dict[str, str]] = None,
    ) -> ProcessResult:
        if not argv or any(type(item) is not str or not item for item in argv):
            raise RuntimeRejected("argv must be a non-empty string array")
        if timeout_seconds <= 0:
            raise ValueError("timeout_seconds must be positive")
        try:
            cwd = Path(cwd).resolve(strict=True)
        except (OSError, RuntimeError) as exc:
            raise RuntimeRejected("working directory cannot be resolved") from exc
        started = time.monotonic()
        creationflags = getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0) if os.name == "nt" else 0
        start_new_session = os.name != "nt"
        try:
            process = subprocess.Popen(
                list(argv),
                cwd=str(cwd),
                stdin=subprocess.DEVNULL,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                shell=False,
                env=env,
                creationflags=creationflags,
                start_new_session=start_new_session,
            )
        except (OSError, ValueError) as exc:
            raise RuntimeRejected(f"process start failed: {type(exc).__name__}") from exc

        stdout_reader = _BoundedReader(self.output_limit)
        stderr_reader = _BoundedReader(self.output_limit)
        stdout_thread = threading.Thread(target=stdout_reader.read, args=(process.stdout,), name="runtime-stdout")
        stderr_thread = threading.Thread(target=stderr_reader.read, args=(process.stderr,), name="runtime-stderr")
        stdout_thread.start()
        stderr_thread.start()
        status = "succeeded"
        try:
            while process.poll() is None:
                if cancel_event is not None and cancel_event.is_set():
                    status = "cancelled"
                    _terminate_process_tree(process)
                    break
                if time.monotonic() - started >= timeout_seconds:
                    status = "timed_out"
                    _terminate_process_tree(process)
                    break
                time.sleep(0.01)
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            status = "timed_out"
            _terminate_process_tree(process)
            process.wait(timeout=5)
        finally:
            stdout_thread.join(timeout=5)
            stderr_thread.join(timeout=5)
            if stdout_thread.is_alive() or stderr_thread.is_alive():
                _terminate_process_tree(process)
                stdout_thread.join(timeout=1)
                stderr_thread.join(timeout=1)
            if process.stdout is not None:
                process.stdout.close()
            if process.stderr is not None:
                process.stderr.close()

        if status == "succeeded" and process.returncode != 0:
            status = "failed"
        duration_ms = int((time.monotonic() - started) * 1000)
        return ProcessResult(
            status=status,
            exit_code=process.returncode,
            stdout=_redact(stdout_reader.text()),
            stderr=_redact(stderr_reader.text()),
            stdout_truncated=stdout_reader.truncated,
            stderr_truncated=stderr_reader.truncated,
            duration_ms=duration_ms,
            cwd=str(cwd),
        )


class ProjectDirectoryGuard:
    def __init__(self, allowed_roots: Sequence[Path]) -> None:
        try:
            roots = [Path(root).resolve(strict=True) for root in allowed_roots]
        except (OSError, RuntimeError) as exc:
            raise RuntimeRejected("allowed root cannot be resolved") from exc
        if not roots:
            raise ValueError("at least one allowed root is required")
        self._roots = tuple(roots)

    def validate(self, path: Path, *, read_only: bool = False) -> Path:
        candidate = Path(path).expanduser()
        if not candidate.exists() or not candidate.is_dir():
            raise RuntimeRejected("project directory does not exist")
        try:
            resolved = candidate.resolve(strict=True)
        except (OSError, RuntimeError) as exc:
            raise RuntimeRejected("project directory cannot be resolved") from exc
        if not any(resolved == root or root in resolved.parents for root in self._roots):
            raise RuntimeRejected("project directory is outside allowed roots")
        if read_only:
            return resolved
        if not os.access(resolved, os.W_OK):
            raise RuntimeRejected("project directory is not writable")
        return resolved


class CodexCliAdapter:
    KIND = "codex-cli"
    ALLOWED_EXECUTABLES = {"codex", "codex.exe"}

    def __init__(self, profile: dict, directory_guard: ProjectDirectoryGuard, supervisor: ProcessSupervisor | None = None):
        if profile.get("kind") != self.KIND:
            raise RuntimeRejected("runtime kind is not codex-cli")
        self.profile = profile
        self.directory_guard = directory_guard
        self.supervisor = supervisor or ProcessSupervisor()

    def executable_path(self) -> str:
        configured = str(self.profile.get("executable", ""))
        name = Path(configured).name.lower()
        if name not in self.ALLOWED_EXECUTABLES:
            raise RuntimeRejected("codex executable is not allowlisted")
        resolved = shutil.which(configured)
        if resolved is None and Path(configured).is_file():
            resolved = str(Path(configured).resolve())
        if resolved is None:
            raise RuntimeRejected("codex executable is unavailable")
        return resolved

    def build_argv(self, prompt: str) -> list[str]:
        if type(prompt) is not str or not prompt.strip() or len(prompt) > 4096:
            raise ValueError("prompt is invalid")
        return [
            self.executable_path(),
            "exec",
            "--ephemeral",
            "--sandbox",
            "read-only",
            "--skip-git-repo-check",
            "--color",
            "never",
            prompt,
        ]

    def build_task_argv(self, prompt: str, cwd: Path, artifact_dir: Path) -> list[str]:
        if type(prompt) is not str or not prompt.strip() or len(prompt) > 4096:
            raise ValueError("prompt is invalid")
        safe_cwd = self.directory_guard.validate(cwd, read_only=False)
        safe_artifact = artifact_dir.resolve()
        if safe_cwd != safe_artifact and safe_cwd not in safe_artifact.parents:
            raise RuntimeRejected("artifact directory is outside project directory")
        configured = str(self.profile.get("executable", ""))
        if Path(configured).name.lower() not in self.ALLOWED_EXECUTABLES:
            raise RuntimeRejected("codex executable is not allowlisted")
        return [
            configured, "exec", "--ephemeral", "--sandbox", "workspace-write",
            "--add-dir", str(safe_artifact),
            "--skip-git-repo-check", "--color", "never", prompt,
        ]

    @staticmethod
    def safe_environment() -> dict[str, str]:
        """Keep process execution useful without forwarding arbitrary secrets."""
        allowed = {
            "PATH",
            "PATHEXT",
            "SYSTEMROOT",
            "COMSPEC",
            "TEMP",
            "TMP",
            "USERPROFILE",
            "HOMEDRIVE",
            "HOMEPATH",
            "LOCALAPPDATA",
            "APPDATA",
            "CODEX_HOME",
        }
        return {key: value for key, value in os.environ.items() if key in allowed}

    def probe(self, *, cwd: Path) -> ProcessResult:
        safe_cwd = self.directory_guard.validate(cwd, read_only=True)
        return self.supervisor.run(
            [self.executable_path(), "--version"],
            cwd=safe_cwd,
            timeout_seconds=min(float(self.profile.get("timeoutSeconds", 30)), 30),
            env=self.safe_environment(),
        )

    def run_readonly(self, prompt: str, *, cwd: Path, cancel_event: Optional[threading.Event] = None) -> ProcessResult:
        safe_cwd = self.directory_guard.validate(cwd, read_only=True)
        timeout = float(self.profile.get("timeoutSeconds", 1800))
        return self.supervisor.run(
            self.build_argv(prompt),
            cwd=safe_cwd,
            timeout_seconds=timeout,
            cancel_event=cancel_event,
            env=self.safe_environment(),
        )


class _GenericCliAdapter:
    ALLOWED_EXECUTABLES: set[str] = set()
    TASK_PREFIX: tuple[str, ...] = ()

    def __init__(self, profile: dict, directory_guard: ProjectDirectoryGuard, supervisor: ProcessSupervisor | None = None):
        if profile.get("kind") != self.KIND:
            raise RuntimeRejected(f"runtime kind is not {self.KIND}")
        self.profile = profile
        self.directory_guard = directory_guard
        self.supervisor = supervisor or ProcessSupervisor()

    def executable_path(self) -> str:
        configured = str(self.profile.get("executable", ""))
        if Path(configured).name.lower() not in self.ALLOWED_EXECUTABLES:
            raise RuntimeRejected("executable is not allowlisted")
        resolved = shutil.which(configured)
        if resolved is None:
            raise RuntimeRejected("executable is unavailable")
        return resolved

    @staticmethod
    def safe_environment() -> dict[str, str]:
        return CodexCliAdapter.safe_environment()

    def build_task_argv(self, prompt: str, cwd: Path, artifact_dir: Path) -> list[str]:
        if type(prompt) is not str or not prompt.strip() or len(prompt) > 4096:
            raise ValueError("prompt is invalid")
        safe_cwd = self.directory_guard.validate(cwd, read_only=False)
        safe_artifact = artifact_dir.resolve()
        if safe_cwd != safe_artifact and safe_cwd not in safe_artifact.parents:
            raise RuntimeRejected("artifact directory is outside project directory")
        configured = str(self.profile.get("executable", ""))
        if Path(configured).name.lower() not in self.ALLOWED_EXECUTABLES:
            raise RuntimeRejected("executable is not allowlisted")
        return [configured, *self.TASK_PREFIX, prompt]


class ClaudeCliAdapter(_GenericCliAdapter):
    KIND = "claude-cli"
    ALLOWED_EXECUTABLES = {"claude", "claude.exe"}
    TASK_PREFIX = ("-p",)


class OpenCodeCliAdapter(_GenericCliAdapter):
    KIND = "opencode-cli"
    ALLOWED_EXECUTABLES = {"opencode", "opencode.exe"}
    TASK_PREFIX = ("run",)


def make_python_argv(code: str) -> list[str]:
    """Small test helper kept here so subprocess tests use argv, never shell text."""
    return [sys.executable, "-c", code]
