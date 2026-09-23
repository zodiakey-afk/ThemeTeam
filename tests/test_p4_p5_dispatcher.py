from __future__ import annotations

import json
import sys
import time
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from themeteam.core.agent_runtime import (
    ClaudeCliAdapter,
    CodexCliAdapter,
    OpenCodeCliAdapter,
    ProcessSupervisor,
    ProjectDirectoryGuard,
    RuntimeRejected,
    make_python_argv,
)
from themeteam.core.dispatcher import TaskDispatcher, TaskRunStore
from themeteam.core.settings_store import SettingsStore


class P4P5Tests(unittest.TestCase):
    def test_settings_store_is_independent_from_workspace_snapshot(self) -> None:
        with TemporaryDirectory() as directory:
            path = Path(directory) / "settings.json"
            store = SettingsStore(path)
            store.save_profiles(
                {
                    "runtimeProfiles": [{"id": "r", "kind": "codex-cli", "executable": "codex"}],
                    "projectDirectories": [{"id": "p", "path": directory}],
                }
            )
            reloaded = SettingsStore(path).load()
            self.assertEqual(reloaded["runtimeProfiles"][0]["id"], "r")
            self.assertNotIn("secret", json.dumps(reloaded))

    def test_cli_adapters_share_contract_without_shell(self) -> None:
        with TemporaryDirectory() as directory:
            guard = ProjectDirectoryGuard([Path(directory)])
            profiles = [
                (CodexCliAdapter, "codex", ["exec"]),
                (ClaudeCliAdapter, "claude", ["-p"]),
                (OpenCodeCliAdapter, "opencode", ["run"]),
            ]
            for adapter_class, executable, expected in profiles:
                with self.subTest(adapter=adapter_class.__name__):
                    adapter = adapter_class(
                        {"kind": adapter_class.KIND, "executable": executable, "timeoutSeconds": 30},
                        guard,
                    )
                    argv = adapter.build_task_argv("hello", Path(directory), Path(directory) / "artifacts")
                    self.assertEqual(argv[0], executable)
                    self.assertIn(expected[0], argv)
                    self.assertTrue(all(isinstance(value, str) for value in argv))

    def test_dispatcher_success_writes_artifact_and_retries_failure(self) -> None:
        with TemporaryDirectory() as directory:
            root = Path(directory)
            run_store = TaskRunStore(root / "runs.json")
            dispatcher = TaskDispatcher(run_store)
            success = dispatcher.start(
                task_id="task-1",
                runtime={"id": "r", "kind": "model-api", "executable": "mock"},
                project={"id": "p", "path": str(root), "readOnly": False},
                prompt="hello",
                argv=make_python_argv(
                    "from pathlib import Path; import os; "
                    "Path(os.environ['THEMETEAM_ARTIFACT_DIR'], 'artifact.txt').write_text('ok')"
                ),
                cwd=root,
            )
            self.assertTrue(dispatcher.wait(success.run_id, timeout=5))
            finished = run_store.get(success.run_id)
            self.assertEqual(finished["status"], "succeeded")
            self.assertTrue((Path(finished["artifactDir"]) / "artifact.txt").is_file())

            failed = dispatcher.start(
                task_id="task-2",
                runtime={"id": "r", "kind": "model-api", "executable": "mock"},
                project={"id": "p", "path": str(root), "readOnly": False},
                prompt="fail",
                argv=make_python_argv("raise SystemExit(3)"),
                cwd=root,
            )
            self.assertTrue(dispatcher.wait(failed.run_id, timeout=5))
            self.assertEqual(run_store.get(failed.run_id)["status"], "failed")
            retried = dispatcher.retry(failed.run_id)
            self.assertNotEqual(retried.run_id, failed.run_id)
            self.assertEqual(run_store.get(retried.run_id)["retryOf"], failed.run_id)
            dispatcher.shutdown()

    def test_dispatcher_parallel_directories_and_cancel(self) -> None:
        with TemporaryDirectory() as first, TemporaryDirectory() as second:
            store = TaskRunStore(Path(first) / "runs.json")
            dispatcher = TaskDispatcher(store)
            runs = []
            for index, directory in enumerate((first, second)):
                runs.append(
                    dispatcher.start(
                        task_id=f"task-{index}",
                        runtime={"id": "r", "kind": "model-api", "executable": "mock"},
                        project={"id": f"p-{index}", "path": directory, "readOnly": False},
                        prompt="parallel",
                        argv=make_python_argv(
                            "from pathlib import Path; import time; "
                            "Path('cwd.txt').write_text(str(Path.cwd())); time.sleep(0.2)"
                        ),
                        cwd=Path(directory),
                    )
                )
            for run in runs:
                self.assertTrue(dispatcher.wait(run.run_id, timeout=5))
            records = [store.get(run.run_id) for run in runs]
            self.assertEqual({record["cwd"] for record in records}, {str(Path(first).resolve()), str(Path(second).resolve())})
            dispatcher.shutdown()

    def test_store_recovery_marks_incomplete_as_interrupted(self) -> None:
        with TemporaryDirectory() as directory:
            path = Path(directory) / "runs.json"
            path.write_text(json.dumps({"runs": [{"runId": "r1", "status": "running"}]}), encoding="utf-8")
            store = TaskRunStore(path)
            self.assertEqual(store.get("r1")["status"], "interrupted")


if __name__ == "__main__":
    unittest.main()
