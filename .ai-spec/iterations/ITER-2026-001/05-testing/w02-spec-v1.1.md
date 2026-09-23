| Document | W02 black-box supplement |
|---|---|
| Version | 1.1 |
| Date | 2026-09-09 |
| Status | Frozen before implementation, CR-W02-01; supplements v1.0 |
| Links | w02-spec.md; w02-review-resolution.md; w02-routes-v1.1.json |

BB-W02-03/04/10: each route default/required/type/ref/enum positive and rejection according to table. Omitted defaults succeed, null only moderatorId, empty text unchanged, empty IDs404, bool numeric400. Unicode512 accepted/513 rejected; text65536/65537; rounds1/100 valid,0/101 invalid. Missing move.roomId/status400. Unknown room404, locked409. Snapshot equal for every failure.

BB-W02-06H: synthetic history: non-archive doc ignored; missing doc meeting list/meeting backlink repaired; missing memory created false; complete replay no-op; conflicting/multiple doc or memory409; summary mismatch409 before repair; historical approval retained. Concurrent repair same IDs/counts. Missing summary empty.

BB-W02-07C: deterministic delayed read/write barriers for save/save, save/mutation, save/reload, reload/mutation; contenders block until lock released. Final disk/snapshot follow serial order. Serialization/write/fsync/replace faults preserve prior disk/live and clean temp. Post-replace crash may commit valid new file, not guaranteed rollback; restart loads valid committed data. No power-loss claim.

BB-W02-09H: wrong/suffix/duplicate/missing Host, alternate port/IPv6 ->403 on state/static GET/HEAD/POST; actual localhost/127.0.0.1 authorities succeed. Foreign/null/duplicate Origin403, missing allowed JSON. Media/framing/deep/slow/truncated400, size413 and close. Factory rejects remote/::1.

BB-W02-01/02X: isolated docs root sibling prefix, symlink outside, active html denied, SVG text attachment. Browser names/summaries/documents/memory/model labels/persisted SVG ids and geometry: img onerror, svg onload, quote breakouts, javascript strings/closing tags. No injected elements/events/network and text preserved. Normal theme/create/select/archive/save still work under CSP. Never real workspace fixture.
