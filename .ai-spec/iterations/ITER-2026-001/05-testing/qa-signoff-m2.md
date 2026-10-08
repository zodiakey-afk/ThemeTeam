| 文档 | M2 QA/G5 签署包 |
|---|---|
| 版本 | v1.0 |
| 日期 | 2026-10-07 |
| 状态 | 待 QA 签署；统一人工审批入口已建立 |
| 关联 | M2 / W07-W10；m2-test-report.md；m2-release-acceptance-report.md |

统一人工审批入口：`.ai-spec/iterations/ITER-2026-001/06-release/m2-human-approval-package.md`

## QA review scope

QA should review the frozen M2 black-box specification, current test report, defect register, security audit, and release acceptance report.

## Machine evidence

- M2 specialized regression: `19/19`
- Backend isolated regression: `83/83 x 2`, one Windows symlink case skipped
- Frontend unit tests: `48/48`
- Frontend typecheck/build: passed
- SQLite migration fault matrix: passed
- SQLite CAS/FK hardening: passed
- Correlation/restart-retry/worker shutdown regression: passed
- Secret audit: no strict credential-format matches in working tree or Git history

## QA decision

Decision: **PENDING**

QA signer: ____________________

Role: ____________________

Date: ____________________

Signature/approval reference: ____________________

## Conditions to record

- Protocol-level WebSocket evidence does not claim browser UI rendering.
- Codex workspace-write smoke remains environment-blocked by Windows ACL.
- Claude/OpenCode executable smoke remains unavailable in this environment.
