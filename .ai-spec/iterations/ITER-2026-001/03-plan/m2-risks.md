| 文档 | P3 M2 风险登记册 |
|---|---|
| 版本 | v1.0 |
| 日期 | 2026-09-24 |
| 状态 | 计划候选，等待 G2/G3 |
| 关联 | M2 / W07-W10 |

| ID | 风险 | 等级 | 缓解 |
|---|---|---|---|
| M2-R01 | JSON 与 SQLite 双写产生事实分裂 | 高 | SQLite 单一事实源；旧 API 只 projection；迁移后禁止 JSON 业务写入。 |
| M2-R02 | outbox 发布与数据库提交不一致 | 高 | 同事务 outbox；publisher 可重试；cursor replay。 |
| M2-R03 | 迁移破坏既有工作区 | 高 | 原子临时 DB、JSON backup、计数/hash/FK 校验和回滚演练。 |
| M2-R04 | 真实 CLI/权限环境不可复现 | 高 | Mock 黑盒先行；Codex smoke 单独标环境；不将环境失败记为产品通过。 |
| M2-R05 | artifact 或日志泄露敏感数据 | 高 | 相对路径 API、输出脱敏、secret scan、禁止 prompt 原文持久化。 |
| M2-R06 | 旧前端与新事件流状态漂移 | 中 | 旧快照兼容；确认版本；画布只消费投影；差异触发 resync。 |
| M2-R07 | Windows ACL 影响临时测试 | 中 | 使用用户身份创建 fixture；CI/本机测试目录预检；记录环境阻断。 |
