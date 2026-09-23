| 文档 | M1 v0.4 独立只读复审 |
|---|---|
| 版本 | v1.0 |
| 日期 | 2026-09-22 |
| 状态 | 已完成；不构成 G4/G5 通过 |
| 关联 | `ITER-2026-001`；M1 v0.4；CHG-M1-004；G5 |

# 结论

本次复审只读取需求、冻结规格、契约、当前代码、既有证据、v0.3 图集候选清单/验证报告及打包脚本。未修改产品代码、测试、冻结规格或门禁文件；本次唯一写入文件为本报告。

判定规则：`PASS` 仅表示本项已有当前、可追溯且足以观察该项行为的证据；`FAIL` 表示已有独立观察或当前实现直接显示不满足；`PENDING` 表示证据存在但不新鲜、不完整、仅为内部 hook/实现感知证据，或无法独立观察完整验收条件。

| 复审项目 | 结论 | 独立依据与限制 |
|---|---|---|
| 20 工位 / 默认总览 100% 规格一致性 | **PENDING 重跑** | 当前 v0.3 map 仍为 32x24、20 work seats、6 meeting seats、20 spawns；实现已将 `overview()` 默认缩放改为 100%。本报告中的 0.65 结论属于历史版本，需用当前源码重跑 browser matrix 和正式 NFR。 |
| 正式 NFR 与双 DPR 长稳新鲜度 | **PENDING** | `m1-nfr-formal.json` 有 6 个 DPR1/2 帧 run、30s warmup、60s sample、20人/8移动/5气泡；`m1-stability-formal.json` 有 DPR1/2 各约30分钟、100次开关和 10/20/30 分钟 heap 样本。但两份报告的 `sceneAdapter.ts`、`domain.ts`、测试源 hash 不同，且未由本独立复审重新绑定同一当前构建；稳定性报告也未形成完整 listener/resource trend。不能采信为当前 v0.4 的正式 G5 PASS。 |
| follow / safe-area | **FAIL** | `m1-browser-matrix.json` 只证明一次 mobile follow 场景和选中对象仍有 screen 坐标；当前 `keepSelectedVisible()` 只按 Phaser `worldView` 边界居中，没有测量导航/详情/底栏占用的实际 drawable safe rect。`applyNavigation()` 的 close/back 仅恢复旧 camera，不恢复由面板安全区造成的调整。既有独立运行视觉复审仍将移动端顺序和抽屉遮挡判为 FAIL，尚无替代签署。 |
| 空白清选 | **PASS** | `m1-browser-matrix.json` 的 `mobile-follow-and-blank-clear` 记录 `cleared: true`；当前 canvas 空白点击路径调用 `clearSelection()`，并通过 root-local navigation 的 `clear` transition 清理选择/跟随状态。该 PASS 仅限清选行为，不外推 safe-area。 |
| 未知角色回退 | **PENDING** | 当前资产 manifest 声明 `unknownRole`/`unknownActivity` 回退，代码对未知角色使用回退帧并施加高对比 tint，browser matrix 记录了 `frame` 与 `tint`。但该证据来自 `__THEMETEAM_OFFICE_TEST__` 内部 hook，未提供黑盒可见截图/DOM 证据证明原名称与状态仍可读且不会被误认为正常 Developer；按冻结 BB-M1-07，不能升级为 PASS。 |
| 动态遮挡 | **FAIL** | `m1-runtime-visual-review.md` 的独立结论仍为 FAIL：没有足够近距离、同一遮挡物前后穿越的可判读视频/像素证据。`m1-motion-evidence.json` 的 depth 字段和当前 `spriteDepth`/`frontOccluderDepth` 只是实现/探针数据，不能替代 BB-M1-06 要求的连续帧、选中不全局置顶、透明命中和前后关系独立观察。 |
| atlas provenance | **PASS（限定范围）** | `m1-atlas-source-review-v2.json/.md` 独立确认候选来源、SHA-256、frame geometry 和 candidate-only 写入边界；`candidate-manifest.json`、`validation-report.json`（361 assertions）、v0.3 打包脚本、`m1-atlas-v03-promotion.json` 形成候选生成→打包→验证→批准→runtime hash 的链路。资产 manifest 的 rightsReview 为 approved。该 PASS 不代表视觉质量、TH-02/03/06 或 G5 总门禁通过。 |
| 隔离 / 零 POST | **PASS（限定范围）** | `m1-two-roots.json` 记录两个 root 的 selection/camera 独立、A 销毁后 B 继续移动、POST=0、externalRequests=0；`m1-browser-matrix.json` 的 viewport/DPR 与恢复场景也记录 POST=0、external=0；`m1-verification.json` 记录 workspace hash 前后不变。当前场景资源路径为固定本地 GET，未发现 localStorage/sessionStorage/BroadcastChannel 写入。该 PASS 不覆盖未执行的所有 BB-M1-19/25 子条件。 |
| 回滚演练 | **PENDING** | `m1-rollback-rehearsal.json` 的临时归档恢复、snapshot unchanged、posts/external/errors 为空，限定演练本身为 PASS；但其 scope 明确说明历史归档不是完整可运行的 legacy M1 build。因此“完整回滚到可运行旧版本并再做验收”的 G5 证据仍缺失，合并项记 PENDING。 |

## 关键证据

- 规格与契约：`.ai-spec/iterations/ITER-2026-001/01-requirements/nfr.md`、`m1-change-record-v0.4.md`、`05-testing/m1-spec.md`、`02-design/contracts/m1-v0.4.json`、`m1-map-v0.3.schema.json`、`m1-assets-v0.3.schema.json`。
- 需求与设计基准：`docs/first-batch.md`、`docs/office-canvas.md`。默认总览现按用户最新变更为 100%；面板 safe-area、follow/退出 follow、空白清选、未知资源回退、动态前后遮挡、临时 Store 和场景零业务写入仍保持。
- 当前运行资产：`frontend/public/assets/office/office-map.v0.3.json`、`office-assets.v0.3.json`、v0.3 agent/prop PNG；地图为 20 work anchors、6 meeting anchors，资产为 84 animations。
- 现有正式/回归证据：`m1-verification.json`、`m1-browser-matrix.json`、`m1-motion-evidence.json`、`m1-divergence.json`、`m1-atlas-v03-promotion.json`、`m1-rollback-rehearsal.json`。
- 当前实现重点复核：`frontend/src/office/sceneAdapter.ts` 的 follow、camera safe-area、fallback、depth 和 teardown；`frontend/src/office/domain.ts` 的地图/资产验证；`frontend/src/office/OfficeCanvas.tsx` 与 `frontend/src/styles.css` 的面板布局。

## G5 状态

本独立复审不宣称 G4 或 G5 通过。依据本报告，G5 应继续保持 **PENDING / 不可关闭**，并同时保留动态遮挡与 follow/safe-area 的独立 FAIL；正式 NFR/双 DPR 长稳、未知角色黑盒回退、精确默认 0.65 和完整可运行回滚仍为 PENDING。

最低补证条件：

1. 对同一当前构建重新生成并绑定 v0.4 规格、代码/测试源、地图/资产和 trace hash 的正式 NFR 与双 DPR 长稳报告。
2. 提供面板打开/关闭、移动跟随、手动平移退出跟随及四尺寸 safe-area 的黑盒截图/视频/DOM bounds 证据。
3. 提供同一人物相对同一桌/墙的 behind/front 连续帧和透明区域命中证据，并由独立视觉复审替换现有 FAIL。
4. 提供未知角色的黑盒可见回退、原名称/状态可读和不冒充正常角色的证据。
5. 将回滚演练扩展为可运行旧版本的恢复、构建/浏览器矩阵、零写入和快照核对。
