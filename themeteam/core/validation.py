"""Strict prototype command fields; references are checked under the Store lock."""
import math


class ConflictError(ValueError):
    pass


class ForbiddenError(ValueError):
    pass


TASK_STATUSES = ("todo", "in_progress", "in_review", "done")
AGENT_STATUSES = ("Idle", "Walking", "Working", "Thinking", "Speaking", "Blocked", "Error", "Offline", "Unplaced")
SCOPES = ("agent", "team", "global")

FIELDS = {
    "agent": {"name": "s", "roleTemplate": "s", "modelProfileId": "s", "seatId": "s",
              "status": AGENT_STATUSES, "appearancePresetId": "s", "leaderFlag": "b",
              "runtimeProfileId": "nullableString", "projectDirectoryProfileId": "nullableString"},
    "runtimeProfile": {
        "name": "s", "kind": ("model-api", "codex-cli", "claude-cli", "opencode-cli"),
        "executable": "s", "enabled": "b", "projectDirectoryProfileId": "nullableString",
        "approvalPolicy": ("manual", "automatic"), "timeoutSeconds": "seconds", "capabilities": "ids",
    },
    "projectDirectory": {
        "name": "s", "path": "s", "pathKind": ("local", "workspace"),
        "allowed": "b", "readOnly": "b", "temporaryCopyPolicy": ("none", "per-task"),
    },
    "runtimeDemo": {
        "runtimeProfileId": "s", "projectDirectoryProfileId": "s",
        "projectName": "s", "template": ("bazi-prediction",),
    },
    "taskRun": {
        "taskId": "s", "runtimeProfileId": "s", "projectDirectoryProfileId": "s",
        "prompt": "text",
    },
    "runControl": {"runId": "s"},
    "task": {"title": "s", "description": "text", "status": TASK_STATUSES,
             "priority": ("low", "medium", "high"), "assigneeIds": "ids", "sourceType": "s"},
    "meeting": {"title": "s", "mode": ("group", "private"), "roomId": "s", "participants": "ids",
                "moderatorId": "nullable", "roundsLimit": "rounds", "summary": "text",
                "status": ("draft", "active", "closed"), "linkedTaskIds": "ids", "linkedDocIds": "ids"},
    "document": {"category": "s", "title": "s", "content": "text", "sourceRef": "s", "version": "s",
                 "linkedTaskIds": "ids", "linkedMeetingIds": "ids", "visibilityScope": SCOPES},
    "memory": {"scope": SCOPES, "sourceType": "s", "text": "text", "embeddingRef": "s",
               "confidence": "confidence", "approvedByHuman": "b", "linkedDocs": "ids"},
    "expand": {"roomId": "s", "visualPreset": "s"},
    "theme": {"themeMode": ("retro", "modern")},
    "select": {"kind": ("workspace", "team", "room", "agent", "task", "meeting", "document", "memory"), "id": "s"},
    "move": {"roomId": "s"}, "status": {"status": TASK_STATUSES},
    "close": {"summary": "text"}, "empty": {},
}


def validate(payload, kind, required=()):
    fields = FIELDS[kind]
    if type(payload) is not dict or set(payload) - set(fields) or not set(required) <= set(payload):
        raise ValueError("Invalid fields")
    for key, value in payload.items():
        rule = fields[key]
        valid = False
        if isinstance(rule, tuple):
            valid = type(value) is str and value in rule
        elif rule in ("s", "text", "nullable"):
            valid = (type(value) is str and len(value) <= (65536 if rule == "text" else 512)) or (rule == "nullable" and value is None)
        elif rule == "nullableString":
            valid = value is None or (type(value) is str and 1 <= len(value) <= 512)
        elif rule == "seconds":
            valid = type(value) is int and 30 <= value <= 86400
        elif rule == "b":
            valid = type(value) is bool
        elif rule == "ids":
            valid = (type(value) is list and len(value) <= 256 and
                     all(type(item) is str and 1 <= len(item) <= 512 for item in value) and
                     len(set(value)) == len(value))
        elif rule == "rounds":
            valid = type(value) is int and 1 <= value <= 100
        elif rule == "confidence":
            valid = type(value) in (int, float) and 0 <= value <= 1 and math.isfinite(value)
        if not valid:
            raise ValueError("Invalid field value")
        if isinstance(value, str):
            value.encode("utf-8")
        elif isinstance(value, list):
            for item in value:
                item.encode("utf-8")
    if payload.get("approvedByHuman") is True:
        raise ForbiddenError("Human approval cannot be supplied by this API")
