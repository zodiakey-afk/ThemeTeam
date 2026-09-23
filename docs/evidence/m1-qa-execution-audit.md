| 文档 | M1 独立 QA 执行审计 |
|---|---|
| 版本 | v1.0 |
| 日期 | 2026-09-16 |
| 状态 | Final |
| 迭代 | ITER-2026-001 / M1 |
| 审计人 | OpenAI Codex，独立 QA 执行审计人 |
| 唯一期望 | `.ai-spec/iterations/ITER-2026-001/05-testing/m1-spec.md` v0.3 Frozen |
| 规格 SHA-256 | `2ca7b60f5efb148229ee8b417ee67f95306b6cba5f417ef922f0ad2350d1ce9e` |
| 审计范围 | 当前 `frontend/tests`、`docs/evidence` 及其可执行结果；不以实现意图替代证据 |
| 审计截点 | 2026-09-16 08:35:25 +08:00 |
| 审计环境 | Windows x64；Node v22.23.0；Python 3.12.14；浏览器脚本使用 Playwright + Edge channel |
| 写入范围 | 仅本文件；未修改产品代码、冻结规格或既有证据 |

# 1. 结论

**M1 独立 QA 执行审计结论：FAIL。**

**G5 建议：保持 PENDING，禁止标记 passed。** 当前没有足够证据证明 BB-M1-01..26、NFR-M1-01..06、WB-M1-01..04 全部满足冻结规格；既有独立运行视觉审查仍为 FAIL，且没有后续独立视觉签署将其替代。这里的 FAIL 是“当前交付不满足 M1 QA 执行验收”，并不把缺证据推断为已确认的产品行为缺陷。

| 范围 | PASS | PENDING | FAIL | 结论 |
|---|---:|---:|---:|---|
| BB-M1-01..26 | 0 | 26 | 0 | 所有条目只有部分或无执行证据，没有一条覆盖冻结条款全部子条件 |
| NFR-M1-01..06 | 1 | 5 | 0 | 仅 NFR-M1-06 的隔离/安全组合证据可接受 |
| WB-M1-01..04 | 0 | 4 | 0 | 有单元覆盖，但均未覆盖冻结规格列出的全部内部不变量 |
| 独立运行视觉审查 | 0 | 0 | 1 | `m1-runtime-visual-review.md` 为 FAIL，未被后续独立复审替代 |
| M1 发散/fuzz | 0 | 1 | 0 | 未找到 seed=20260911 的 200 序列/100 障碍图生成、运行和 triage 报告 |

判定规则：PASS 仅用于冻结条款全部子条件均有当前、可追溯执行证据；PENDING 表示证据缺失或仅部分覆盖；FAIL 仅用于保留证据直接记录失败或实测越过阈值。截图存在、内部 hook 状态、报告中的 `result: passed` 均不自动构成 PASS。

# 2. 审计执行与证据完整性

## 2.1 独立抽样

| 检查 | 结果 | 审计观察 |
|---|---|---|
| `npm --offline run test:unit` | PASS | 2 files、44 tests 全通过；主要支撑 office domain、workspace controller 的 WB/局部 BB |
| `python -B -m unittest discover -s tests -v` | PASS | 48 tests 全通过；临时 Store、跨实例、默认文件守卫、安全和保存故障回归通过 |
| 当前 `m1-e2e.cjs` 隔离执行 | PASS（仅抽样范围） | 8 个 viewport/DPR 组合、2 个恢复、1 个竞争、1 个 pointercancel、1 个有限重规划；POST=0、external=0；输出重定向到系统临时目录并清理 |
| 媒体独立目视检查 | 未完成 | Windows UI/image helper 两次因 `helper_sandbox_lock_failed`/Node kernel exit 失败；不得据此签署视觉通过 |

## 2.2 当前关键指纹

| 产物 | SHA-256 / 状态 |
|---|---|
| `frontend/tests/m1-e2e.cjs` | 审计截点内容 hash `078a283ff1439745e7d35e2027894283ec8f6b08a59b8791d0e6986f7fca4da6`；测试在审计期间曾短暂变更后恢复，正式证据未记录测试源 hash |
| `frontend/tests/m1-motion-evidence.cjs` | `1df82b29062721692e91c2415fbf89d9344f17faff8cf675ae8db27430c6fdf7` |
| `frontend/tests/m1-nfr.cjs` | `46c476662815b92fab4e31eaaf2ad15cdffd3fb74de9ee7849618b1faa4f4c63` |
| `frontend/tests/m1-stability.cjs` | `9f47b2c559bccbc8903d6f34f5acd857565c4fda2aa4d6022d2678fde33cad47` |
| `docs/evidence/m1-verification.json` | `d45652353d0d4f48460614f38e3ca68059a862be04f217445d9cd5f3c6300410`；不执行 formal NFR/stability |
| `docs/evidence/m1-browser-matrix.json` | `9ea185501ffa906c38cf02664876cdb3042611ac11aff4cd8ce7ae1b0bb42996` |
| `docs/evidence/m1-motion-evidence.json` | `35624a14fca25faa052848f7f379db529b07cc9a990694e7668493059a97d6d4` |
| `docs/evidence/m1-nfr-formal.json` | `9c59f664eb33d1503d5255a241597715bdbd3051cb151f2ced656617173e5f54`；早于后续 office runtime 修改，未绑定当前构建 hash |
| `docs/evidence/m1-stability-formal.json` | `c25fd9f131b8f0293750dbe6d0977d41eeb6cdc1653b985c502fda1a533528ba`；早于后续 office runtime 修改，未绑定当前构建 hash |
| `docs/evidence/m1-runtime-visual-review.md` | `085b7175094283fceb1578a4fd43a798e697b3209d354dd6e268046cac95e7e7`；结论 FAIL |

`m1-verification.json` 于 2026-09-16 08:28 记录 typecheck、unit、contracts、build、M1 E2E、motion、W03 E2E 全部 exit 0，真实 workspace hash 前后均为 `106f669a107c9b7900387574879e25ee0b094bc82e71a22a787e7ec2e8f14190`。该报告只能证明所列命令，不包含 formal NFR、formal stability、M1 fuzz 或独立视觉复审。

# 3. 主要发现

## Blocker

**B-01：冻结 BB 没有完整执行追溯。** `frontend/tests` 中只有 BB-M1-18 被显式编号；浏览器脚本以综合场景运行，但没有 BB-M1-01..26 的逐项结果、跳过理由或证据 hash。审计逐条拆分后，26 条均只覆盖部分子条件或完全未覆盖。

**B-02：正式 NFR 不能支持当前 G5。** `m1-nfr-formal.json` 和 `m1-stability-formal.json` 未记录冻结规格要求的完整环境、命令、构建/资源/fixture hash，也未绑定当前可执行物；总验证脚本没有重跑这两项。

**B-03：运行视觉/遮挡仍未签署。** 既有独立视觉报告为 FAIL。后续 trace、WebM 和三张 motion 截图虽已存在，但没有独立目视复审；motion harness 只断言 phase/facing/请求计数，不包含 BB-M1-06 的前后遮挡、透明区域命中或“选中不全局置顶”的像素断言。

## High

**H-01：NFR-M1-02 缺少两组必测量。** `m1-nfr.cjs` 只测 zoom 和通过内部 hook 触发的 selection；没有 panel 开关 30 次，也没有 30 次串行本地 HTTP 命令的 dispatch-to-confirmed-snapshot、网络时间和含队列用户时间。单次 rAF 也没有 trace 证明真正可见提交。

**H-02：DPR2 backing ratio 未闭环。** 8 个矩阵项的 browser DPR 正确，但 DPR2 时 `canvas.width / CSS width` 与 `canvas.height / CSS height` 仍约为 1，而非 2。当前断言允许 `0.99 <= ratio <= DPR+0.1`，因此 ratio=1 在 DPR2 也通过。冻结规格要求校验 CSS/backing/DPR 且不能有 DPR 双乘；当前证据既未定义预期 backing 策略，也未以清晰度/像素密度证明 ratio=1 可接受，故 BB-M1-03、WB-M1-01、NFR-M1-04 均保持 PENDING。

**H-03：NFR-M1-05 的两次 30 分钟数据形状存在，但完整性不足。** 报告含 DPR1/2 各约 1,800 秒、100 次开关、10/20/30 分钟 GC heap，增长约 0.50%/0.53%；但 pass 条件没有监听器计数，报告也没有 listener/resource trend、运行起止时间、命令日志、浏览器/硬件/电源/刷新率或当前构建 hash。该报告还早于后续 runtime 修改，不能视为当前版本 PASS。

**H-04：M1 发散/fuzz 未执行。** 未找到冻结 seed=20260911、每 seed 200 条手势/选择/预演序列、100 张合成障碍图、生成器版本、耗时、失败最小化和 triage。W02 的 seeded invalid-command corpus 不能替代 M1 图形/路径/手势语料。

## Medium

**M-01：证据元数据不足。** browser matrix、formal NFR、formal stability、motion report 本体缺少全部或部分 command/cwd/exit code/environment/source hash/artifact hash。`m1-verification.json` 只 hash 命令日志和 license report，不 hash trace、WebM、截图、formal reports 或对应测试源。

**M-02：motion trace/video 缩小了“无录制”缺口，但不能自动通过。** trace ZIP 可列出 `trace.trace`、`trace.network` 和截图资源，WebM 非空；motion report 有 159 个 timeline 事件、四方向和六阶段、POST/external=0。它依赖 `__THEMETEAM_OFFICE_TEST__` 内部 hook，未记录环境与 artifact hash，也没有独立视觉核对启动、动作帧、遮挡和 UI 可读性。

**M-03：覆盖率门禁无数值。** 现有 unit 日志只有 44 tests passed，没有 line/branch/function coverage，也没有经批准的覆盖阈值或偏离记录。

# 4. BB 逐项矩阵

| ID | 当前可用覆盖 | 结论 | 未满足的冻结项 |
|---|---|---|---|
| BB-M1-01 | ready、非空 canvas 粗粒度颜色检查、截图、motion 启动 | PENDING | 未断言四区域、8/6 锚点、3 个可辨角色、独立地图/角色绘制及人工控制可用性 |
| BB-M1-02 | zoom 按钮、一次 pinch、范围内 zoom、POST=0 | PENDING | 未测五档、滚轮/捏合反复边界、锚点稳定、clamp 不跳、总览最小值和平移 |
| BB-M1-03 | 4 viewport x DPR1/2；browser DPR 值正确 | PENDING | DPR2 backing ratio 约 1；无 DOM offset、页面滚动、抽屉切换、菱形边缘/图外及命中优先级 |
| BB-M1-04 | 无直接覆盖 | PENDING | 未测右键 0/5/6/7px 阈值、中键/Space 拖动、输入框 Space、画布外原生菜单 |
| BB-M1-05 | pinch 后 pointercancel 清空 touch/pinch，行走未停止 | PENDING | 未断言 pointer capture 释放、失焦、离界、未提交 click、其他 root 隔离 |
| BB-M1-06 | 有静态截图、trace、WebM | PENDING | 无前后遮挡像素断言、选中不置顶、墙淡化范围、透明像素点击穿透及独立目视签署 |
| BB-M1-07 | map 首次 503 后重试；context-loss 重建；schema/fallback 引用校验 | PENDING | 未测缺单帧/未知皮肤、坏 atlas、全纹理失败、原名称/状态可见、坏地图禁止非法移动 |
| BB-M1-08 | motion timeline 覆盖四方向、门洞位置和逐步 cell | PENDING | 内部 hook 状态不能替代独立 collision oracle、四邻接全路径、无切角/瞬移的逐帧/像素证明 |
| BB-M1-09 | 会议 dock 与返回 work 录制 | PENDING | 未测离座再回座、脚底/朝向视觉匹配、重复同座不重复占用/抖动 |
| BB-M1-10 | 同目标竞争，首个入座，失败者保留原 seat | PENDING | 未断言占用反馈、视觉不重叠、不覆盖首人、失败者原路线不变 |
| BB-M1-11 | 合法意图后 missing-anchor 不抢占，旧意图完成 | PENDING | 未覆盖 locked/unreachable、后端 snapshot/event/occupancy 完整不变 |
| BB-M1-12 | WB 禁同格/对向边；动态阻塞恰好 2 次重规划并释放 reservation | PENDING | 未覆盖窄门对向队列推进、前人停住、第三等待周期全过程和占用视觉 |
| BB-M1-13 | latest-wins、迟到旧意图不接管、reservation 归零 | PENDING | 未覆盖途中重复选择、关闭详情、无关快照不取消及旧目的地可被他人使用 |
| BB-M1-14 | 无直接覆盖 | PENDING | 未测行走/入座中删除人物、换地图、退出预演、destroy root、幽灵与迟到移动 |
| BB-M1-15 | 动态阻塞约 6.1 秒结束，有限重规划 | PENDING | 未按已知 L 验证公式上界；未测 planning >1s 和其他失败路径均停在合法点 |
| BB-M1-16 | 无直接覆盖 | PENDING | 未测 prefers-reduced-motion、隐藏 30 秒/恢复、旧 Walking 刷新及大 delta |
| BB-M1-17 | 合成状态含 Working/Thinking/Blocked | PENDING | 未断言 workspace/preview 来源区分、无虚构模型指标/权限、动画不改领域状态 |
| BB-M1-18 | 显式 controller 单元测试；W03 浏览器流程含 owner/back/close/reload prune/focus | PENDING | 未形成冻结场景完整顺序结果；相机书签、delete/prune、同人重复历史和 root 触发者焦点未全部同测 |
| BB-M1-19 | W03 两 root focus 隔离 | PENDING | 未测两页签、camera/hover/menu、localStorage/BroadcastChannel、销毁 A 后 B 全功能 |
| BB-M1-20 | 手机可见控件 >=44px；部分键盘焦点 | PENDING | 未完成无鼠标同等流程、目标表单/相机/Esc/触控更多、面板滚动不被 zoom 吞掉及全局快捷键隔离 |
| BB-M1-21 | 4 viewport x DPR1/2、无横向溢出、控件未出文档、手机 44px | PENDING | 未测所有开合状态、场景安全区/脚下标记、裁剪祖先交集、多点命中、0 尺寸及手动平移退出跟随 |
| BB-M1-22 | 无 M1 容量矩阵执行 | PENDING | 未测 0/1/3/8/9/20/超容量、未知 room/skin/state、长文本、删除 current/previous |
| BB-M1-23 | W03 有 unknown-write freeze 流程 | PENDING | 未与场景保持打开组合执行；未覆盖明确 4xx、坏 2xx、GET 不解冻及 preview 不能绕过屏障的完整链 |
| BB-M1-24 | W03 agent/task XSS 与外联检查 | PENDING | 未覆盖冻结清单全部字段、allowlist 资源映射、完整 DOM 文本、最多 5 个详细气泡 |
| BB-M1-25 | 当前 scene 流程 POST=0；workspace 文件 hash 前后不变 | PENDING | 未逐操作比较完整临时业务 snapshot/disk；未显式证明 preview seat 不写回 seatId 及原 CRUD/save 队列保持 |
| BB-M1-26 | map-load retry、context-loss retry、旧 canvas 脱离、POST=0 | PENDING | 未测加载中离开/重进、晚到响应不复活旧 root、重试不重复业务提交及 DOM 错误入口全过程 |

# 5. NFR 逐项矩阵

| ID | 当前可用覆盖 | 结论 | 未满足的冻结项 |
|---|---|---|---|
| NFR-M1-01 | 6 个 formal run 的 P95/P99 数值低于阈值；20 人/8 walking/5 bubble 状态存在 | PENDING | 报告未绑定当前构建；无浏览器 trace、原始样本、标准差；缺完整环境；内部 phase 不能单独证明真实呈现负载 |
| NFR-M1-02 | 4 尺寸各 30 次 zoom 与 selection，P95 数值低于 100ms | PENDING | selection 用内部 hook；无 panel 30 次；无 30 次串行 HTTP 本地命令、confirmed snapshot、网络/端到端/队列时间；无 trace 可见提交 |
| NFR-M1-03 | 3 次记录约 581-588ms，external=0 | PENDING | 未证明禁 cache/清 SW；未执行阻断全部非 loopback 后打开已保存 workspace；缺完整环境和当前构建 hash |
| NFR-M1-04 | 4 尺寸 x DPR1/2 截图、粗粒度非空像素、布局和 44px 检查 | PENDING | DPR2 backing ratio 未决；无长中文/长 ID、对比度、完整键盘、抽屉/底栏/菜单状态、ROI/遮挡/动作帧像素断言和独立目视签署 |
| NFR-M1-05 | DPR1/2 各 30 分钟、100 次详情开关、10/20/30 分钟 GC heap，数值增长 <20% | PENDING | 证据早于 runtime 修改；无 listener/resource trend；无起止时间、命令日志、硬件/浏览器/电源/刷新率和构建 hash |
| NFR-M1-06 | 四轮 48-test backend isolation/security 日志；独立 48-test 抽样；W03 当前 E2E；scene POST/external=0；真实 workspace hash 不变 | PASS | 仍需在最终 G5 报告中绑定各日志/命令 hash，但冻结行为组合已有充分现行证据 |

# 6. WB 逐项矩阵

| ID | 当前可用覆盖 | 结论 | 未满足的冻结项 |
|---|---|---|---|
| WB-M1-01 | 投影/逆投影、四方向、非法步、map/asset 正负语义 fixtures | PENDING | 未测 camera safe rect、菱形边界、完整 CSS/backing/DPR 策略；DPR2 ratio=1 仍无判据闭环 |
| WB-M1-02 | 同格/对向边约束；竞争、latest-wins、2 次重规划浏览器场景 | PENDING | 未直接测 EasyStar 分片预算、迟到 callback token 的 rootGeneration/motionId/mapRevision 全组合及失败前后局部快照相等 |
| WB-M1-03 | root navigation 顺序、bridge dispose 幂等、context-loss 替换旧 canvas | PENDING | 未覆盖 StrictMode 双挂载、加载中 dispose、listener/observer/timer/tween/pending path/texture/canvas 计数与跨 root 资源归属 |
| WB-M1-04 | W03 unknown-write freeze、50ms delta 代码路径有间接场景 | PENDING | 无显式 WB-M1-04 执行；未测断网/坏 2xx 与 scene retry 组合、后台暂停、5Hz 节流及禁止每帧全量 React 发布 |

# 7. G5 未满足验收项

1. 建立 BB-M1-01..26 的显式执行映射，每条记录命令、cwd、环境、退出码、计数、日志/截图/trace/video hash，并补齐本报告矩阵中的所有缺项。
2. 决定并冻结 DPR2 backing 策略；若要求原生 DPR backing，修复后应证明 ratio 约为 2；若接受 ratio=1，需由规格/视觉负责人批准并以清晰度像素判据补偿，不能用宽区间断言静默通过。
3. 增加 BB-M1-06/NFR-M1-04 的遮挡和透明命中像素断言，并由独立视觉审查人实际查看桌/墙前后、选中途中、动作帧、桌面和手机布局；形成取代当前 FAIL 的签署。
4. 按冻结规格补跑 NFR-M1-02：四尺寸的 selection/zoom/panel 各 30 次真实输入，以及临时后端 30 次串行本地 HTTP 命令的网络、确认快照和含队列用户时间。
5. 用当前可执行物重跑 formal frame 与两次 30 分钟 stability，补齐 OS/CPU/GPU/RAM、浏览器完整版本、Python/Node/Phaser/EasyStar、构建/资源/fixture hash、电源模式、刷新率、原始样本/方差、trace、listener 和 resource trend。
6. 执行并保留 seed=20260911 的 M1 发散/fuzz 证据：200 条交互序列、100 张合成障碍图、生成器版本、seed、运行时长、失败序列、最小复现和 triage。
7. 补齐 BB-M1-04、14、16、22 及其他未覆盖边界；补齐 WB-M1-01..04 的内部计数、不变量和资源回收证明。
8. 对 motion trace/WebM/截图和 formal 报告记录 artifact hash，并在验证 manifest 中绑定测试源 hash与当前构建 hash。
9. 记录 line/branch/function coverage 或经 QA/项目负责人批准的明确阈值偏离。

在以上项目关闭并完成独立 QA/视觉签署前，M1 不满足 G5，任何 `passed` 结论均属于证据越权。
