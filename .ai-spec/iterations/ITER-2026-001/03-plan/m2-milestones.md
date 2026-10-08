| 文档 | P2 M2 里程碑计划 |
|---|---|
| 版本 | v1.0 |
| 日期 | 2026-09-24 |
| 状态 | 计划候选，等待 G2/G3 |
| 关联 | M2 / W07-W10 |

| 里程碑 | 退出条件 |
|---|---|
| M2-A 数据底座 | SQLite schema、JSON 导入、备份/回滚、旧快照兼容；W07 BB 全部通过。 |
| M2-B 事件与恢复 | outbox、WebSocket cursor、gap resync、幂等/版本冲突；W08 BB 全部通过。 |
| M2-C 执行闭环 | runtime profile、审批、run lifecycle、Mock + Codex 受控执行；W09 BB 全部通过。 |
| M2-D 产品闭环 | 任务页、artifact、归档、重启/断线 E2E；W10 BB/NFR/独立评审完成。 |

关键路径：W07.1 -> W08.1 -> W08.2 -> W09.2 -> W10.3。
