from __future__ import annotations

import json
import os
import tempfile
import threading
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional
from uuid import uuid4

from .models import (
    Agent,
    AgentRuntimeProfile,
    Document,
    MemoryItem,
    Meeting,
    ProjectDirectoryProfile,
    Task,
    WorkspaceState,
)
from .settings_store import SettingsStore
from .dispatcher import TaskDispatcher, TaskRunStore
from .seed import seed_workspace
from .validation import ConflictError, validate
from .agent_runtime import CodexCliAdapter, ProcessSupervisor, ProjectDirectoryGuard, RuntimeRejected
from .project_templates import generate_bazi_project


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _slug(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex[:8]}"


class WorkspaceStore:
    def __init__(self, storage_path: Path | None = None) -> None:
        self._lock = threading.RLock()
        self._storage_path = storage_path or Path(__file__).with_name("workspace_state.json")
        settings_path = Path(__file__).with_name("settings.json") if storage_path is None else None
        self._settings = SettingsStore(settings_path)
        self._state = self._load_state()
        self._hydrate_local_profiles()
        runs_path = (self._storage_path.parent / ".themeteam-task-runs.json")
        self._dispatcher = TaskDispatcher(TaskRunStore(runs_path), on_status=self._on_task_run_status)

    def snapshot(self) -> Dict[str, Any]:
        with self._lock:
            return self._state.to_dict()

    def close(self) -> None:
        with self._lock:
            self._dispatcher.shutdown()

    def save(self) -> Dict[str, Any]:
        with self._lock:
            return self._save_candidate(deepcopy(self._state))

    def _save_candidate(self, candidate) -> Dict[str, Any]:
        candidate.last_saved_at = _now()
        candidate.events.insert(0, f"[{_now()}] 工作区已保存")
        response = candidate.to_dict()
        self._settings.save_profiles({
            "runtimeProfiles": response.get("runtimeProfiles", []),
            "projectDirectories": response.get("projectDirectories", []),
        })
        blob = json.dumps(candidate.to_dict(include_local_profiles=False), ensure_ascii=False, indent=2, allow_nan=False)
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=self._storage_path.parent,
                                             prefix=".themeteam-", suffix=".tmp", delete=False) as handle:
                temporary = Path(handle.name)
                handle.write(blob)
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temporary, self._storage_path)
            temporary = None
            self._state = candidate
            return response
        finally:
            if temporary is not None:
                temporary.unlink(missing_ok=True)

    def reload(self) -> Dict[str, Any]:
        with self._lock:
            candidate = self._load_state()
            self._hydrate_profiles_for(candidate)
            candidate.events.insert(0, f"[{_now()}] 工作区已重新加载")
            response = candidate.to_dict()
            self._state = candidate
            return response

    def set_theme(self, theme_mode: str) -> Dict[str, Any]:
        with self._lock:
            validate({"themeMode": theme_mode}, "theme")
            self._state.theme_mode = theme_mode
            self._state.events.insert(0, f"[{_now()}] 切换主题：{theme_mode}")
            return self._state.to_dict()

    def set_theme_and_save(self, theme_mode: str) -> Dict[str, Any]:
        with self._lock:
            validate({"themeMode": theme_mode}, "theme")
            candidate = deepcopy(self._state)
            candidate.theme_mode = theme_mode
            candidate.events.insert(0, f"[{_now()}] 切换主题：{theme_mode}")
            return self._save_candidate(candidate)

    def select(self, kind: str, item_id: str) -> Dict[str, Any]:
        with self._lock:
            validate({"kind": kind, "id": item_id}, "select")
            groups = {"team": "teams", "room": "rooms", "agent": "agents", "task": "tasks",
                      "meeting": "meetings", "document": "documents", "memory": "memory_items"}
            if kind == "workspace":
                if item_id not in ("workspace", self._state.id):
                    raise KeyError(item_id)
            else:
                self._require(groups[kind], item_id)
            if kind == "team":
                self._state.active_team_id = item_id
            self._state.selection = {"kind": kind, "id": item_id}
            return self._state.to_dict()

    def create_meeting_document_memory_bundle(self, meeting_id: str, summary: str) -> Dict[str, Any]:
        with self._lock:
            validate({"summary": summary}, "close")
            self._require("meetings", meeting_id)
            candidate = deepcopy(self._state)
            meeting = next(m for m in candidate.meetings if m.id == meeting_id)
            docs = [d for d in candidate.documents if d.category == "meeting-notes" and
                    (d.source_ref == meeting.id or meeting.id in d.linked_meeting_ids)]
            if len(docs) > 1:
                raise ConflictError("Ambiguous archive")
            if docs:
                doc = docs[0]
                if (doc.source_ref != meeting.id or doc.linked_meeting_ids not in ([], [meeting.id]) or
                        doc.content != summary or (meeting.status == "closed" and meeting.summary != summary)):
                    raise ConflictError("Archive differs")
                memories = [m for m in candidate.memory_items if m.source_type == "meeting" and doc.id in m.linked_docs]
                if len(memories) > 1 or (memories and (memories[0].text != doc.content or memories[0].linked_docs != [doc.id])):
                    raise ConflictError("Ambiguous archive memory")
                complete = (doc.linked_meeting_ids == [meeting.id] and doc.id in meeting.linked_doc_ids and
                            bool(memories) and meeting.status == "closed" and meeting.summary == summary)
                if complete:
                    return self._state.to_dict()
                doc.linked_meeting_ids = [meeting.id]
                if doc.id not in meeting.linked_doc_ids:
                    meeting.linked_doc_ids.append(doc.id)
                if not memories:
                    candidate.memory_items.insert(0, MemoryItem(id=_slug("memory"), scope="team", source_type="meeting",
                        text=summary, embedding_ref=f"local://{doc.id}", approved_by_human=False, linked_docs=[doc.id]))
                meeting.status, meeting.summary = "closed", summary
                candidate.events.insert(0, f"[{_now()}] 会议 {meeting.title} 归档关联已补齐")
                response = candidate.to_dict()
                self._state = candidate
                return response
            meeting.status = "closed"
            meeting.summary = summary
            doc = Document(
                id=_slug("doc"),
                category="meeting-notes",
                title=f"{meeting.title} 会议纪要",
                content=summary,
                source_ref=meeting.id,
                version="v1.0",
                linked_task_ids=list(meeting.linked_task_ids),
                linked_meeting_ids=[meeting.id],
                visibility_scope="team",
                created_at=_now(),
            )
            candidate.documents.insert(0, doc)
            meeting.linked_doc_ids.append(doc.id)
            memory = MemoryItem(
                id=_slug("memory"),
                scope="team",
                source_type="meeting",
                text=summary,
                embedding_ref=f"local://{doc.id}",
                approved_by_human=False,
                linked_docs=[doc.id],
            )
            candidate.memory_items.insert(0, memory)
            candidate.events.insert(0, f"[{_now()}] 会议 {meeting.title} 已归档为文档")
            response = candidate.to_dict()
            self._state = candidate
            return response

    def create_agent(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        with self._lock:
            validate(payload, "agent")
            seat_id = payload.get("seatId", "room_work")
            work_room = self._require("rooms", "room_work")
            if seat_id == "room_work" and len(work_room.occupant_ids) >= 20:
                expansion = self._require("rooms", "room_b1")
                expansion.unlocked = True
                seat_id = expansion.id
                self._state.events.insert(0, f"[{_now()}] 工位区已满，自动启用扩容楼层：{expansion.name}")
            self._require("rooms", seat_id)
            if not self._state.model_profiles:
                raise ConflictError("No model profiles")
            self._require("model_profiles", payload.get("modelProfileId", self._state.model_profiles[0].id))
            runtime_profile_id = payload.get("runtimeProfileId")
            project_directory_profile_id = payload.get("projectDirectoryProfileId")
            if runtime_profile_id is not None:
                runtime = self._require("runtime_profiles", runtime_profile_id)
                if not runtime.enabled:
                    raise ConflictError("Runtime profile disabled")
                if runtime.project_directory_profile_id and project_directory_profile_id != runtime.project_directory_profile_id:
                    raise ConflictError("Runtime requires a compatible project directory")
            if project_directory_profile_id is not None:
                directory = self._require("project_directories", project_directory_profile_id)
                if not directory.allowed:
                    raise ConflictError("Project directory not allowed")
            self._destination(seat_id)
            agent = Agent(
                id=_slug("agent"),
                name=payload.get("name", "New Agent"),
                role_template=payload.get("roleTemplate", "generalist"),
                model_profile_id=payload.get("modelProfileId", self._state.model_profiles[0].id),
                seat_id=seat_id,
                status=("Unplaced" if seat_id == "room_b1" else payload.get("status", "Idle")),
                appearance_preset_id=payload.get("appearancePresetId", "default"),
                team_id=self._state.active_team_id,
                leader_flag=bool(payload.get("leaderFlag", False)),
                runtime_profile_id=runtime_profile_id,
                project_directory_profile_id=project_directory_profile_id,
            )
            self._state.agents.append(agent)
            self._attach_agent_to_room(agent.id, seat_id)
            self._state.events.insert(0, f"[{_now()}] 新建 Agent：{agent.name}")
            return self._state.to_dict()

    def create_runtime_profile(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        from .models import AgentRuntimeProfile

        with self._lock:
            validate(payload, "runtimeProfile")
            directory_id = payload.get("projectDirectoryProfileId")
            if directory_id is not None:
                self._require("project_directories", directory_id)
            profile = AgentRuntimeProfile(
                id=_slug("runtime"),
                name=payload["name"],
                kind=payload["kind"],
                executable=payload["executable"],
                enabled=payload["enabled"],
                project_directory_profile_id=directory_id,
                approval_policy=payload["approvalPolicy"],
                timeout_seconds=payload["timeoutSeconds"],
                capabilities=list(payload.get("capabilities", [])),
            )
            self._state.runtime_profiles.append(profile)
            self._persist_local_profiles()
            self._state.events.insert(0, f"[{_now()}] 新建 Agent 运行时：{profile.name}")
            return self._state.to_dict()

    def create_project_directory(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        from .models import ProjectDirectoryProfile

        with self._lock:
            validate(payload, "projectDirectory")
            path = os.path.abspath(os.path.expanduser(payload["path"]))
            if not os.path.isdir(path):
                raise ConflictError("Project directory does not exist")
            profile = ProjectDirectoryProfile(
                id=_slug("project"),
                name=payload["name"],
                path=path,
                path_kind=payload["pathKind"],
                allowed=payload["allowed"],
                read_only=payload["readOnly"],
                temporary_copy_policy=payload["temporaryCopyPolicy"],
            )
            self._state.project_directories.append(profile)
            self._persist_local_profiles()
            self._state.events.insert(0, f"[{_now()}] 新建工程目录：{profile.name}")
            return self._state.to_dict()

    def run_task(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        with self._lock:
            validate(payload, "taskRun")
            task = self._require("tasks", payload["taskId"])
            runtime = self._require("runtime_profiles", payload["runtimeProfileId"])
            project = self._require("project_directories", payload["projectDirectoryProfileId"])
            if not runtime.enabled or not project.allowed or project.read_only:
                raise ConflictError("Task runtime or project directory is not executable")
            if runtime.project_directory_profile_id and runtime.project_directory_profile_id != project.id:
                raise ConflictError("Runtime requires a compatible project directory")
            handle = self._dispatcher.start(
                task_id=task.id,
                runtime=runtime.to_dict(),
                project=project.to_dict(),
                prompt=payload["prompt"],
                cwd=Path(project.path),
            )
            self._state.events.insert(0, f"[{_now()}] 任务已进入运行队列：{task.title}")
            return {"run": self._dispatcher.run_store.get(handle.run_id), "workspace": self._state.to_dict()}

    def task_runs(self, task_id: Optional[str] = None) -> Dict[str, Any]:
        with self._lock:
            if task_id is not None:
                self._require("tasks", task_id)
            return {"runs": self._dispatcher.run_store.list(task_id)}

    def task_run(self, run_id: str) -> Dict[str, Any]:
        with self._lock:
            return {"run": self._dispatcher.run_store.get(run_id)}

    def cancel_task_run(self, run_id: str) -> Dict[str, Any]:
        with self._lock:
            return {"run": self._dispatcher.cancel(run_id)}

    def retry_task_run(self, run_id: str) -> Dict[str, Any]:
        with self._lock:
            handle = self._dispatcher.retry(run_id)
            return {"run": self._dispatcher.run_store.get(handle.run_id)}

    def probe_runtime(self, runtime_id: str) -> Dict[str, Any]:
        with self._lock:
            runtime = self._require("runtime_profiles", runtime_id)
            if not runtime.enabled:
                raise ConflictError("Runtime profile disabled")
            if runtime.kind != "codex-cli":
                raise ConflictError("Only Codex CLI probing is enabled in this milestone")
            if not runtime.project_directory_profile_id:
                raise ConflictError("Runtime requires a project directory")
            directory = self._require("project_directories", runtime.project_directory_profile_id)
            if not directory.allowed:
                raise ConflictError("Project directory not allowed")
            try:
                adapter = CodexCliAdapter(
                    runtime.to_dict(),
                    ProjectDirectoryGuard([Path(directory.path)]),
                    ProcessSupervisor(output_limit=8192),
                )
                result = adapter.probe(cwd=Path(directory.path))
            except RuntimeRejected as exc:
                raise ConflictError(str(exc)) from exc
            outcome = "通过" if result.status == "succeeded" and result.exit_code == 0 else "失败"
            self._state.events.insert(0, f"[{_now()}] Codex CLI 探测{outcome}：{runtime.name}")
            return self._state.to_dict()

    def run_mock_project(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        with self._lock:
            validate(payload, "runtimeDemo")
            runtime = self._require("runtime_profiles", payload["runtimeProfileId"])
            directory = self._require("project_directories", payload["projectDirectoryProfileId"])
            if not runtime.enabled or runtime.kind != "model-api" or runtime.executable != "mock":
                raise ConflictError("Only the controlled mock runtime is enabled in this milestone")
            if not directory.allowed or directory.read_only:
                raise ConflictError("Project directory is not writable")
            project = generate_bazi_project(Path(directory.path), payload["projectName"])
            self._state.events.insert(0, f"[{_now()}] Mock Runtime 生成项目：{project}")
            return self._state.to_dict()

    def move_agent(self, agent_id: str, room_id: str) -> Dict[str, Any]:
        with self._lock:
            validate({"roomId": room_id}, "move")
            agent = self._find_agent(agent_id)
            if not agent:
                raise KeyError(agent_id)
            self._destination(room_id)
            self._detach_agent_from_rooms(agent.id)
            agent.seat_id = room_id
            agent.status = "Walking"
            self._attach_agent_to_room(agent.id, room_id)
            self._state.events.insert(0, f"[{_now()}] {agent.name} 移动到 {room_id}")
            return self._state.to_dict()

    def create_task(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        with self._lock:
            validate(payload, "task")
            self._references(payload, {"assigneeIds": "agents"})
            task = Task(
                id=_slug("task"),
                title=payload.get("title", "未命名任务"),
                description=payload.get("description", ""),
                status=payload.get("status", "todo"),
                priority=payload.get("priority", "medium"),
                assignee_ids=list(payload.get("assigneeIds", [])),
                source_type=payload.get("sourceType", "manual"),
            )
            self._state.tasks.insert(0, task)
            self._state.events.insert(0, f"[{_now()}] 创建任务：{task.title}")
            return self._state.to_dict()

    def create_meeting(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        with self._lock:
            validate(payload, "meeting")
            self._require("rooms", payload.get("roomId", "room_meeting"))
            self._references(payload, {"participants": "agents", "linkedTaskIds": "tasks", "linkedDocIds": "documents"})
            if payload.get("moderatorId") is not None:
                self._require("agents", payload["moderatorId"])
                if payload["moderatorId"] not in payload.get("participants", []):
                    raise ValueError("Moderator must be a participant")
            self._destination(payload.get("roomId", "room_meeting"))
            meeting = Meeting(
                id=_slug("meeting"),
                title=payload.get("title", "新会议"),
                mode=payload.get("mode", "group"),
                room_id=payload.get("roomId", "room_meeting"),
                participants=list(payload.get("participants", [])),
                moderator_id=payload.get("moderatorId"),
                rounds_limit=int(payload.get("roundsLimit", 3)),
                summary=payload.get("summary", ""),
                status=payload.get("status", "draft"),
                linked_task_ids=list(payload.get("linkedTaskIds", [])),
                linked_doc_ids=list(payload.get("linkedDocIds", [])),
            )
            self._state.meetings.insert(0, meeting)
            self._state.events.insert(0, f"[{_now()}] 创建会议：{meeting.title}")
            return self._state.to_dict()

    def close_meeting(self, meeting_id: str, summary: str, linked_task_ids: Optional[list[str]] = None) -> Dict[str, Any]:
        with self._lock:
            validate({"summary": summary}, "close")
            if linked_task_ids is not None:
                validate({"linkedTaskIds": linked_task_ids}, "meeting")
                self._references({"linkedTaskIds": linked_task_ids}, {"linkedTaskIds": "tasks"})
            meeting = self._find_meeting(meeting_id)
            if not meeting:
                raise KeyError(meeting_id)
            meeting.status = "closed"
            meeting.summary = summary
            if linked_task_ids:
                meeting.linked_task_ids = list(linked_task_ids)
            self._state.events.insert(0, f"[{_now()}] 会议 {meeting.title} 已收束")
            return self._state.to_dict()

    def create_document(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        with self._lock:
            validate(payload, "document")
            self._references(payload, {"linkedTaskIds": "tasks", "linkedMeetingIds": "meetings"})
            document = Document(
                id=_slug("doc"),
                category=payload.get("category", "other"),
                title=payload.get("title", "未命名文档"),
                content=payload.get("content", ""),
                source_ref=payload.get("sourceRef", "manual"),
                version=payload.get("version", "v1.0"),
                linked_task_ids=list(payload.get("linkedTaskIds", [])),
                linked_meeting_ids=list(payload.get("linkedMeetingIds", [])),
                visibility_scope=payload.get("visibilityScope", "team"),
                created_at=_now(),
            )
            self._state.documents.insert(0, document)
            self._state.events.insert(0, f"[{_now()}] 创建文档：{document.title}")
            return self._state.to_dict()

    def create_memory(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        with self._lock:
            validate(payload, "memory")
            self._references(payload, {"linkedDocs": "documents"})
            memory = MemoryItem(
                id=_slug("memory"),
                scope=payload.get("scope", "team"),
                source_type=payload.get("sourceType", "meeting"),
                text=payload.get("text", ""),
                embedding_ref=payload.get("embeddingRef", ""),
                confidence=float(payload.get("confidence", 0.8)),
                approved_by_human=False,
                linked_docs=list(payload.get("linkedDocs", [])),
            )
            self._state.memory_items.insert(0, memory)
            self._state.events.insert(0, f"[{_now()}] 写入记忆：{memory.text[:20]}")
            return self._state.to_dict()

    def expand_office(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        with self._lock:
            validate(payload, "expand", ("roomId",))
            room = self._find_room(payload.get("roomId"))
            if not room:
                raise KeyError(payload.get("roomId"))
            room.unlocked = True
            room.visual_preset = payload.get("visualPreset", room.visual_preset)
            self._state.events.insert(0, f"[{_now()}] 办公室扩容：{room.name}")
            return self._state.to_dict()

    def unlock_room(self, room_id: str) -> Dict[str, Any]:
        with self._lock:
            room = self._find_room(room_id)
            if not room:
                raise KeyError(room_id)
            room.unlocked = True
            self._state.events.insert(0, f"[{_now()}] 解锁房间：{room.name}")
            return self._state.to_dict()

    def set_selection(self, kind: str, item_id: str) -> Dict[str, Any]:
        return self.select(kind, item_id)

    def update_task_status(self, task_id: str, status: str) -> Dict[str, Any]:
        with self._lock:
            validate({"status": status}, "status")
            task = self._find_task(task_id)
            if not task:
                raise KeyError(task_id)
            task.status = status
            self._state.events.insert(0, f"[{_now()}] 任务 {task.title} 状态变更为 {status}")
            return self._state.to_dict()

    def _find_agent(self, agent_id: str) -> Optional[Agent]:
        return next((agent for agent in self._state.agents if agent.id == agent_id), None)

    def _require(self, collection, item_id):
        item = next((item for item in getattr(self._state, collection) if item.id == item_id), None)
        if item is None:
            raise KeyError(item_id)
        return item

    def _destination(self, room_id):
        room = self._require("rooms", room_id)
        if not room.unlocked:
            raise ConflictError("Destination locked")
        return room

    def _references(self, payload, references):
        for field, collection in references.items():
            for item_id in payload.get(field, []):
                self._require(collection, item_id)

    def _find_task(self, task_id: str) -> Optional[Task]:
        return next((task for task in self._state.tasks if task.id == task_id), None)

    def _find_meeting(self, meeting_id: str) -> Optional[Meeting]:
        return next((meeting for meeting in self._state.meetings if meeting.id == meeting_id), None)

    def _find_room(self, room_id: str) -> Optional[object]:
        return next((room for room in self._state.rooms if room.id == room_id), None)

    def _detach_agent_from_rooms(self, agent_id: str) -> None:
        for room in self._state.rooms:
            if agent_id in room.occupant_ids:
                room.occupant_ids = [item for item in room.occupant_ids if item != agent_id]

    def _attach_agent_to_room(self, agent_id: str, room_id: str) -> None:
        for room in self._state.rooms:
            if room.id == room_id and agent_id not in room.occupant_ids:
                room.occupant_ids.append(agent_id)

    def _load_state(self) -> WorkspaceState:
        if self._storage_path.is_file():
            import json

            data = json.loads(self._storage_path.read_text(encoding="utf-8"))
            json.dumps(data, allow_nan=False)
            from .models import workspace_state_from_dict

            return workspace_state_from_dict(data)
        return seed_workspace()

    def _hydrate_local_profiles(self) -> None:
        self._hydrate_profiles_for(self._state)

    def _hydrate_profiles_for(self, state: WorkspaceState) -> None:
        local = self._settings.load()
        if local.get("runtimeProfiles"):
            state.runtime_profiles = [
                AgentRuntimeProfile(
                    id=item["id"],
                    name=item.get("name", item["id"]),
                    kind=item.get("kind", "model-api"),
                    executable=item.get("executable", ""),
                    enabled=item.get("enabled", True),
                    working_directory_policy=item.get("workingDirectoryPolicy", "project-profile"),
                    project_directory_profile_id=item.get("projectDirectoryProfileId"),
                    credential_ref=item.get("credentialRef"),
                    approval_policy=item.get("approvalPolicy", "manual"),
                    timeout_seconds=item.get("timeoutSeconds", 1800),
                    capabilities=list(item.get("capabilities", [])),
                )
                for item in local["runtimeProfiles"]
            ]
        if local.get("projectDirectories"):
            state.project_directories = [
                ProjectDirectoryProfile(
                    id=item["id"],
                    name=item.get("name", item["id"]),
                    path=item["path"],
                    path_kind=item.get("pathKind", "local"),
                    allowed=item.get("allowed", True),
                    read_only=item.get("readOnly", False),
                    temporary_copy_policy=item.get("temporaryCopyPolicy", "none"),
                )
                for item in local["projectDirectories"]
            ]

    def _persist_local_profiles(self) -> None:
        self._settings.save_profiles({
            "runtimeProfiles": [profile.to_dict() for profile in self._state.runtime_profiles],
            "projectDirectories": [profile.to_dict() for profile in self._state.project_directories],
        })

    def _on_task_run_status(self, task_id: str, status: str) -> None:
        with self._lock:
            task = self._find_task(task_id)
            if task is not None:
                task.status = status
                self._state.events.insert(0, f"[{_now()}] 任务 {task.title} 运行状态：{status}")
