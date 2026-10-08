| 文档 | M2 整体人工审批与收尾包 |
|---|---|
| 版本 | v1.0 |
| 日期 | 2026-10-08 |
| 状态 | 项目负责人批准；技术独立复审/QA 条件仍待签署 |
| 关联 | M2 / W07-W10；UI_DRAG_LANGUAGE；M2_G4/G5/G6/G7 |

## 1. 审批结论摘要

当前结论：**机器验收通过，正式发布暂不批准（No-Go pending human gates）。**

M2 核心机器证据：

- M2 专项测试：19/19
- 后端隔离回归：83/83 × 2；1 项 Windows symlink case 因 ACL 跳过
- 前端历史单测：48/48
- 前端当前 typecheck：通过
- SQLite 迁移故障矩阵、CAS/FK、持久化、延迟、安全、可观测性：已有通过证据
- Secret audit：工作树与可达 Git 历史未命中严格格式凭据

当前不能自动关闭的项目：

- 当前工作树独立实现复审尚未形成最终签署记录
- QA/G5 尚未签署
- 项目负责人/G6 尚未批准发布
- G7 修改报告最终确认尚未签署
- UI 拖拽与中英文切换的完整浏览器 E2E 尚未绑定当前工作树
- Codex workspace-write 真实业务 smoke 受 Windows ACL 阻断
- Claude/OpenCode executable smoke 当前环境不可用
- 本次提交前本地 M2 unittest 重跑因选定 Python 环境缺少 `fastapi` 依赖失败；历史 19/19 证据仍保留，但未由本次环境重新认证

项目负责人决定（2026-10-08）：**批准 M2 代码提交和后续 M3/M4 计划；正式生产发布为有条件批准，必须在独立复审、QA 签署和环境例外处理完成后执行。**

## 2. 已确认的产品范围

用户已于 **2026-10-08** 确认：

- 空白区域拖拽只平移办公室视口，不修改员工、任务、房间或工作区事实
- 成员点击继续选中；空白点击继续清除选择
- English 只翻译产品 UI，不自动翻译用户内容
- 默认中文，语言偏好使用 `localStorage` 持久化
- UI 范围覆盖办公室、任务、设置、运行状态和 Inspector

证据：

- `.ai-spec/iterations/ITER-2026-001/01-requirements/office-drag-language-clarification.md`
- `.ai-spec/iterations/ITER-2026-001/07-summary/office-drag-language-change-report.md`

## 3. 人工审批矩阵

### A. 独立实现复审 / M2_G4

审批角色：独立技术评审人 / 代码评审人

请确认：

- [ ] 评审对象是当前最终工作树，而不是历史提交或旧证据
- [ ] SQLite 事实源、迁移、CAS/FK、outbox、审计、run 生命周期和前端 M2 接入无未关闭 P0/P1
- [ ] UI 拖拽命中分流不会破坏成员选择、空白清选、触摸平移和双指缩放
- [ ] 中英文资源切换不会改变业务数据、workspace snapshot 或 API 契约
- [ ] 已审阅遗留风险和环境限制

决定：

| 时间 | 评审人 | 角色 | 结论 | 签署引用 |
|---|---|---|---|---|
|  |  | 独立技术评审人 | 待确认：通过 / 有条件通过 / 不通过 |  |

### B. QA / M2_G5

审批角色：QA / 测试负责人

请确认：

- [ ] M2 19/19 黑盒测试证据已审阅
- [ ] 后端 83/83 × 2 回归证据已审阅
- [ ] 前端 48/48 历史单测、typecheck/build 证据已审阅
- [ ] 迁移故障、持久化、延迟、安全、可观测性、CAS/FK 证据已审阅
- [ ] UI 拖拽与双语功能的浏览器 E2E 已执行，或明确接受当前环境下的延期/补测
- [ ] 缺陷登记册没有未接受的 Blocker/Critical
- [ ] Secret audit 的扫描范围和局限已理解

决定：

| 时间 | QA 签署人 | 结论 | 签署引用 |
|---|---|---|---|
|  |  | 待确认：通过 / 有条件通过 / 不通过 |  |

### C. 项目负责人 / G6 发布批准

审批角色：项目负责人

发布决定：

- [ ] GO：批准按 release plan 发布
- [ ] CONDITIONAL GO：接受下列例外后发布
- [ ] NO-GO：保持发布冻结，先完成补测/复审

必须明确的例外决定：

| 例外项 | 接受 | 拒绝 | 补充条件 |
|---|---:|---:|---|
| Codex workspace-write Windows ACL 阻断 | [ ] | [ ] |  |
| Claude/OpenCode executable smoke 不可用 | [ ] | [ ] |  |
| JSON array references 仍由业务校验而非完整关系型 FK 保护 | [ ] | [ ] |  |
| UI 完整浏览器 E2E 需要后补 | [ ] | [ ] |  |
| 当前工作树尚未形成独立发布提交 | [ ] | [ ] |  |

发布批准记录：

| 时间 | 项目负责人 | 结论 | 目标环境 | 批准引用 |
|---|---|---|---|---|
| 2026-10-08 | User | CONDITIONAL GO；批准提交代码和推进 M3/M4，生产发布继续受 G4/G5 条件约束 | 本地仓库 / 后续受控发布环境 | 当前用户确认“M2审核通过，提交代码上仓，制定 M3/M4 阶段计划” |

### D. 需求负责人 / 项目负责人 / G7 最终确认

请确认已理解并接受：

- [ ] M2 修改报告覆盖源代码、测试、配置、文档、证据和知识库产物
- [ ] 当前机器验收结果和测试环境限制
- [ ] 发布边界与 out-of-scope 内容
- [ ] 遗留风险、环境例外和补测要求
- [ ] UI 拖拽与双语范围已按 2026-10-08 人工确认执行

最终确认记录：

| 时间 | 确认人 | 角色 | 结论 | 确认引用 |
|---|---|---|---|---|
| 2026-10-08 | User | 需求负责人 / 项目负责人 | 接受 M2 修改、证据、遗留风险和条件发布边界；批准提交代码 | 当前用户确认“M2审核通过” |

## 4. 审核证据索引

### M2 核心

- `.ai-spec/iterations/ITER-2026-001/05-testing/m2-test-report.md`
- `.ai-spec/iterations/ITER-2026-001/06-release/m2-release-acceptance-report.md`
- `.ai-spec/iterations/ITER-2026-001/05-testing/qa-signoff-m2.md`
- `.ai-spec/iterations/ITER-2026-001/06-release/release-plan.md`
- `.ai-spec/iterations/ITER-2026-001/06-release/rollback-plan.md`
- `.ai-spec/iterations/ITER-2026-001/06-release/release-checklist.md`
- `.ai-spec/iterations/ITER-2026-001/07-summary/m2-change-report.md`
- `.ai-spec/iterations/ITER-2026-001/07-summary/final-confirmation-m2.md`

### UI 拖拽与双语

- `.ai-spec/iterations/ITER-2026-001/01-requirements/office-drag-language-clarification.md`
- `.ai-spec/iterations/ITER-2026-001/05-testing/office-drag-language-test-plan.md`
- `.ai-spec/iterations/ITER-2026-001/07-summary/office-drag-language-change-report.md`
- `frontend/src/office/sceneAdapter.ts`
- `frontend/src/i18n.ts`
- `frontend/tests/m1-e2e.cjs`

### 安全与环境限制

- `docs/evidence/secret-audit-20261007.json`
- `docs/evidence/codex-task-smoke.json`
- `docs/evidence/codex-cli-smoke.json`

## 5. 收尾规则

在 A、B、C、D 的签署记录全部完成前：

- M2_G4/G5/G6/G7 保持 `pending`
- 正式发布保持 `No-Go`
- 可继续本地开发和受控验收，但不得声明生产发布完成

签署完成后，按 `release-plan.md`、`rollback-plan.md`、`release-checklist.md` 执行发布，并将最终引用回写到 `gate-manifest.yaml`、`state.yaml` 和 `registry.yaml`。
