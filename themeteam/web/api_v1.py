from __future__ import annotations

import asyncio
import json
import re
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse

from ..core.m2_service import M2Service
from ..core.sqlite_store import SqliteWorkspace, migrate_json_to_sqlite, now_iso
from ..core.agent_runtime import RuntimeRejected
from ..core.validation import ConflictError, ForbiddenError


def _error(code: str, message: str, correlation_id: str = "unknown", status: int = 400):
    return JSONResponse(
        status_code=status,
        content={"error": {"code": code, "message": message, "correlationId": correlation_id}},
    )


def _envelope(body: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    if not isinstance(body, dict):
        raise ValueError("object required")
    envelope = {
        "commandId": body.get("commandId"),
        "idempotencyKey": body.get("idempotencyKey"),
        "correlationId": body.get("correlationId"),
        "expectedVersion": body.get("expectedVersion"),
    }
    if not all(isinstance(envelope[key], str) and envelope[key] for key in ("commandId", "idempotencyKey", "correlationId")):
        raise ValueError("command envelope required")
    payload = body.get("payload", body)
    if "payload" in body and not isinstance(payload, dict):
        raise ValueError("payload must be object")
    return envelope, dict(payload)


def _validate_text(payload: dict[str, Any], field: str, max_length: int = 65536) -> str:
    value = payload.get(field)
    if not isinstance(value, str) or not value or len(value) > max_length:
        raise ValueError(f"{field} invalid")
    return value


def create_m2_app(service: M2Service) -> FastAPI:
    app = FastAPI(title="ThemeTeam M2 API", version="1.0")
    MAX_BODY = 1_048_576

    @app.middleware("http")
    async def loopback_boundary(request: Request, call_next):
        hosts = request.headers.getlist("host")
        host = hosts[0] if len(hosts) == 1 else ""
        if not re.fullmatch(r"(127\.0\.0\.1|localhost)(:\d+)?", host):
            return _error("forbidden", "local host required", status=403)
        origin = request.headers.get("origin")
        if origin and origin not in (f"http://{host}", f"https://{host}"):
            return _error("forbidden", "local origin required", status=403)
        lengths = request.headers.getlist("content-length")
        if len(lengths) > 1:
            return _error("invalid_payload", "duplicate content length", status=400)
        length = lengths[0] if lengths else None
        if length is not None and (not length.isdecimal() or int(length) > MAX_BODY):
            return _error("payload_too_large", "request body too large", status=413)
        if request.headers.get("transfer-encoding"):
            return _error("invalid_payload", "chunked framing is not supported", status=400)
        if request.method in {"POST", "PUT", "PATCH"}:
            content_types = request.headers.getlist("content-type")
            if len(content_types) != 1 or content_types[0].lower().replace(" ", "") not in (
                "application/json",
                "application/json;charset=utf-8",
            ):
                return _error("invalid_payload", "JSON content type required", status=400)
        if request.method in {"POST", "PUT", "PATCH"}:
            chunks: list[bytes] = []
            total = 0
            async for chunk in request.stream():
                total += len(chunk)
                if total > MAX_BODY:
                    return _error("payload_too_large", "request body too large", status=413)
                chunks.append(chunk)
            raw = b"".join(chunks)
            async def receive():
                return {"type": "http.request", "body": raw, "more_body": False}
            request._body = raw
            request._receive = receive
        return await call_next(request)

    @app.exception_handler(KeyError)
    async def missing(_request: Request, exc: KeyError):
        return _error("not_found", str(exc), status=404)

    @app.exception_handler(ValueError)
    async def invalid(_request: Request, exc: ValueError):
        return _error("invalid_payload", str(exc), status=400)

    @app.exception_handler(ConflictError)
    async def conflict(_request: Request, exc: ConflictError):
        return _error("conflict", str(exc), status=409)

    @app.exception_handler(RuntimeRejected)
    async def runtime_rejected(_request: Request, exc: RuntimeRejected):
        return _error("runtime_unavailable", str(exc), status=503)

    @app.exception_handler(ForbiddenError)
    async def forbidden(_request: Request, exc: ForbiddenError):
        return _error("forbidden", str(exc), status=403)

    @app.get("/api/v1/workspaces/{workspace_id}/snapshot")
    async def snapshot(workspace_id: str):
        if workspace_id != "workspace_main":
            raise KeyError(workspace_id)
        return service.snapshot_bundle()

    @app.get("/api/v1/agents")
    async def agents():
        return {"agents": service.snapshot()["agents"], "version": service.cursor()}

    @app.get("/api/v1/model-profiles")
    async def model_profiles():
        return {"modelProfiles": service.snapshot()["modelProfiles"], "version": service.cursor()}

    @app.get("/api/v1/runs")
    async def runs(taskId: str | None = None):
        return service.list_runs(taskId)

    @app.get("/api/v1/approvals")
    async def approvals(status: str | None = None, runId: str | None = None):
        values = service.list_runs()
        result = []
        for run in values["runs"]:
            approval_status = run.get("approvalStatus")
            if approval_status is None:
                continue
            if status is not None and approval_status != status:
                continue
            if runId is not None and run["runId"] != runId:
                continue
            result.append({
                "id": f"approval:{run['runId']}",
                "runId": run["runId"],
                "action": "execute",
                "status": approval_status,
                "decidedAt": run.get("approvedAt") or run.get("finishedAt"),
                "decidedBy": "actor_owner" if approval_status != "pending" else None,
                "reason": run.get("rejectionReason"),
                "version": 1,
            })
        return {"approvals": result}

    @app.get("/api/v1/documents")
    async def documents(sourceRef: str | None = None, taskId: str | None = None):
        return service.list_documents(sourceRef, taskId)

    @app.get("/api/v1/artifacts/{run_id}")
    async def artifacts(run_id: str):
        return service.list_artifacts(run_id)

    @app.get("/api/v1/audit")
    async def audit(correlationId: str | None = None):
        query = "SELECT id, workspace_id, actor_id, correlation_id, type, payload_json, occurred_at FROM audit_events"
        args: tuple[Any, ...] = ()
        if correlationId:
            query += " WHERE correlation_id=?"
            args = (correlationId,)
        query += " ORDER BY occurred_at"
        rows = service.workspace.connection.execute(query, args).fetchall()
        return {
            "events": [
                {
                    "id": row["id"],
                    "workspaceId": row["workspace_id"],
                    "actorId": row["actor_id"],
                    "correlationId": row["correlation_id"],
                    "type": row["type"],
                    "payload": json.loads(row["payload_json"]),
                    "occurredAt": row["occurred_at"],
                }
                for row in rows
            ],
            "cursor": service.cursor(),
        }

    @app.post("/api/v1/tasks")
    async def create_task(request: Request):
        service.authorize("write")
        envelope, payload = _envelope(await request.json())
        _validate_text(payload, "title", 512)
        payload.setdefault("description", "")
        payload.setdefault("priority", "medium")
        payload.setdefault("assigneeIds", [])
        return service.create_task(payload, envelope)

    @app.post("/api/v1/agents")
    async def create_agent(request: Request):
        service.authorize("write")
        envelope, payload = _envelope(await request.json())
        for field in ("name", "modelProfileId"):
            _validate_text(payload, field, 512)
        if payload.get("runtimeProfileId") is not None:
            _validate_text(payload, "runtimeProfileId", 512)
        if payload.get("projectDirectoryProfileId") is not None:
            _validate_text(payload, "projectDirectoryProfileId", 512)
        if payload.get("seatId") is not None:
            _validate_text(payload, "seatId", 512)
        return service.create_agent(payload, envelope)

    @app.post("/api/v1/model-profiles")
    async def create_model_profile(request: Request):
        service.authorize("write")
        envelope, payload = _envelope(await request.json())
        for field in ("name", "provider", "modelName"):
            _validate_text(payload, field, 512)
        context_window = payload.get("contextWindow", 0)
        if type(context_window) is not int or context_window < 0:
            raise ValueError("contextWindow invalid")
        return service.create_model_profile(payload, envelope)

    @app.post("/api/v1/runtime-profiles")
    async def create_runtime_profile(request: Request):
        service.authorize("write")
        envelope, payload = _envelope(await request.json())
        for field in ("name", "kind", "executable"):
            _validate_text(payload, field, 512)
        if payload["kind"] not in {"model-api", "codex-cli", "claude-cli", "opencode-cli"}:
            raise ValueError("kind invalid")
        approval_policy = payload.get("approvalPolicy", "manual")
        if approval_policy not in {"manual", "automatic"}:
            raise ValueError("approvalPolicy invalid")
        timeout_seconds = payload.get("timeoutSeconds", 300)
        if type(timeout_seconds) is not int or not 30 <= timeout_seconds <= 86400:
            raise ValueError("timeoutSeconds invalid")
        capabilities = payload.get("capabilities", [])
        if (
            type(capabilities) is not list
            or len(capabilities) > 64
            or any(type(item) is not str or not item or len(item) > 128 for item in capabilities)
        ):
            raise ValueError("capabilities invalid")
        return service.create_runtime_profile(payload, envelope)

    @app.post("/api/v1/project-directories")
    async def create_project_directory(request: Request):
        service.authorize("write")
        envelope, payload = _envelope(await request.json())
        _validate_text(payload, "name", 512)
        _validate_text(payload, "path", 4096)
        return service.create_project_directory(payload, envelope)

    @app.post("/api/v1/runs")
    async def start_run(request: Request):
        service.authorize("run")
        envelope, payload = _envelope(await request.json())
        for field in ("taskId", "runtimeProfileId", "projectDirectoryProfileId"):
            _validate_text(payload, field, 512)
        _validate_text(payload, "prompt")
        return service.start_run(payload, envelope)

    @app.post("/api/v1/runs/{run_id}/approve")
    async def approve_run(run_id: str, request: Request):
        service.authorize("approve")
        envelope, _payload = _envelope(await request.json())
        return service.approve_run(run_id, envelope)

    @app.post("/api/v1/runs/{run_id}/reject")
    async def reject_run(run_id: str, request: Request):
        service.authorize("approve")
        envelope, payload = _envelope(await request.json())
        reason = payload.get("reason", "rejected by owner")
        if not isinstance(reason, str):
            raise ValueError("reason invalid")
        return service.reject_run(run_id, reason, envelope)

    @app.post("/api/v1/runs/{run_id}/cancel")
    async def cancel_run(run_id: str, request: Request):
        service.authorize("cancel")
        envelope, _payload = _envelope(await request.json())
        return service.cancel_run(run_id, envelope)

    @app.post("/api/v1/runs/{run_id}/retry")
    async def retry_run(run_id: str, request: Request):
        service.authorize("run")
        envelope, _payload = _envelope(await request.json())
        return service.retry_run(run_id, envelope)

    @app.websocket("/api/v1/workspaces/{workspace_id}/events")
    async def events(websocket: WebSocket, workspace_id: str, lastSeenSeq: int = 0):
        if workspace_id != "workspace_main":
            await websocket.close(code=4404)
            return
        host = websocket.headers.get("host", "")
        origin = websocket.headers.get("origin")
        if not re.fullmatch(r"(127\.0\.0\.1|localhost)(:\d+)?", host) or (
            origin and origin not in (f"http://{host}", f"https://{host}")
        ):
            await websocket.close(code=4403)
            return
        await websocket.accept()
        cursor = lastSeenSeq
        try:
            first_seq = service.workspace.first_seq()
            if cursor < 0 or (cursor and first_seq and cursor < first_seq - 1):
                current = service.cursor()
                await websocket.send_json({
                    "eventId": f"resync_{current}",
                    "schemaVersion": "1.0",
                    "workspaceId": workspace_id,
                    "teamId": service.snapshot().get("activeTeamId"),
                    "seq": current,
                    "entityVersion": service.workspace.workspace_version(),
                    "type": "resync_required",
                    "entityId": workspace_id,
                    "correlationId": "resync",
                    "occurredAt": now_iso(),
                    "payload": {"reason": "cursor_retention_gap"},
                })
                return
            bundle = service.snapshot_bundle()
            snapshot_version = bundle["snapshotVersion"]
            current = bundle["cursor"]
            replay = service.workspace.events_until(cursor, current)
            for event in replay:
                await websocket.send_json(event)
                cursor = max(cursor, int(event["seq"]))
            await websocket.send_json({
                "eventId": f"subscription_{current}",
                "schemaVersion": "1.0",
                "workspaceId": workspace_id,
                "teamId": service.snapshot().get("activeTeamId"),
                "seq": current,
                "entityVersion": snapshot_version,
                "type": "subscription.ready",
                "entityId": workspace_id,
                "correlationId": "subscription",
                "occurredAt": now_iso(),
                "payload": {"snapshotVersion": snapshot_version, "lastSeq": current},
            })
            while True:
                events = service.events_since(cursor)
                for event in events:
                    await websocket.send_json(event)
                    cursor = max(cursor, int(event["seq"]))
                try:
                    message = await asyncio.wait_for(websocket.receive_json(), timeout=0.25)
                    if message.get("type") == "ping":
                        await websocket.send_json({"type": "pong", "seq": cursor})
                except asyncio.TimeoutError:
                    continue
        except WebSocketDisconnect:
            return

    return app


def create_m2_service(json_path: Path, db_path: Path) -> M2Service:
    if not db_path.exists():
        migrate_json_to_sqlite(json_path, db_path)
    workspace = SqliteWorkspace(db_path)
    return M2Service(workspace)
