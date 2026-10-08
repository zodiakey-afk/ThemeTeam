from __future__ import annotations

from dataclasses import MISSING, dataclass, field, fields, is_dataclass
from typing import Any, Dict, List, Optional, Union, get_args, get_origin, get_type_hints
import math
from pathlib import Path

from .validation import AGENT_STATUSES, TASK_STATUSES


@dataclass
class ModelProfile:
    id: str
    name: str
    provider: str
    context_window: int
    capability_tags: List[str] = field(default_factory=list)
    cost_label: str = "standard"
    model_name: Optional[str] = None
    credential_ref: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        payload = {
            "id": self.id,
            "name": self.name,
            "provider": self.provider,
            "contextWindow": self.context_window,
            "capabilityTags": list(self.capability_tags),
            "costLabel": self.cost_label,
        }
        if self.model_name is not None:
            payload["modelName"] = self.model_name
        if self.credential_ref is not None:
            payload["credentialRef"] = self.credential_ref
        return payload


@dataclass
class AgentRuntimeProfile:
    id: str
    name: str
    kind: str
    executable: str
    enabled: bool = True
    working_directory_policy: str = "project-profile"
    project_directory_profile_id: Optional[str] = None
    credential_ref: Optional[str] = None
    approval_policy: str = "manual"
    timeout_seconds: int = 1800
    capabilities: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "kind": self.kind,
            "executable": self.executable,
            "enabled": self.enabled,
            "workingDirectoryPolicy": self.working_directory_policy,
            "projectDirectoryProfileId": self.project_directory_profile_id,
            "credentialRef": self.credential_ref,
            "approvalPolicy": self.approval_policy,
            "timeoutSeconds": self.timeout_seconds,
            "capabilities": list(self.capabilities),
        }


@dataclass
class ProjectDirectoryProfile:
    id: str
    name: str
    path: str
    path_kind: str = "local"
    allowed: bool = True
    read_only: bool = False
    temporary_copy_policy: str = "none"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "path": self.path,
            "pathKind": self.path_kind,
            "allowed": self.allowed,
            "readOnly": self.read_only,
            "temporaryCopyPolicy": self.temporary_copy_policy,
        }


@dataclass
class Room:
    id: str
    name: str
    type: str
    level: int
    x: int
    y: int
    width: int
    height: int
    occupant_ids: List[str] = field(default_factory=list)
    unlocked: bool = True
    visual_preset: str = "retro"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "type": self.type,
            "level": self.level,
            "x": self.x,
            "y": self.y,
            "width": self.width,
            "height": self.height,
            "occupantIds": list(self.occupant_ids),
            "unlocked": self.unlocked,
            "visualPreset": self.visual_preset,
        }


@dataclass
class Agent:
    id: str
    name: str
    role_template: str
    model_profile_id: str
    seat_id: str
    status: str
    appearance_preset_id: str
    team_id: str
    leader_flag: bool = False
    animation_pack_id: str = "default"
    skin_id: str = "default"
    runtime_profile_id: Optional[str] = None
    project_directory_profile_id: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "roleTemplate": self.role_template,
            "modelProfileId": self.model_profile_id,
            "seatId": self.seat_id,
            "status": self.status,
            "appearancePresetId": self.appearance_preset_id,
            "teamId": self.team_id,
            "leaderFlag": self.leader_flag,
            "animationPackId": self.animation_pack_id,
            "skinId": self.skin_id,
            "runtimeProfileId": self.runtime_profile_id,
            "projectDirectoryProfileId": self.project_directory_profile_id,
        }


@dataclass
class Task:
    id: str
    title: str
    description: str
    status: str
    priority: str
    assignee_ids: List[str] = field(default_factory=list)
    source_type: str = "manual"
    due_at: Optional[str] = None
    parent_task_id: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "status": self.status,
            "priority": self.priority,
            "assigneeIds": list(self.assignee_ids),
            "sourceType": self.source_type,
            "dueAt": self.due_at,
            "parentTaskId": self.parent_task_id,
        }


@dataclass
class Meeting:
    id: str
    title: str
    mode: str
    room_id: str
    participants: List[str] = field(default_factory=list)
    moderator_id: Optional[str] = None
    rounds_limit: int = 3
    summary: str = ""
    status: str = "draft"
    linked_task_ids: List[str] = field(default_factory=list)
    linked_doc_ids: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "title": self.title,
            "mode": self.mode,
            "roomId": self.room_id,
            "participants": list(self.participants),
            "moderatorId": self.moderator_id,
            "roundsLimit": self.rounds_limit,
            "summary": self.summary,
            "status": self.status,
            "linkedTaskIds": list(self.linked_task_ids),
            "linkedDocIds": list(self.linked_doc_ids),
        }


@dataclass
class Document:
    id: str
    category: str
    title: str
    content: str
    source_ref: str
    version: str
    linked_task_ids: List[str] = field(default_factory=list)
    linked_meeting_ids: List[str] = field(default_factory=list)
    visibility_scope: str = "team"
    created_at: Optional[str] = None
    correlation_id: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "category": self.category,
            "title": self.title,
            "content": self.content,
            "sourceRef": self.source_ref,
            "version": self.version,
            "linkedTaskIds": list(self.linked_task_ids),
            "linkedMeetingIds": list(self.linked_meeting_ids),
            "visibilityScope": self.visibility_scope,
            "createdAt": self.created_at,
            "correlationId": self.correlation_id,
        }


@dataclass
class MemoryItem:
    id: str
    scope: str
    source_type: str
    text: str
    embedding_ref: str = ""
    confidence: float = 0.75
    approved_by_human: bool = False
    linked_docs: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "scope": self.scope,
            "sourceType": self.source_type,
            "text": self.text,
            "embeddingRef": self.embedding_ref,
            "confidence": self.confidence,
            "approvedByHuman": self.approved_by_human,
            "linkedDocs": list(self.linked_docs),
        }


@dataclass
class Team:
    id: str
    name: str
    leader_agent_id: str
    capacity: int
    default_model_profile_id: str
    tags: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "leaderAgentId": self.leader_agent_id,
            "capacity": self.capacity,
            "defaultModelProfileId": self.default_model_profile_id,
            "tags": list(self.tags),
        }


@dataclass
class WorkspaceState:
    id: str
    name: str
    theme_mode: str
    active_team_id: str
    selection: Dict[str, str] = field(default_factory=lambda: {"kind": "workspace", "id": "workspace"})
    teams: List[Team] = field(default_factory=list)
    rooms: List[Room] = field(default_factory=list)
    agents: List[Agent] = field(default_factory=list)
    tasks: List[Task] = field(default_factory=list)
    meetings: List[Meeting] = field(default_factory=list)
    documents: List[Document] = field(default_factory=list)
    memory_items: List[MemoryItem] = field(default_factory=list)
    model_profiles: List[ModelProfile] = field(default_factory=list)
    runtime_profiles: List[AgentRuntimeProfile] = field(default_factory=list)
    project_directories: List[ProjectDirectoryProfile] = field(default_factory=list)
    events: List[str] = field(default_factory=list)
    last_saved_at: Optional[str] = None

    def to_dict(self, *, include_local_profiles: bool = True) -> Dict[str, Any]:
        payload = {
            "id": self.id,
            "name": self.name,
            "themeMode": self.theme_mode,
            "activeTeamId": self.active_team_id,
            "selection": dict(self.selection),
            "teams": [team.to_dict() for team in self.teams],
            "rooms": [room.to_dict() for room in self.rooms],
            "agents": [agent.to_dict() for agent in self.agents],
            "tasks": [task.to_dict() for task in self.tasks],
            "meetings": [meeting.to_dict() for meeting in self.meetings],
            "documents": [document.to_dict() for document in self.documents],
            "memoryItems": [memory.to_dict() for memory in self.memory_items],
            "modelProfiles": [profile.to_dict() for profile in self.model_profiles],
            "events": list(self.events),
            "lastSavedAt": self.last_saved_at,
        }
        if include_local_profiles:
            payload["runtimeProfiles"] = [profile.to_dict() for profile in self.runtime_profiles]
            payload["projectDirectories"] = [profile.to_dict() for profile in self.project_directories]
        return payload


def _check_persisted_types(value, expected):
    """Validate supplied historical fields before the compatibility loader adds defaults."""
    origin, args = get_origin(expected), get_args(expected)
    if origin is Union:
        for option in args:
            try:
                _check_persisted_types(value, option)
                return
            except ValueError:
                pass
        raise ValueError("Invalid optional field")
    if is_dataclass(expected):
        if type(value) is not dict:
            raise ValueError("Expected object")
        hints = get_type_hints(expected)
        for item in fields(expected):
            first, *rest = item.name.split("_")
            key = first + "".join(part.title() for part in rest)
            if key not in value and item.default is MISSING and item.default_factory is MISSING:
                raise ValueError("Missing required field")
            if key in value:
                field_type = float if expected is Room and item.name in ("x", "y", "width", "height") else hints[item.name]
                _check_persisted_types(value[key], field_type)
    elif origin is list:
        if type(value) is not list:
            raise ValueError("Expected list")
        for item in value:
            _check_persisted_types(item, args[0])
    elif origin is dict:
        if type(value) is not dict:
            raise ValueError("Expected mapping")
        for key, item in value.items():
            _check_persisted_types(key, args[0])
            _check_persisted_types(item, args[1])
    elif expected is float:
        try:
            valid = type(value) in (float, int) and math.isfinite(value)
        except OverflowError:
            valid = False
        if not valid:
            raise ValueError("Expected finite number")
    elif type(value) is not expected:
        raise ValueError("Invalid field type")
    elif expected is str:
        value.encode("utf-8")


def workspace_state_from_dict(data: Dict[str, Any]) -> WorkspaceState:
    required = {"id", "name", "themeMode", "activeTeamId", "selection", "teams", "rooms", "agents", "tasks",
                "meetings", "documents", "memoryItems", "modelProfiles", "events", "lastSavedAt"}
    if type(data) is not dict or not required <= data.keys():
        raise ValueError("Incomplete workspace snapshot")
    if type(data["selection"]) is not dict or set(data["selection"]) != {"kind", "id"}:
        raise ValueError("Invalid selection structure")
    _check_persisted_types(data, WorkspaceState)
    for task in data["tasks"]:
        if task["status"] not in TASK_STATUSES:
            raise ValueError("Invalid task status")
    for agent in data["agents"]:
        if agent["status"] not in AGENT_STATUSES:
            raise ValueError("Invalid agent status")
    for runtime in data.get("runtimeProfiles", []):
        if runtime["kind"] not in {"model-api", "codex-cli", "claude-cli", "opencode-cli"}:
            raise ValueError("Invalid runtime kind")
        if runtime["approvalPolicy"] not in {"manual", "automatic"}:
            raise ValueError("Invalid approval policy")
    runtime_profiles = data.get("runtimeProfiles")
    if runtime_profiles is None:
        runtime_profiles = [{
            "id": "runtime_mock",
            "name": "受控演示运行时",
            "kind": "model-api",
            "executable": "mock",
            "enabled": True,
            "workingDirectoryPolicy": "project-profile",
            "projectDirectoryProfileId": "project_theme_team",
            "credentialRef": None,
            "approvalPolicy": "manual",
            "timeoutSeconds": 300,
            "capabilities": ["demo", "web"],
        }]
    project_directories = data.get("projectDirectories")
    if project_directories is None:
        project_directories = [{
            "id": "project_theme_team",
            "name": "ThemeTeam 主工程",
            "path": str(Path(__file__).resolve().parents[2]),
            "pathKind": "local",
            "allowed": True,
            "readOnly": False,
            "temporaryCopyPolicy": "none",
        }]
    return WorkspaceState(
        id=data.get("id", "workspace_main"),
        name=data.get("name", "ThemeTeam Workspace"),
        theme_mode=data.get("themeMode", "retro"),
        active_team_id=data.get("activeTeamId", "team_alpha"),
        selection=dict(data.get("selection", {"kind": "workspace", "id": "workspace"})),
        teams=[
            Team(
                id=team["id"],
                name=team["name"],
                leader_agent_id=team["leaderAgentId"],
                capacity=team["capacity"],
                default_model_profile_id=team["defaultModelProfileId"],
                tags=list(team.get("tags", [])),
            )
            for team in data.get("teams", [])
        ],
        rooms=[
            Room(
                id=room["id"],
                name=room["name"],
                type=room["type"],
                level=room["level"],
                x=room["x"],
                y=room["y"],
                width=room["width"],
                height=room["height"],
                occupant_ids=list(room.get("occupantIds", [])),
                unlocked=room.get("unlocked", True),
                visual_preset=room.get("visualPreset", "retro"),
            )
            for room in data.get("rooms", [])
        ],
        agents=[
            Agent(
                id=agent["id"],
                name=agent["name"],
                role_template=agent["roleTemplate"],
                model_profile_id=agent["modelProfileId"],
                seat_id=agent["seatId"],
                status=agent["status"],
                appearance_preset_id=agent.get("appearancePresetId", "default"),
                team_id=agent.get("teamId", data.get("activeTeamId", "team_alpha")),
                leader_flag=agent.get("leaderFlag", False),
                animation_pack_id=agent.get("animationPackId", "default"),
                skin_id=agent.get("skinId", "default"),
                runtime_profile_id=agent.get("runtimeProfileId"),
                project_directory_profile_id=agent.get("projectDirectoryProfileId"),
            )
            for agent in data.get("agents", [])
        ],
        tasks=[
            Task(
                id=task["id"],
                title=task["title"],
                description=task.get("description", ""),
                status=task["status"],
                priority=task.get("priority", "medium"),
                assignee_ids=list(task.get("assigneeIds", [])),
                source_type=task.get("sourceType", "manual"),
                due_at=task.get("dueAt"),
                parent_task_id=task.get("parentTaskId"),
            )
            for task in data.get("tasks", [])
        ],
        meetings=[
            Meeting(
                id=meeting["id"],
                title=meeting["title"],
                mode=meeting.get("mode", "group"),
                room_id=meeting.get("roomId", "room_meeting"),
                participants=list(meeting.get("participants", [])),
                moderator_id=meeting.get("moderatorId"),
                rounds_limit=meeting.get("roundsLimit", 3),
                summary=meeting.get("summary", ""),
                status=meeting.get("status", "draft"),
                linked_task_ids=list(meeting.get("linkedTaskIds", [])),
                linked_doc_ids=list(meeting.get("linkedDocIds", [])),
            )
            for meeting in data.get("meetings", [])
        ],
        documents=[
            Document(
                id=document["id"],
                category=document.get("category", "other"),
                title=document.get("title", ""),
                content=document.get("content", ""),
                source_ref=document.get("sourceRef", "manual"),
                version=document.get("version", "v1.0"),
                linked_task_ids=list(document.get("linkedTaskIds", [])),
                linked_meeting_ids=list(document.get("linkedMeetingIds", [])),
                visibility_scope=document.get("visibilityScope", "team"),
                created_at=document.get("createdAt"),
                correlation_id=document.get("correlationId"),
            )
            for document in data.get("documents", [])
        ],
        memory_items=[
            MemoryItem(
                id=memory["id"],
                scope=memory.get("scope", "team"),
                source_type=memory.get("sourceType", "meeting"),
                text=memory.get("text", ""),
                embedding_ref=memory.get("embeddingRef", ""),
                confidence=memory.get("confidence", 0.75),
                approved_by_human=memory.get("approvedByHuman", False),
                linked_docs=list(memory.get("linkedDocs", [])),
            )
            for memory in data.get("memoryItems", [])
        ],
        model_profiles=[
            ModelProfile(
                id=profile["id"],
                name=profile["name"],
                provider=profile.get("provider", "Unknown"),
                context_window=profile.get("contextWindow", 0),
                capability_tags=list(profile.get("capabilityTags", [])),
                cost_label=profile.get("costLabel", "standard"),
                model_name=profile.get("modelName"),
                credential_ref=profile.get("credentialRef"),
            )
            for profile in data.get("modelProfiles", [])
        ],
        runtime_profiles=[
            AgentRuntimeProfile(
                id=profile["id"],
                name=profile["name"],
                kind=profile.get("kind", "model-api"),
                executable=profile.get("executable", ""),
                enabled=profile.get("enabled", True),
                working_directory_policy=profile.get("workingDirectoryPolicy", "project-profile"),
                project_directory_profile_id=profile.get("projectDirectoryProfileId"),
                credential_ref=profile.get("credentialRef"),
                approval_policy=profile.get("approvalPolicy", "manual"),
                timeout_seconds=profile.get("timeoutSeconds", 1800),
                capabilities=list(profile.get("capabilities", [])),
            )
            for profile in runtime_profiles
        ],
        project_directories=[
            ProjectDirectoryProfile(
                id=profile["id"],
                name=profile["name"],
                path=profile["path"],
                path_kind=profile.get("pathKind", "local"),
                allowed=profile.get("allowed", True),
                read_only=profile.get("readOnly", False),
                temporary_copy_policy=profile.get("temporaryCopyPolicy", "none"),
            )
            for profile in project_directories
        ],
        events=list(data.get("events", [])),
        last_saved_at=data.get("lastSavedAt"),
    )
