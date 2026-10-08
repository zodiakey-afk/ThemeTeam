| 文档 | P4 M2 Definition of Done |
|---|---|
| 版本 | v1.0 |
| 日期 | 2026-09-24 |
| 状态 | 计划候选，等待 G2/G3 |
| 关联 | M2 / W07-W10 |

- SQLite 为唯一业务事实源，JSON 导入、备份和回滚有证据。
- `/api/v1` API、WebSocket 事件、cursor/resync、幂等和版本冲突有冻结契约。
- Mock runtime、Codex adapter、审批、取消、超时、重试、恢复和 artifact 隔离通过黑盒测试。
- 任务创建到执行、归档、刷新、断线和重启形成端到端证据。
- 旧 M1/W03 回归通过，workspace 原始 hash 未被测试破坏。
- 无明文凭据、越界写入、shell 拼接和伪审批。
- G4/G5 所需命令、报告、覆盖率/计数、独立评审和 QA 结论均已留痕。
