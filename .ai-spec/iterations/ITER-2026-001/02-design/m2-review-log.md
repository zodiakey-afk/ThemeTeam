| 文档 | D8 M2 设计评审记录 |
|---|---|
| 版本 | v1.0 |
| 日期 | 2026-09-24 |
| 状态 | 待独立技术评审 |
| 关联 | M2 / D1-D7；G2 |

## 自审

- 旧 API 与新 `/api/v1` 并存，避免 M1/W03 立即切换。
- SQLite 迁移不覆盖原 JSON；失败和回滚边界已定义。
- run 状态、审批、artifact 和 outbox 均有明确事实来源。
- 事件只发布已提交 outbox；客户端遇到 gap 必须 resync。
- 真实 CLI smoke 的 ACL 条件不会被当作产品通过证据。

## Independent review 2026-09-24

结论：Fail。发现 API/事件契约不完整、数据模型缺 profile/artifact/archive/actor 约束、安全授权语义不足、NFR 测试覆盖不足、run 状态和 WS 恢复语义未闭合，以及 M2 专属 G2/G3 证据缺失。

修订范围：

- 补充 actor、profile、artifact、approval、audit、archive 的 schema 和 SQLite 约束。
- 统一 run 状态、错误码、artifact 生命周期和迟到结果语义。
- 补充 WebSocket route、seq 作用域、snapshot boundary、replay/resync 规则。
- 将 NFR 阈值、样本量、重复次数、环境和证据路径写入冻结测试规格。
- 建立 `M2_G2` / `M2_G3` 专属门禁，避免复用旧 M1 批次状态。

## Pending independent re-review

- 评审人需确认本轮修订后的 SQLite schema/FK、迁移原子性、WebSocket cursor、审批状态机、artifact 边界和错误契约。
- 未完成独立复审前，M2_G2 不能标记 passed，不能进入代码实现门禁。

## Second narrow review findings

- Legacy top-level G2/G3 could be mistaken for M2 authorization.
- API lacked model profile and concrete response/error schemas.
- Data model needed explicit workspace-scoped idempotency, FK matrix, archive/artifact lifecycle and retention policy.
- Runtime unavailable and artifact partial/failed transitions needed deterministic rules.

## Revision status

All four findings are addressed in the current M2 authority metadata, API contract, data model and LLD. A final independent re-review is still required before M2_G2 can pass.

## Final independent re-review 2026-09-24

结论：PASS。最终窄范围复审确认：

- M2 使用专属 `M2_G2/M2_G3`，旧批次 G2/G3 不具备 M2 授权效力。
- API 契约包含 model profile、ErrorEnvelope 以及 Model/Runtime/Project/Approval/Artifact/Audit/Document schema。
- 数据模型包含 workspace-scoped idempotency、FK/unique matrix、archive/artifact lifecycle 与 retention policy。
- runtime unavailable、non-zero exit、timeout 和 artifact pending/complete/partial/failed 语义已确定。

M2_G2 可关闭；M2_G3 仍等待项目负责人批准。
