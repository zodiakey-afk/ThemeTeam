| 文档 | M1 发布检查单 |
|---|---|
| 版本 | v1.0 |
| 日期 | 2026-09-22 |
| 状态 | 待人工签署 |
| 关联 | M1 v0.4；`release-plan.md`；`rollback-plan.md` |

| 检查项 | 状态 | 证据 |
|---|---|---|
| 当前 v0.3 atlas/map hash 已登记 | PASS | `m1-atlas-v03-promotion.json`、`m1-map-v03-generation.json` |
| 类型、单测、合同、构建、双 root | PASS | `m1-verification.json` |
| 浏览器、移动、遮挡、无障碍、发散 | PASS（机器） | `m1-browser-matrix.json`、`m1-motion-evidence.json`、`m1-accessibility.json`、`m1-divergence.json` |
| 正式 NFR | PASS（机器） | `m1-nfr-formal.json` |
| 双 DPR 长稳 | PASS（机器） | `m1-stability-formal.json` |
| 回滚演练 | PASS | `m1-rollback-rehearsal.json` |
| 独立复审 | PENDING | `m1-independent-rereview-v04.md` |
| QA / 项目负责人发布批准 | PENDING | 待人工签署 |
