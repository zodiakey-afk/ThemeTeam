| Document | W01 Independent Code Review |
|---|---|
| Version | v1.0 |
| Date | 2026-09-09 |
| Status | PENDING: W01 lifecycle finding requires resolution |
| Related | ITER-2026-001; B01-01/02/03; W01-SERVER-1; BB-W01-01 through BB-W01-05 |

## Scope and Independence

Independent reviewer, separate from implementation; no implementation history or author reasoning used. Read `docs/first-batch.md`, the frozen `02-design/contracts/w01.json` and `05-testing/w01-spec.md` under `.ai-spec/iterations/ITER-2026-001` before reviewing the six requested Python files. Checked Store initialization/loading only as supporting dependency context. This is scoped feature-workflow review evidence, not release approval or a change to shared gate/state records.

## Blocking W01 Finding

- **R1 / P2 (Medium): thread construction failure bypasses listener cleanup.** `tests/support.py:23-29` binds the server, then constructs `threading.Thread` before entering the cleanup `try`. If construction raises (fault-injected `MemoryError`), neither `server_close()` nor the later cleanup runs. The socket can remain live while the server/exception traceback is retained, violating B01-03's service-start failure cleanup requirement. Reproduction: use `temporary_store()`, capture the created server without changing it, patch `support.threading.Thread` to raise `MemoryError`, and enter `running_server(store)`. Observed `socket.fileno() != -1`; rebinding the same address raised `OSError`. The existing start-failure test (`tests/test_isolation.py:98-115`) only patches `Thread.start`, after the cleanup boundary, so does not cover this path. **Required:** extend cleanup ownership to all post-bind initialization and add a constructor-failure regression. Reviewer explicitly closed the captured listener afterward; no probe resources remained.

## Additional W01 Observation

- **R2 / P2 (Medium), conditional runner limitation:** `tests/run_isolated.py:24` and `:47` unconditionally read the default file for integrity checks. With an absent default file, the entry point raises `FileNotFoundError` before discovering any tests, although Store supports a missing file via seed initialization (`themeteam/core/store.py:259`). Reproduced by importing the runner and assigning only its integrity-check `DEFAULT` to a nonexistent path in a temporary directory; `main()` with `--rounds 1` failed before discovery. Handle absent-before/absent-after explicitly without creating user state, or document an existing-file prerequisite. This does not invalidate the four successful rounds below; the frozen hash acceptance scenario assumes an existing file and does not explicitly specify an absent-file case.

## Independent Verification

Environment: `C:/repos/ThemeTeam`, Windows 11 build 26200, Python 3.12.14. Executable: `C:/Users/z00654528/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe`; commands used PowerShell here-string scripts piped to Python `-B -`. No implementation/test files were edited, no bytecode was written, and no real `workspace_state.json` was opened or used as a fixture.

| Check | Execution and observed evidence | Result |
|---|---|---|
| Regression / repeated runs | Three fresh subprocesses imported the delivered runner and invoked `main()` with rounds `1`, `1`, `2`. Each round: 16 tests, 0 failures/errors/skips; all subprocess exit codes 0. | PASS, 64/64 executions |
| Workspace isolation | Wrapper rejected real `workspace_state.json` open attempts; only runner `DEFAULT` was replaced with a temporary `{}` sentinel. No Store binding was replaced by the wrapper. All reports: denied accesses 0, leaked threads `[]`; outer guard attempts `[]`. The import test's subprocess retained its own audit guard. | PASS for exercised paths |
| Two instances / import / bind / failure cleanup | Delivered BB/WB tests passed in every round, covering independent saves, B surviving A shutdown, explicit reload, import, occupied port, assertion failure and `Thread.start` failure. | PASS for covered cases |
| Store-load failure ordering | Patched default Store construction to raise `ValueError`; observed 0 `ThemeTeamServer` constructor calls. Probe exit 0. | PASS |
| Divergent setup failure | Thread-constructor fault above: open socket and retained port; temporary directory removed. Explicit reviewer cleanup then confirmed closed sockets and unchanged thread set. Probe exit 0 means reproduction succeeded. | FAIL: R1 |
| Absent integrity target | Temporary nonexistent runner target raised `FileNotFoundError` before discovery. Probe exit 0 means reproduction succeeded. | R2 confirmed |

The sentinel SHA-256 stayed `44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a`. This is **not** a real-workspace hash result. Actual before/after JSON hash verification remains pending because this review honored the instruction not to touch that file. No coverage percentage or exhaustive listener/worker cleanup claim is made.

Reviewed artifact SHA-256 values (no Git repository was available):

| File | SHA-256 |
|---|---|
| `themeteam/web/server.py` | `0f7d991737c6e5fd5e765d2a85007d32b9c20841746b79fb6075e6c57fa83acc` |
| `tests/support.py` | `5c1c45ba5afe5c4fcf62a60fc0080622ef008c9a36fb7aa500019eedde1b90d9` |
| `tests/test_isolation.py` | `ca204da25b4d4912596379ea85713b85b08fa0f9f54b164053af9a820b289912` |
| `tests/test_server.py` | `ffd6a09dc9ca6b8e2554448a3c9b2953f5e9e9ecfe51e8c040db55f1dd31911e` |
| `tests/test_store.py` | `cd7feefc4d5bf2a19d389f36a795d01e479b3f983b9bee71dfc3c881b1481867` |
| `tests/run_isolated.py` | `e8f685e6d73f3a0045ebab33c0a1976c50a2d7a887a6a04e2632dabce4096337` |

## Existing Out-of-Scope Risks

The delivered `/docs/` path lacks containment enforcement (`themeteam/web/server.py:60-64`), and body parsing occurs outside its error-handling block (`:70-71`). These match already-declared W02 path/input-hardening work, not W01 isolation regressions. They were not exploit-tested or assigned release clearance here; no history-based attribution is possible. They do not drive the W01 conclusion.

## Conclusion

**PENDING for W01 acceptance:** R1 blocks the stated startup-failure cleanup guarantee. Normal isolation and the exercised repeated-run matrix pass. Resolve R1, rerun its regression and the four-round matrix, and attach authorized real-hash evidence before closing B01-01/03. R2 needs explicit disposition. QA/project-owner gate updates and release/final confirmation remain outside this independent review.

## Independent Re-review (2026-09-09)

**Latest conclusion: PASS for the scoped W01 code review.** This addendum supersedes the original PENDING conclusion above; original findings and evidence remain as history. R1 and R2 are closed on the reviewed revisions. No remaining blocking W01 issue was found. W02 security work, QA/release approvals and shared gate updates remain separate and are not approved by this result.

- **R1 / P2 resolved:** `tests/support.py:25-29` now constructs the thread inside the cleanup boundary; `tests/test_isolation.py:117-134` adds the constructor-failure regression. Independently repeated the original `MemoryError` probe: the retained server socket had descriptor -1, the same address could be rebound, the temporary directory was removed, and the thread set returned to baseline.
- **R2 / P2 resolved:** `tests/run_isolated.py:27` and `:50` represent an absent integrity target as `None` without creating it. Positive-round validation is at `:25-26`; empty-discovery failure is at `:56`. Direct probes confirmed the expected outcomes below.

Verification used the same Windows/Python environment and a PowerShell here-string piped to Python `-B -` from `C:/repos/ThemeTeam` (aggregate command exit 0). The parent performed read-only SHA-256 checks of the real workspace before/after all seven child probes. Child audit guards rejected real-workspace opens/removals/renames; the import test's own subprocess retained its audit guard. Runner integrity targets were temporary present/absent sentinel paths, never real user data.

| Check | Actual result |
|---|---|
| Four-round matrix | Two independent one-round processes plus a third process with two rounds: **17 tests per round, 68/68 executions passed**, 0 failures/errors/skips; each runner exit 0. |
| W01-only selection | Harness composed discovery of exactly `test_isolation.py`, `test_server.py`, `test_store.py` for every round. `test_security.py` was neither imported nor executed. The runner's default broad discovery is not claimed to pass W02. |
| Present/absent targets | First process: sentinel hash unchanged. Second and third: before/after `null`, target still absent. All matrix reports: denied accesses 0 and leaked threads `[]`; child real-workspace access attempts `[]`. |
| Constructor fault | Closed listener, same-port rebind succeeded, temporary directory removed, no residual thread. Probe exit 0. |
| Invalid rounds | `--rounds 0` and `--rounds -1`: parser exit 2, message `rounds must be positive`; no target created. |
| Empty discovery | `--rounds 1 --pattern no_such_w01_test_*.py`: 0 tests, runner exit 1, no target created. |
| Real-workspace integrity | Parent before/after SHA-256 both **`106f669a107c9b7900387574879e25ee0b094bc82e71a22a787e7ec2e8f14190`**. This closes this review's earlier real-hash evidence gap. |

Updated SHA-256 identities: `tests/support.py` = `ae4da3d931c665919b63793c5c1b33847d5a6751f10c640c40c54e40b06e9220`; `tests/test_isolation.py` = `888d0864be9be80be67f0075112b4194c4c8802b8ab30adc140e505c3c0333ea`; `tests/run_isolated.py` = `e352914bf18daaa1027292bb0c7e023c6d33a0d012772eaca8625baefd55623f`. The other three reviewed files match their original recorded hashes. Only this report was edited by the reviewer; implementation and tests were not modified.
