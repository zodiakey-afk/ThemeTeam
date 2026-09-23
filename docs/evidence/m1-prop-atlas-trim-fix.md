| 文档 | M1 v0.3 家具图集裁切缺陷修复证据 |
|---|---|
| 版本 | v1.0 |
| 日期 | 2026-09-22 |
| 状态 | 已修复并验证；最新版本使用显式对象区域 |
| 关联 | M1-T-005；M1 v0.4；`pack_m1_prop_atlas_v03.cjs` |

## 根因

旧打包器把 `1536x1024` 的展示板误当作严格 `5x4` 生产网格切片。会议桌、老板桌、咖啡台和饮水机的真实轮廓跨越了理论列边界，随后又只保留最大 alpha 连通组件，导致左侧、下沿和独立底座被切掉。

## 修复

- 家具类使用显式真实对象区域，不再按展示板列边界切片。
- 家具区域保留所有合法 alpha 连通组件，再 `trim + aspect-fit` 到 `192x128` 固定帧。
- 地板、墙、门和效果帧继续使用网格清理裁切。
- 验证器检查固定帧边界、非空像素和唯一 frame geometry；promotion 前必须通过验证。

## 证据

| 检查 | 结果 |
|---|---|
| 图集 validation | PASS，355 assertions，17 props frames |
| Runtime promotion | PASS，props atlas SHA-256 `5b6b2293f0a915ba232a3c72e7929231d3ee8081a6f885ed52e0da4421be0f0d` |
| Formal build | PASS |
| Browser matrix | PASS，8 viewport/DPR cases，0 POST、0 external、0 page errors |
| Accessibility / pixel checks | PASS，36 contrast checks、近景家具 ROI、键盘流程 |
| Motion evidence | PASS，160 timeline events，近景 behind/front evidence，0 POST、0 external |

保留 `office-props.v0.2.png`、`office-assets.v0.2.json` 和 v0.2 运行备份用于回滚。
