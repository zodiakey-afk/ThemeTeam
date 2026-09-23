| Document | W02 scoped implementation plan |
|---|---|
| Version | 1.1 |
| Date | 2026-09-09 |
| Status | User sequence approved; technical prerequisite pending |
| Links | first-batch.md; w02-review-resolution.md; w02-spec-v1.1.md |

User/project-owner authorization: confirmed first-batch scope, then explicitly requested approved W01/W00V/W02/M1 development and completion. No further scope confirmation required. Implementation enters only when independent technical review clears v1.1; this plan does not declare clearance itself.

| Step | Output | Depends On | Verification |
|---|---|---|---|
| W02.1 | Frozen route/BB contracts and red regression baseline | W01 | JSON parse, docs/evidence/w02-red-baseline.md |
| W02.2 | Strict validation, pre-mutation reference checks, atomic save and archive | W02.1 + scoped G2 | isolated BB/WB tests, seeded corpus, filesystem fault injection |
| W02.3 | Local HTTP host/body/static bounds and stable errors | W02.2 | HTTP contract/raw framing/containment cases |
| W02.4 | Escaped legacy rendering without business rewrites | W02.3 | node --check, real-browser malicious fixtures and positive workflows |
| W02.5 | Review, regression/impact/divergence and report | W02.2..4 | four isolated rounds; independent adversarial/code review; hash/secret scan |

No new Python dependencies. Real JSON only read for integrity hashing, no migration or writes. Test/browser servers use explicit temporary Store and port0, close all owned resources. Code-only rollback; no claim this prototype is authenticated or suitable for remote exposure. Current working directory is not Git, retain versioned design and report evidence instead of commits.

DoD: B01-04..07, stable errors, no failed-request mutation, no XSS or traversal, no forged approval, repeat archive stable, failed save preserves precommit disk/state. Independent review and final report mandatory. W03 can follow W02 acceptance; M1 additionally requires completed visual reference review and actual canvas/assets/performance evidence. No M2 runtime work in scope.
