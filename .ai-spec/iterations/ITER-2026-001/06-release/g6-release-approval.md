| 文档 | M2 G6 发布批准包 |
|---|---|
| 版本 | v1.0 |
| 日期 | 2026-10-07 |
| 状态 | 项目负责人已批准条件发布；正式生产发布仍受 G4/G5 条件约束 |
| 关联 | M2 / W07-W10；release-plan.md；rollback-plan.md；m2-release-acceptance-report.md |

统一人工审批入口：`.ai-spec/iterations/ITER-2026-001/06-release/m2-human-approval-package.md`

## Release recommendation

Recommendation: **NO-GO until G5 and environment exceptions are resolved or explicitly accepted.**

## Prepared evidence

- Release plan: `release-plan.md`
- Rollback plan: `rollback-plan.md`
- Release checklist: `release-checklist.md`
- Acceptance report: `m2-release-acceptance-report.md`
- Secret audit: `docs/evidence/secret-audit-20261007.json`
- Current machine evidence: `19/19` M2, `83/83 x 2` backend, `48/48` frontend

## Approval decision

Decision: **CONDITIONAL GO for repository submission and next-phase planning; production release remains gated**

Project owner: User

Role: Requirement owner / project owner

Date: 2026-10-08

Decision reference: Current user instruction: “M2审核通过，提交代码上仓，制定接下来M3、M4阶段计划”

## Explicit exception decisions required

- Codex workspace-write Windows ACL block: accept / reject
- Claude/OpenCode unavailable: accept / reject
- Residual JSON-array-reference validation boundary: accept / reject
