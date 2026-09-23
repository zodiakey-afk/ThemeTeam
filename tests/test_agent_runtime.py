from __future__ import annotations

import threading
import time
import unittest
from pathlib import Path

from themeteam.core.agent_runtime import (
    CodexCliAdapter,
    ProcessSupervisor,
    ProjectDirectoryGuard,
    RuntimeRejected,
    make_python_argv,
)

ROOT = Path(__file__).resolve().parents[1]
WORKSPACE_CHILD = ROOT / "tests"


class AgentRuntimeTests(unittest.TestCase):
    def test_process_supervisor_uses_bounded_output(self) -> None:
        result = ProcessSupervisor(output_limit=32).run(
            make_python_argv("print('x' * 1000)"),
            cwd=ROOT,
            timeout_seconds=5,
        )
        self.assertEqual(result.status, "succeeded")
        self.assertTrue(result.stdout_truncated)
        self.assertLessEqual(len(result.stdout.encode()), 32)

    def test_process_supervisor_timeout_cleans_up(self) -> None:
        started = time.monotonic()
        result = ProcessSupervisor().run(
            make_python_argv("import time; time.sleep(10)"),
            cwd=ROOT,
            timeout_seconds=0.1,
        )
        self.assertEqual(result.status, "timed_out")
        self.assertLess(time.monotonic() - started, 5)

    def test_process_supervisor_cancel(self) -> None:
        cancel = threading.Event()
        holder = {}

        def run() -> None:
            holder["result"] = ProcessSupervisor().run(
                make_python_argv("import time; time.sleep(10)"),
                cwd=ROOT,
                timeout_seconds=5,
                cancel_event=cancel,
            )

        thread = threading.Thread(target=run)
        thread.start()
        time.sleep(0.1)
        cancel.set()
        thread.join(timeout=5)
        self.assertFalse(thread.is_alive())
        self.assertEqual(holder["result"].status, "cancelled")

    def test_project_directory_guard_rejects_escape_and_allows_root(self) -> None:
        guard = ProjectDirectoryGuard([ROOT])
        self.assertEqual(guard.validate(ROOT, read_only=True), ROOT.resolve())
        self.assertEqual(guard.validate(WORKSPACE_CHILD, read_only=True), WORKSPACE_CHILD.resolve())
        with self.assertRaises(RuntimeRejected):
            guard.validate(Path("C:/Windows"), read_only=True)

    def test_project_directory_guard_rejects_symlink_escape(self) -> None:
        link = ROOT / "tests" / "fixtures" / "m1-link-for-runtime-test"
        outside = ROOT.parent
        try:
            link.symlink_to(outside, target_is_directory=True)
        except OSError:
            self.skipTest("symlink creation unavailable in this Windows test environment")
        try:
            with self.assertRaises(RuntimeRejected):
                ProjectDirectoryGuard([ROOT / "tests" / "fixtures"]).validate(link, read_only=True)
        finally:
            link.unlink(missing_ok=True)

    def test_codex_adapter_uses_readonly_argv_and_redacts_output(self) -> None:
        adapter = CodexCliAdapter(
            {
                "kind": "codex-cli",
                "executable": "codex",
                "timeoutSeconds": 30,
            },
            ProjectDirectoryGuard([ROOT]),
        )
        argv = adapter.build_argv("read marker only")
        self.assertEqual(argv[1:7], ["exec", "--ephemeral", "--sandbox", "read-only", "--skip-git-repo-check", "--color"])
        self.assertIn("never", argv)
        redacted_key = "sk" + "-secret-token-123456"
        self.assertNotIn(redacted_key, adapter.supervisor.run(
            make_python_argv(f"print('Bearer {redacted_key}')"),
            cwd=ROOT,
            timeout_seconds=5,
        ).stdout)
        self.assertNotIn("session-123", adapter.supervisor.run(
            make_python_argv("print('session id: session-123')"),
            cwd=ROOT,
            timeout_seconds=5,
        ).stdout)
        self.assertNotIn("OPENAI_API_KEY", adapter.safe_environment())

    def test_codex_adapter_rejects_arbitrary_executable(self) -> None:
        with self.assertRaises(RuntimeRejected):
            CodexCliAdapter(
                {"kind": "codex-cli", "executable": "powershell", "timeoutSeconds": 30},
                ProjectDirectoryGuard([ROOT]),
            ).build_argv("read only")


if __name__ == "__main__":
    unittest.main()
