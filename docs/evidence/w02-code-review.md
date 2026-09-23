| Document | W02 independent code/adversarial review |
|---|---|
| Version | 1.2 |
| Date | 2026-09-10 |
| Status | Scoped code/adversarial approval after independent re-review; see appended conclusion |
| Links | ITER-2026-001; B01-04..07; W02 routes v1.2; workspace snapshot v1 |

## Initial Decision (Superseded)

The original findings and executions below are retained as historical evidence. The 2026-09-10 re-review conclusion at the end supersedes this initial decision; it does not erase the earlier failures.

**Do not approve the reviewed W02 artifact set yet.** Resolve CR-01 through CR-03 and repeat the affected isolated checks. CR-04 is a lower-priority contract correction, not an independent safety blocker. No authentication bypass, outside-root read, forged new approval, or save/archive partial commit was demonstrated in this review.

This is an independent CodingSpec code/adversarial review, not an implementation task or a release/QA sign-off. Inputs were requirements, design/threat-model documents, contracts, frozen test specifications, and delivered source/tests. No implementation history or implementer reasoning was requested or read. Parent owns browser evidence, test expansion, gate/state updates, and final acceptance. No source or test files were edited by this reviewer.

## Findings

### CR-01 [P1] Reject invalid snapshot structure before publishing reload

Locations: [models.py:269](/C:/repos/ThemeTeam/themeteam/core/models.py:269), [models.py:279](/C:/repos/ThemeTeam/themeteam/core/models.py:279), [models.py:294](/C:/repos/ThemeTeam/themeteam/core/models.py:294), [store.py:61](/C:/repos/ThemeTeam/themeteam/core/store.py:61).

The historical checker validates only fields that happen to be present, and treats `selection` as an arbitrary string-to-string mapping. The compatibility loader then constructs defaults and reload publishes the result without checking the snapshot structure. With a synthetic file containing `{}`, POST `/api/reload` returned 200 and replaced the live three-agent workspace with empty entity collections. With an otherwise complete snapshot whose selection was `{"unexpected":"x"}`, reload returned 200, changed live state, and returned that invalid selection unchanged. The latter response is explicitly invalid under the required `kind`/`id` and `additionalProperties:false` selection schema.

This violates B01-07/BB-W02-08 and CR-W02-02's requirement that invalid historical shape yield `storage_error` 500 without replacing live state. It can discard recoverable in-memory work when a malformed but parseable file is loaded. Validate required structure and the resulting snapshot before assignment, while preserving only explicitly supported historical defaults. This does not require rewriting existing files or migrating history.

### CR-02 [P2] Historical geometry rejects numbers allowed by the contract

Locations: [models.py:34](/C:/repos/ThemeTeam/themeteam/core/models.py:34), [models.py:288](/C:/repos/ThemeTeam/themeteam/core/models.py:288).

Snapshot v1 defines room `x`, `y`, `width`, and `height` as `number`. The new type checker instead follows the dataclass's `int` annotations and requires exact Python integer types. Changing only a synthetic snapshot's first room `x` to `1.5` caused POST `/api/reload` to return 500; live state was correctly preserved, but this contract-valid snapshot could not load. The same loader is used at Store startup.

Accept finite numeric geometry as declared by the frozen schema, without accepting booleans or silently rounding. This is a compatibility correction under B01-07/BB-W02-10, not a request for new geometry features.

### CR-03 [P2] Decode entity IDs after splitting API route segments

Locations: [server.py:227](/C:/repos/ThemeTeam/themeteam/web/server.py:227), [server.py:232](/C:/repos/ThemeTeam/themeteam/web/server.py:232), [server.py:237](/C:/repos/ThemeTeam/themeteam/web/server.py:237), [server.py:242](/C:/repos/ThemeTeam/themeteam/web/server.py:242).

The frontend correctly uses `encodeURIComponent` for entity IDs, but the server passes the raw percent-encoded segment to Store lookups. A synthetic persisted task with ID `task/a b` loads successfully. POST `/api/tasks/task%2Fa%20b/status` with `{"status":"done"}` returns 404, while `update_task_status("task/a b", "done")` succeeds. Spaces, non-ASCII characters, percent signs, and reserved characters can therefore make readable historical entities unusable through their normal UI routes.

Snapshot IDs are strings without an ASCII/slug restriction; DR-05 explicitly requires encoded API IDs. Split the route first, decode the one ID segment exactly once with controlled malformed-encoding handling, then perform the existing lookup. Do not decode the whole route before segment matching or migrate persisted IDs.

### CR-04 [P3] Unknown-reference precedence loses to a locked destination

Locations: [store.py:167](/C:/repos/ThemeTeam/themeteam/core/store.py:167), [store.py:221](/C:/repos/ThemeTeam/themeteam/core/store.py:221).

Routes v1.2 orders unknown-reference 404 before locked-destination 409. POST `/api/agents` with `{"seatId":"room_b1","modelProfileId":"missing"}` returns 409 because `_destination` checks the room lock before model lookup. Meeting creation has the same ordering for participant/task/document references. The probe confirmed no state mutation, so this is error-contract consistency rather than an atomicity or authorization defect. Resolve references before evaluating resource-state conflicts while retaining the operation lock.

## Executed Evidence

Environment: Windows 11 build 26200; Python 3.12.14. CWD `C:/repos/ThemeTeam`. Bundled executable obtained from `load_workspace_dependencies`:

`C:/Users/z00654528/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe`

Commands used PowerShell here-string stdin piped to that executable with `-B -`; no probe script was written to the repository. Fixtures used `tests/support.py`'s `temporary_store`, `running_server`, and `connection`, with explicit Store paths and ephemeral loopback ports. A Python audit hook rejected any attempt to open the real `themeteam/core/workspace_state.json`; the combined probe/suite execution reported **0 such attempts**. Real JSON was neither read, hashed, nor written. Context managers closed owned connections/servers/threads and removed temporary fixtures.

The implementation-aware probes are WB review evidence, not replacements for frozen BB tests. The operative cases were:

```python
# Each case starts with its own temporary_store() and running_server(store).
# request() POSTs JSON with Content-Type application/json and reads status/body.
before = store.snapshot()
path.write_text("{}", encoding="utf-8")
request(server, "/api/reload", {})

fixture = store.snapshot()  # fresh context for each remaining case
fixture["selection"] = {"unexpected": "x"}
path.write_text(json.dumps(fixture), encoding="utf-8")
request(server, "/api/reload", {})

fixture = store.snapshot()
fixture["rooms"][0]["x"] = 1.5
path.write_text(json.dumps(fixture), encoding="utf-8")
request(server, "/api/reload", {})

fixture = store.snapshot()
fixture["tasks"][0]["id"] = "task/a b"
path.write_text(json.dumps(fixture), encoding="utf-8")
store.reload()
request(server, "/api/tasks/task%2Fa%20b/status", {"status": "done"})
store.update_task_status("task/a b", "done")  # positive control

request(server, "/api/agents",
        {"seatId": "room_b1", "modelProfileId": "missing"})
```

Observed output, reproduced in two isolated probe runs:

```text
empty_snapshot status 200 state_unchanged False agents 0
invalid_selection status 200 state_unchanged False selection {'unexpected': 'x'}
float_geometry status 500 state_unchanged True
encoded_id 404 direct_store done
precedence 409 unchanged True
```

The initial probe-only execution exited 0. A separate surrogate-string probe against the current validator returned 400 with task count unchanged; subsequent state GET and save both returned 200. No surrogate poisoning finding is raised.

The security suite was invoked in-process with `unittest.defaultTestLoader.loadTestsFromName('test_security')`, after adding the absolute `tests` directory to `sys.path` and installing the real-workspace audit guard. Three executions were made against successively delivered artifacts:

| Execution | Tests | Passed | Failures | Errors | Skipped | Exit |
|---|---:|---:|---:|---:|---:|---:|
| Initial delivered suite | 21 | 20 | 0 | 1 | 0 | 1 |
| Expanded suite before final transport correction | 25 | 24 | 0 | 1 | 0 | 1 |
| Latest artifacts with half-close/discard and corrected GET helper | 25 | 25 | 0 | 0 | 0 | 0 |

Initial error: `test_bb_09_foreign_origin_and_host`, `getresponse()`, Windows `ConnectionAbortedError [WinError 10053]`. Second-run error: `test_bb_03_types_limits_and_required`, while reading the response to the 1,048,577-byte body, same Windows error. These earlier failures remain recorded rather than being replaced by a retry result.

The final delivered server was reread, including its output half-close, discard cap of 1,048,577 bytes, and 250 ms socket read timeout. The final independent run passed all 25 tests in 2.129 seconds, exit 0, with zero real-workspace open attempts. This is one successful run of the corrected transport, not an exhaustive slow-client or timing proof. The same execution rechecked all four review findings: empty/invalid-selection reload still returned 200 and changed state; fractional geometry returned 500 unchanged; encoded task ID returned 404; mixed missing-reference/locked-room input returned 409 unchanged. Therefore the transport correction does not change the scoped review decision. Parent-reported retained transport logs were not needed or read for this recheck.

An attempted optional `jsonschema` import failed with `ModuleNotFoundError` before that attempted probe ran; no dependency was installed. The successful probes read the authoritative schema using stdlib JSON and checked the relevant declarations directly. Full automated JSON Schema validation, coverage, exhaustive concurrency scheduling, and browser execution are not claimed here.

## Scoped Assurance And Handoff

The reviewed lock/candidate/replace structure prepares save data before the commit point; reload and archive prepare responses before assignment. Available passing tests cover replacement/fsync failures, theme-save rollback, archive replay/conflict/history repair, and save versus mutation ordering. No additional concrete defect was established in those paths. Static containment resolves paths and checks root membership; the latest passing tests include content policy and symlink/junction escape checks. Renderer review found escaped dynamic text/attributes and only internally generated trusted fragments. Browser XSS tests are separately parent-owned and were not re-certified here.

Re-review CR-01..03 after correction, resolve or explicitly adjudicate CR-04, and attach the parent's completed test/browser evidence. Existing 25-test success does not cover the demonstrated contract defects. Do not expand this review into authentication, multi-process writers, migrations, or new frontend functionality. This document does not close G4/G5 or the iteration.

## Reviewed Artifact Hashes

SHA-256 values identify the final reviewed artifact set. Core/renderer hashes were rechecked before the final run; server/test hashes were captured after the final successful combined probe/suite execution. Parent changes after these hashes need their own verification.

| Artifact | SHA-256 |
|---|---|
| themeteam/core/store.py | a2f431ab869a54ad34f191484bf2809b5dd17213a72968e8044d00f3d74e9710 |
| themeteam/core/validation.py | e43c87d5c9aa74520ecf0a4ac32078e8ad47d6d1cecc40c930a0441902c8a7e4 |
| themeteam/core/models.py | e7795eb3df03fdc7418825dba91bc28d69669762ce68e83719bd527964168934 |
| themeteam/web/server.py | 242ac90a23312ae47ce6b3d3bd7f2c9601c9d3b7924fe7ff1cb4d8fdbd350dd1 |
| themeteam/web/static/app.js | 667d394aaa9d000c4f8a44e593fc03243a2338bd2d7fe825a698e7038fc592d3 |
| tests/test_security.py | 3d201182d4e082689afbe6ad26fb703d18433ba618affa3b4b6065a2e82edd90 |

## Re-review Conclusion: 2026-09-10

**Approved for the scoped W02 code/adversarial review. CR-01 through CR-04 are closed on the artifact hashes below. No remaining actionable finding was established in this correction re-review.** This supersedes the initial changes-requested decision, not the retained historical evidence. It is not a full release approval, browser certification, or G4/G5 closure.

Before the interruption, the corrected loader, reference-check ordering, route decoder, transport handler, and regression tests were independently inspected. On resumption, all six artifact hashes matched that inspected set. The reviewer then independently reran the original defect scenarios, adjacent negative/positive controls, transport exchanges, and the latest `test_security` suite. Parent test/browser results were not substituted for these executions.

### Finding Disposition

| Finding | Independent recheck | Disposition |
|---|---|---|
| CR-01 | `{}`, invalid selection keys, and a missing mandatory nested agent ID return 500 `storage_error`; full live snapshot and test-file bytes remain unchanged. An omitted legacy `animationPackId` still defaults to `default`. | Closed |
| CR-02 | Each of x/y/width/height accepts and preserves 1.5 on reload. Boolean, Infinity, and NaN geometry return controlled 500 with live state and file bytes unchanged. | Closed |
| CR-03 | Encoded IDs containing slash, space, percent, and a non-ASCII character work for agent move, task status, meeting archive, and room unlock. A task ID containing literal `%2F` is decoded once, not twice. `%`, `%2`, `%GG`, and invalid UTF-8 `%FF` return 400 without mutation. | Closed |
| CR-04 | Missing model reference plus locked agent destination, and missing participant plus locked meeting destination, return 404 without mutation. | Closed |

### Fresh Execution Evidence

Environment and command mechanism remain the bundled Python 3.12.14 on Windows, CWD `C:/repos/ThemeTeam`, with PowerShell here-string stdin piped to the bundled executable using `-B -`. The resumed execution completed with exit code 0. It used fresh explicit temporary Store paths, ephemeral loopback servers, and the same audit guard denying opens of the real workspace JSON.

The WB harness retained the original probe structure above and added assertions for the corrected expectations, unchanged live/disk data on rejected reloads, numeric geometry boundaries, optional legacy defaults, all four encoded route families, malformed escape handling, and both reference-precedence paths. Transport was exercised with ten 1,048,577-byte request bodies and ten foreign-Host requests carrying a body. Every exchange returned a fully readable JSON 413/403 respectively with the expected error code; snapshots remained unchanged.

```text
CR01/02 original and boundary probes PASS
CR03 four route families, single decoding and malformed encoding PASS
CR04 and 20 early-rejection transport exchanges PASS
INDEPENDENT_ASSERTIONS 105
SUITE 27 failures 0 errors 0 skipped 0
REAL_OPEN_ATTEMPTS 0
Ran 27 tests in 1.459s
OK
Process exit code: 0
```

The 105 assertions are implementation-aware reviewer checks, not 105 additional BB test cases. The suite was loaded with `unittest.defaultTestLoader.loadTestsFromName('test_security')` and contains the newly delivered regressions. This fresh run does not claim execution of the parent's full 44-test suite. No source/tests were edited, no persistent probe script was added, and real workspace JSON was not read, hashed, or written. Test-owned resources were closed and temporary directories cleaned by their context managers.

### Scope And Remaining Verification

The parent reports full-suite logs `w02-reviewed-a/b/c.log` and ten hostile browser surfaces passing in `w02-browser.json`; those claims remain parent-owned evidence and were not independently rerun or certified here. This re-review does not claim exhaustive timing/slow-client resistance, complete JSON Schema automation, coverage measurement, multi-process writer safety, or migration validation. The bounded discard's socket timeout is a per-read timeout, not a demonstrated absolute wall-clock deadline. None of these limitations reopens the four concrete findings within this agreed correction scope.

The parent may use this report as the independent W02 code/adversarial review evidence while retaining responsibility for full regression/browser results, QA sign-off, gate records, and final user confirmation. Subsequent source changes require appropriately scoped verification.

### Re-reviewed Artifact Hashes

These SHA-256 values were checked on resumption and recaptured after the successful fresh execution; they supersede the earlier artifact table for the current decision.

| Artifact | SHA-256 |
|---|---|
| themeteam/core/store.py | 9771d976b30ba0f525cb6f5608ee643926aa86f690b9c425264c1f4a69d8e88a |
| themeteam/core/models.py | a44ee8cff4da111d737327ac346236f3df44b7eb446b06d1059c27d614ac4d2a |
| themeteam/core/validation.py | e43c87d5c9aa74520ecf0a4ac32078e8ad47d6d1cecc40c930a0441902c8a7e4 |
| themeteam/web/server.py | ec5e76262f068aae9d355b43d4eafc384354c99f658e8f435b97bc2f165f41c7 |
| themeteam/web/static/app.js | 667d394aaa9d000c4f8a44e593fc03243a2338bd2d7fe825a698e7038fc592d3 |
| tests/test_security.py | 8daa8675fb54b43cdaac9352b0884ff9aaff9437ff5459be8ecc4db086d6d782 |
