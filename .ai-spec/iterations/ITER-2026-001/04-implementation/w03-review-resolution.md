| Document | W03 implementation review resolution |
|---|---|
| Version | 1.0 |
| Date | 2026-09-10 |
| Status | Fixes implemented; independently re-reviewed and closed 2026-09-10 14:35 +08:00 |
| Links | w03-v1.1.json; docs/evidence/w03-code-review.md |

No requirement or frozen contract changes. This is scoped completion within the active feature implementation stage, not a waiver of independent review.

| Finding | Change | Regression |
|---|---|---|
| R01 preview authority/proxy | Shared exact Host/Origin middleware; static preview explicitly sets empty proxy and rejects API with404 after authority validation | Three hostile preview POSTs403, local API404, zero upstream requests |
| R02 malformed error envelope | Locally bundled copy of W02 v1.2 error schema validated with existing Ajv before definitive rejection is allowed | Missing/wrong-type message, extra fields, null error and malformed storage error remain unknown; valid controls continue |
| R03 invoking button/root focus | Root-scoped DOM queries, exact visible invoker retained for Close; Back still focuses its destination; root-unique dialog title IDs | Exact second-owner assertion and two mounted roots in real browser |

R02 red run: 24 cases,19pass/5fail before implementation correction. Final24pass, full `npm run verify` passes. Main/inspector/form screenshots at1440/1024/390 and mobile44px form-control assertions passed. Test fixtures use temporary Store only. Unmodified backend regressions48x2 pass.

Allowed write scope: frontend state/error schema/config/App/CSS/tests, frontend README and W03 evidence/progress/gates. No backend, real data, API semantics, provider credentials or M1 scope changes. Preview is static-only; the supported interactive entry remains `npm run dev`. No default-entry replacement or deployment.

Independent closure: Gauss re-review in `docs/evidence/w03-code-review.md` confirmed42preview requests with0upstream hits,45malformed envelopes and7valid controls, actual browser exact-element/root-local focus, and24unit tests. R01-R03 closed; no unresolved finding in that scope. This does not approve M1, QA or release.
