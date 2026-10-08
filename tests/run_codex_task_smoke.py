from __future__ import annotations

import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path
from tempfile import TemporaryDirectory

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from themeteam.core.dispatcher import TaskDispatcher, TaskRunStore


def main() -> int:
    executable = shutil.which("codex")
    evidence = ROOT / "docs" / "evidence" / "codex-task-smoke.json"
    report = {
        "testId": "BB-P4-02",
        "startedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "status": "not_run",
        "credentialPolicy": "No API key or token is supplied, read, or persisted by this test.",
        "workspacePolicy": "Only the run-specific artifact directory may be written.",
    }
    if executable is None:
        report.update({"status": "environment_unavailable", "reason": "codex executable not found"})
        evidence.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        return 2

    with TemporaryDirectory(prefix=".themeteam-codex-task-", dir=ROOT) as directory:
        project = Path(directory)
        artifact_instruction = (
            "Create exactly one file named result.txt inside the run artifact directory "
            f"{project / '.themeteam-artifacts-placeholder'}. "
            "The dispatcher will provide the actual artifact directory through the "
            "THEMETEAM_ARTIFACT_DIR environment variable; use that exact environment value. "
            "Put the text 'ThemeTeam Codex task smoke passed.' in result.txt. "
            "Do not create or modify any other file. Do not access credentials or the network."
        )
        # The dispatcher creates the actual artifact directory and supplies its path to the process.
        store = TaskRunStore(project / "runs.json")
        dispatcher = TaskDispatcher(store)
        handle = dispatcher.start(
            task_id="task_codex_smoke",
            runtime={
                "id": "runtime_codex_smoke",
                "kind": "codex-cli",
                "executable": "codex",
                "enabled": True,
                "timeoutSeconds": 90,
                "approvalPolicy": "manual",
                "capabilities": ["coding", "files"],
            },
            project={
                "id": "project_codex_smoke",
                "path": str(project),
                "readOnly": False,
            },
            prompt=artifact_instruction,
            cwd=project,
        )
        if store.get(handle.run_id)["status"] == "waiting":
            dispatcher.approve(handle.run_id)
        dispatcher.wait(handle.run_id, timeout=120)
        record = store.get(handle.run_id)
        artifact_dir = Path(record["artifactDir"])
        artifact = artifact_dir / "result.txt"
        unexpected = [
            path.relative_to(project).as_posix()
            for path in project.rglob("*")
            if path.is_file() and path.name not in {"runs.json"}
            and artifact not in {path}
        ]
        report.update(
            {
                "status": "passed" if record["status"] == "succeeded" and artifact.is_file() and not unexpected else "failed",
                "executable": executable,
                "runId": handle.run_id,
                "runStatus": record["status"],
                "exitCode": record["exitCode"],
                "cwd": record["cwd"],
                "artifactDir": record["artifactDir"],
                "artifacts": record["artifacts"],
                "artifactText": artifact.read_text(encoding="utf-8") if artifact.is_file() else None,
                "unexpectedFiles": unexpected,
                "stdout": record["stdout"],
                "stderr": record["stderr"],
            }
        )
        dispatcher.shutdown()
    report["finishedAt"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    evidence.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return 0 if report["status"] == "passed" else 1


if __name__ == "__main__":
    raise SystemExit(main())
