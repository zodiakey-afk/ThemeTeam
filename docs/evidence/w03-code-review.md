# W03 Independent Code and Adversarial Review

Date: 2026-09-10, completed against the source snapshot recorded below at approximately 14:25 +08:00.

Decision: **Changes requested. Three unresolved findings. No blanket W03 approval.**

## Findings

### R01 [P1] Preview inherits the write proxy without its origin boundary

Location: `frontend/vite.config.ts:10` and `frontend/vite.config.ts:32`.

The authority check is installed only by `configureServer`. Vite 8.2.2 preview inherits `server.proxy`, but invokes `configurePreviewServer`, not `configureServer`. The inherited `proxyReq` callback consequently rewrites an unvalidated foreign or null Origin to the backend Origin. Preview's built-in hostname allowlist does not supply the missing exact-port/Origin check.

Independent reproduction used the delivered config and installed Vite `preview()` API, with only an ephemeral preview port and `THEMETEAM_API_PORT` pointed to a reviewer-owned loopback HTTP stub. Config transpilation was in memory; no build or real backend was needed. Three POST `/api/save` requests, each with body `{}` and Content-Type `text/plain`, produced:

| Incoming Host / Origin | Response | Upstream observation |
| --- | --- | --- |
| `127.0.0.1:51977` / `https://foreign.example` | 200 | Host `127.0.0.1:51976`, Origin `http://127.0.0.1:51976` |
| `127.0.0.1:51977` / `null` | 200 | Same rewritten authority |
| `127.0.0.1:51978` (wrong port) / `https://foreign.example` | 200 | Same rewritten authority |

Actual upstream hits: 3; required rejected-request hits: 0. Both temporary servers were closed in `finally`. These are forwarding observations against a stub, not claims of real workspace mutation or of a browser exploit having been executed.

**Applicability:** this requires starting the standard Vite preview entry, not the supplied `npm run dev` entry. There is no package preview script, and the development middleware did reject the adversarial header fixtures. Nevertheless, the delivered config exposes this alternate write-capable entry without the promised boundary. This finding does not request a new preview feature: explicitly disabling preview API forwarding is sufficient if preview is unsupported; otherwise install the same validation before preview forwarding. Add a regression asserting zero upstream hits for both entry points that retain a proxy.

Basis: W03 design's rewrite-only-after-validation requirement and BB-W03-08H. Installed Vite implementation confirms inheritance at `frontend/node_modules/vite/dist/node/chunks/node.js:35781` and preview-hook dispatch at line 35843.

### R02 [P2] Invalid error envelopes release the uncertainty barrier

Location: `frontend/src/workspace.ts:48` through line 52; test expectations at `frontend/tests/workspace.test.ts:34` and line 74.

The client validates successful snapshots but treats an error as definitive using only `error.code` and the status. The referenced W02 v1.2 error schema requires an object containing an error object with both `code` and a string `message`, and prohibits extra properties. W03 v1.1 permits continued writes only after a known structured rejection; otherwise an invalid response after write dispatch is outcome-unknown.

Independent injected-fetch reproductions first loaded a valid synthetic snapshot, dispatched the operation below, and immediately queued a save. Ajv validation against the referenced error schema returned false for all three response bodies:

| Operation / response | Actual outcomes | Actual dispatched paths |
| --- | --- | --- |
| Task POST, 400 `{"error":{"code":"invalid_payload"}}` | `rejected`, `success` | state, tasks, save |
| Task POST, 400 `{"error":{"code":"invalid_payload","message":42}}` | `rejected`, `success` | state, tasks, save |
| Save POST, 500 `{"error":{"code":"storage_error","message":[]}}` | `rejected`, `success` | state, save, save |

In every case `uncertain` remained false. This promotes an invalid envelope to evidence that the write definitively failed, allowing the following write/save/reload to run. Under the frozen contract these responses must retain the last good snapshot, mark uncertainty/dirty, and suppress subsequent writes until external recovery. Validate the error envelope before granting the definitive-rejection exception. Keep valid structured rejections working.

The current unit tests themselves omit the required message in the supposedly definitive rejection fixtures, so their passing results do not cover this distinction. Include missing/wrong-type message and malformed envelope regressions alongside valid structured 4xx and storage-error controls. No test or implementation was changed by this review.

### R03 [P2] Close returns focus to the first matching owner, not the invoking button

Location: `frontend/src/App.tsx:30` through line 35 and the repeated owner button at line 79.

Owner buttons now have `data-entity`, but `focusSelection()` globally queries the document and takes the first visible match for the selected entity ID. A common task board can contain several buttons for the same Agent. Open the Agent from the second task's owner button and close the inspector: the first task's owner button receives focus even though the actual invoking button remains mounted. With two mounted workspace roots, the same unscoped query can instead focus a button in the other root.

The current source's `focusSelection` function was extracted with the TypeScript AST and executed unchanged against DOM doubles containing two visible `agent:a` buttons in document order. It focused the earlier button, not the invoking one. This is a source/function-level reproduction; real-browser repeated-owner keyboard verification remains to be performed by the parent acceptance run.

The v1.1 `selectionTransitions.close` rule explicitly says to focus the invoking entity button when present. Retain the invoking element for Close, scope fallback searches to the owning workspace root, and keep Back's destination-selection behavior separate. Add an exact-element assertion with two tasks sharing an owner, plus a two-root focus case. The supplied E2E assertion checks only that focus matches `.content .owner`, which cannot distinguish this failure.

## Scope and Independence

- Reviewed the approved scope in `docs/first-batch.md`, `02-design/w03-design.md`, `02-design/contracts/w03-v1.1.json`, both `05-testing/w03-spec*.md` documents, and the unchanged rules in `contracts/w03.json`. Resolved the referenced snapshot and W02 v1.2 error contracts directly.
- Independently read `frontend/src/workspace.ts`, `sceneBridge.ts`, `App.tsx`, `types.ts`, `workspace-schema.json`, `frontend/vite.config.ts`, and `frontend/tests/workspace.test.ts`. Also inspected the current entry point, package scripts, TypeScript configuration, E2E/verify harnesses and the relevant installed Vite preview implementation.
- Used source and frozen contracts, not implementation-history summaries or another reviewer's conclusion. Re-read current files after the continuation request; earlier missing-owner-marker observations are not carried forward as current findings.
- This is W03 foundation only. No missing Phaser adapter, office map, animation, M1 visual assets, canvas performance or M1 acceptance is reported as a W03 implementation defect. The reference image remains explicitly noninteractive and M1 remains pending.
- Only this evidence document was manually edited. No implementation/test/user JSON was edited. Probes used constructed in-memory snapshots, injected fetches, and a temporary loopback HTTP stub; they did not access the real workspace Store or credentials. No probe files were persisted and no reviewer-owned server remains running.

## Executed Evidence

Environment: Windows, Node v22.23.0, installed Vite 8.2.2, Vitest 5.0.0; working directory `C:/repos/ThemeTeam/frontend`.

1. Earlier `npm run test:unit` attempt exited 1 before tests because the default Vite config loader could not write its `.vite-temp` config file (`EPERM`). This was not an application failure or a quota restriction.
2. Final command `node node_modules/vitest/vitest.mjs run --configLoader runner --no-file-parallelism` exited 0 at 14:24:36 +08:00: **1 test file, 18 tests passed**, duration 279 ms. The runner loader avoids that temporary config file; no permission/quota bypass was used.
3. Independent Node stdin harness transpiled reviewed TS/TSX into memory with the installed TypeScript compiler. Final run exited 0. It reproduced R02/R03 and passed controls for generic 500 write uncertainty, valid structured storage-error save rejection, invalid-JSON write uncertainty, four malformed GET fixtures, dispatched-write disposal with late completion, and idempotent bridge cleanup.
4. The malformed GET cases were an object-valued task title, null agents array, object-valued assignee ID, and missing documents array. All were rejected without replacing the good snapshot or marking dirty.
5. A loaded synthetic snapshot rendered through React static markup escaped script/image/SVG payloads in task and Agent text and exposed the current owner entity marker. The harness explicitly substituted the loaded store state for SSR's initial-state subscription. An earlier default-SSR probe rendered the empty initial state and failed its payload assertion; that harness mismatch was corrected and is not counted as an application defect. Static escaping is not a substitute for browser XSS acceptance.
6. Direct execution of the delivered development middleware rejected seven header shapes (missing/duplicate/wrong-port/scheme Host; null/foreign/duplicate Origin), with zero calls to the forwarding continuation. Valid localhost same-origin and valid Host with absent Origin were accepted. The separate live preview probe exited 0 and reproduced R01 with three upstream hits.
7. Bundled `workspace-schema.json` exactly matches the frozen snapshot schema by SHA-256: `24AFFD9D845E9FEBC8A4320BA5426AC8BD9C258B3511048E79FC7ED5421394F1`.

The evidence above supports the tested ordinary FIFO/uncertainty/disposal paths, root-local selection state, pruning, and bridge behavior, but does not override R02's malformed-error exception or constitute full acceptance.

## Remaining Acceptance Boundaries

Build, real-browser keyboard/layout/XSS, and dependency audit remain owned by the parent task as requested; this review does not claim to have rerun or approved them. `npm run verify` was inspected but not run: it writes several other evidence files and performs a repository-wide credential-pattern scan, beyond this review's one-file/no-credential-read boundary. The isolated unit/probe path was used instead.

After fixes, re-review R01-R03 and run exact-element keyboard and zero-upstream proxy regressions. Do not close W03's independent review gate on the current all-green unit count alone. No gate/state metadata was changed by this review.

## Reviewed Source Identity

SHA-256 at the final unit run; any later implementation changes require a scoped re-review.

| File | SHA-256 |
| --- | --- |
| `frontend/src/workspace.ts` | `954FF85A9D9E46911A16C31A4942D3524226ED6658333F58045D19DE2C05BADB` |
| `frontend/src/sceneBridge.ts` | `377E800116500F25BF5D054CF81E6E4EA0A7CAE48E161BDB2D40A7BF2BC198F8` |
| `frontend/src/App.tsx` | `4CFAB581F17659B52FF1FBD15C29989A6A4EF952388B67B191B348701F03A24A` |
| `frontend/src/types.ts` | `7218882D70B193D1D68014652CD0F1380F690DD7210CF4FCDDC2DDEDFB08DC9A` |
| `frontend/src/workspace-schema.json` | `24AFFD9D845E9FEBC8A4320BA5426AC8BD9C258B3511048E79FC7ED5421394F1` |
| `frontend/vite.config.ts` | `653D34716838ECBD25C509D5B2FDB4810239070F838233D0DE453F6880ADFED3` |
| `frontend/tests/workspace.test.ts` | `5D7B1F6B57D5A95B98E626AAE3BDA750065510F007E0151326257FA82C55974E` |
| `frontend/package.json` | `5356A21BFA7C7304E464C98650001521CB5F53A0002475423EAAE28E4CCECCB9` |

## Independent Re-review: R01-R03

Date: 2026-09-10, 14:35 +08:00.

**Current decision: R01, R02 and R03 are closed for the source identities below. Scoped approval of these W03 corrections; no unresolved finding in this re-review scope.** This appendix supersedes the original open status of those three findings, not the historical evidence above. It is not approval of M1, release readiness, or unexecuted acceptance work.

### Inputs and Method

Re-read the original W03 v1.1 contract and frozen BB supplement. Independently inspected the current `frontend/vite.config.ts`, `src/error-schema.json`, `src/workspace.ts`, `src/App.tsx`, `tests/workspace.test.ts`, `tests/e2e.cjs` and `tests/two-roots.html`. Compared the error schema directly with the original W02 v1.2 `$defs.error`. No implementer reasoning or implementation-history account was used.

Executed the installed unit suite and two reviewer-authored Node stdin harnesses. The harnesses transpiled the current TypeScript into memory, without modifying source or tests. The live harness used the delivered Vite configuration, replacing only configuration-file loading, ephemeral listen ports, and a temporary cache location. Its API target was an ephemeral loopback stub serving a fully synthetic snapshot, never the real Python Store. Browser requests were restricted to the reviewer-owned Vite origin. The existing E2E runner was read but not executed because it overwrites other evidence artifacts; its real two-root HTML fixture was used directly by the independent browser probe.

Environment: Windows; Node v22.23.0; Vite 8.2.2; Vitest 5.0.0; headless Microsoft Edge reported version `152.0.4191.66`; browser viewport 1440x1000. Working directory: `C:/repos/ThemeTeam/frontend`.

### R01 Closure: No Preview API Forwarding

Current config explicitly sets `preview.proxy` to an empty object, installs the origin boundary for preview, and rejects the `/api` mount with a structured 404 response. The development proxy remains available behind its original validation.

Independent live `preview()` results, harness exit code 0:

- 10 adversarial requests returned 403: GET and POST with foreign Origin, null Origin, wrong-port Host, duplicate Host, or duplicate Origin.
- 32 valid-authority API requests returned 404: GET and POST, localhost and 127.0.0.1 Host, absent and valid same-origin Origin, across `/api/state`, `/api/save`, `/api/reload` and `/api/tasks`.
- **Upstream hits across all 42 preview requests: 0.**
- Development control: foreign-Origin POST returned 403 with no upstream hit; valid localhost same-origin GET returned 200 and arrived at the stub with Origin rewritten to the fixed loopback target.

R01 is closed. Static preview cannot use the delivered API proxy; this does not rely on browser CORS or on backend rejection.

### R02 Closure: Full Error Envelope Validation

The bundled error schema is structurally identical to the original W02 v1.2 error definition. `workspace.ts` now requires schema validation before using an error code as a definitive-rejection exception. Validation is noncoercing and does not insert defaults.

Independent injected-fetch results, harness exit code 0:

- **45 malformed-envelope scenarios passed:** 15 malformed shapes for each of create-task, save and reload. Shapes included null/array/scalar roots, empty root, null/array error, missing code/message, wrong code/message types, unknown code, extra root/error properties, and array-valued storage-error message.
- Each scenario first loaded a valid snapshot, dispatched the operation, then queued create-task/save/reload. All four outcomes were `unknown`; only the initial GET and first operation reached fetch. The good snapshot was retained, `uncertain=true`, `dirty=true`, and `pending=0`.
- A subsequent successful GET refresh did not clear uncertainty/dirty; another save remained blocked with no additional write dispatch.
- **Seven valid structured rejection controls passed:** the five documented 4xx codes on task writes and `storage_error` 500 on save/reload returned `rejected` and allowed the queued save to succeed.

R02 is closed. The malformed bodies used in the original finding no longer release the barrier, while the valid rejection exception is preserved.

### R03 Closure: Exact Invoker and Root-local Focus

The current App records the entity trigger in a root-local ref, prefers that connected visible element for Close, scopes fallback lookup to its workspace root, and limits selection-pruning focus work to that root. Back still resolves the destination selection separately.

Independent real-browser checks against the delivered `tests/two-roots.html`, using two synthetic tasks sharing the same Agent in both roots, passed:

1. Focus the second owner button in root B and activate with Enter; focus Close and activate with Enter. Focus returns to that exact second owner DOM element, not the earlier owner or root A. Repeat in root A with the same exact-element assertion. The other root's inspector remains closed in each case.
2. Task `t2` -> inspector owner -> Back returns focus to root B's exact `t2` task button, not the last owner trigger.
3. After owner selection, filter away the invoking task buttons and close the inspector. Fallback focus stays on root B's heading rather than moving to an identically identified owner in root A.
4. With both inspectors open, hold root B's GET response, focus root A's Close control, then release a snapshot removing root B's selected entity. Root B's inspector closes without stealing root A's focus.

Browser page errors: **0**. The live harness exited 0. These checks cover exact-element restoration and root isolation, including Enter activation; they do not claim a complete Tab-order or mobile accessibility audit. R03 is closed.

### Regression and Preservation

Command `node node_modules/vitest/vitest.mjs run --configLoader runner --no-file-parallelism` exited 0 at 14:32:43 +08:00: **1 file, 24 tests passed**, duration 310 ms. This includes the existing uncertainty, timeout, disposal, bridge and selection regressions plus the new malformed-envelope cases.

Only this appendix was added. No implementation, test, fixture HTML, user JSON, other evidence report, or gate/state metadata was edited. No credentials or real workspace data were read; no full-repository credential scan was performed. The browser, preview/dev servers and stub were closed, and the reviewer-created temporary Vite cache was removed after checking its resolved path. No temporary probe scripts were persisted.

The pre-append report was 11877 bytes with SHA-256 `1130cf632dd5370258bfb04d02d2c44713a5a4503315dffadf1c384a289effe5`; the original findings and evidence remain intact. Broader build/audit/layout/M1 acceptance remains outside this targeted re-review.

### Re-reviewed Source Identity

| File | SHA-256 |
| --- | --- |
| `frontend/vite.config.ts` | `40173CAF644E64CC493BA2FAADF4B7E4C2A222F688A7DB6FFA772D2E1A142DB1` |
| `frontend/src/error-schema.json` | `C79310424CE4C71088DD6D07C008CA3F841CBA05CFE149AC16B1AD4D6510A363` |
| `frontend/src/workspace.ts` | `5FF55B70190F5CC63E6675B9A529AEC1BC48EED26E3026D9B27285D355BC8914` |
| `frontend/src/App.tsx` | `1D8B87F71A146B9A14D4C4EA0A8DE69BE75B72219CC803E9AE6583764954CC84` |
| `frontend/tests/workspace.test.ts` | `2A5F86692DEB384D31768C87199DFBB1E87AA515B42287BE45122F90B7436BFE` |
| `frontend/tests/e2e.cjs` | `189EAA9D3AF34A5FEE209BD7B971AC7AEF9BC8B0F1258436F535FF242FAF5C63` |
| `frontend/tests/two-roots.html` | `D45A24BA4D15989E00F7CB8BDB309918C476CDDDA4D8B7E74C00391C5761BC50` |
