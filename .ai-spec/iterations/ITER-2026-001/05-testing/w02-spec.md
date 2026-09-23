| Document | W02 black-box specification |
|---|---|
| Version | 1.0 |
| Date | 2026-09-09 |
| Status | Frozen before W02 implementation; derived from B01 and contract |
| Links | B01-04..07; contracts/w02.json |

- BB-W02-01: raw/percent encoded traversal, Windows separator/drive and symlink escape cannot return outside-root content; legitimate docs remain reachable.
- BB-W02-02: hostile HTML in entity names, documents, memory and summaries renders as text in the actual browser; no injected element/event execution.
- BB-W02-03: malformed UTF-8/JSON, scalar/list JSON, wrong field types, missing required fields, duplicate keys, NaN, excessive body/length produce specified JSON 4xx; snapshot unchanged.
- BB-W02-04: invalid entity refs/enums, locked room and invalid destination produce 404/400/409 respectively; no objects, occupants, events, selection changed.
- BB-W02-05: approvedByHuman true rejected 403; new direct/archive memories false; existing historical data read unchanged.
- BB-W02-06: sequential and concurrent same-summary archive yield one doc/memory, matching backlinks; different-summary replay 409 and snapshot unchanged.
- BB-W02-07: save/reload temporary workspace round trip; failed replacement leaves previous disk bytes and memory state unchanged; no owned temp files left.
- BB-W02-08: malformed saved file reload returns controlled failure without losing live data.
- BB-W02-09: foreign Origin/Host POST forbidden, valid local requests succeed; unsafe framing rejected.
- BB-W02-10: all existing valid HTTP/store flows and W01 four-round isolation retain compatibility.

WB-W02-01 supplements BB-W02-07 with filesystem fault injection. WB-W02-02 seeded malformed-input corpus supplements contract boundaries. Coverage and performance claims require actual measurement; absence is recorded, not passed.
