| 文档 | M2 发布验收报告 |
|---|---|
| 版本 | v1.0 |
| 日期 | 2026-10-07 |
| 状态 | 验收完成；正式发布 No-Go |
| 关联 | M2 / W07-W10；M2_G4/G5/G6/G7；`m2-test-report.md` |

## 1. 验收结论

**结论：M2 当前工作树的机器验收通过，正式发布 No-Go。**

本次验收确认 SQLite 事实源、FastAPI `/api/v1`、任务/run 生命周期、人工审批、取消/重试、artifact 元数据、outbox/WebSocket replay/resync、M2 配置入口、数据库级 CAS、关键 FK、correlationId 追踪、重启 retry、线程收敛和前端任务页接入均具备机器证据。当前机器验收由 `19/19` 黑盒、`83/83 × 2` 后端回归和 `48/48` 前端回归覆盖；最终独立复审签署尚未归档，因此不能关闭 G4/G5。

正式发布仍不得批准，原因是 CodingSpec 强制人工门禁尚未完成：

- 修复后的独立实现复审尚未形成当前工作树的最终签署记录。
- QA/测试负责人尚未签署 G5。
- 项目负责人尚未签署 G6 发布批准。
- 需求负责人或项目负责人尚未签署 G7 修改报告最终确认。
- 真实 Codex workspace-write 业务 smoke 仍受 Windows ACL 环境限制；Claude/OpenCode executable smoke 当前环境不可用。

## 2. 范围与版本边界

### In scope

- M2 / W07-W10 SQLite、迁移、备份、规范化实体和事实源。
- `/api/v1` 命令、幂等、expectedVersion、审计和 outbox。
- WebSocket 初次订阅、事件回放、断点重连和 cursor gap resync。
- runtime/project profile 绑定、dispatcher run 生命周期、审批、取消、重试、恢复和 artifact 隔离。
- 任务页 M2 run 状态与事件刷新。

### Out of scope

- M3 GroupChat/Moderator/Leader 拆解。
- M4 文件解析、检索、记忆和知识审批流。
- M5 多团队、多楼层、离线模型和桌面发行。
- 旧 `/api/*` 入口立即退役；当前保留兼容路径。

## 3. 验收证据

| 类别 | 结果 | 证据 |
|---|---|---|
| M2 专项黑盒/集成 | 19/19 PASS | `tests/test_m2_service.py` |
| 后端隔离回归 | 83/83 × 2 PASS；1 项 symlink skip | `tests/run_isolated.py --rounds 2` |
| 前端单测 | 48/48 PASS | `frontend` `npm.cmd run test:unit` |
| 类型检查/生产构建 | PASS | `npm.cmd run typecheck` / `npm.cmd run build` |
| 真实 M2 启动 | PASS | `docs/evidence/m2-server-start-smoke.json` |
| WebSocket protocol reconnect/gap | PASS | `docs/evidence/m2-websocket-acceptance.json` |
| 迁移故障矩阵、SQLite integrity/FK/unique | PASS | `05-testing/evidence/m2-migration-fault-matrix.json` |
| 50 次持久化写入与重启校验 | PASS | `05-testing/evidence/m2-persistence.json` |
| 200 次本地命令延迟 | PASS，P95 39.039 ms | `05-testing/evidence/m2-latency.json` |
| Secret audit | PASS with scope | `docs/evidence/secret-audit-20261007.json` |
| 安全边界与可观测性 | PASS | `05-testing/evidence/m2-security.json`、`m2-observability.json` |
| 默认 workspace 完整性 | PASS，hash unchanged | `tests/run_isolated.py --rounds 2` 输出 |

## 4. 已修复验收缺陷

迁移故障注入发现 `os.replace` 失败时临时 SQLite 未清理。已在 `themeteam/core/sqlite_store.py` 增加 finally 清理路径，并通过重新执行迁移故障矩阵确认：

- malformed JSON 被拒绝；
- 已有目标文件保持不变；
- atomic replace 失败后临时 DB 被删除；
- `PRAGMA integrity_check` 为 `ok`；
- FK 违规为 0；
- artifact `(run_id, relative_path)` 重复键为 0。

## 5. 遗留风险与发布条件

| 风险/条件 | 当前状态 | 发布前动作 |
|---|---|---|
| 独立实现复审 | Pending | 当前复审服务仍返回旧工作树行号/结论；需重新基于最终工作树归档签署 |
| QA 签署 | Pending | QA 核对测试矩阵、缺陷和本报告后签署 |
| Codex workspace-write | Environment blocked | 在与发布执行一致的用户 ACL 下重跑并归档成功/失败证据 |
| Claude/OpenCode executable | Environment unavailable | 在目标环境可用时完成 smoke，或由项目负责人书面接受范围偏离 |
| settings/profile 旧 `/api/*` 兼容路径 | Partial by design | M2 保留兼容；后续统一 adapter，不作为本次核心链路失败 |
| P2 并发/FK 完整性 | Closed with scope | 数据库条件 CAS 与关键 FK 已通过回归；JSON array references 仍由业务校验维护 |
| 发布审批与最终确认 | Pending | 项目负责人完成 G6，需求/项目负责人完成 G7 |

## 6. 发布建议

在上述人工门禁和环境证据完成前，保持发布冻结；可以继续使用当前构建进行本地开发和受控验收。完成签署后，按 `release-plan.md`、`rollback-plan.md` 和 `release-checklist.md` 执行发布，不扩大 M2 范围。

## 7. 门禁状态

| 门禁 | 状态 | 说明 |
|---|---|---|
| M2_G4 | Pending | 机器实现证据完成；P1 修复后的独立实现复审待签署 |
| M2_G5 | Pending | 风险驱动证据完成；QA 和独立对抗评审待签署 |
| G6 | Pending | 发布/回滚文档已准备，项目负责人批准待完成 |
| G7 | Pending | 本报告已提交，最终确认待完成 |
