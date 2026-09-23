| 文档 | CLI Adapter 黑盒与安全验证规格 |
|---|---|
| 版本 | v1.0 |
| 日期 | 2026-09-23 |
| 状态 | 冻结；实现前创建 |
| 关联 | P2；`docs/agent-cli-architecture.md`；`docs/next-development-plan-unified.md` |

## 范围

本轮只验收本机 Codex CLI 的受控只读执行能力，不验收真实业务任务、模型 API 密钥托管、Claude/OpenCode 接入或前端任务编排。

## 黑盒验收

| ID | Given / When | Then |
|---|---|---|
| BB-CLI-01 | 使用登记的 `ProjectDirectoryProfile` 启动 Codex CLI | 进程 cwd 是校验后的真实目录；只允许引用已登记目录，任务文本不能覆盖 cwd |
| BB-CLI-02 | 运行 Codex adapter 的只读 prompt | 使用 argv 数组启动，不经过 shell；返回退出码、状态、stdout/stderr 摘要和 cwd 摘要 |
| BB-CLI-03 | 运行超时或取消的子进程 | 任务在有界时间内结束，进程及其子进程组被清理，返回 `timed_out` 或 `cancelled`，不遗留后台线程 |
| BB-CLI-04 | 子进程持续输出超过上限 | stdout/stderr 继续被排空但只保留上限内内容，结果标记截断，不因管道背压卡死 |
| BB-CLI-05 | 工程目录是越界目录、符号链接逃逸、文件或不存在路径 | 启动前拒绝，不产生子进程，不改变工作区或目录内容 |
| BB-CLI-06 | 运行时 profile 的类型、可执行文件或参数不合规 | adapter 拒绝未知 runtime、任意 shell 字符串和不允许的 executable |
| BB-CLI-07 | 输出包含疑似 API key、Bearer token 或 credential 字段 | 返回值和证据摘要脱敏；不记录 secret、session token 或完整环境变量 |
| BB-CLI-08 | Codex CLI 不存在、未登录或返回非零退出码 | 返回结构化失败，保留安全错误摘要；不得伪造成功 |

## 白盒补充

- `WB-CLI-01`：Windows 进程组创建、超时、取消和强制清理路径。
- `WB-CLI-02`：stdout/stderr bounded drain、UTF-8 容错和脱敏。
- `WB-CLI-03`：adapter argv 构造固定顺序，禁止 shell 注入。

## 真实 smoke 约束

- 工作目录必须是本仓库下的临时目录，运行结束清理。
- prompt 只要求读取目录中的非敏感 marker 并输出摘要。
- 使用 `--ephemeral`、`--sandbox read-only`、`--skip-git-repo-check`。
- 不使用聊天中提供的任何 API key，不把环境变量或 Codex session 写入证据。
- smoke 失败只能记录为环境/凭据失败，不得转写为 adapter 成功。
