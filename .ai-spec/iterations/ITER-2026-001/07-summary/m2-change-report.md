| 文档 | ITER-2026-001 / M2 修改报告 |
|---|---|
| 版本 | v1.0 |
| 日期 | 2026-10-07 |
| 状态 | 待最终确认 |
| 关联 | M2 / W07-W10；G4/G5/G6/G7 |

## 修改总览

| 修改 ID | 路径 / 产物 | 修改内容 | 修改原因 | 实现能力 |
|---|---|---|---|---|
| M2-01 | `themeteam/core/sqlite_store.py` | SQLite 事实源、迁移/备份、规范化实体、outbox、audit、idempotency、CAS/FK hardening、增量 projection | 完成 M2 持久化一致性、并发终态保护和引用完整性 | 可回滚迁移、条件 CAS、关键 FK、运行与任务状态一致 |
| M2-02 | `themeteam/core/dispatcher.py` | 审批、取消、终态 CAS、重启恢复、retry spec fallback、worker shutdown 收敛 | 完成任务执行生命周期和重启恢复 | 运行隔离、可靠终态、重启后 retry、无 worker 泄漏 |
| M2-03 | `themeteam/core/m2_service.py`, `themeteam/web/api_v1.py` | `/api/v1` 任务、Agent、runtime、工程目录、审批、运行、归档和 correlationId 追踪 | 建立 M2 服务闭环 | SQLite 事实源上的配置与任务/run 操作 |
| M2-04 | `frontend/src/App.tsx`, `frontend/src/workspace.ts`, `frontend/src/types.ts`, `frontend/src/workspace-schema.json` | M2 snapshot 启动、任务/run 控制、配置写入、unknown outcome freeze、事件 replay | 让前端始终消费 M2 事实源 | 任务页、设置页、审批/取消/重试和断线恢复 |
| M2-05 | `tests/test_m2_service.py`, `tests/run_m2_release_acceptance.py` | 黑盒、CAS/FK、重启 retry、correlation、迁移故障、NFR 和真实服务协议验收 | 建立可重复发布证据 | `19/19` M2、`83/83 x 2` 后端、真实服务验收 |
| M2-06 | `.ai-spec/*`, `docs/evidence/*`, `docs/kb/*` | 测试、缺陷、发布、secret audit、知识库和签署包 | 完成门禁溯源和人工签署准备 | QA/G6/G7 可直接审阅和签署 |

## 验证结果

| 验证项 | 结果 | 证据 |
|---|---|---|
| M2 专项 | PASS 19/19 | `tests/test_m2_service.py` |
| 后端回归 | PASS 83/83 x 2；1 项 symlink skip | `tests/run_isolated.py --rounds 2` |
| 前端 | PASS 48/48、typecheck、build | `frontend` scripts |
| SQLite CAS/FK | PASS | `m2-cas-fk-hardening.json` |
| Secret audit | PASS with scope | `docs/evidence/secret-audit-20261007.json` |
| 真实服务/NFR | PASS | `docs/evidence/m2-websocket-acceptance.json`; `05-testing/evidence/` |

## 遗留风险

- 独立实现复审当前仍缺少可靠的最终签署记录。
- QA、项目负责人发布批准和最终确认尚未签署。
- Codex workspace-write 受 Windows ACL 限制；Claude/OpenCode executable 不可用。
- JSON array references 依赖业务校验，不全部落为关系型 FK。

## 最终确认

| 时间 | 角色 | 结论 | 范围 |
|---|---|---|---|
| 待填写 | 需求负责人 / 项目负责人 | 待确认 | M2 全部修改、证据和遗留风险 |
