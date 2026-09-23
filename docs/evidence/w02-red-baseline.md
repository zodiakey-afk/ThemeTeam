| Document | W02 preimplementation defect reproduction |
|---|---|
| Version | 1.0 |
| Date | 2026-09-09 |
| Status | Reproduced; not acceptance |
| Links | tests/test_security.py; B01-04..07 |

Command: bundled Python 3.12.14 `-B tests/run_isolated.py`, cwd `C:/repos/ThemeTeam`, Windows 11 build 26200, exit 1. Result: 28 test methods, 31 failing assertions/subtests and 7 errors, no skips. Existing W01/store/server tests passed. New security tests reproduced traversal, malformed parsing, missing validation, approval forgery, archive duplication/backlinks, non-atomic save and foreign-origin acceptance. Output includes exceptions from the old handler; no stable JSON error contract yet.

Real workspace SHA-256 before and after: `106f669a107c9b7900387574879e25ee0b094bc82e71a22a787e7ec2e8f14190`. Guard denied accesses 0, leaked threads 0. All mutation fixtures temporary. Coverage not measured. No raw state contents copied into this report. Frozen specification precedes code changes; technical review still pending at reproduction time.
