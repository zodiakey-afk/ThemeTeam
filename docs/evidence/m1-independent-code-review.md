| 文档 | M1 独立代码 / 安全对抗评审 |
|---|---|
| 版本 | v1.0 |
| 日期 | 2026-09-16 |
| 状态 | Final - FAIL |
| 评审人 | Codex（GPT-5 独立评审 Agent） |
| 独立性 | 本评审人未参与 M1 实现；未采信主实现者结论，仅使用冻结规格、机器合同、当前代码、可执行测试和指定机器证据 |
| 关联 | ITER-2026-001；M1 / W04-W06；G4 / G5 |

## 1. 结论

**FAIL。** 当前源码存在 **7 个未解决 High** 和 **3 个 Medium**。按本次门禁规则，存在任一未解决 Blocker / Critical / High 即不得 PASS，因此 M1 独立代码 / 安全对抗评审不通过，不能以现有材料关闭 G4 或 G5。

未发现硬编码凭据、场景业务 POST、跨 root 持久化通道或无限重规划。有限重规划实现为 2 次重规划并在第三个等待周期结束后进入 `obstructed`；本地场景状态主要封闭在 adapter 实例中；当前独立执行的前端单元测试、类型检查和后端隔离测试均通过。但这些正向结果不抵消下列冻结 BB/合同违例。

## 2. 输入与快照

### 2.1 冻结 / 批准输入

| 输入 | SHA-256 |
|---|---|
| `.ai-spec/iterations/ITER-2026-001/05-testing/m1-spec.md` | `2ca7b60f5efb148229ee8b417ee67f95306b6cba5f417ef922f0ad2350d1ce9e` |
| `.ai-spec/iterations/ITER-2026-001/02-design/m1-design.md` | `139467a1b1701debb9ff7f38d56caa9837df5917827bd49dceec4e44688804b6` |
| `contracts/m1-v0.2.json` | `41302acd3aaac207b9585900d11c10d3f1075eb8b304584c4b494d7b516bf08f` |
| `contracts/m1-map-v0.2.schema.json` | `553ea1cad40a693259917c00a547d6323d08becd6c2310c835984beeaa031b2a` |
| `contracts/m1-assets-v0.2.schema.json` | `39dd8e4d5031bc14103911135964d311607d970db954ac447241f10c2ee59e6e` |

### 2.2 当前代码快照

| 文件 | SHA-256 |
|---|---|
| `frontend/src/office/sceneAdapter.ts` | `013878d2bf66f3581150026fc5eafd46b16de7e349f52830294f815f8d807659` |
| `frontend/src/office/domain.ts` | `650d441fb0b57968e62d2fd0922c0ee4ac53342126b6d1f43d9f48a6943b8eb3` |
| `frontend/src/office/OfficeCanvas.tsx` | `d3298d05d3384561db0885f443f16ac089dc6e0e7522e1fefee4e38a66617c86` |

仓库不是 Git working tree，无法关联 commit。`sceneAdapter.ts` 最后修改时间为 2026-09-16 08:33:35 +08:00；下列行号均以该快照为准。

### 2.3 指定机器证据

| 证据 | SHA-256 | 独立评审处理 |
|---|---|---|
| `docs/evidence/m1-verification.json` | `d45652353d0d4f48460614f38e3ca68059a862be04f217445d9cd5f3c6300410` | 检查命令与日志引用；不接受其总括 `passed` 作为代码结论 |
| `docs/evidence/m1-browser-matrix.json` | `9ea185501ffa906c38cf02664876cdb3042611ac11aff4cd8ce7ae1b0bb42996` | 检查 DPR、恢复、竞争、手势和有限重规划记录 |
| `docs/evidence/m1-nfr-formal.json` | `9c59f664eb33d1503d5255a241597715bdbd3051cb151f2ced656617173e5f54` | 检查采样形状与测试实现；结论不被接受，见 H-07 |
| `docs/evidence/m1-stability-formal.json` | `c25fd9f131b8f0293750dbe6d0977d41eeb6cdc1653b985c502fda1a533528ba` | 检查 2x30 分钟 heap 数据；结论不被接受，见 H-07 |
| `docs/evidence/m1-backend-isolation.log` | `3f960b2ec53621608ad6babd06d70c582a351a56f5ced26a3b56fec4bd133454` | 4 轮 x 48 后端测试通过；支持后端隔离，不覆盖场景状态机 |

## 3. Findings

### H-01 - High - 离座缺少 `undocking`，旧座位在到达 stand 前释放

**位置：** `frontend/src/office/sceneAdapter.ts:13-30, 495-519, 602-645`；合同 `m1-v0.2.json:86-95`；设计 `m1-design.md:107-115`；冻结测试 `m1-spec.md:47-50`。

**依据 / 复现：** `AgentView.phase` 不包含合同冻结的 `undocking`。路径回调一旦成功便在 `sceneAdapter.ts:510` 将 `occupiedAnchorId` 清空，随后直接进入 `walking`；首个 walking 帧又从逻辑 `approach` 投影开始，而原 sprite 仍在 `sit` 世界坐标。代码没有 300ms `sit -> stand` 过渡，也没有“到 stand 后才释放旧座位”的所有权转换。此时另一成员可把旧座位视为空闲并取得目标，且离座成员会从 sit 位置跳到 approach 路段。

新增 motion 测试 `frontend/tests/m1-motion-evidence.cjs:116-121` 只要求 `planning/walking/waiting/docking/seated/obstructed`，反而未要求 `undocking`，不能覆盖合同违例。

**影响：** 违反 BB-M1-09/10/12；可产生视觉瞬移、短暂重复占座及错误竞争结果，破坏占用一致性。

### H-02 - High - 锁定 / 不可达目标会替换已有合法意图

**位置：** `frontend/src/office/sceneAdapter.ts:476-540`；合同 `m1-v0.2.json:59, 87-97`；冻结测试 `m1-spec.md:49`。

**依据 / 复现：** `moveSelected` 仅检查对象存在与目标占用，未检查目标房间 `movementEnabled`、锁定状态或可达性；它先删除旧目标预留、递增 `motionId`、写入新目标，再调用 `planRoute`。`planRoute` 随后取消旧 EasyStar 请求。若新目标不可达，回调进入 `stopObstructed`，旧合法路线已不可恢复。合同明确要求 shape/entity/map/lock/reachability 全部验证成功后才能替换旧意图。

现有 E2E `frontend/tests/m1-e2e.cjs:159-165` 只用不存在的 `missing-anchor`；该分支在 `sceneAdapter.ts:525` 提前返回，因此没有覆盖“已存在但锁定 / 断开 / 不可达”目标。

**影响：** 违反 BB-M1-11；攻击性或损坏地图可中断合法移动，且 `locked` 合同 outcome 实际不可达。

### H-03 - High - 退出预演与 context-loss 重试造成 UI / 场景状态分叉

**位置：** `frontend/src/office/sceneAdapter.ts:85-90, 652-669, 723-750`；`frontend/src/office/OfficeCanvas.tsx:13-35, 49, 65-68`；冻结测试 `m1-spec.md:52, 68-69`。

**依据 / 复现：**

1. `setPreview(false)` 会取消计划和清预留，但对 `seated` 成员保留当前 `occupiedAnchorId`、cell 和 demo 座位；只切换 pose。返回“工作区记录视图”后，演示位置仍是场景事实，未从 snapshot 重建。
2. `webglcontextlost` 仅调用 scene 内的 `setPreview(false)`；React 的 `preview` state 仍为 `true`。点击重试后 effect 创建全新 adapter，其闭包 `preview=false`，但 UI 仍显示演示已开启且移动按钮可用；点击移动会被新 adapter 拒绝。

**影响：** 违反 BB-M1-14/25/26；本地演示状态泄漏到工作区展示，资源恢复后控制面与执行面不一致。

### H-04 - High - 右键 / 触控等价菜单未实现，取消前已提交选择

**位置：** `frontend/src/office/sceneAdapter.ts:221-335, 377-383`；`frontend/src/office/OfficeCanvas.tsx:53-59`；设计 `m1-design.md:88-97`；冻结测试 `m1-spec.md:35-36, 63`。

**依据 / 复现：**

- 右键 release 只发送“可使用画布上方的目标菜单”提示，没有记录 down/up 同一目标，也没有创建本 root 对象菜单或执行等价动作。
- 手机“更多场景操作”按钮同样只改 feedback 文本。
- 人物选择在 sprite `pointerdown` 立即提交；随后发生拖拽、第二指介入、失焦或 `pointercancel` 时，已提交选择无法撤销。
- DOM `pointercancel` handler 只处理 touch，mouse/pen 取消不走同一释放路径；Space 输入焦点也没有显式排除。

**影响：** 违反 BB-M1-04/05/20；手势取消不能保证“未提交点击取消”，鼠标、触控和键盘流程不等价。

### H-05 - High - drawable safe rect 与面板关闭镜头恢复未实现

**位置：** `frontend/src/office/sceneAdapter.ts:104-112, 138-147, 423-450`；设计 `m1-design.md:86, 99-101, 122`；冻结测试 `m1-spec.md:64`。

**依据 / 复现：** 唯一 `ResizeObserver` 只观察 canvas host 并调用 `scale.resize`。没有测量导航、详情、底栏的遮挡矩形，没有 safe rect 计算，也没有在 inspector 打开后重新保证人物和脚下标记可见。`focusSelected` 只把人物 pan 到相机中心；`close` transition 不保存或恢复临时 safe-rect 镜头调整。selection transition 在 React inspector 布局提交前到达 scene，随后容器缩小时也不会重新聚焦。

**影响：** 违反 BB-M1-21；选中目标可在详情打开后落到不可见 / 被遮挡区域，Close 也无法恢复冻结合同要求的镜头。

### H-06 - High - 运行时地图 / atlas 校验不是冻结合同的 fail-safe

**位置：** `frontend/src/office/domain.ts:54-110`；`frontend/src/office/sceneAdapter.ts:123-152, 189-219, 692-720`；合同 `m1-v0.2.json:110-118`；冻结测试 `m1-spec.md:38, 69`。

**依据 / 复现：** 运行时 `validateOfficeMap` 未验证 `doors/props/renderLayers` 存在、14 个锚点与 8/6 数量、door/prop ID 和引用、footprint 重叠、spawn 唯一、stand/approach 邻接与连通、closed door、room `movementEnabled` 等语义。示例：删除 `props` 或 `doors` 仍可通过 validator，随后 `drawMap` 的 `for...of` 抛错。`validateOfficeAssets` 也未验证 atlas ID 全局唯一、frame kind/pivot、animation ID/role/activity allowlist 与 agent-frame 类型。

Phaser texture 加载错误没有 loader error handler；`create()` 内的异步 scene 错误也没有可靠转换为 DOM error。因而坏 atlas / map / 全纹理失败可能停在加载提示或生成缺失纹理 canvas，而不是合同要求的明确错误和可用 DOM 入口。

**影响：** 违反 BB-M1-07/26；损坏的本地构建资产可导致空白 / 半初始化场景，属于资源完整性与恢复缺陷。

### H-07 - High - “formal passed” 证据不满足冻结 NFR，且未绑定当前源码

**位置：** `frontend/tests/m1-nfr.cjs:51-65, 83-166`；`frontend/tests/m1-stability.cjs:51-116`；`frontend/tests/m1-e2e.cjs:25-71`；冻结测试 `m1-spec.md:73-88, 94-96`；证据 `m1-nfr-formal.json:2-9, 1499-1549`、`m1-stability-formal.json:2-4, 1965`、`m1-browser-matrix.json:109-184`。

**依据：**

- NFR 与稳定性脚本运行 Vite dev server，而冻结规格要求本地正式构建。
- 帧测试只测页面 `requestAnimationFrame` 间隔，没有浏览器 trace / scene render mark 双证。
- 响应测试只测 zoom 与 selection；缺少面板开关 30 次、串行本地非模型命令 30 次、网络与用户端分位数。
- 冷启动未显式禁 cache / 清 Service Worker，也未执行独立的非 loopback 请求阻断画像。
- NFR 报告没有规格要求的 OS/CPU/GPU/内存、浏览器完整版本、资源/fixture/build hash、电源模式、刷新率及测量开销；`limitations` 却为空。
- 稳定性通过条件只检查 heap、canvas、agent 和 walking 数；没有 listener/resource 计数、重复进入退出或双 root 行为不倍增。
- NFR formal（19:48）和 stability formal（20:49）均早于当前 `sceneAdapter.ts`（21:01）；报告没有源码 hash，无法证明针对当前可执行物。

**影响：** NFR-M1-01/02/03/04/05 缺少冻结形状的通过证据；机器文件中的 `passed` 不足以支持 G4/G5。

### M-01 - Medium - DPR2 仍使用 1x backing buffer，测试断言放宽了合同

**位置：** `frontend/src/office/sceneAdapter.ts:703-714`；`frontend/tests/m1-e2e.cjs:52-71`；合同 `m1-v0.2.json:72`；证据 `m1-browser-matrix.json:109-184`。

**依据：** Phaser config 没有设置 DPR backing resolution；DPR2 的全部证据行仍为 `canvas.width / CSS width == 1`。测试只要求 ratio `>=0.99 && <=dpr+0.1`，因此 DPR2 的 1x buffer 被判为通过。合同明确限定 DPR 只作用于 backing buffer，而不是取消高密度 backing。

**影响：** 高 DPI 像素密度与像素 ROI 证据不可信，且掩盖真正的 DPR backing / pointer 适配回归。

### M-02 - Medium - EasyStar stale-result token 缺少 `rootGeneration` 与 `mapRevision`

**位置：** `frontend/src/office/sceneAdapter.ts:31-37, 476-519, 671-750`；合同 `m1-v0.2.json:86-95`；设计 `m1-design.md:111, 148`。

**依据：** `PathPlan` 只保存 `motionId/anchorId`；回调也只比对这些字段。当前 root 通过闭包、清 plans 和 destroy 获得部分隔离，但合同冻结的三元 token `rootGeneration + motionId + mapRevision` 未实现。若同一 adapter 内换图 / 重载 revision，旧 callback 没有 revision 判据。

**影响：** 当前静态单地图路径降低了触发概率，但地图恢复 / 替换扩展会重新引入迟到路径接管风险。

### M-03 - Medium - 未知角色静默映射为 developer，而非可辨 fallback

**位置：** `frontend/src/office/sceneAdapter.ts:56-67, 368-400`；资产合同 `m1-assets-v0.2.schema.json:56-60`；冻结测试 `m1-spec.md:38`。

**依据：** `roleOf` 对任何未知 `roleTemplate` 返回 `developer`，绕过 `fallbacks.unknownRole`。未知角色在 canvas 上被伪装成开发者，不能提供“可辨回退及原名称 / 状态”的冻结行为。

**影响：** 不执行脚本或外联，但会误报身份 / 角色视觉语义。

## 4. 已确认的正向控制

| 控制 | 结果 | 依据 |
|---|---|---|
| 有限重规划 | PASS（局部） | `sceneAdapter.ts:573-590` 最多 2 次 replan，第三等待周期进入 obstructed；browser matrix 记录 2 次 / 6066ms |
| planning 上限 | PASS（局部） | `sceneAdapter.ts:543-557` 前台累计超过 1000ms 取消并失败 |
| 四邻接 / 禁对角 | PASS（局部） | EasyStar `disableDiagonals()`；单元测试覆盖四向与非法步 |
| root-local 主状态 | PASS（局部） | adapter 的 game/scene/selection/plans/reservations 为函数实例闭包；`connectScene` unsubscribe 后 destroy |
| 后端隔离 | PASS | 独立执行 48/48；指定日志另含 4 轮、无 leaked threads / 默认存储打开 |
| 本地场景网络写 | 未发现 | scene adapter 仅 fetch 两个固定同源资源；现有浏览器证据 POST=0 |
| 文本注入 | 未发现可执行 sink | React 文本节点和 Phaser Text 使用字符串；未发现 `dangerouslySetInnerHTML` 或数据驱动 URL |

## 5. 独立命令与结果

| 命令 / 检查 | 结果 |
|---|---|
| `npm --offline run typecheck`（`frontend`） | exit 0 |
| `npm --offline run test:unit`（`frontend`） | 2 files，44/44 passed |
| `python.exe -B -m unittest discover -s tests`（repo root） | 48/48 passed |
| 冻结输入、当前核心源码和 5 份指定证据 `Get-FileHash -Algorithm SHA256` | 完成；hash 记录于第 2 节 |
| 对 `sceneAdapter/domain/OfficeCanvas/workspace/sceneBridge` 的行级静态审计 | 完成 |
| 对 `m1-e2e/m1-motion-evidence/m1-nfr/m1-stability` 的测试充分性审计 | 完成；发现 H-01、H-02、H-07 覆盖缺口 |
| 指定 evidence 内日志 hash 复核 | `m1-verification.json` 引用的现有日志 hash 匹配；该事实不等于行为规格通过 |

未重跑会写入 `docs/evidence` 的 browser / formal 脚本，以遵守“只写本评审文件”的范围。一次额外无写入浏览器探针因本地 runner 模块解析 / 结果回传问题未形成可靠结果，未被用于任何 finding；所有结论均可由当前源码控制流、冻结合同和现有可执行测试缺口直接复核。

## 6. 限制

- 工作区无 Git 元数据，无法声明 commit、diff 或实现者身份；本报告用文件 SHA-256 固定审阅快照。
- 未修改产品代码、冻结规格、合同、现有测试或既有 evidence。
- 未把主实现者的 `passed` 字段、总结或视觉结论作为通过依据。
- 未重新执行 2x30 分钟稳定性与 6x60 秒正式性能测试；现有 formal 证据因 H-07 不满足冻结证据形状且早于当前源码。
- 视觉遮挡、44px 多点命中与完整动作录像未做新的人工签署；现有脚本也不足以替代该签署。

## 7. 门禁结论

| 门禁项 | 结论 | 原因 |
|---|---|---|
| 独立代码 / 安全对抗评审 | **FAIL** | 7 个未解决 High |
| G4 候选 | **不得通过** | BB-M1-04/05/07/09/11/14/21/26 存在实现或覆盖缺口 |
| G5 候选 | **不得通过** | NFR formal / stability 证据未满足冻结形状，且未绑定当前源码 |

重新评审最低条件：关闭 H-01 至 H-07；为每项补充冻结 BB 的可观察浏览器复现；重新生成绑定当前源码 / build / fixture hash 的正式 NFR 与稳定性证据；保持 2 次有限重规划、root 隔离、零场景业务 POST 和后端隔离回归不退化。
