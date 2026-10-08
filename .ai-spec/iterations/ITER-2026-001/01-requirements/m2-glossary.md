| 文档 | R5 M2 术语表增量 |
|---|---|
| 版本 | v1.0 |
| 日期 | 2026-09-24 |
| 状态 | 已确认 |
| 关联 | M2 / W07-W10 |

| 术语 | 定义 |
|---|---|
| Workspace fact source | SQLite 中的业务实体和状态事实；前端、画布和 JSON 均为投影或迁移输入。 |
| Run | 一次任务执行尝试，具有独立状态、correlationId、artifact 目录和 retryOf。 |
| Artifact | 运行产生的文件；只能写入该 run 的受控目录。 |
| Outbox event | 与业务提交同一事务写入、等待发布到 WebSocket 的结构化事件。 |
| Cursor | 事件订阅位置；用于重连补偿、去重和缺口检测。 |
| Approval | 服务端维护的审批事实；客户端不能通过 payload 字段伪造。 |
| CorrelationId | 贯穿命令、run、事件、审计、artifact 和归档的追踪 ID。 |
| Confirmed write | 服务端已提交并返回确认版本的写操作；未确认写操作不能被前端视为成功。 |
