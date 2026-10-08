| 文档 | R1 M2 需求澄清记录 |
|---|---|
| 版本 | v1.0 |
| 日期 | 2026-09-24 |
| 状态 | 已确认 |
| 关联 | M2 / W07-W10；docs/plan.md；docs/requirements.md |

## 原始输入

2026-09-24，需求负责人确认继续推进初始计划 M2。M2 以 W07-W10 为实现边界：

- W07：FastAPI + SQLite + JSON 迁移。
- W08：outbox、WebSocket、幂等与恢复。
- W09：模型配置、真实/受控 adapter、运行、取消、重试和审计。
- W10：看板指派、人物联动、产物归档和断线/重启闭环。

## 已解决的边界

| 问题 | 结论 |
|---|---|
| M1 与 M2 的关系 | M1 画布作为客户端投影继续保留；M2 不重做 M1 视觉与寻路。 |
| 事实来源 | SQLite 作为业务实体、运行记录、审批、审计和 outbox 的事实源；文件系统保存 artifact 与文档内容。 |
| 旧数据 | 首次启动执行可回滚 JSON 导入；原 JSON 保留为备份，导入失败不得覆盖原文件。 |
| 运行时 | Mock runtime 用于确定性测试；Codex 为首个真实 CLI adapter；Claude/OpenCode 只完成契约兼容和可用时 smoke。 |
| 审批 | manual runtime 的真实写任务必须先进入 waiting；审批由服务端命令改变状态，不能由前端字段伪造。 |
| 会议与知识 | 真实 GroupChat、文件解析、向量检索和三层记忆不在 M2，分别留给 M3/M4。 |
| 多团队与扩容 | M2 只验收单团队；P5 的地图扩容和多团队不作为 M2 退出条件。 |

## 外部依赖

- Python `fastapi`、`uvicorn` 已在当前环境可用；SQLite 使用 Python 标准库。
- Codex 可执行文件和登录状态属于本机外部依赖；无可执行文件时，契约测试必须仍可通过，真实 smoke 标记 environment_unavailable。
- 真实模型凭据不进入 workspace、SQLite 业务表、日志、前端 snapshot 或测试证据。
- 独立技术评审和 QA 签署仍是后续门禁人工项。
