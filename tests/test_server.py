from __future__ import annotations

import json
import unittest
from http.client import HTTPConnection

from support import running_server, temporary_store


class ServerTests(unittest.TestCase):
    def setUp(self) -> None:
        self.store, self.storage_path = self.enterContext(temporary_store())
        self.server = self.enterContext(running_server(self.store))
        self.port = self.server.server_address[1]

    def test_index_and_state_endpoints(self) -> None:
        conn = HTTPConnection("127.0.0.1", self.port, timeout=5)
        self.addCleanup(conn.close)
        conn.request("GET", "/")
        response = conn.getresponse()
        self.assertEqual(response.status, 200)
        body = response.read().decode("utf-8")
        self.assertIn("Agent Office", body)

        conn.request("GET", "/api/state")
        response = conn.getresponse()
        payload = json.loads(response.read().decode("utf-8"))
        self.assertEqual(payload["themeMode"], "retro")
        self.assertIn("agents", payload)

    def test_theme_switch_endpoint(self) -> None:
        conn = HTTPConnection("127.0.0.1", self.port, timeout=5)
        self.addCleanup(conn.close)
        conn.request("POST", "/api/theme", body=json.dumps({"themeMode": "modern"}), headers={"Content-Type": "application/json"})
        response = conn.getresponse()
        payload = json.loads(response.read().decode("utf-8"))
        self.assertEqual(response.status, 200)
        self.assertEqual(payload["themeMode"], "modern")

    def test_phase_endpoints(self) -> None:
        conn = HTTPConnection("127.0.0.1", self.port, timeout=5)
        self.addCleanup(conn.close)
        conn.request("POST", "/api/meetings", body=json.dumps({"title": "评审会", "participants": ["agent_pm"]}), headers={"Content-Type": "application/json"})
        response = conn.getresponse()
        meeting_payload = json.loads(response.read().decode("utf-8"))
        self.assertEqual(response.status, 201)
        meeting_id = next(item["id"] for item in meeting_payload["meetings"] if item["title"] == "评审会")

        conn.request("POST", f"/api/meetings/{meeting_id}/close", body=json.dumps({"summary": "已收束。"}), headers={"Content-Type": "application/json"})
        response = conn.getresponse()
        closed_payload = json.loads(response.read().decode("utf-8"))
        self.assertTrue(any(doc["content"] == "已收束。" for doc in closed_payload["documents"]))
        self.assertTrue(any(mem["text"] == "已收束。" for mem in closed_payload["memoryItems"]))

        conn.request("POST", "/api/rooms/room_b1/unlock", body=b"{}", headers={"Content-Type": "application/json"})
        response = conn.getresponse()
        unlock_payload = json.loads(response.read().decode("utf-8"))
        self.assertTrue(any(room["id"] == "room_b1" and room["unlocked"] for room in unlock_payload["rooms"]))

        conn.request("POST", "/api/save", body=b"{}", headers={"Content-Type": "application/json"})
        response = conn.getresponse()
        saved_payload = json.loads(response.read().decode("utf-8"))
        self.assertIsNotNone(saved_payload["lastSavedAt"])

    def test_runtime_probe_route_is_restricted_to_registered_profile(self) -> None:
        conn = HTTPConnection("127.0.0.1", self.port, timeout=5)
        self.addCleanup(conn.close)
        conn.request("POST", "/api/runtime-profiles/runtime_mock/probe", body=b"{}", headers={"Content-Type": "application/json"})
        response = conn.getresponse()
        payload = json.loads(response.read().decode("utf-8"))
        self.assertEqual(response.status, 409)
        self.assertEqual(payload["error"]["code"], "conflict")

    def test_task_run_routes_return_structured_run_record(self) -> None:
        conn = HTTPConnection("127.0.0.1", self.port, timeout=10)
        self.addCleanup(conn.close)
        task_id = self.store.snapshot()["tasks"][0]["id"]
        directory = self.store.create_project_directory({
            "name": "Temporary task run directory",
            "path": str(self.storage_path.parent),
            "pathKind": "local",
            "allowed": True,
            "readOnly": False,
            "temporaryCopyPolicy": "none",
        })["projectDirectories"][-1]
        runtime = self.store.create_runtime_profile({
            "name": "Temporary mock task runtime",
            "kind": "model-api",
            "executable": "mock",
            "enabled": True,
            "projectDirectoryProfileId": directory["id"],
            "approvalPolicy": "manual",
            "timeoutSeconds": 30,
            "capabilities": ["test"],
        })["runtimeProfiles"][-1]
        body = {
            "taskId": task_id,
            "runtimeProfileId": runtime["id"],
            "projectDirectoryProfileId": directory["id"],
            "prompt": "test run",
        }
        conn.request("POST", "/api/task-runs", body=json.dumps(body), headers={"Content-Type": "application/json"})
        response = conn.getresponse()
        payload = json.loads(response.read().decode("utf-8"))
        self.assertEqual(response.status, 202)
        self.assertIn("run", payload)


if __name__ == "__main__":
    unittest.main()
