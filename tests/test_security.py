"""BB-W02 acceptance tests, frozen against B01 and w02.json before implementation."""
from __future__ import annotations

import json
import os
import random
import subprocess
import threading
from copy import deepcopy
import unittest
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch

from support import connection, running_server, temporary_store


class SecurityTests(unittest.TestCase):
    def setUp(self):
        self.store, self.path = self.enterContext(temporary_store())
        self.server = self.enterContext(running_server(self.store))

    def request(self, path, body=None, *, method="POST", raw=None, headers=None):
        with connection(self.server) as conn:
            payload = raw if raw is not None else json.dumps(body or {}) if method == "POST" else None
            conn.request(method, path, payload,
                         headers or {"Content-Type": "application/json"})
            response = conn.getresponse()
            return response.status, response.read(), response.getheader("Content-Type", "")

    def rejected(self, path, body, expected, **kwargs):
        before = self.store.snapshot()
        status, raw, content_type = self.request(path, body, **kwargs)
        self.assertEqual(status, expected, raw)
        self.assertIn("application/json", content_type)
        self.assertIsInstance(json.loads(raw)["error"]["code"], str)
        self.assertEqual(before, self.store.snapshot())

    def test_bb_01_static_traversal(self):
        for path in ("/docs/../run.py", "/docs/%2e%2e/run.py",
                     "/docs/..%5crun.py", "/docs/%2e%2e/themeteam/core/workspace_state.json",
                     "/docs/C:%5cWindows%5cwin.ini", "/docs/%252e%252e/run.py"):
            with self.subTest(path=path):
                status, raw, _ = self.request(path, method="GET")
                self.assertEqual(status, 404, raw)
        self.assertEqual(self.request("/docs/first-batch.md", method="GET")[0], 200)

    def test_bb_01_static_content_policy(self):
        from themeteam.web import server as module
        root = self.path.parent / "docs"
        root.mkdir()
        (root / "active.html").write_text('<script>alert(1)</script>', encoding="utf-8")
        (root / "drawing.svg").write_text('<svg onload="alert(1)"/>', encoding="utf-8")
        with patch.object(module, "DOCS_DIR", root):
            self.assertEqual(self.request("/docs/active.html", method="GET")[0], 404)
            with connection(self.server) as conn:
                conn.request("GET", "/docs/drawing.svg")
                response = conn.getresponse()
                self.assertEqual(response.status, 200)
                self.assertEqual(response.getheader("Content-Disposition"), "attachment")
                self.assertEqual(response.getheader("X-Content-Type-Options"), "nosniff")
                self.assertTrue(response.getheader("Content-Type").startswith("text/plain"))
                response.read()

    def test_bb_01_symlink_escape(self):
        from themeteam.web import server as module
        root = self.path.parent / "docs"
        root.mkdir()
        outside_dir = self.path.parent / "outside"
        outside_dir.mkdir()
        outside = outside_dir / "sentinel.txt"
        outside.write_text("outside sentinel", encoding="utf-8")
        link = root / "link"
        try:
            link.symlink_to(outside_dir, target_is_directory=True)
        except OSError:
            result = subprocess.run(["powershell.exe", "-NoProfile", "-Command",
                "New-Item -ItemType Junction -Path $env:TT_TEST_LINK -Target $env:TT_TEST_TARGET | Out-Null"],
                env={**os.environ, "TT_TEST_LINK": str(link), "TT_TEST_TARGET": str(outside_dir)},
                capture_output=True, timeout=15)
            self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(link.resolve(), outside_dir.resolve())
        with patch.object(module, "DOCS_DIR", root):
            status, raw, _ = self.request("/docs/link/sentinel.txt", method="GET")
            self.assertEqual(status, 404)
            self.assertNotIn(b"outside sentinel", raw)

    def test_bb_03_malformed_json(self):
        for raw in (b"{", b"[]", b"null", b"42", b'"text"', b'\xff',
                    b'{"title":NaN}', b'{"title":"a","title":"b"}'):
            with self.subTest(raw=raw):
                self.rejected("/api/tasks", {}, 400, raw=raw)
        self.rejected("/api/tasks", {}, 400, raw=b'{"title":"\\ud800"}')

    def test_bb_03_types_limits_and_required(self):
        cases = [("/api/tasks", {"title": []}), ("/api/tasks", {"assigneeIds": "agent_pm"}),
                 ("/api/tasks", {"title": "x" * 513}), ("/api/tasks", {"extra": True}),
                 ("/api/meetings", {"roundsLimit": True}), ("/api/meetings", {"roundsLimit": 101}),
                 ("/api/memory", {"confidence": 2}), ("/api/agents", {"leaderFlag": "false"}),
                 ("/api/agents/agent_pm/move", {}), ("/api/tasks/task_canvas/status", {})]
        for path, body in cases:
            with self.subTest(path=path, body=body):
                self.rejected(path, body, 400)
        self.rejected("/api/tasks", {}, 413, raw=b" " * 1048577)

    def test_bb_04_references_and_enums(self):
        cases = [("/api/tasks", {"status": "running"}, 400),
                 ("/api/tasks/task_canvas/status", {"status": "bad"}, 400),
                 ("/api/agents/agent_pm/move", {"roomId": "missing"}, 404),
                 ("/api/agents/agent_pm/move", {"roomId": "room_b1"}, 409),
                 ("/api/agents", {"seatId": "room_b1"}, 409),
                 ("/api/agents", {"modelProfileId": "missing"}, 404),
                 ("/api/tasks", {"assigneeIds": ["missing"]}, 404),
                 ("/api/meetings", {"participants": ["missing"]}, 404),
                 ("/api/documents", {"linkedTaskIds": ["missing"]}, 404),
                 ("/api/memory", {"linkedDocs": ["missing"]}, 404),
                 ("/api/select", {"kind": "team", "id": "missing"}, 404)]
        for path, body, status in cases:
            with self.subTest(path=path, body=body):
                self.rejected(path, body, status)

    def test_bb_05_approval_not_forgeable(self):
        self.rejected("/api/memory", {"text": "candidate", "approvedByHuman": True}, 403)
        status, raw, _ = self.request("/api/memory", {"text": "candidate"})
        self.assertEqual(status, 201)
        self.assertFalse(json.loads(raw)["memoryItems"][0]["approvedByHuman"])

    def test_bb_06_archive_replay_and_conflict(self):
        self.request("/api/meetings", {"title": "archive fixture"})
        meeting_id = self.store.snapshot()["meetings"][0]["id"]
        path = f"/api/meetings/{meeting_id}/close"
        self.assertEqual(self.request(path, {"summary": "once"})[0], 200)
        once = self.store.snapshot()
        self.assertEqual(self.request(path, {"summary": "once"})[0], 200)
        self.assertEqual(once, self.store.snapshot())
        doc = next(d for d in once["documents"] if d["sourceRef"] == meeting_id)
        self.assertIn(doc["id"], once["meetings"][0]["linkedDocIds"])
        self.assertIn(meeting_id, doc["linkedMeetingIds"])
        self.assertFalse(once["memoryItems"][0]["approvedByHuman"])
        self.rejected(path, {"summary": "changed"}, 409)

    def test_bb_06_concurrent_archive(self):
        self.request("/api/meetings", {"title": "concurrent fixture"})
        before = self.store.snapshot()
        path = f'/api/meetings/{before["meetings"][0]["id"]}/close'
        with ThreadPoolExecutor(max_workers=4) as pool:
            statuses = list(pool.map(lambda _: self.request(path, {"summary": "same"})[0], range(8)))
        self.assertEqual(statuses, [200] * 8)
        after = self.store.snapshot()
        self.assertEqual(len(after["documents"]), len(before["documents"]) + 1)
        self.assertEqual(len(after["memoryItems"]), len(before["memoryItems"]) + 1)

    def test_bb_07_round_trip(self):
        self.request("/api/tasks", {"title": "round trip"})
        self.assertEqual(self.request("/api/save")[0], 200)
        saved = self.store.snapshot()
        self.request("/api/tasks", {"title": "not saved"})
        self.assertEqual(self.request("/api/reload")[0], 200)
        self.assertEqual(self.store.snapshot()["tasks"], saved["tasks"])

    def test_wb_01_atomic_save_failure(self):
        self.store.save()
        old_bytes = self.path.read_bytes()
        self.store.create_task({"title": "unsaved"})
        before = self.store.snapshot()
        with patch("os.replace", side_effect=OSError("injected failure")):
            self.rejected("/api/save", {}, 500)
        self.assertEqual(self.path.read_bytes(), old_bytes)
        self.assertEqual(self.store.snapshot(), before)
        self.assertEqual(list(self.path.parent.iterdir()), [self.path])

    def test_bb_08_failed_reload(self):
        # Fault fixture is a test-owned file, never the default workspace.
        self.path.write_text("{broken", encoding="utf-8")
        self.rejected("/api/reload", {}, 500)
        self.path.write_text("{}", encoding="utf-8")
        self.rejected("/api/reload", {}, 500)
        data = self.store.snapshot()
        data["selection"] = {"unexpected": "x"}
        self.path.write_text(json.dumps(data), encoding="utf-8")
        self.rejected("/api/reload", {}, 500)
        data = self.store.snapshot()
        data["agents"][0]["name"] = {"invalid": "shape"}
        self.path.write_text(json.dumps(data), encoding="utf-8")
        self.rejected("/api/reload", {}, 500)

    def test_bb_10_historical_numeric_geometry_and_encoded_id(self):
        from urllib.parse import quote
        data = self.store.snapshot()
        data["rooms"][0]["x"] = 1.5
        data["tasks"][0]["id"] = "task/a b%汉"
        self.path.write_text(json.dumps(data), encoding="utf-8")
        self.assertEqual(self.request("/api/reload")[0], 200)
        self.assertEqual(self.store.snapshot()["rooms"][0]["x"], 1.5)
        url = "/api/tasks/" + quote(data["tasks"][0]["id"], safe="") + "/status"
        self.assertEqual(self.request(url, {"status": "done"})[0], 200)
        self.assertEqual(self.store.snapshot()["tasks"][0]["status"], "done")
        self.rejected("/api/tasks/task%zz/status", {"status": "done"}, 400)

    def test_bb_04_missing_reference_precedes_locked(self):
        self.rejected("/api/agents", {"seatId": "room_b1", "modelProfileId": "missing"}, 404)
        self.rejected("/api/meetings", {"roomId": "room_b1", "participants": ["missing"]}, 404)

    def test_bb_09_foreign_origin_and_host(self):
        self.rejected("/api/tasks", {"title": "cross site"}, 403,
                      headers={"Origin": "https://evil.example", "Content-Type": "application/json"})
        self.rejected("/api/tasks", {}, 403, headers={"Host": "evil.example"})
        self.rejected("/api/tasks", {}, 400, headers={"Transfer-Encoding": "chunked"})

    def test_bb_09_host_guards_reads(self):
        for method in ("GET", "HEAD"):
            for path in ("/api/state", "/", "/app.js"):
                status, raw, _ = self.request(path, method=method, headers={"Host": "evil.example"})
                self.assertEqual(status, 403)
                self.assertNotIn(b"agent_pm", raw)
        self.rejected("/api/tasks", {}, 403, headers={"Origin": "null"})
        self.rejected("/api/tasks", {}, 400, headers={"Content-Type": "text/plain"})

    def test_bb_09_loopback_only(self):
        from themeteam.web.server import create_server
        for host in ("0.0.0.0", "::1", "192.0.2.1"):
            with self.subTest(host=host), self.assertRaises(ValueError):
                unexpected = create_server(host, 0, store=self.store)
                unexpected.server_close()

    def test_bb_09_duplicate_framing_and_host(self):
        for header, value, expected in (("Host", "evil.example", 403), ("Content-Length", "2", 400)):
            before = self.store.snapshot()
            with connection(self.server) as conn:
                conn.putrequest("POST", "/api/tasks")
                conn.putheader("Content-Type", "application/json")
                conn.putheader("Content-Length", "2")
                conn.putheader(header, value)
                conn.endheaders(b"{}")
                response = conn.getresponse()
                self.assertEqual(response.status, expected)
                response.read()
            self.assertEqual(before, self.store.snapshot())
        raw = b'{"title":' + b'[' * 40 + b'0' + b']' * 40 + b'}'
        self.rejected("/api/tasks", {}, 400, raw=raw)

    def historical_archive(self):
        from themeteam.core.store import WorkspaceStore
        self.request("/api/meetings", {"title": "history"})
        mid = self.store.snapshot()["meetings"][0]["id"]
        self.request(f"/api/meetings/{mid}/close", {"summary": "history"})
        fixture = self.store.snapshot()
        fixture["meetings"][0]["linkedDocIds"] = []
        fixture["documents"][0]["linkedMeetingIds"] = []
        fixture["memoryItems"][0]["approvedByHuman"] = True
        self.path.write_text(json.dumps(fixture), encoding="utf-8")
        return WorkspaceStore(self.path), mid, fixture

    def test_bb_06_history_repairs_preserve_identity(self):
        store, mid, before = self.historical_archive()
        result = store.create_meeting_document_memory_bundle(mid, "history")
        self.assertEqual([d["id"] for d in result["documents"]], [d["id"] for d in before["documents"]])
        self.assertEqual([m["id"] for m in result["memoryItems"]], [m["id"] for m in before["memoryItems"]])
        self.assertTrue(result["memoryItems"][0]["approvedByHuman"])
        self.assertIn(result["documents"][0]["id"], result["meetings"][0]["linkedDocIds"])
        self.assertIn(mid, result["documents"][0]["linkedMeetingIds"])
        self.assertEqual(result, store.create_meeting_document_memory_bundle(mid, "history"))

    def test_bb_06_history_conflict_no_repair(self):
        store, mid, before = self.historical_archive()
        with self.assertRaises(ValueError):
            store.create_meeting_document_memory_bundle(mid, "changed")
        self.assertEqual(store.snapshot(), before)

    def test_bb_06_ambiguous_history_and_missing_memory(self):
        from themeteam.core.store import WorkspaceStore
        _, mid, fixture = self.historical_archive()
        duplicate = deepcopy(fixture["documents"][0])
        duplicate["id"] = "duplicate_archive"
        fixture["documents"].append(duplicate)
        self.path.write_text(json.dumps(fixture), encoding="utf-8")
        store = WorkspaceStore(self.path)
        before = store.snapshot()
        with self.assertRaises(ValueError):
            store.create_meeting_document_memory_bundle(mid, "history")
        self.assertEqual(before, store.snapshot())
        fixture["documents"].pop()
        fixture["memoryItems"].pop(0)
        self.path.write_text(json.dumps(fixture), encoding="utf-8")
        store = WorkspaceStore(self.path)
        result = store.create_meeting_document_memory_bundle(mid, "history")
        self.assertFalse(result["memoryItems"][0]["approvedByHuman"])
        self.assertEqual(len(result["documents"]), len(fixture["documents"]))

    def test_wb_07_fsync_failure(self):
        self.store.save()
        old = self.path.read_bytes()
        before = self.store.snapshot()
        with patch("os.fsync", side_effect=OSError("injected fsync")):
            with self.assertRaises(OSError):
                self.store.save()
        self.assertEqual(self.path.read_bytes(), old)
        self.assertEqual(self.store.snapshot(), before)
        self.assertEqual(list(self.path.parent.iterdir()), [self.path])

    def test_bb_07_theme_and_save_failure(self):
        self.store.save()
        before = self.store.snapshot()
        old = self.path.read_bytes()
        with patch("os.replace", side_effect=OSError("injected")):
            with self.assertRaises(OSError):
                self.store.set_theme_and_save("modern")
        self.assertEqual(self.store.snapshot(), before)
        self.assertEqual(self.path.read_bytes(), old)

    def test_bb_03_empty_reference_precedence(self):
        self.rejected("/api/tasks", {"assigneeIds": [""]}, 400)
        self.rejected("/api/agents/agent_pm/move", {"roomId": ""}, 404)

    def test_bb_10_legal_defaults_and_unicode(self):
        for path in ("/api/tasks", "/api/meetings", "/api/documents", "/api/memory", "/api/agents"):
            with self.subTest(path=path):
                self.assertEqual(self.request(path)[0], 201)
        self.assertEqual(self.request("/api/tasks", {"title": "汉" * 512})[0], 201)
        self.rejected("/api/tasks", {"title": "汉" * 513}, 400)
        self.assertEqual(self.request("/api/meetings", {"roundsLimit": 100})[0], 201)

    def test_wb_07_save_serializes_mutation(self):
        import os
        entered, release, mutated = threading.Event(), threading.Event(), threading.Event()
        real_replace = os.replace

        def slow_replace(*args):
            entered.set()
            if not release.wait(5):
                raise TimeoutError("test barrier")
            return real_replace(*args)

        def mutate():
            self.store.create_task({"title": "after save"})
            mutated.set()

        with patch("os.replace", side_effect=slow_replace), ThreadPoolExecutor(max_workers=2) as pool:
            save = pool.submit(self.store.save)
            try:
                self.assertTrue(entered.wait(2))
                change = pool.submit(mutate)
                self.assertFalse(mutated.wait(0.05))
            finally:
                release.set()
            save.result(5)
            change.result(5)
        self.assertEqual(self.store.snapshot()["tasks"][0]["title"], "after save")
        self.assertNotEqual(json.loads(self.path.read_text(encoding="utf-8"))["tasks"][0]["title"], "after save")

    def test_wb_02_seeded_invalid_command_corpus(self):
        rng = random.Random(20260909)
        invalid = [None, [], {}, True, False, 42, 1.5]
        for _ in range(40):
            self.rejected("/api/tasks", {"title": rng.choice(invalid)}, 400)


if __name__ == "__main__":
    unittest.main()
