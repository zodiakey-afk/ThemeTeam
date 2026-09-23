| Document | W03 frozen acceptance tests |
|---|---|
| Version | 1.0 |
| Date | 2026-09-10 |
| Status | Frozen before implementation |
| Links | contracts/w03.json; B01-11/12 |

- BB-W03-01: two independent browser roots select different agents; neither network select command nor localStorage write; task-owner selection reaches same inspector/bridge ID.
- BB-W03-02: concurrent enqueue create/load/save observes FIFO server snapshots; failures retain prior snapshot/error and allow next request; pending returns zero, no automatic replay.
- BB-W03-03: timeout and disposal abort requests; late completion cannot publish; second root unaffected; no updates after bridge disposal, exactly one destroy/unsubscribe.
- BB-W03-04: bridge mount initially syncs, local selection and successful snapshot changes propagate once; repeated dispose harmless; remount owns new adapter.
- BB-W03-05: malformed/partial API shape or JSON error displays error, does not erase last good data or claim save success.
- BB-W03-06: browser temporary backend create task/agent, update status, owner locate, explicit save/reload; unsaved flag clears only success. Agent/task text rendered safely. Offline error and retry accessible.
- BB-W03-07: 390x844,1024x768,1440x900 screenshots and DOM bounding checks; no horizontal overflow/overlapping controls, keyboard field/button access, inspector close restores context.
- BB-W03-08: dev proxy rejects foreign/null Origin and invalid Host, accepts expected local browser; /api/state reads no secrets from external hosts. No wildcard CORS.

No W03 test proves completed Theme Hospital visual baseline or M1 scene motion. Those must remain pending separately. Pure instrumented scene adapter tests verify ownership/bridge contracts only.
