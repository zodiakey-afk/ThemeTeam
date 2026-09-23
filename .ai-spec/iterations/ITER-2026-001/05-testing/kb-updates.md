| 文档 | ITER-2026-001 / M1 知识库回写清单 |
|---|---|
| 版本 | v1.0 |
| 日期 | 2026-09-22 |
| 状态 | 已回写候选条目；等待 G5 签署 |
| 关联 | `docs/kb/INDEX.yaml` |

| 条目 | 内容 | 来源 |
|---|---|---|
| KB-TST-0004 | M1 正式性能必须绑定当前源码、构建、地图/图集 hash；双 DPR 长稳需记录 10/20/30 分钟 heap、生命周期重建和监听器稳定性 | `docs/evidence/m1-nfr-formal.json`；`m1-stability-formal.json` |
| KB-TST-0005 | 随机相机发散测试必须等待镜头稳定，并从可见且可命中的 canvas worker 中取样，避免把测试坐标竞态误报为产品选择缺陷 | `docs/evidence/m1-divergence.json`；`frontend/tests/m1-divergence.cjs` |
| KB-OPS-0001 | 部分历史归档只能用于文件完整性和隔离恢复演练，不能宣称为完整旧版可运行构建；回滚范围必须显式标注 | `docs/evidence/m1-rollback-rehearsal.json`；`m1-rollback-targets.json` |
