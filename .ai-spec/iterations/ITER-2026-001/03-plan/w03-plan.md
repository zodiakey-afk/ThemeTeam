| Document | W03 scoped implementation sequence |
|---|---|
| Version | 1.0 |
| Date | 2026-09-10 |
| Status | User-approved W03 sequence; scoped G2 independently approved |
| Links | w03-design.md; w03-v1.1.json; w03-spec-v1.1.md |

W03.1 exact package/lock and API schema/types -> W03.2 per-root store, queue and scene bridge -> W03.3 DOM shell/forms/inspector -> W03.4 unit/browser/type/build/audit/license evidence -> independent code review/report. W02 code and machine evidence prerequisite complete; no release/default-entry replacement. User's explicit approval to complete W03 and repeated continue requests authorize this existing scope. No visual waiver; W04-W06 remain separate.

Verification: npm run typecheck, npm run test:unit, npm run build, npm run test:e2e, npm audit; lockfile license inventory and offline build. Tests use temporary Python fixture and ephemeral ports; user dev server starts only after checks. Uncertain write freezes subsequent mutations, local selection independent across roots, adapter teardown idempotent. Latest approved design overrides older drafts. Failure of any check must be resolved or reported, never claim M1 success from this shell.
