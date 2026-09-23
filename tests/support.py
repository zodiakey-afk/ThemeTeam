from __future__ import annotations

import threading
from contextlib import contextmanager
from http.client import HTTPConnection
from pathlib import Path
from tempfile import TemporaryDirectory

from themeteam.core.store import WorkspaceStore


@contextmanager
def temporary_store():
    with TemporaryDirectory(prefix="themeteam-test-") as directory:
        path = Path(directory) / "state.json"
        yield WorkspaceStore(path), path


@contextmanager
def running_server(store):
    from themeteam.web.server import create_server

    server = create_server("127.0.0.1", 0, store=store)
    started = False
    try:
        thread = threading.Thread(
            target=lambda: server.serve_forever(poll_interval=0.01),
            name="themeteam-test-server",
        )
        thread.start()
        started = True
        yield server
    finally:
        try:
            if started:
                server.shutdown()
        finally:
            close = getattr(store, "close", None)
            if close is not None:
                close()
            server.server_close()
            if started:
                thread.join(timeout=5)
                if thread.is_alive():
                    raise RuntimeError("Test server thread did not stop")


@contextmanager
def connection(server):
    conn = HTTPConnection(*server.server_address, timeout=5)
    try:
        yield conn
    finally:
        conn.close()
