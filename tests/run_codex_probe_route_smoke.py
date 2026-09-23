from __future__ import annotations

import json
import sys
from http.client import HTTPConnection
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from tests.support import running_server
from themeteam.core.store import WorkspaceStore


def post(connection: HTTPConnection, path: str, body: dict) -> tuple[int, dict]:
    raw = json.dumps(body).encode("utf-8")
    connection.request("POST", path, raw, {"Content-Type": "application/json"})
    response = connection.getresponse()
    payload = json.loads(response.read().decode("utf-8"))
    return response.status, payload


def main() -> int:
    storage = ROOT / "tests" / ".codex-route-smoke-state.json"
    store = WorkspaceStore(storage)
    with running_server(store) as server:
        connection = HTTPConnection(*server.server_address, timeout=120)
        try:
            status, snapshot = post(
                connection,
                "/api/project-directories",
                {
                    "name": "Codex route smoke directory",
                    "path": str(ROOT / "tests"),
                    "pathKind": "local",
                    "allowed": True,
                    "readOnly": True,
                    "temporaryCopyPolicy": "none",
                },
            )
            if status != 201:
                raise RuntimeError(snapshot)
            directory_id = snapshot["projectDirectories"][-1]["id"]
            status, snapshot = post(
                connection,
                "/api/runtime-profiles",
                {
                    "name": "Codex route smoke",
                    "kind": "codex-cli",
                    "executable": "codex",
                    "enabled": True,
                    "projectDirectoryProfileId": directory_id,
                    "approvalPolicy": "manual",
                    "timeoutSeconds": 90,
                    "capabilities": ["read-only-probe"],
                },
            )
            if status != 201:
                raise RuntimeError(snapshot)
            runtime_id = snapshot["runtimeProfiles"][-1]["id"]
            status, snapshot = post(connection, f"/api/runtime-profiles/{runtime_id}/probe", {})
            report = {
                "testId": "BB-CLI-SETTINGS-01",
                "status": "passed" if status == 200 else "failed",
                "httpStatus": status,
                "runtimeIdCreated": runtime_id,
                "directoryIdCreated": directory_id,
                "workspaceStatePersisted": storage.exists(),
                "credentialPolicy": "No API key or token is supplied, read, or persisted by this test.",
                "eventTail": snapshot.get("events", [])[:1],
            }
            print(json.dumps(report, ensure_ascii=True, indent=2))
            return 0 if report["status"] == "passed" and not report["workspaceStatePersisted"] else 1
        finally:
            connection.close()


if __name__ == "__main__":
    raise SystemExit(main())
