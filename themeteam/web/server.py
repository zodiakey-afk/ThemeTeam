from __future__ import annotations

import json
import re
import socket
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, unquote

from ..core.store import WorkspaceStore
from ..core.validation import ConflictError, ForbiddenError, validate


STATIC_DIR = Path(__file__).with_name("static")
DOCS_DIR = Path(__file__).parents[2] / "docs"
CSP = ("default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
       "img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; "
       "frame-ancestors 'none'; form-action 'self'")


class PayloadTooLarge(ValueError):
    pass


def _pairs(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate JSON key")
        result[key] = value
    return result


def _constant(value):
    raise ValueError("Nonfinite JSON")


def _route_id(path):
    segment = path.split("/")[3]
    if re.search(r"%(?![0-9a-fA-F]{2})", segment):
        raise ValueError("Malformed escaped id")
    return unquote(segment, errors="strict")


def _read_body(handler: BaseHTTPRequestHandler) -> dict:
    lengths = handler.headers.get_all("Content-Length", [])
    if handler.headers.get_all("Transfer-Encoding") or len(lengths) > 1:
        raise ValueError("Invalid framing")
    value = lengths[0] if lengths else "0"
    if not value.isascii() or not value.isdecimal():
        raise ValueError("Invalid length")
    length = int(value)
    if length > 1048576:
        raise PayloadTooLarge()
    types = handler.headers.get_all("Content-Type", [])
    if len(types) != 1 or types[0].lower().replace(" ", "") not in ("application/json", "application/json;charset=utf-8"):
        raise ValueError("JSON content type required")
    if length == 0:
        return {}
    raw = handler.rfile.read(length)
    handler.body_consumed = True
    if len(raw) != length:
        raise ValueError("Truncated body")
    body = json.loads(raw.decode("utf-8"), object_pairs_hook=_pairs, parse_constant=_constant)
    if type(body) is not dict:
        raise ValueError("Object required")
    stack = [(body, 1)]
    while stack:
        item, depth = stack.pop()
        if depth > 32:
            raise ValueError("JSON too deep")
        values = item.values() if isinstance(item, dict) else item if isinstance(item, list) else []
        stack.extend((v, depth + 1) for v in values if isinstance(v, (dict, list)))
    return body


def _send_json(handler: BaseHTTPRequestHandler, data: dict, status: int = 200) -> None:
    blob = json.dumps(data, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(blob)))
    handler.end_headers()
    if handler.command != "HEAD":
        handler.wfile.write(blob)


def _send_file(handler: BaseHTTPRequestHandler, path: Path, content_type: str) -> None:
    blob = path.read_bytes()
    handler.send_response(200)
    handler.send_header("Content-Type", content_type)
    handler.send_header("Content-Length", str(len(blob)))
    if path.suffix.lower() == ".svg":
        handler.send_header("Content-Disposition", "attachment")
    handler.end_headers()
    if handler.command != "HEAD":
        handler.wfile.write(blob)


class ThemeTeamHandler(BaseHTTPRequestHandler):
    def setup(self):
        super().setup()
        self.body_consumed = False
        self.connection.settimeout(5)

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Security-Policy", CSP)
        self.send_header("Connection", "close")
        self.close_connection = True
        super().end_headers()

    def _trusted(self):
        hosts = self.headers.get_all("Host", [])
        port = self.server.server_address[1]
        if len(hosts) != 1 or hosts[0] not in (f"127.0.0.1:{port}", f"localhost:{port}"):
            return False
        origins = self.headers.get_all("Origin", [])
        return not origins or origins == [f"http://{hosts[0]}"]

    def _error(self, status, code):
        _send_json(self, {"error": {"code": code, "message": code.replace("_", " ")}}, status)
        # Half-close before bounded discard, avoiding a TCP reset hiding the error on Windows.
        if not self.body_consumed:
            try:
                length = int(self.headers.get("Content-Length", "0"))
                remaining = min(max(length, 0), 1048577)
                if remaining:
                    self.wfile.flush()
                    self.connection.shutdown(socket.SHUT_WR)
                    self.connection.settimeout(0.25)
                    while remaining:
                        chunk = self.rfile.read1(min(65536, remaining))
                        if not chunk:
                            break
                        remaining -= len(chunk)
            except (ValueError, OSError):
                pass

    @property
    def store(self) -> WorkspaceStore:
        return self.server.store

    def do_GET(self) -> None:  # noqa: N802
        if not self._trusted():
            self._error(403, "forbidden")
            return
        parsed = urlparse(self.path)
        if parsed.path == "/api/state":
            _send_json(self, self.store.snapshot())
            return
        if parsed.path == "/api/task-runs":
            _send_json(self, self.store.task_runs())
            return
        if parsed.path.startswith("/api/task-runs/"):
            run_id = unquote(parsed.path.split("/")[-1], errors="strict")
            _send_json(self, self.store.task_run(run_id))
            return
        if parsed.path == "/":
            _send_file(self, STATIC_DIR / "index.html", "text/html; charset=utf-8")
            return
        if parsed.path == "/styles.css":
            _send_file(self, STATIC_DIR / "styles.css", "text/css; charset=utf-8")
            return
        if parsed.path == "/app.js":
            _send_file(self, STATIC_DIR / "app.js", "application/javascript; charset=utf-8")
            return
        if parsed.path.startswith("/docs/"):
            try:
                relative = unquote(parsed.path[len("/docs/"):])
                if "\x00" in relative:
                    raise ValueError("NUL path")
                candidate = (DOCS_DIR / relative).resolve()
                candidate.relative_to(DOCS_DIR.resolve())
                types = {".md": "text/plain; charset=utf-8", ".txt": "text/plain; charset=utf-8",
                         ".svg": "text/plain; charset=utf-8", ".png": "image/png",
                         ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp"}
                content_type = types.get(candidate.suffix.lower())
                if content_type and candidate.is_file():
                    _send_file(self, candidate, content_type)
                    return
            except (ValueError, OSError):
                pass
        self._error(404, "not_found")

    def do_HEAD(self) -> None:  # noqa: N802
        self.do_GET()

    def do_POST(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        try:
            if not self._trusted():
                self._error(403, "forbidden")
                return
            body = _read_body(self)
            if parsed.path == "/api/theme":
                validate(body, "theme")
                _send_json(self, self.store.set_theme(body.get("themeMode", "retro")))
                return
            if parsed.path == "/api/agents":
                _send_json(self, self.store.create_agent(body), status=201)
                return
            if parsed.path == "/api/runtime-profiles":
                _send_json(self, self.store.create_runtime_profile(body), status=201)
                return
            if parsed.path == "/api/project-directories":
                _send_json(self, self.store.create_project_directory(body), status=201)
                return
            if parsed.path.startswith("/api/runtime-profiles/") and parsed.path.endswith("/probe") and len(parsed.path.split("/")) == 5:
                validate(body, "empty")
                runtime_id = _route_id(parsed.path)
                _send_json(self, self.store.probe_runtime(runtime_id))
                return
            if parsed.path == "/api/runtime/mock-project":
                _send_json(self, self.store.run_mock_project(body), status=201)
                return
            if parsed.path == "/api/task-runs":
                _send_json(self, self.store.run_task(body), status=202)
                return
            if parsed.path == "/api/task-runs/cancel":
                validate(body, "runControl")
                _send_json(self, self.store.cancel_task_run(body["runId"]))
                return
            if parsed.path == "/api/task-runs/retry":
                validate(body, "runControl")
                _send_json(self, self.store.retry_task_run(body["runId"]), status=202)
                return
            if parsed.path == "/api/tasks":
                _send_json(self, self.store.create_task(body), status=201)
                return
            if parsed.path == "/api/meetings":
                _send_json(self, self.store.create_meeting(body), status=201)
                return
            if parsed.path == "/api/documents":
                _send_json(self, self.store.create_document(body), status=201)
                return
            if parsed.path == "/api/memory":
                _send_json(self, self.store.create_memory(body), status=201)
                return
            if parsed.path == "/api/office/expand":
                _send_json(self, self.store.expand_office(body))
                return
            if parsed.path == "/api/save":
                validate(body, "empty")
                try:
                    result = self.store.save()
                except (OSError, ValueError, TypeError):
                    self._error(500, "storage_error")
                    return
                _send_json(self, result)
                return
            if parsed.path == "/api/reload":
                validate(body, "empty")
                try:
                    result = self.store.reload()
                except (OSError, ValueError, TypeError, KeyError, AttributeError, RecursionError, OverflowError):
                    self._error(500, "storage_error")
                    return
                _send_json(self, result)
                return
            if parsed.path == "/api/select":
                validate(body, "select")
                _send_json(self, self.store.select(body.get("kind", "workspace"), body.get("id", "workspace")))
                return
            if parsed.path.startswith("/api/agents/") and parsed.path.endswith("/move") and len(parsed.path.split("/")) == 5:
                validate(body, "move", ("roomId",))
                agent_id = _route_id(parsed.path)
                _send_json(self, self.store.move_agent(agent_id, body["roomId"]))
                return
            if parsed.path.startswith("/api/tasks/") and parsed.path.endswith("/status") and len(parsed.path.split("/")) == 5:
                validate(body, "status", ("status",))
                task_id = _route_id(parsed.path)
                _send_json(self, self.store.update_task_status(task_id, body["status"]))
                return
            if parsed.path.startswith("/api/meetings/") and parsed.path.endswith("/close") and len(parsed.path.split("/")) == 5:
                validate(body, "close")
                meeting_id = _route_id(parsed.path)
                _send_json(self, self.store.create_meeting_document_memory_bundle(meeting_id, body.get("summary", "")))
                return
            if parsed.path.startswith("/api/rooms/") and parsed.path.endswith("/unlock") and len(parsed.path.split("/")) == 5:
                validate(body, "empty")
                room_id = _route_id(parsed.path)
                _send_json(self, self.store.unlock_room(room_id))
                return
        except KeyError:
            self._error(404, "not_found")
            return
        except ForbiddenError:
            self._error(403, "forbidden")
            return
        except ConflictError:
            self._error(409, "conflict")
            return
        except PayloadTooLarge:
            self._error(413, "payload_too_large")
            return
        except (ValueError, TypeError, RecursionError, TimeoutError):
            self._error(400, "invalid_payload")
            return
        self._error(404, "not_found")

    def log_message(self, fmt: str, *args) -> None:
        return


class ThemeTeamServer(ThreadingHTTPServer):
    allow_reuse_address = False
    allow_reuse_port = False

    def __init__(self, address: tuple[str, int], store: WorkspaceStore) -> None:
        self.store = store
        super().__init__(address, ThemeTeamHandler)


def create_server(
    host: str = "127.0.0.1", port: int = 8000, *, store: WorkspaceStore | None = None
) -> ThemeTeamServer:
    if host not in ("127.0.0.1", "localhost"):
        raise ValueError("Only IPv4 loopback binding is supported")
    return ThemeTeamServer((host, port), WorkspaceStore() if store is None else store)
