| 文档 | M2 黑盒测试规格 |
|---|---|
| 版本 | v1.0 |
| 日期 | 2026-09-24 |
| 状态 | 修订候选，等待 M2 G2/G3 |
| 关联 | M2-01..08；M2-NFR-01..08；m2-api-v1.json；m2-events-v1.json |

## Migration / storage

- `BB-M2-01` 新工作区可创建 SQLite schema v1，integrity_check 通过。
- `BB-M2-02` 合法 JSON 导入后实体计数、引用和 canonical hash 一致。
- `BB-M2-03` malformed JSON、缺引用、重复 ID、非法枚举被拒绝，原 JSON/DB 不变。
- `BB-M2-04` 导入前生成 backup；替换前故障注入不破坏旧事实源。
- `BB-M2-05` 重启后已确认 task/agent/run/document/audit 状态保持。

## API / events

- `BB-M2-06` `/api/v1` loopback Host/Origin/framing/body cap 约束与旧 W02 一致。
- `BB-M2-07` commandId/idempotencyKey 重放返回相同确认结果，无重复副作用。
- `BB-M2-08` expectedVersion 冲突返回 409，业务对象和 outbox 不变。
- `BB-M2-09` committed command 产生一个 outbox event；event envelope 字段完整且无 secret。
- `BB-M2-10` WebSocket 从 lastSeenSeq replay；重复事件去重。
- `BB-M2-11` cursor gap 返回 resync_required，快照重取后最终一致。

## Runtime / approvals

- `BB-M2-12` manual runtime 创建 run 为 waiting；未审批不得启动进程或写 artifact。
- `BB-M2-13` 合法 approve 只执行一次；重复 approve 不重复启动。
- `BB-M2-14` cancel/timeout/non-zero exit 分别产生明确终态；迟到结果不能覆盖 cancelled。
- `BB-M2-15` restart 将 queued/running 变为 interrupted；不伪造成功。
- `BB-M2-16` retry 创建新 run，保留 retryOf，旧 run 不变。
- `BB-M2-17` 两个工程目录并行执行的 cwd、artifact、取消 token 和事件互不串扰。
- `BB-M2-18` executable allowlist、shell=false、目录 realpath 和 artifact root 越界均被约束。

## Product E2E

- `BB-M2-19` 创建 Agent/绑定 runtime/project 后创建任务并提交运行。
- `BB-M2-20` 任务页显示服务端确认的 run 状态；画布动画不能改变 run/task 事实。
- `BB-M2-21` 成功 artifact 可按相对路径查询；绝对路径、越界路径和 prompt 原文不返回。
- `BB-M2-22` run 结果归档到文档/审计且重复归档幂等。
- `BB-M2-23` 断线期间写入恢复后重取快照；重复命令副作用为 0。
- `BB-M2-24` M1/W03/旧 `/api/*` 回归通过，默认 workspace hash 不变。

## White-box / divergence

- `WB-M2-01` migration failure points before/after atomic replace。
- `WB-M2-02` SQLite lock contention and outbox publisher retry。
- `WB-M2-03` dispatcher callback late result, process tree cleanup and thread leak。
- `WB-M2-04` secret redaction corpus and artifact traversal corpus。
- `WB-M2-05` WebSocket reorder, duplicate, gap and reconnect sequence.

## NFR execution matrix

All M2 NFR evidence must record Windows version, Python/Node/browser versions, CPU/RAM, power mode, database path type, dataset size, warm-up, repeat count, raw report path and contract hash. Evidence belongs under `.ai-spec/iterations/ITER-2026-001/05-testing/evidence/`.

| NFR | Test IDs | Profile | Samples/repeats | Threshold | Evidence |
|---|---|---|---:|---|---|
| M2-NFR-01 | BB-M2-01..05/WB-M2-01 | 50 confirmed writes + restart + migration faults | 50 writes, 3 fault points | loss 0; integrity_check pass | `evidence/m2-persistence.json` |
| M2-NFR-02 | BB-M2-10..11/WB-M2-05 | 100 events during 10 disconnect/reconnect cycles | 10 cycles, 100 events | final cursor/entity hash <=3s; duplicate side effects 0 | `evidence/m2-recovery.json` |
| M2-NFR-03 | BB-M2-06..09 | 200 tasks on loopback | 200 samples, 3 repeats | command confirmation P95 <=300ms; run state commit P95 <=500ms | `evidence/m2-latency.json` |
| M2-NFR-04 | BB-M2-17..18/WB-M2-04 | two project roots, parallel Mock/Codex adapters | 2 roots, 10 runs each | cross-root writes 0; orphan processes 0 | `evidence/m2-isolation.json` |
| M2-NFR-05 | BB-M2-06,12,18,24/WB-M2-04 | path/shell/approval/secret corpus | 100 cases, 2 repeats | unauthorized writes/leaks 0 | `evidence/m2-security.json` |
| M2-NFR-06 | BB-M2-15/WB-M2-03 | forced dispatcher restart | 20 queued/running runs | interrupted correctness 100%; false success 0 | `evidence/m2-run-recovery.json` |
| M2-NFR-07 | BB-M2-22 | 8 concurrent archive replays per run | 8 requests x 10 runs | one archive per run; duplicate docs 0 | `evidence/m2-idempotency.json` |
| M2-NFR-08 | BB-M2-09,21,22,24 | command/run/artifact/approval/audit correlation | 50 end-to-end runs | correlation completeness 100%; secret fields 0 | `evidence/m2-observability.json` |

M1 frame rate, M3 meeting streaming and M4 file parsing are explicitly out of scope for M2 and require separate approval.
