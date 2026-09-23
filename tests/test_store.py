from __future__ import annotations

import unittest

from themeteam.core.store import WorkspaceStore
from support import temporary_store


class WorkspaceStoreTests(unittest.TestCase):
    def setUp(self) -> None:
        self.store, self.storage_path = self.enterContext(temporary_store())

    def test_seed_contains_core_phase_one_objects(self) -> None:
        snapshot = self.store.snapshot()
        self.assertEqual(snapshot["themeMode"], "retro")
        self.assertEqual(len(snapshot["agents"]), 3)
        self.assertGreaterEqual(len(snapshot["tasks"]), 3)
        self.assertGreaterEqual(len(snapshot["rooms"]), 5)

    def test_theme_switch(self) -> None:
        snapshot = self.store.set_theme("modern")
        self.assertEqual(snapshot["themeMode"], "modern")

    def test_create_agent_and_move(self) -> None:
        snapshot = self.store.create_agent({"name": "UX-03", "roleTemplate": "developer", "seatId": "room_work"})
        new_agent = next(agent for agent in snapshot["agents"] if agent["name"] == "UX-03")
        self.assertEqual(new_agent["seatId"], "room_work")
        moved = self.store.move_agent(new_agent["id"], "room_meeting")
        moved_agent = next(agent for agent in moved["agents"] if agent["id"] == new_agent["id"])
        self.assertEqual(moved_agent["seatId"], "room_meeting")

    def test_task_status_transition(self) -> None:
        snapshot = self.store.snapshot()
        task_id = snapshot["tasks"][0]["id"]
        updated = self.store.update_task_status(task_id, "done")
        updated_task = next(task for task in updated["tasks"] if task["id"] == task_id)
        self.assertEqual(updated_task["status"], "done")

    def test_meeting_archive_document_and_memory(self) -> None:
        snapshot = self.store.create_meeting({"title": "评审会", "participants": ["agent_pm"], "roomId": "room_meeting"})
        meeting_id = next(meeting["id"] for meeting in snapshot["meetings"] if meeting["title"] == "评审会")
        updated = self.store.create_meeting_document_memory_bundle(meeting_id, "会议已归档。")
        self.assertTrue(any(doc["content"] == "会议已归档。" for doc in updated["documents"]))
        self.assertTrue(any(mem["text"] == "会议已归档。" for mem in updated["memoryItems"]))

    def test_expand_and_save_reload(self) -> None:
        expanded = self.store.unlock_room("room_b1")
        room = next(room for room in expanded["rooms"] if room["id"] == "room_b1")
        self.assertTrue(room["unlocked"])
        saved = self.store.save()
        self.assertIsNotNone(saved["lastSavedAt"])
        reloaded = self.store.reload()
        self.assertEqual(reloaded["themeMode"], saved["themeMode"])

    def test_probe_runtime_rejects_non_codex_without_side_effects(self) -> None:
        before = self.store.snapshot()
        with self.assertRaises(ValueError):
            self.store.probe_runtime("runtime_mock")
        self.assertEqual(before, self.store.snapshot())

    def test_agent_creation_auto_uses_expansion_room_after_workstations_are_full(self) -> None:
        state = self.store.snapshot()
        for index in range(18):
            self.store.create_agent({"name": f"Worker-{index}", "roleTemplate": "developer", "seatId": "room_work"})
        created = self.store.create_agent({"name": "Overflow", "roleTemplate": "developer", "seatId": "room_work"})
        overflow = next(agent for agent in created["agents"] if agent["name"] == "Overflow")
        room = next(room for room in created["rooms"] if room["id"] == "room_b1")
        self.assertEqual(overflow["seatId"], "room_b1")
        self.assertEqual(overflow["status"], "Unplaced")
        self.assertTrue(room["unlocked"])
        self.assertEqual(len(created["agents"]), len(state["agents"]) + 19)


if __name__ == "__main__":
    unittest.main()
