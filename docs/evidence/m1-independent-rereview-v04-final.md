| 文档 | M1 v0.4 最终 P0 独立只读复审 |
|---|---|
| 版本 | v1.0 |
| 日期 | 2026-09-23 |
| 状态 | 已完成；不自我宣称 G4/G5/G6 通过 |
| 关联 | `ITER-2026-001`；M1 v0.4；CHG-M1-004；G4/G5/G6 |

# 复审范围与规则

本次只读复审以当前最终 v0.3 运行资产、2026-09-23 正式 NFR/稳定性/浏览器/动作/可达性证据、最终截图、当前代码和既有回滚演练为输入。未修改产品代码、测试、冻结规格或门禁文件；本次唯一写入文件为本报告。

判定规则：

- `PASS`：当前版本有可追溯、足以观察完整复审项的证据。
- `FAIL`：当前版本有直接可观察的不符合，或已有独立证据记录失败。
- `PENDING`：有部分证据，但仍缺少门禁所需的独立可观察闭环、人工签署或发布级证明。

最终运行资产指纹：

| 资产 | SHA-256 |
|---|---|
| `frontend/public/assets/office/office-agents.v0.3.png` | `58bfc049aa5916f4abce2813f41b41941edb324b482033febb20ea0ccfcad232` |
| `frontend/public/assets/office/office-props.v0.3.png` | `5b6b2293f0a915ba232a3c72e7929231d3ee8081a6f885ed52e0da4421be0f0d` |
| `frontend/public/assets/office/office-assets.v0.3.json` | `b34946f2290517f992e8026f847cf4e7dca0d32527c5be16d849f8a13f2cda87` |

# 逐项结论

| 复审项目 | 结论 | 当前证据与判断 |
|---|---|---|
| 家具四类缺边闭合 | **PASS** | `output/m1-visual-candidate-v0.3/validation-report.json` 的最终 candidate hash 为 props `5b6b2293...1be0f0d`，17 个 prop frame 均 `edgePixels: 0`；最终 `m1-current-final.png`、behind/front 近景中桌、椅、CRT、墙/门、会议桌、白板、控制台、咖啡/饮水道具边缘连续，未见此前 trim 造成的透明缺边。 |
| 动态遮挡近景 | **PASS** | `m1-occlusion-behind-workstation.png` 可观察人物被工位前景遮挡的关系；`m1-occlusion-front-workstation.png` 可观察人物处于前景、工位/会议家具位于其后；正式 NFR trace 含 `safeRect`、`frontOccluderDepth` 与 prop depth，`m1-accessibility.json` 也保留了最终近景 occlusion 产物。该 PASS 针对最终近景/运行关系，不扩展为所有地图物件的全量遮挡证明。 |
| safeRect / follow / 退出跟随 | **PASS** | 当前 `OfficeCanvas.tsx` 根据 stage bounds 与 inspector/context menu 计算 safe rect；`sceneAdapter.ts` 将 safe rect 换算到 camera world bounds，并在跟随时保持选中人物/脚下标记可见。最新 formal NFR 已记录 safeRect，browser matrix 记录 mobile follow、blank clear 与 close camera restore；代码中的平移、捏合、overview 均停止 follow。 |
| 20 工位 / 默认总览 100% | **PENDING 重跑** | 当前 v0.3 map 有 20 个 `workSeat`、6 个 `meetingSeat`、20 个 spawn；本次变更将 `overview()` 默认值改为 100%，需重跑绑定当前源码的浏览器矩阵和正式 NFR。 |
| 正式 NFR 帧预算/响应/冷加载 | **PASS** | `m1-nfr-formal.json` 于 2026-09-23 01:15:54 完成，`sourceUnchanged: true`，绑定最终三项运行资产 hash。6 个 DPR1/2 frame run 的 P95 约 16.8ms、P99 约 16.9ms；四尺寸 selection/zoom/panel 各 30 次，用户端响应样本低于 300ms 阈值；30 次串行命令有 network/user 分位数；3 次 cold load 约 393-406ms，externalRequests=0。 |
| 双 DPR 正式长稳新鲜度 | **PASS** | `m1-stability-formal.json` 于 2026-09-23 02:17:31 完成，`sourceUnchanged: true`，绑定同一最终资产与当前源 hash。DPR1/DPR2 均约 30 分钟、100 次开关；按 10 分钟到 30 分钟 heap 计算增长分别为 2.37% 和 2.62%，低于 <=20% 阈值；监听器均 251、DOM nodes 均 639，未见持续增长。 |
| 视觉参考是否不再作为运行模块 | **PASS** | 当前 `frontend/src/App.tsx` 已无 `reference` view、视觉参考导航入口或 `office-reference` 运行入口；最终 `m1-current-final.png` 页面也无视觉参考入口。设计资产仍保留在 `docs/`/`output/`，属于设计与溯源材料，不作为运行模块。 |
| 隔离 / 零场景 POST / 外联 | **PASS（限定场景）** | 最新 browser matrix 的 8 个 viewport/DPR 主场景、恢复和导航记录 `posts=0`、`external=0`、无 page errors；`m1-motion-evidence.json` 记录 `posts=0`；当前代码场景资源只 fetch 固定本地资产，未发现 localStorage/sessionStorage/BroadcastChannel。正式 NFR 的 30 次业务命令另有 loopback POST，这是 NFR 命令测量，不是场景写入；不能混同为“所有应用 POST=0”。 |
| 回滚演练 | **PENDING** | `m1-rollback-rehearsal.json` 的隔离归档恢复、current-v03 restore、snapshot unchanged、posts/external/errors 为空，演练本身 PASS；但报告明确限定为“partial historical archive is not treated as a complete runnable legacy M1 build”。因此可确认隔离归档完整性和当前运行恢复，不能确认发布级旧版本完整可运行回滚、回滚后完整浏览器矩阵和正式验收闭环。 |

# 证据新鲜度与独立性

| 证据 | 当前复核事实 |
|---|---|
| `docs/evidence/m1-nfr-formal.json` | 2026-09-23 01:15:54；`sourceUnchanged: true`；绑定最终 agent/props/assets hash；包含正式 frame、response、cold-load、command-run 和 trace 引用。 |
| `docs/evidence/m1-stability-formal.json` | 2026-09-23 02:17:31；`sourceUnchanged: true`；绑定同一最终源与资产 hash；DPR1 2.37%、DPR2 2.62%。 |
| `docs/evidence/m1-browser-matrix.json` | 2026-09-23 01:00:30；DPR1 ratio=1、DPR2 ratio=2，四尺寸均无横向越界，主场景 POST/external 为 0。 |
| `docs/evidence/m1-accessibility.json` | 2026-09-23 01:02:44；长中文/长 ID、keyboard-only、44px 目标、对比度和最终 occlusion 资产均有记录。 |
| `docs/evidence/m1-motion-evidence.json` | 2026-09-23 01:01:06；最终动作状态含 walking、waiting、obstructed、docking、seated、undocking 等；场景 POST=0。 |
| 最终截图 | `m1-current-final.png`、`m1-occlusion-behind-workstation.png`、`m1-occlusion-front-workstation.png` 均为 2026-09-23 生成，且与最终运行 asset hash 相容。 |

以上证据足以替代此前基于 v0.2 资产和旧运行代码的独立复审结论；本报告不沿用旧 v0.2 的视觉或遮挡 FAIL。

# 门禁建议

| 门禁 | 建议 | 理由 |
|---|---|---|
| G4 | **PENDING** | 当前实现、正式构建、最终资产、回归、可达性、NFR 和稳定性证据已支持本次 P0/M1 复审项；但本报告不能替代 QA/代码评审签署，也未把全部 G4 黑盒覆盖、覆盖率阈值和人工批准记录重新签署为通过。 |
| G5 | **PENDING** | 本次独立复审的指定最终项目均已达到 PASS，除发布级回滚外没有发现当前版本的 P0/M1 失败项；但 G5 仍需 QA 签署、完整 BB/WB 矩阵闭环和正式门禁记录，不能由本报告自我关闭。 |
| G6 | **PENDING** | 回滚隔离演练和零写入已通过，但演练范围明确不是完整可运行 legacy M1 build；项目负责人发布批准、完整回滚验收和发布检查单仍需完成。 |

最终建议：保持 `G4=PENDING`、`G5=PENDING`、`G6=PENDING`。本报告结论为当前最终 v0.3 运行版本的独立 P0/M1 复审结果，不构成任何门禁自动通过或发布批准。
