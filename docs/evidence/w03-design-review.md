| Document | W03 independent scoped technical design review |
|---|---|
| Version | 1.2 |
| Date | 2026-09-10 |
| Status | Scoped G2 technical approval: no unresolved W03 design blockers |
| Reviewer | Codex, independent technical reviewer in this task |
| Links | ITER-2026-001; W03; B01-11/12; CodingSpec feature G2 |

## Decision

Approve the W03 frontend foundation design with CR-W03-01 and the authoritative v1.1 contract/frozen BB supplement. D01, D02 and D03 are closed at design level; no unresolved scoped design blockers remain. User authorization for W03 is accepted. This satisfies the independent technical-review item for scoped G2, not G3, implementation acceptance, test execution, release, or the whole-iteration gate. No visual waiver is inferred.

## Finding Closure

### W03-D01 [P1] Closed: unknown write outcomes

Evidence: [v1.1 queue contract:7](C:/repos/ThemeTeam/.ai-spec/iterations/ITER-2026-001/02-design/contracts/w03-v1.1.json:7), [BB-W03-02U/02R/03D:11](C:/repos/ThemeTeam/.ai-spec/iterations/ITER-2026-001/05-testing/w03-spec-v1.1.md:11).

The contract now distinguishes definitive rejection from an unknown dispatched-write outcome, starts the timeout at dispatch, retains last good data, sets uncertain+dirty, cancels queued writes/save/reload, and disables further writes in that session. GET cannot clear uncertainty or prove backend completion. No replay or in-session recovery is offered; recovery requires externally established backend quiescence/restart and an explicitly opened fresh session. Disposal is expressly client-only. Forms distinguish success/rejected/unknown/disposed and retain input without allowing uncertain resubmission.

Frozen cases cover late backend commit, lost/invalid write responses, generic 5xx, definitive rejection, queued-write suppression, GET preservation of uncertainty, pending settlement and disposal without backend-cancellation assertions. This resolves the ordering/false-clean-state concern without backend scope expansion. Residual operational limitation: browser session creation itself is not proof of quiescence; the documented external recovery prerequisite must remain explicit.

### W03-D03 [P2] Closed: selection and inspector transitions

Evidence: [v1.1 selection contract:8](C:/repos/ThemeTeam/.ai-spec/iterations/ITER-2026-001/02-design/contracts/w03-v1.1.json:8), [BB-W03-01S/04S/07S:14](C:/repos/ThemeTeam/.ai-spec/iterations/ITER-2026-001/05-testing/w03-spec-v1.1.md:14).

Close hides the inspector while retaining current/history and bridge selection; Back consumes previous selection and opens the inspector only for a remaining target. Same-ID selection reopens without pushing history. Initial selection is null, backend selection is always ignored, and successful snapshots prune missing current/previous IDs. Frozen tests cover task -> owner -> Back, Close/reopen, invalid targets, reload removal and keyboard focus, including main-heading fallback. These observable rules remove the earlier ambiguity while preserving root isolation and bridge lifecycle guarantees.

## Nonblocking Scope And Dependencies

- W03-D02 remains closed by [boundary addendum:29](C:/repos/ThemeTeam/.ai-spec/iterations/ITER-2026-001/02-design/w03-design.md:29): every-request middleware, exactly one allowed Host with actual socket port, exactly matching present Origin, explicit absent-Origin exception, validation before forwarding, and fixed loopback upstream. CORS false is supplementary, not the trust check. BB-W03-08H now freezes header rejection before upstream contact and prevents forwarding headers from changing authority. No security test execution is claimed.
- React/TypeScript, a root-owned Zustand vanilla store, Vite/Vitest and lucide are coherent W03 choices. Ajv8.20.0 with the bundled full draft-2020-12 schema, no remote refs and no coercion/default insertion addresses partial-response validation; use its draft-compatible entry point. Deferring Phaser/easystarjs installation is appropriate. Exact versions and top-level licenses are stated, but the registry inspection claim was not independently verified here. Lockfile/engine compatibility, vulnerability and transitive-license checks, and offline build/runtime evidence remain required downstream; none is marked passed by this review.
- Snapshot/request/error compatibility should remain tied to `workspace-snapshot-v1.json` and `w02-routes-v1.2.json`; no backend schema migration, selection POST, optimistic success, credentials, or default-entry replacement is approved.
- CR-W03-01 explicitly makes the versioned v1.1 contract and BB supplement authoritative over conflicting v1.0 prose, while retaining unchanged API/schema/bridge requirements and the original files. This technical review accepts that scoped correction. Instrumented bridge tests remain valid public-contract BB tests, not substitutes for actual scene acceptance. Frozen descriptions are not execution evidence.
- W04-W06, VIS-01..04 approval, actual office assets/map/motion, canvas pixels, and M1 performance/full viewport acceptance remain pending. Their absence is not a blocker for this narrowly separated W03 design review. W03 screenshots do not waive the remaining B01/M1 requirements.

## Evidence And Handoff

Reviewed the original four artifacts, Boundary implementation details, CR-W03-01, `w03-v1.1.json`, `w03-spec-v1.1.md`, and referenced frozen W02 route/snapshot contracts. Parsed the revised JSON successfully with PowerShell `ConvertFrom-Json` in `C:/repos/ThemeTeam` (exit 0); this is syntax verification only. No source, implementation history, or prior implementation reviews were used. CodingSpec common/feature and state/gate metadata established review context. Knowledge retrieval started at `docs/kb/INDEX.yaml`; KB-PRODUCT-0002 points to the reviewed first-batch requirements.

Input SHA-256 at review:

| Artifact | SHA-256 |
|---|---|
| docs/first-batch.md | 464F55438DD393F95FDB9DF862488D86BD7B47FCF8BE418610F3F0C4522C795D |
| 02-design/w03-design.md | 3C5FD90899F97A8B88CECF65870802DA022818CC797CBB08537549F111B83AB8 |
| 02-design/contracts/w03.json | BFD143C77BC189B5EE97DB443FA055DF6D675AE2B41DB506BF7C4C4DA8FD5D52 |
| 02-design/contracts/w03-v1.1.json | 5D1E3DE5BC7063FFF975AA80003713B1ED10CB44DFBC02BE8E22CF48B7C9732E |
| 05-testing/w03-spec.md | 205C1C5A7A984436C2C79D081A3B6404224F8B468E20AB7A7805EDB18DBC5DAA |
| 05-testing/w03-spec-v1.1.md | A32346D25CE34C6490C4A10DD4AFCF43391A95A465DF133DE1A42C6FAE25BBBB |

Approval record: 2026-09-10, Codex independent technical reviewer, approved W03 foundation G2 technical design and CR-W03-01 only. No pending technical decision remains in this scope. The coordinating task may use this evidence for scoped G2 closure, complete gate/state and knowledge-index writeback, and proceed subject to G3 and other existing prerequisites. Those metadata files are not changed by this evidence-only review. Only this review document was edited; no implementation or tests were run.
