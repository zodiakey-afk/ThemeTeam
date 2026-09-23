| 文档 | ITER-2026-001 / M1 结果验证报告 |
|---|---|
| 版本 | v1.0 |
| 日期 | 2026-09-23 |
| 状态 | P0 既有机器验证完成；默认总览已变更为 100%，相关正式 NFR/视觉证据需绑定新源码重跑；人工签署待完成 |
| 关联 | M1 v0.4；`m1-spec.md` v0.4；`nfr.md` v1.0 |

## 执行结论

当前 v0.3 图集、v0.3 地图和 20 工位布局已通过既有机器验证。默认总览从历史 0.65 改为 100%，因此旧 NFR/视觉截图中的 0.65 只能作为历史证据，不能替代新版本重跑。G4/G5/G6/G7 仍不自动关闭。

| 验证面 | 命令 / 证据 | 结果 |
|---|---|---|
| 类型、单元、合同、构建 | `npm run verify`；`m1-verification.json` | PASS |
| E2E、移动、双 root | `m1-browser-matrix.json`、`m1-motion-evidence.json`、`m1-two-roots.json` | PASS |
| 发散与无障碍 | `m1-divergence.json`、`m1-accessibility.json` | PASS；200 交互序列、100 障碍图、0 失败 |
| 正式 NFR | `m1-nfr-formal.json` | PASS；6 帧 run、4 尺寸响应、3 冷启动，0 外部请求 |
| 双 DPR 长稳 | `m1-stability-formal.json` | PASS；DPR1/2 各 30 分钟、100 次详情开关、heap 增长均 <=20% |
| 资产溯源与几何 | `m1-atlas-v03-promotion.json`、candidate validation | PASS；60 agent frames、17 prop frames |
| 隔离回滚 | `m1-rollback-rehearsal.json` | PASS；归档 hash、当前版恢复、快照不变、0 POST |
| 独立对抗/视觉复审 | `m1-independent-rereview-v04-final.md` | PASS；最终复审确认家具、遮挡、safeRect、默认缩放、NFR、长稳和视觉参考策略 |

## 关键指标

- 正式帧预算：DPR1/2 六个 run 的 P95 约 16.8ms、P99 约 16.9ms。
- 正式响应：选择 P95 约 29-44ms；缩放与面板 P95 约 65-68ms。
- 正式冷启动：约 393-406ms，外部请求 0。
- 长稳：DPR1 heap 增长约 2.37%，DPR2 约 2.62%；监听器稳定、生命周期通过、页面错误 0。
- 工作区完整性：`106f669a107c9b7900387574879e25ee0b094bc82e71a22a787e7ec2e8f14190` 前后不变。
- 最终家具图集：props atlas SHA-256 `5b6b2293f0a915ba232a3c72e7929231d3ee8081a6f885ed52e0da4421be0f0d`；家具真实对象区域修复证据见 `docs/evidence/m1-prop-atlas-trim-fix.md`。

## 测试边界

M1 仍是固定 20 工位容量的首批办公室画布，不包含无限工位自动扩建、100 人多楼层、真实模型运行、真实会议编排或持久化迁移。20 人以上的容量扩展应作为后续需求，不得由本报告推断为已完成。
