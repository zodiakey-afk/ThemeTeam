| Document | W02 scoped design and threat model |
|---|---|
| Version | 1.0 |
| Date | 2026-09-09 |
| Status | Candidate for independent technical review |
| Links | B01-04..07; docs/first-batch.md; contracts/w02.json |

## Scope and ADR
Keep stdlib HTTP, current JSON schema, default entry and manual-save semantics. No migration or bulk write to real data. Add request validation before mutation and atomic save; reject unsafe inputs without inventing runtime/approval functionality. Risk M: input parsing and shared-state consistency require independent review. User authorized this dependency in the first-batch plan; W03 still follows W02.

One Store lock covers validation and mutation, including referenced entity and unlocked destination checks. Pure payload shape checks may precede the lock, but references must be checked inside it. Mutation is performed only after all validation succeeds. Add a ValueError-derived conflict exception. Successful legacy HTTP shape is unchanged; failures use JSON error codes. Client approval true is rejected, never coerced; new memories (including archives) are unapproved. Existing historical flags remain readable and confer no tool permission.

Archive: locate an existing meeting-notes document by sourceRef and linkedMeetingIds, not unrelated seeded architecture documents. Same-summary repeat returns existing snapshot; different summary yields 409 without mutation. First archive links new doc back to meeting and creates one unapproved memory. Historical archives with incomplete links may be repaired only for that explicitly requested archive, under lock; never duplicate an existing related document or candidate memory. Concurrent duplicates serialize.

Atomic save: copy state under lock, stamp copy, serialize strictly (no NaN), write unique sibling temporary file, flush and fsync, os.replace, then commit in-memory saved metadata. Failure removes only owned temp file; old disk and in-memory snapshot unchanged. Explicit save remains required. Reload parses into a candidate before replacing live state; failure leaves current state intact. No autosave added, no shared-file multi-process guarantee claimed.

Static access: decode URL once, resolve candidate under explicit docs root and require relative_to(root), including Windows separators, drive paths, symlinks and ..; allow only static safe document/image extensions, never Python/JSON state. Other routes exact match. Nosniff and restrictive CSP for legacy page. POST is same-origin/local application only: reject foreign Origin and unrecognized Host to limit browser CSRF/DNS rebinding; no CORS. Loopback deployment only, not an authentication product. Body cap 1 MiB, 5s read timeout, reject transfer encoding, invalid/duplicate Content-Length, malformed UTF-8, non-object JSON, duplicate keys and nonfinite numbers.

Legacy UI: escape every dynamic interpolation through a tagged HTML template helper; fixed markup remains literal. SVG attribute numbers/colors from data must be escaped and constrained, no untrusted raw URLs/event attributes. API IDs are URI-encoded in paths. React successor uses JSX text nodes. Browser XSS tests mandatory; do not infer from syntax checks.

## NFR and observability
Map B01-04 to traversal/XSS fixtures; B01-05 to invalid-shape/reference/enum snapshot equality; B01-06 to approval rejection and concurrent replay; B01-07 to failure injection and save/reload. JSON errors stable, no exception paths/keys in response or logs. No new backend dependencies. Tests use only temporary Store/server fixtures and the W01 guard.

## Plan and rollback
Freeze BB specification before implementation. Implement HTTP validation and Store checks, then escape legacy renderer, run isolated regression/impact/seeded fuzz and browser checks, independent review. Disjoint implementation scope: core/store.py, core/validation.py, web/server.py, web/static/app.js, new W02 tests. Rollback code only, no schema migration; keep real workspace untouched. Release requires reviewer, QA evidence and final user report confirmation.
