| 文档 | M1 设计 / 计划 / 测试门禁独立评审 |
|---|---|
| 版本 | v1.0 |
| 日期 | 2026-09-14 |
| 状态 | 评审完成；scoped G2 failed，scoped G3 pending/blocked，BB 不可冻结 |
| 关联 | ITER-2026-001；B01-09..12；M1 / W04-W06 |

# M1 设计 / 计划 / 测试门禁独立评审

## 1. 评审范围与独立性

本评审只判断 M1 / W04-W06 的客户端办公室场景设计、计划和实现前黑盒规格，不重判 W01-W03，也不扩大到后续真实会议、模型执行、上传、SQLite、WebSocket 或服务端座位模型。

唯一输入为：

- `docs/first-batch.md`
- `docs/office-canvas.md`
- `.ai-spec/iterations/ITER-2026-001/02-design/contracts/w03-v1.1.json`
- `.ai-spec/iterations/ITER-2026-001/02-design/contracts/m1-v0.1.json`
- `.ai-spec/iterations/ITER-2026-001/02-design/contracts/m1-map-v0.1.schema.json`
- `.ai-spec/iterations/ITER-2026-001/02-design/contracts/m1-assets-v0.1.schema.json`
- `.ai-spec/iterations/ITER-2026-001/02-design/m1-design.md`
- `.ai-spec/iterations/ITER-2026-001/03-plan/m1-plan.md`
- `.ai-spec/iterations/ITER-2026-001/05-testing/m1-spec.md`
- `docs/evidence/m1-contracts.json`

未读取实现、测试实现、提交历史、运行历史、`state.yaml` 或 `gate-manifest`；未修改任何输入、state 或 gates。因未读取 `tests/m1_contracts.cjs`，本评审只核对已给出的执行摘要、当前产物及其哈希，不推断校验器内部实现正确。

本次 scoped 边界接受为：M1 只增加 root-local React/Phaser 空间投影；W03 快照和 controller 继续拥有业务事实与选择；场景意图产生 0 次 HTTP 写，不持久化镜头、选择、占用或运动，不改变 `seatId`、任务、会议、文档或审批语义；超过视觉容量的实体仍可从 DOM 目录访问。

## 2. 门禁结论

| 判定对象 | 结论 | 说明 |
|---|---|---|
| scoped G2：M1 技术设计 | **failed / blocked** | 当前合同证据与主合同哈希不一致，地图合同不能表达已设计的关键边界，DOM/镜头转换协议未闭合，依赖 PoC、威胁/NFR 映射和必需评审仍缺失 |
| scoped G3：M1 开发计划 | **pending / blocked** | G2 未通过不得进入 G3；计划本身还存在门禁顺序倒置、角色/预算/批准未定和回滚验证未进入 WBS |
| M1 黑盒规格冻结 | **not freezable** | `m1-spec.md` 明示为 Draft；fixture、视觉/地图/图集基线、候选时序及当前合同哈希尚未冻结或签署 |
| M1 实施授权 | **no** | 本评审不批准安装依赖、制作运行资产或开始应用实现 |

这是 M1 scoped 结论，不改变 W03 既有状态，也不代表全迭代 G2/G3 的判定。

## 3. G2 阻塞项

### M1-G2-B01 当前主合同没有有效校验证据

严重度：Blocker。

`docs/evidence/m1-contracts.json:18-19` 为 `m1-v0.1.json` 记录的 SHA-256 是 `4d2a9b1cb53bf3774be79e582b4b71e4ab6bbe2844dc1ecd448d2b725124d0da`；本评审对当前输入只读复算得到 `5d48acc04fb124a103e7af9255bb3be6368dcfe4563a7011df3689ba844ce969`。因此证据中的 structural/semantic `passed` 不能覆盖当前主合同。两个 Schema 的当前哈希与证据一致。

此外，现有证据有 command、cwd、runtime 和产物哈希，但没有 exit code、原始日志/报告路径；其 `scope` 也明确排除 Phaser/EasyStar 运行时、真实地图/图集、性能与 M1 验收（`docs/evidence/m1-contracts.json:30`）。

关闭条件：对当前精确版本重新执行结构和语义校验，记录 exit code、日志/报告、正反例计数以及全部合同哈希；任何合同更新后证据必须随版本重跑。

### M1-G2-B02 地图合同不能表达设计所依赖的数据边界

严重度：Blocker。

存在三组机器合同与设计不一致：

| 边界 | 设计/主合同要求 | 当前地图 Schema | 风险 |
|---|---|---|---|
| 工作区房间绑定 | 显式映射到已有 snapshot `roomId`，缺失/锁定房间不可移动（`m1-v0.1.json:24`；`m1-design.md:68`） | `roomBindings` 只有 `key`、`roomType`、`cells`（`m1-map-v0.1.schema.json:22-31`） | 无法机器判定当前工作区的稳定房间引用，可能把类型匹配误当实体绑定 |
| 地图失效令牌 | 路径结果必须匹配 `mapRevision`，地图变化释放预留（`m1-v0.1.json:43,50`；`m1-design.md:108,114`） | 只有固定格式版本 `version: 0.1`，没有实例级 `mapRevision` / `mapVersion` | 迟到路径和旧预留不能由合同证明会在换图时失效 |
| 离座合法点 | 先到合法 `stand` 再释放旧座，随后寻路至 `approach`/`sit`（`m1-v0.1.json:47`；`m1-design.md:69,109`） | anchor 只有 `approach`、`sit`、`facing`、`footprint`（`m1-map-v0.1.schema.json:48-63`） | 离座、旧座释放和路径起点缺少可验证坐标，交换/删除/取消时占用语义不确定 |

`x-semanticChecks` 是约束清单，但不能补回未出现在实例结构中的字段。设计文档还保留“实际 map/atlas schema 仍待建立”的过期描述（`m1-design.md:79`），与本次输入中的两个 Schema 互相矛盾。

关闭条件：统一设计、主合同和地图 Schema；至少冻结稳定房间绑定、实例级地图 revision、`stand`/`approach`/`sit` 语义及其引用/唯一性/可达性规则，并用实际 map 正例与针对上述字段的负例复验。

### M1-G2-B03 Back 与镜头恢复的跨 DOM/Scene 协议不完备

严重度：Major，阻塞冻结。

W03/M1 兼容签名只把当前 `selection` 传入 `adapter.update(snapshot, selection)`（`w03-v1.1.json:8`；`m1-v0.1.json:8-11`）。设计同时要求 `previousCamera` 与 W03 `previousSelection` 同步替换/消耗，并让 `task -> owner -> Back` 恢复原镜头（`m1-design.md:121-123`；`m1-spec.md:59`）。仅观察连续的当前 selection，adapter 无法可靠区分 Back、直接选中、prune 或普通跨实体选择，也未获准读取 controller 的 previousSelection。

关闭条件：在不破坏 W03 公共兼容边界的前提下，冻结 root-local 导航转换协议，例如由 controller 明确传递转换原因/camera bookmark，或明确由 controller 完成镜头恢复；补充 close、selectSame、selectDifferent、back、prune、删除触发者和双 root 的确定性转换表及合同测试。

### M1-G2-B04 Phaser/EasyStar 决策缺少门禁前证据，且计划顺序倒置

严重度：Blocker。

版本选择已具体到 Phaser 3.90.0 和 easystarjs 0.4.4，但主合同仍标记 `installed: false`（`m1-v0.1.json:16`），设计明确将安装、锁文件、传递许可证、漏洞、离线构建、EasyStar 分片/取消及 Phaser destroy 实测列为待办（`m1-design.md:22,133`）。计划却把这些工作放在 P1 之后的 W04.1（`m1-plan.md:45-46`），而 P1 同时声称冻结 G2/G3/BB。

主合同还把“plan approval, BB freeze”列为合同冻结前置（`m1-v0.1.json:76-81`），计划 P1 又把设计、计划和 BB 合并冻结。这违反 G2 先于 G3、合同先供黑盒规格引用的顺序，并形成 G2 所需证据被安排在 G2 之后的闭环。

关闭条件：增加不进入产品实现的 pre-G2 技术 PoC/审计任务，先验证锁版安装、Vite/TypeScript 构建、离线包、许可证/漏洞、EasyStar 分片与迟到回调失效、Phaser StrictMode/destroy/context-loss；随后依次完成 G2 设计/合同冻结、G3 计划批准、实现前 BB 冻结。

### M1-G2-B05 威胁模型、NFR 映射与可观测性尚不能冻结

严重度：Major，阻塞冻结。

设计已经提出纯文本、资源 allowlist、0 POST、root 隔离、迟到回调失效和 W03 uncertain 屏障（`m1-design.md:53-59,125`），测试规格也完整保留六类首批阈值（`m1-spec.md:69-86`）。这些是良好机制，但尚未形成 CodingSpec 要求的逐项 NFR 设计映射和明确威胁模型：没有按攻击面/受保护资产/信任边界/威胁/控制/残余风险/责任人列项；性能 mark、帧采样、heap/监听器观测和禁外网检查的生产构建插桩所有权仍待评审（`m1-design.md:129-133`）。

关闭条件：增加 NFR-M1-01..06 到设计机制、观测点、BB/WB、阈值、环境和负责人一对一矩阵；补足本地资源/快照文本/DOM-Canvas 边界、跨 root 状态、未知写结果、资源耗尽与恶意 map/atlas 的威胁及残余风险；冻结测量工具和不可用时的替代/停止条件。

## 4. G3 阻塞项

### M1-G3-B01 WBS 还不是可批准的顺序与责任基线

严重度：Blocker。

任务表具备 ID、依赖、估算、产出和验证入口，图示依赖本身没有显式环；但第 M1-G2-B04 项构成门禁层面的前置倒置。计划还明确“指定角色尚未分派”（`m1-plan.md:40`），W04-W06 编号归并、剩余预算、运行美术范围及计划负责人批准均为 pending（`m1-plan.md:16,56,106-109`）。拟新增命令可以作为计划入口，但冻结时必须明确由哪个任务创建、在哪个工作目录执行、失败由谁处理。

关闭条件：重排 pre-G2/G2/G3/BB/实施里程碑；给每个任务指定 owner/reviewer/QA，确认剩余预算与美术交付边界；为所有拟新增验证入口指明创建任务、执行阶段和产物路径；由项目负责人批准 scoped G3。

### M1-G3-B02 回滚仅有原则，没有进入 WBS 和可验证 DoD

严重度：Major，阻塞 G3 批准。

现有回滚原则正确：只撤新 frontend 场景入口/adapter/包，保留 W03 DOM 与旧 Python 入口，不迁移或覆盖用户 JSON，也不把 UI 回滚解释成后端未提交（`m1-plan.md:100`）。但计划没有回滚任务、触发条件、实际目标清单、依赖/锁文件恢复边界、验证命令、负责人或演练证据；W06.3 的交接退出项也没有要求证明回滚后 W03 可操作且用户 JSON 未变化。

关闭条件：WBS 增加可验证回滚任务和 DoD，冻结场景 feature flag/入口、资产、包/lock/config 的目标清单生成规则；定义触发阈值、执行责任、回滚后 W03 回归、离线打开、临时 Store 与只读真实 hash 检查。实际文件清单可在实现后生成，但生成与校验义务必须在 G3 先写入计划。

## 5. 专项检查结果

| 检查域 | scoped 结果 | 评审意见 |
|---|---|---|
| 范围与兼容 | pass with freeze dependency | 客户端投影、0 写、无持久化、W03 uncertain/selection 所有权及超容量 DOM 访问边界清楚；不得据此扩到后端 Seat/Meeting/WS/SQLite |
| 数据边界 | fail | `roomId` 显式绑定、map revision 和 stand 锚点未进入地图机器合同 |
| Phaser / EasyStar | fail | 锁版方向合理且不手写 A*；安装、许可证、漏洞、离线构建与关键 API 行为尚无 pre-G2 证据 |
| 生命周期 | scoped design pass | root generation、latest input、StrictMode、shutdown/destroy、context loss、迟到回调、资源归属和 0x0 容器路径完整；仍需锁版 PoC/WB 证明 |
| 投影 / 镜头 / 命中 | scoped design pass | 2:1 正逆投影、CSS/camera/DPR 顺序、0.5..2、6px 手势、图外拒绝和像素遮挡有 BB/WB；参数仍待视觉/技术批准 |
| 安全区 | scoped design pass | 抽屉/导航/底栏遮挡、ResizeObserver、空 safe rect、390x844 恢复和 44px 实际命中均有设计与 BB；W00V/运行图仍未批准 |
| A* / 占用 / 终止 | conditional fail | 四邻接、格/边/目标独占、FIFO 窄门、有限重规划、前台终止上界与隐藏时钟语义充分；因 map revision/stand 合同缺口和 EasyStar PoC 未完成不能冻结 |
| DOM 联动 | fail | 单一选择、root 隔离、键盘等价和纯文本规则充分；Back/previousCamera 的转换所有权不确定 |
| 威胁 / NFR | fail | 测试阈值完整，但缺显式威胁模型、逐 NFR 机制/观测/责任映射及测量工具冻结 |
| WBS / 关键路径 | fail | 任务分解可用，但门禁顺序倒置、角色/预算/审批未定 |
| 回滚 | fail | 数据不迁移原则正确；缺 WBS 任务、触发、目标清单和回滚后验证 |

## 6. BB 可冻结性

`m1-spec.md` 的覆盖面可作为下一版基础：投影/镜头/安全区、四向移动、A*/占用/有限终止、生命周期、DOM 联动、跨 root、XSS/资源输入、0 POST、六类 NFR、回归/影响/发散均已覆盖，且明确不以实现输出作为路径 oracle。

当前仍不可冻结，原因如下：

| 冻结前置 | 当前状态 |
|---|---|
| 当前主合同及 map/assets 合同证据同 hash | failed，主合同 hash 漂移 |
| 视觉、实际 map/atlas、碰撞 oracle 与 fixture 版本/hash | pending；fixture 明示“待制作”（`m1-spec.md:14-24`） |
| 候选速度、planning/wait/replan/终止预算 | pending；测试明示冻结前需确认（`m1-spec.md:40`） |
| 测试 ID/fixture 引用一致 | pending；定义为 `F-M1-A..E`，用例中写成 `F-A/F-B`，冻结版需统一 |
| 技术、QA、视觉签署及实现前时间/hash 记录 | pending（`m1-spec.md:101-107`） |

冻结顺序必须是：先关闭 M1-G2-B01..B05 并完成 scoped G2 独立复审；再关闭 M1-G3-B01..B02 并取得 scoped G3 批准；随后用已冻结合同更新 BB、统一 fixture ID、记录版本/hash/时间并由 QA 签署。此前 `m1-design.md`、`m1-v0.1.json`、map/assets Schema、`m1-plan.md` 和 `m1-spec.md` 均只能视为 versioned draft，不能标记 frozen，也不能据此开始产品实现。

## 7. 本评审证据

| 检查 | 结果 |
|---|---|
| 五份指定 JSON 使用 PowerShell `ConvertFrom-Json` 只读解析 | pass，5/5 可解析；cwd=`C:\repos\ThemeTeam`；exit code 0 |
| 当前合同 SHA-256 与 `docs/evidence/m1-contracts.json` 比对 | `m1-map-v0.1.schema.json`、`m1-assets-v0.1.schema.json` 一致；`m1-v0.1.json` 不一致 |
| 实现/历史/state/gates 隔离 | 遵守；未读取、未修改 |

最终结论：**M1 scoped G2 不通过；M1 scoped G3 被 G2 及自身计划缺口阻塞；BB 规格不可冻结；不得进入实现。**
