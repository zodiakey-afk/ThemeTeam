"""Temporary HTTP fixture; stdin closure always tears down its owned server."""
import sys
import mimetypes
from pathlib import Path
from urllib.parse import unquote, urlparse

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from support import running_server, temporary_store
from themeteam.web.server import ThemeTeamHandler, _send_file


class BuiltFrontendHandler(ThemeTeamHandler):
    """Serve only the local build, retaining the API's origin and CSP boundary."""

    def do_GET(self):
        if not self._trusted():
            self._error(403, "forbidden")
            return
        route = urlparse(self.path).path
        if route.startswith("/api/"):
            super().do_GET()
            return
        build_name = "dist-two-roots" if "--two-roots" in sys.argv else "dist"
        build = Path(__file__).resolve().parents[1] / "frontend" / build_name
        try:
            relative = "index.html" if route == "/" else unquote(route).lstrip("/")
            candidate = (build / relative).resolve()
            candidate.relative_to(build.resolve())
            allowed = {".html", ".js", ".css", ".json", ".png", ".woff", ".woff2", ".ico"}
            if candidate.is_file() and candidate.suffix in allowed:
                content_type = mimetypes.guess_type(candidate.name)[0] or "application/octet-stream"
                _send_file(self, candidate, content_type)
                return
        except (ValueError, OSError):
            pass
        self._error(404, "not_found")


def seed_m1_load(store):
    snapshot = store.snapshot()
    model_id = snapshot["modelProfiles"][0]["id"]
    active_statuses = ["Blocked", "Working", "Thinking"]
    roles = ["pm", "developer", "tester"]
    for index in range(len(snapshot["agents"]), 20):
        store.create_agent({
            "name": f"M1成员-{index:02d}",
            "roleTemplate": roles[index % len(roles)],
            "modelProfileId": model_id,
            "status": active_statuses[(index - 3) % len(active_statuses)],
            "seatId": "room_work",
        })
    snapshot = store.snapshot()
    agent_ids = [agent["id"] for agent in snapshot["agents"]]
    for index in range(len(snapshot["tasks"]), 200):
        store.create_task({
            "title": f"M1性能任务-{index:03d}",
            "description": "M1 临时 Store 性能画像",
            "status": "todo",
            "priority": "medium",
            "assigneeIds": [agent_ids[index % len(agent_ids)]],
        })


def seed_m1_accessibility(store):
    """Create long-text boundary data only in this fixture's temporary Store."""
    state = store._state
    agent = state.agents[0]
    previous_id = agent.id
    long_id = "agent_" + ("unbroken_identifier_" * 9)
    agent.id = long_id
    agent.name = "超长中文成员名称用于验证办公室详情与目录在窄屏下仍然完整换行且所有按钮保持可达" * 2
    agent.role_template = "developer"
    agent.status = "Working"
    for room in state.rooms:
        room.occupant_ids = [long_id if item == previous_id else item for item in room.occupant_ids]
    for task in state.tasks:
        task.assignee_ids = [long_id if item == previous_id else item for item in task.assignee_ids]
    for meeting in state.meetings:
        meeting.participants = [long_id if item == previous_id else item for item in meeting.participants]
        if meeting.moderator_id == previous_id:
            meeting.moderator_id = long_id
    for team in state.teams:
        if team.leader_agent_id == previous_id:
            team.leader_agent_id = long_id
    state.selection = {"kind": "agent", "id": long_id}


with temporary_store() as (store, _):
    if "--m1-load" in sys.argv:
        seed_m1_load(store)
    if "--m1-a11y" in sys.argv:
        seed_m1_accessibility(store)
    with running_server(store) as server:
        if "--production" in sys.argv:
            server.RequestHandlerClass = BuiltFrontendHandler
        print(f"http://127.0.0.1:{server.server_address[1]}", flush=True)
        sys.stdin.read()
