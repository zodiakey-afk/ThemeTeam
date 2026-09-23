| Document | W03 review closure and frozen BB supplement |
|---|---|
| Version | 1.1 |
| Date | 2026-09-10 |
| Status | Frozen preimplementation, CR-W03-01; replaces conflicting v1.0 expectations |
| Links | contracts/w03-v1.1.json; w03-design.md; docs/evidence/w03-design-review.md |

CR-W03-01 resolves D01/D03 without backend runtime expansion. Authoritative transitions and uncertainty policy are machine-readable in contracts/w03-v1.1.json, superseding v1.0 boolean-failure and close/back ambiguity. Scope and primary sequence already user-approved; independent technical re-review required before implementation.

- BB-W03-02U: dispatched POST times out, then fake server commits late. queued save/reload/POST must not dispatch; uncertain=true,dirty=true, prior snapshot retained, pending eventually0, outcome unknown. No automatic mutation replay. Optional GET refresh may show new data but cannot clear uncertainty or re-enable writes. Operator recovery is externally verified backend quiescence plus new browser session, not a UI claim of cancellation.
- BB-W03-02R: known structured4xx rejection allows next queued command; structured storage_error500 save/reload definitive. Lost/invalid 2xx write response and generic5xx write response unknown. Invalid/failed GET only produces error and cannot corrupt snapshot/dirty. Timeout clock starts at dispatch.
- BB-W03-03D: disposal stops client updates, cancels queued calls and aborts fetch; fake server may still commit. No backend cancellation assertion. Fresh root does not inherit disposed instance.
- BB-W03-01S/04S/07S: task -> owner -> Back restores task and consumes history. Close keeps Agent selected in bridge, hides inspector and returns focus; select same Agent reopens without pushing history. Initial null stays null despite backend selection. Reload removing current clears current/closes; missing previous pruned. Selecting nonexistent entity is ignored. Keyboard focus returns to entity button if mounted, otherwise main heading.
- BB-W03-08H: duplicate/absent/foreign/null Origin as contract; duplicate/missing/wrong-port/scheme Host forbidden on GET/POST before proxy with zero upstream hits; forwarded headers cannot change authority. Valid localhost/current-port origin rewritten to fixed127.0.0.1 target only after validation.
