from __future__ import annotations

import json
import subprocess
import sys
import threading
import unittest
from pathlib import Path
from unittest.mock import patch

from support import connection, running_server, temporary_store
from themeteam.core.store import WorkspaceStore


class IsolationTests(unittest.TestCase):
    def request(self, server, method, path, body=None):
        with connection(server) as conn:
            conn.request(method, path, json.dumps(body) if body is not None else None,
                         {"Content-Type": "application/json"})
            response = conn.getresponse()
            self.assertIn(response.status, (200, 201))
            return json.loads(response.read())

    def test_bb_two_servers_are_independent(self):
        with temporary_store() as (a, path_a), temporary_store() as (b, path_b):
            with running_server(b) as server_b:
                original = self.request(server_b, "GET", "/api/state")
                with running_server(a) as server_a:
                    self.request(server_a, "POST", "/api/theme", {"themeMode": "modern"})
                    self.request(server_a, "POST", "/api/tasks", {"title": "A only"})
                    self.request(server_a, "POST", "/api/save", {})
                    self.assertTrue(path_a.is_file())
                    self.assertFalse(path_b.exists())
                    self.assertEqual(self.request(server_b, "GET", "/api/state"), original)
                self.assertEqual(self.request(server_b, "GET", "/api/state"), original)

    def test_bb_explicit_reload_does_not_change_other_store(self):
        with temporary_store() as (a, path_a), temporary_store() as (b, _):
            original = b.snapshot()
            a.set_theme("modern")
            a.save()
            self.assertEqual(WorkspaceStore(path_a).snapshot()["themeMode"], "modern")
            self.assertEqual(b.snapshot(), original)

    def test_bb_import_has_no_workspace_or_socket_side_effect(self):
        script = """
import os, sys, threading
def audit(event, args):
    if event == 'open' and isinstance(args[0], (str, bytes, os.PathLike)):
        if os.fsdecode(args[0]).replace('\\\\', '/').endswith('/core/workspace_state.json'):
            raise AssertionError('Default workspace accessed during import')
    if event == 'socket.bind':
        raise AssertionError('Socket bound during import')
sys.addaudithook(audit)
before = set(threading.enumerate())
import themeteam.web.server
assert set(threading.enumerate()) == before
"""
        result = subprocess.run([sys.executable, "-B", "-c", script],
                                cwd=Path(__file__).resolve().parents[1],
                                capture_output=True, text=True, timeout=15)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_bb_bind_failure_preserves_first_server(self):
        from themeteam.web.server import create_server
        with temporary_store() as (a, _), temporary_store() as (b, _):
            with running_server(a) as first:
                with self.assertRaises(OSError):
                    unexpected = create_server(*first.server_address, store=b)
                    unexpected.server_close()
                self.assertEqual(self.request(first, "GET", "/api/state")["themeMode"], "retro")

    def test_wb_default_is_lazy_and_explicit_store_is_used(self):
        from themeteam.web import server as module
        with temporary_store() as (store, _):
            with patch.object(module, "WorkspaceStore", return_value=store) as factory:
                server = module.create_server("127.0.0.1", 0)
                try:
                    factory.assert_called_once_with()
                    self.assertIs(server.store, store)
                finally:
                    server.server_close()
            with patch.object(module, "WorkspaceStore", side_effect=AssertionError("Unexpected default")):
                with running_server(store) as server:
                    self.assertEqual(self.request(server, "GET", "/api/state"), store.snapshot())

    def test_wb_cleanup_on_assertion_failure(self):
        before = set(threading.enumerate())
        path = None
        with self.assertRaisesRegex(AssertionError, "intentional"):
            with temporary_store() as (store, path):
                with running_server(store) as server:
                    self.request(server, "POST", "/api/save", {})
                    raise AssertionError("intentional")
        self.assertFalse(path.parent.exists())
        self.assertEqual(set(threading.enumerate()), before)

    def test_wb_cleanup_on_thread_start_failure(self):
        from themeteam.web import server as module
        created = []
        original = module.create_server

        def capture(*args, **kwargs):
            server = original(*args, **kwargs)
            created.append(server)
            return server

        with temporary_store() as (store, path):
            with patch.object(module, "create_server", side_effect=capture):
                with patch.object(threading.Thread, "start", side_effect=RuntimeError("start failed")):
                    with self.assertRaisesRegex(RuntimeError, "start failed"):
                        with running_server(store):
                            self.fail("Should not yield")
            self.assertEqual(created[0].socket.fileno(), -1)
        self.assertFalse(path.parent.exists())

    def test_wb_cleanup_on_thread_constructor_failure(self):
        from themeteam.web import server as module
        created = []
        original = module.create_server

        def capture(*args, **kwargs):
            server = original(*args, **kwargs)
            created.append(server)
            return server

        with temporary_store() as (store, path):
            with patch.object(module, "create_server", side_effect=capture):
                with patch("support.threading.Thread", side_effect=MemoryError("constructor failed")):
                    with self.assertRaisesRegex(MemoryError, "constructor failed"):
                        with running_server(store):
                            self.fail("Should not yield")
            self.assertEqual(created[0].socket.fileno(), -1)
        self.assertFalse(path.parent.exists())
