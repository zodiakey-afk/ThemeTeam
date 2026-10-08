| 文档 | R3 M2 NFR 验收标准 |
|---|---|
| 版本 | v1.0 |
| 日期 | 2026-09-24 |
| 状态 | 冻结候选，待 G2/G3 设计评审 |
| 关联 | M2 / W07-W10；NFR-05、NFR-06、NFR-07、NFR-10 |

| ID | NFR | 指标/阈值 | 环境与度量 |
|---|---|---|---|
| M2-NFR-01 | 持久化一致性 | 50 次已确认写入后重启，丢失 0；导入/回滚演练成功 | Windows 11、Python 当前版本、SQLite 临时数据库；命令证据与 checksum。 |
| M2-NFR-02 | 事件恢复 | 断线期间 100 个事件，重连后快照与游标在 3 秒内一致；重复副作用 0 | 本地 loopback；故障注入、事件计数、最终实体 hash。 |
| M2-NFR-03 | 本地命令响应 | 非模型命令确认 P95 <=300ms，run 状态落库 P95 <=500ms | 单团队、200 任务样本；服务端 monotonic clock。 |
| M2-NFR-04 | 执行隔离 | 两个工程目录并行运行不串 cwd、artifact、取消 token 或事件；越界写入 0 | Mock + Codex adapter；目录快照和 artifact 清单。 |
| M2-NFR-05 | 安全 | 明文密钥/令牌在 snapshot、SQLite、日志、响应中为 0；路径穿越、shell 注入、伪审批成功为 0 | 固定恶意语料；BB/WB 安全测试和 secret scan。 |
| M2-NFR-06 | 运行恢复 | 进程重启时 queued/running run 变为 interrupted；不得伪造 succeeded；retryOf 链完整 | dispatcher 重启故障注入；run store 与 SQLite 对账。 |
| M2-NFR-07 | 归档幂等 | 同一 run 的结果归档重复提交不新增文档或记忆；correlationId 可追踪 | 并发重复请求 8 次；数据库唯一约束和最终计数。 |
| M2-NFR-08 | 可观测性 | 每个命令、run、artifact、审批和归档事件可按 correlationId 查询；敏感字段脱敏 | 审计查询、日志扫描、事件 schema 校验。 |

不适用项：M1 帧率、100 人多楼层性能、会议流式文本、PDF 解析和向量检索不属于 M2 退出条件，沿用现有 M1/M3/M4 规格。
