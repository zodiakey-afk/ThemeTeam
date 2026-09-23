| 文档 | M1 发布计划 |
|---|---|
| 版本 | v1.0 |
| 日期 | 2026-09-22 |
| 状态 | 待 G5/G6 审批 |
| 关联 | M1 v0.4；`release-checklist.md`；`rollback-plan.md` |

## 发布范围

发布当前前端正式构建、v0.3 agent/prop atlas、v0.3 office map/oracle 和 M1 root-local 画布能力。后端 schema、业务 API、持久化结构和真实工作区数据不迁移。

## 发布顺序

1. 运行 `npm run verify`、正式 NFR、正式双 DPR 长稳和回滚演练。
2. 核对独立复审、QA 签署和当前构建/资源 hash。
3. 以当前正式构建启动本地服务，观察 30 分钟。
4. 仅在发现画布加载失败、外部请求、场景 POST、页面错误、heap 超阈值或视觉关键回归时回滚。

## 成功指标

页面可操作、场景非空、20 工位/6 会议席可见、0 场景业务 POST、0 非 loopback 请求、无页面错误；正式 NFR 和长稳指标保持在 v0.4 阈值内。
