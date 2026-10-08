| 文档 | T2 M2 缺陷登记 |
|---|---|
| 版本 | v1.0 |
| 日期 | 2026-10-07 |
| 状态 | 当前已知项已分类 |
| 关联 | M2 / W07-W10；m2-test-report.md |

| ID | 严重度 | 描述 | 状态 | 处理 |
|---|---|---|---|---|
| M2-T-001 | Low | 旧 `/api/*` 方法仍保留为兼容导出；当前 Agent/runtime/project 表单已经使用 `/api/v1` | Accepted compatibility | 保留旧入口以满足 M2 兼容策略；不作为当前发布阻塞 |
| M2-T-002 | Medium | WebSocket 主动推送与 cursor replay 已有服务/集成证据，曾缺少真实服务 reconnect/gap 证据 | Closed | `docs/evidence/m2-websocket-acceptance.json` 已证明初次订阅、断点回放和 gap resync |
| M2-T-003 | Medium | 真实 Codex workspace-write smoke 受 Windows ACL 影响；manual run approval path is explicit in the smoke | Environment | 在同一用户 ACL 临时目录重跑；不计作产品缺陷 |
| M2-T-004 | Low | Claude/OpenCode executable 不一定存在 | Environment | executable unavailable 时保留结构化结果和环境证据 |
| M2-T-005 | Low | SQLite 规范化实体表和关键 FK/unique 已实现；曾缺少迁移故障矩阵与全量 FK 审计 | Closed | `05-testing/evidence/m2-migration-fault-matrix.json` 已通过 malformed JSON、atomic replace failure、integrity/FK/unique 检查 |
| M2-T-006 | Process | 修复后独立实现复审尚未形成基于最终工作树的可靠签署记录 | Pending independent review | 最近一次返回结论引用了更早工作树，不能作为当前复审证据；G4 保持 pending |
| M2-T-007 | Medium | 迁移在 `os.replace` 失败时未清理临时 SQLite 文件 | Closed | 修复 `migrate_json_to_sqlite` finally 清理路径；故障矩阵复测通过 |
| M2-T-008 | P1 | 版本语义、M2 配置事实源、非法枚举校验、权限边界和 environment_unavailable 重试存在复审缺口 | Fixed pending independent re-review | 已完成最小修复；最终 M2 黑盒回归 19/19、全量回归 83/83 x 2、前端 48/48 通过；等待最终独立复审确认 |
| M2-T-009 | P2 | `finish_cas` 曾依赖进程内锁，尚非多进程数据库条件 CAS | Closed | `UPDATE` 已增加 expected version/status 条件；两连接 stale callback 竞争用例通过 |
| M2-T-010 | P2 | 部分历史业务引用曾未在 SQLite schema 中形成完整 FK | Closed with scope | runs/task/retry、approvals、audit、outbox、idempotency 关键 FK 已声明并通过 `foreign_key_check=0`；JSON array references 仍由业务校验维护 |
| M2-T-011 | Environment | Codex workspace-write smoke 受 Windows ACL 影响；Claude/OpenCode executable 不可用 | Open / environment | 在目标执行环境补做真实 CLI smoke，或由项目负责人书面接受偏离 |
| M2-T-012 | P2 | 增加 FK 后，普通 snapshot projection 重建可能删除被 run 引用的任务 | Closed | 普通命令改为增量 upsert，显式 import/初始化保留全量替换；`19/19` M2 专项与 `83/83 × 2` 回归通过 |
| M2-T-013 | P1 | 归档文档、run、audit 的 correlationId 链路不完整 | Fixed pending independent re-review | 文档模型/API/归档逻辑保留原 run correlationId，并由黑盒回归验证 |
| M2-T-014 | P1 | 设置页/启动路径可能优先读取旧 `/api/state`，M2 snapshot 不始终为事实源 | Fixed pending independent re-review | 启动及配置视图优先加载 `/api/v1` snapshot；旧入口仅作兼容 fallback |
| M2-T-015 | P1 | dispatcher 重启后 retry 规格只存在内存 `_specs` | Fixed pending independent re-review | 通过持久化 task/runtime/project profile 重建受控 retry prompt；重启 retry 回归通过 |
| M2-T-016 | P2 | dispatcher worker 完成态从活动表移除过早，close 可能与 SQLite 访问竞态 | Fixed pending independent re-review | completed-thread 跟踪与 shutdown 等待已加入；全量回归无泄漏线程 |
