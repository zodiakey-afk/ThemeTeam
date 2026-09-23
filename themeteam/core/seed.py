from __future__ import annotations

from datetime import datetime, timezone

from .models import Agent, AgentRuntimeProfile, Document, Meeting, MemoryItem, ModelProfile, ProjectDirectoryProfile, Room, Task, Team, WorkspaceState


def _stamp(text: str) -> str:
    return f"[{datetime.now(timezone.utc).isoformat(timespec='seconds')}] {text}"


def seed_workspace() -> WorkspaceState:
    model_primary = ModelProfile(
        id="model_primary",
        name="gpt-4.1",
        provider="OpenAI",
        context_window=128000,
        capability_tags=["planning", "coding", "analysis"],
        cost_label="balanced",
    )
    model_local = ModelProfile(
        id="model_local",
        name="local-ollama",
        provider="Local",
        context_window=32000,
        capability_tags=["offline", "fast"],
        cost_label="low",
    )
    runtime_mock = AgentRuntimeProfile(
        id="runtime_mock",
        name="受控演示运行时",
        kind="model-api",
        executable="mock",
        capabilities=["demo", "web"],
        approval_policy="manual",
        timeout_seconds=300,
    )
    project_theme_team = ProjectDirectoryProfile(
        id="project_theme_team",
        name="ThemeTeam 主工程",
        path=str(__import__("pathlib").Path(__file__).resolve().parents[2]),
        path_kind="local",
        allowed=True,
        read_only=False,
        temporary_copy_policy="none",
    )

    rooms = [
        Room("room_boss", "老板办公室", "bossOffice", 1, 100, 70, 220, 160, ["agent_pm"], True, "retro"),
        Room("room_work", "工位区", "workstation", 1, 350, 100, 430, 230, ["agent_dev", "agent_qa"], True, "retro"),
        Room("room_meeting", "会议室", "meetingRoom", 1, 320, 350, 260, 180, [], True, "retro"),
        Room("room_lounge", "休憩区", "lounge", 1, 120, 330, 170, 140, [], True, "retro"),
        Room("room_archive", "文档中心", "archive", 1, 720, 260, 180, 150, [], True, "retro"),
        Room("room_b1", "扩容楼层 B1", "expansionRoom", 2, 690, 470, 220, 160, [], False, "retro"),
    ]

    agents = [
        Agent("agent_pm", "PM-01", "pm", model_primary.id, "room_boss", "Thinking", "pm_base", "team_alpha", True),
        Agent("agent_dev", "Dev-02", "developer", model_primary.id, "room_work", "Working", "dev_base", "team_alpha"),
        Agent("agent_qa", "QA-01", "tester", model_local.id, "room_work", "Idle", "qa_base", "team_alpha"),
    ]

    tasks = [
        Task("task_roadmap", "整理 MVP 路线", "把 Sprint 0 和 Phase 1 的实施项拆成可执行任务。", "in_progress", "high", ["agent_pm"], "manual"),
        Task("task_canvas", "落地 2.5D 办公画布", "完成默认办公室画布、镜头和路径高亮。", "todo", "high", ["agent_dev"], "manual"),
        Task("task_tests", "补齐核心测试", "覆盖状态机、API 和页面冒烟验证。", "todo", "medium", ["agent_qa"], "manual"),
    ]

    meetings = [
        Meeting(
            id="meeting_phase2",
            title="Phase 2 设计评审",
            mode="group",
            room_id="room_meeting",
            participants=["agent_pm", "agent_dev", "agent_qa"],
            moderator_id="agent_pm",
            rounds_limit=3,
            summary="确认会议、扩容和动效的交互边界。",
            status="active",
            linked_task_ids=["task_roadmap"],
        )
    ]

    documents = [
        Document(
            id="doc_spec",
            category="architecture",
            title="Phase 2-4 实施说明",
            content="围绕 2.5D 办公画布、会议流、文档中心和桌面打包的实现说明。",
            source_ref="meeting_phase2",
            version="v1.0",
            linked_task_ids=["task_roadmap"],
            linked_meeting_ids=["meeting_phase2"],
            created_at=_stamp("phase-2-4 doc seeded"),
        )
    ]

    memory_items = [
        MemoryItem(
            id="memory_1",
            scope="team",
            source_type="meeting",
            text="默认主题为像素经营桌面外壳 + 2.5D 游戏化办公室画布。",
            embedding_ref="local://memory_1",
            approved_by_human=True,
            linked_docs=["doc_spec"],
        )
    ]

    team = Team("team_alpha", "产品团队", "agent_pm", 8, model_primary.id, ["default"])

    state = WorkspaceState(
        id="workspace_main",
        name="ThemeTeam Workspace",
        theme_mode="retro",
        active_team_id=team.id,
        teams=[team],
        rooms=rooms,
        agents=agents,
        tasks=tasks,
        meetings=meetings,
        documents=documents,
        memory_items=memory_items,
        model_profiles=[model_primary, model_local],
        runtime_profiles=[runtime_mock],
        project_directories=[project_theme_team],
        events=[
            _stamp("Sprint 0: 需求冻结与架构预研就绪"),
            _stamp("Phase 1: 初始三人组已部署"),
            _stamp("默认主题：像素经营桌面 + 2.5D 办公画布"),
        ],
    )
    return state
