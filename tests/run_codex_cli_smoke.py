from __future__ import annotations

import json
import os
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from themeteam.core.agent_runtime import CodexCliAdapter, ProjectDirectoryGuard


EVIDENCE = ROOT / "docs" / "evidence" / "codex-cli-smoke.json"


def main() -> int:
    executable = shutil.which("codex")
    report = {
        "testId": "BB-CLI-02",
        "startedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "cwdRoot": str(ROOT),
        "credentialPolicy": "No API key or token is supplied, read, or persisted by this test.",
        "status": "not_run",
    }
    if executable is None:
        report.update({"status": "environment_unavailable", "reason": "codex executable not found"})
        EVIDENCE.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        return 2

    working_directory = ROOT / "tests"
    marker = working_directory / "test_agent_runtime.py"
    try:
        profile = {
            "kind": "codex-cli",
            "executable": "codex",
            "enabled": True,
            "timeoutSeconds": 90,
            "approvalPolicy": "manual",
        }
        adapter = CodexCliAdapter(profile, ProjectDirectoryGuard([ROOT]))
        prompt = (
            "Read the first line of test_agent_runtime.py in the current directory. "
            "Do not create, modify, delete, or rename any file. "
            "Do not access the network or inspect credentials. "
            "Reply with exactly one short sentence confirming the file was read."
        )
        result = adapter.run_readonly(prompt, cwd=working_directory)
        report.update(
            {
                "status": "passed" if result.status == "succeeded" and result.exit_code == 0 else "failed",
                "executable": executable,
                "argvPolicy": "argv array; shell=false; --ephemeral; --sandbox read-only",
                "workingDirectory": str(working_directory.resolve()),
                "markerExistsAfterRun": marker.is_file(),
                "result": result.to_dict(),
            }
        )
        return 0 if report["status"] == "passed" and report["markerExistsAfterRun"] else 1
    except Exception as exc:
        report.update(
            {
                "status": "failed",
                "executable": executable,
                "errorType": type(exc).__name__,
                "error": str(exc),
            }
        )
        return 1
    finally:
        report["finishedAt"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
        report["temporaryDirectoryPolicy"] = "No temporary directory or file is created by this read-only smoke."
        EVIDENCE.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())
