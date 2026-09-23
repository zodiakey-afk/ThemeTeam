| 文档 | P4/P5 CLI 执行与容量扩展黑盒规格 |
|---|---|
| 版本 | v1.0 |
| 日期 | 2026-09-23 |
| 状态 | 冻结；实现前创建 |
| 关联 | P4；P5；`docs/agent-cli-architecture.md` |

## 黑盒验收

| ID | 验收 |
|---|---|
| BB-P4-01 | 提交合法 Agent 任务后生成 `queued -> running -> succeeded/failed/cancelled` 状态，任务状态由 dispatcher 更新，不由画布动画决定 |
| BB-P4-02 | Codex 任务使用已登记 runtime/project profile、argv 数组和受控 artifact 目录，完成后返回退出码、脱敏摘要和 artifact 清单 |
| BB-P4-03 | 任务超时、取消、非零退出均有结构化结果，进程树和后台线程清理，无孤儿运行记录 |
| BB-P4-04 | 失败任务可 retry，生成新 run 并保留 `retryOf`，旧 run 不被覆盖 |
| BB-P4-05 | dispatcher 重启时将未完成 run 标记为 `interrupted`，不伪造成功 |
| BB-P4-06 | Claude/OpenCode adapter 遵守同一 argv/超时/输出/目录契约；CLI 不存在时结构化失败 |
| BB-P4-07 | 两个工程目录并行运行互不共享 cwd、artifact、状态或取消 token |
| BB-P4-08 | runtime/project profile 持久化到独立本机 settings store；workspace JSON 不作为其唯一来源 |
| BB-P5-01 | 20 个可见工位满载后创建新成员，自动解锁扩容房间并分配 `unplaced` 状态，不覆盖已有工位 |
| BB-P5-02 | 扩容后目录中所有成员保留，未定位成员有明确原因；已有 M1 20 人场景行为不改变 |

## 安全约束

- 不读取、注入或持久化 API key、OAuth token、CLI session。
- executable 只能来自 adapter allowlist，禁止 shell 拼接。
- artifact 必须位于运行专属目录；任务文本不能改变 cwd 或 artifact 根。
- 本轮不关闭 M1 G4/G5/G6/G7 人工 pending。
