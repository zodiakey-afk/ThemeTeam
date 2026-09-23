export interface Agent {
  id: string; name: string; roleTemplate: string; modelProfileId: string; seatId: string;
  status: string; appearancePresetId: string; teamId: string; leaderFlag: boolean; animationPackId: string; skinId: string;
  runtimeProfileId?: string | null; projectDirectoryProfileId?: string | null;
}
export interface Task {
  id: string; title: string; description: string; status: string; priority: string; assigneeIds: string[];
  sourceType: string; dueAt: string | null; parentTaskId: string | null;
}
export interface Room { id: string; name: string; type: string; level: number; x: number; y: number; width: number; height: number; occupantIds: string[]; unlocked: boolean; visualPreset: string }
export interface Meeting { id: string; title: string; mode: string; roomId: string; participants: string[]; moderatorId: string | null; roundsLimit: number; summary: string; status: string; linkedTaskIds: string[]; linkedDocIds: string[] }
export interface DocumentRecord { id: string; category: string; title: string; content: string; sourceRef: string; version: string; linkedTaskIds: string[]; linkedMeetingIds: string[]; visibilityScope: string; createdAt: string | null }
export interface Snapshot {
  id: string; name: string; themeMode: string; activeTeamId: string; selection: { kind: string; id: string };
  teams: { id: string; name: string; leaderAgentId: string; capacity: number; defaultModelProfileId: string; tags: string[] }[];
  agents: Agent[]; rooms: Room[]; tasks: Task[]; meetings: Meeting[]; documents: DocumentRecord[];
  memoryItems: { id: string; scope: string; sourceType: string; text: string; embeddingRef: string; confidence: number; approvedByHuman: boolean; linkedDocs: string[] }[];
  modelProfiles: { id: string; name: string; provider: string; contextWindow: number; capabilityTags: string[]; costLabel: string }[];
  runtimeProfiles?: { id: string; name: string; kind: string; executable: string; enabled: boolean; projectDirectoryProfileId: string | null; approvalPolicy: string; timeoutSeconds: number; capabilities: string[] }[];
  projectDirectories?: { id: string; name: string; path: string; pathKind: string; allowed: boolean; readOnly: boolean; temporaryCopyPolicy: string }[];
  events: string[]; lastSavedAt: string | null;
}
export type Selection = { kind: 'agent' | 'task' | 'room' | 'meeting' | 'document'; id: string };
export type View = 'office' | 'tasks' | 'agents' | 'meetings' | 'documents' | 'settings';
export type Outcome = 'success' | 'rejected' | 'unknown' | 'disposed';
export interface ClientState {
  snapshot: Snapshot | null; selection: Selection | null; previousSelection: Selection | null;
  inspectorOpen: boolean; pending: number; error: string | null; dirty: boolean; uncertain: boolean; disposed: boolean;
}
