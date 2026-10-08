| 文档 | D3 M2 详细设计 |
|---|---|
| 版本 | v1.0 |
| 日期 | 2026-09-24 |
| 状态 | 修订候选，等待独立技术复审 |
| 关联 | M2 / W07-W10；m2-hld.md |

## 运行状态机

```text
waiting --approve--> queued
queued --> running
running --> succeeded
running --> failed
running --> cancelled
running --> timed_out
queued/running --process restart--> interrupted
queued --runtime unavailable--> environment_unavailable
waiting --reject--> rejected
failed/timed_out/cancelled/interrupted/environment_unavailable --retry--> queued (new run, retryOf)
```

`status` 枚举为 `waiting|queued|running|succeeded|failed|cancelled|timed_out|interrupted|environment_unavailable|rejected`。
manual runtime 的写任务必须先处于 `waiting`；审批和拒绝只能由服务端命令执行，前端动画不参与状态转移。

超时定义：从 worker 进程启动确认到进程退出或被终止的 wall-clock 秒数，取 runtime profile 的 `timeoutSeconds`。
取消定义：服务端记录取消请求并终止进程组；迟到的进程结果只能写入诊断字段，不得覆盖 `cancelled`。
artifact 生命周期：`pending -> complete|partial|failed`；artifact 文件只允许位于 canonical run root，API 只返回相对路径。
`environment_unavailable` is deterministic: it is emitted only for preflight failures before process start, including missing/denylisted executable, canonical project root failure, read-only/permission failure, or missing required runtime dependency. A non-zero process exit is always `failed`; timeout is always `timed_out`.
Artifact lifecycle is deterministic: initialize `pending` before process start; after process exit, scan only the canonical run root. If scan and hashes complete for all discovered files, set `complete`; if process ended after some valid files but a later file/scan failed, set `partial`; if root validation or the scan itself fails before any valid artifact is recorded, set `failed`. Run terminal status is never changed by artifact status.

## Actor、授权与命令处理

M2 为单机单租户，但每个命令仍使用服务端解析的 actor context：

| Actor | 允许 |
|---|---|
| `owner` | 配置 profile、创建/批准/拒绝/取消/重试 run、查看全量团队数据。 |
| `operator` | 创建任务、提交 run、查看所属团队 run、取消自己提交的 run。 |
| `observer` | 只读 snapshot、事件、run 摘要和已发布 artifact metadata。 |

当前 loopback 无账号登录时，服务端创建单一本地 `owner` actor；API 不接受客户端自报角色作为授权依据。`credentialRef` 只能是不透明引用，真实凭据不进入数据库。

命令处理：

1. 校验 `commandId`, `idempotencyKey`, `correlationId`, payload schema。
2. 在 SQLite 事务中检查 expected entity version 和 idempotency key。
3. 写业务状态、audit event 和 outbox event。
4. 提交事务后返回 confirmed version。
5. outbox publisher 发送事件；客户端按 `seq` 去重。
6. 发现 cursor gap 时返回 `resync_required`，客户端重新取快照。

## 并发与恢复

- SQLite `BEGIN IMMEDIATE` 保护同一 workspace 的命令线性化。
- Run terminal completion additionally uses `UPDATE ... WHERE id=? AND version=? AND status NOT IN (...)`,
  so stale worker callbacks cannot overwrite a newer terminal state across SQLite connections.
- `idempotency_keys` 保留命令结果，重复提交返回相同确认结果。
- 每个 run 使用独立 cancel token、artifact root 和 process group。
- dispatcher 启动扫描非终态 run，转换为 interrupted 并写审计事件。
- WebSocket 连接只发布已提交 outbox；发布失败不回滚数据库，后续 cursor 可补发。

## 错误处理

| 错误 | HTTP | 客户端处理 |
|---|---:|---|
| schema/字段错误 | 400 | 保留表单输入，不重试。 |
| 未授权/伪审批 | 403 | 显示权限错误，不改变本地状态。 |
| unknown entity | 404 | 刷新 projection。 |
| version/idempotency conflict | 409 | 取新快照并提示冲突。 |
| migration/storage failure | 500 | 禁止继续写入，提供恢复入口。 |
| runtime unavailable | 503 | run 进入 failed 或 environment_unavailable，保留审计。 |
| approval required | 409 | run 保持 waiting，客户端展示审批入口。 |
| resync required | 409 | 客户端停止应用事件，取 snapshot + cursor。 |

## 线程边界

- API 线程不直接执行长任务；仅创建 run 和 worker job。
- worker 只能通过 service 写 run 结果，不直接修改前端 snapshot。
- WebSocket publisher 不持有业务锁等待网络写入。
- snapshot 与 replay 边界：服务端在同一 SQLite read transaction 中读取 snapshot version 与 `lastSeq`；客户端随后以 `lastSeq` 订阅，若 publisher 发现 seq gap 则发送 `resync_required`。
