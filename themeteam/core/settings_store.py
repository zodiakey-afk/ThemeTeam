from __future__ import annotations

import json
import os
import tempfile
import threading
from copy import deepcopy
from pathlib import Path
from typing import Any, Optional


class SettingsStore:
    """Machine-local runtime settings kept outside the business workspace snapshot."""

    VERSION = 1

    def __init__(self, path: Optional[Path]) -> None:
        self.path = Path(path) if path is not None else None
        self._lock = threading.RLock()
        self._memory: dict[str, Any] = {"version": self.VERSION, "runtimeProfiles": [], "projectDirectories": []}

    def load(self) -> dict[str, Any]:
        with self._lock:
            if self.path is None:
                return deepcopy(self._memory)
            if not self.path.is_file():
                return {"version": self.VERSION, "runtimeProfiles": [], "projectDirectories": []}
            data = json.loads(self.path.read_text(encoding="utf-8"))
            if type(data) is not dict:
                raise ValueError("Invalid settings store")
            return self._sanitize(data)

    def save_profiles(self, profiles: dict[str, Any]) -> dict[str, Any]:
        with self._lock:
            current = self.load()
            current.update(deepcopy(profiles))
            current["version"] = self.VERSION
            sanitized = self._sanitize(current)
            blob = json.dumps(sanitized, ensure_ascii=False, indent=2, allow_nan=False)
            if self.path is None:
                self._memory = sanitized
                return sanitized
            self.path.parent.mkdir(parents=True, exist_ok=True)
            temporary: Path | None = None
            try:
                with tempfile.NamedTemporaryFile(
                    mode="w",
                    encoding="utf-8",
                    dir=self.path.parent,
                    prefix=".themeteam-settings-",
                    suffix=".tmp",
                    delete=False,
                ) as handle:
                    temporary = Path(handle.name)
                    handle.write(blob)
                    handle.flush()
                    os.fsync(handle.fileno())
                os.replace(temporary, self.path)
                temporary = None
            finally:
                if temporary is not None:
                    temporary.unlink(missing_ok=True)
            return sanitized

    def _sanitize(self, data: dict[str, Any]) -> dict[str, Any]:
        allowed = {"version", "runtimeProfiles", "projectDirectories"}
        if set(data) - allowed:
            raise ValueError("Unknown settings field")
        for key in ("runtimeProfiles", "projectDirectories"):
            value = data.get(key, [])
            if type(value) is not list or not all(type(item) is dict for item in value):
                raise ValueError("Invalid settings profile list")
        encoded = json.dumps(data, ensure_ascii=False, allow_nan=False)
        lowered = encoded.lower()
        if any(marker in lowered for marker in ("api_key", "apikey", "access_token", "bearer ", "private_key")):
            raise ValueError("Secrets cannot be stored in settings")
        return {
            "version": self.VERSION,
            "runtimeProfiles": deepcopy(data.get("runtimeProfiles", [])),
            "projectDirectories": deepcopy(data.get("projectDirectories", [])),
        }
