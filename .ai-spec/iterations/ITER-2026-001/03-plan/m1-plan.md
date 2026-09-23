| 文档 | M1 / W04-W06 任务与验证计划草案 |
|---|---|
| 版本 | v0.4 |
| 日期 | 2026-09-15 |
| 状态 | Approved；项目负责人 scoped G3 批准，待独立 QA 冻结 BB |
| 关联 | B01-09..12；m1-design.md；m1-spec.md；W03 v1.1 |

## 1. 本次边界

M1 只增加 root-local React/Phaser 办公场景，不重复 W01-W03，不改后端 schema、业务写路径或真实工作区。计划修订允许隔离的 pre-G2 依赖 PoC 和设计契约测试；在 scoped G2、scoped G3 与 BB 冻结完成前，不写产品场景代码。Mode 延续 `feature`。

已读取 coding-spec 公共/feature 规范、当前 state/gate-manifest、KB 索引与命中条目、首批验收、office-canvas、W03 v1.0/v1.1 契约。`03-plan/wbs.md` 当前不存在，分解依据使用 `docs/plan.md` 与本草案，不假定有已批准的 M1 WBS。

## 2. 编号映射与关键路径

`docs/plan.md` 最新推进说明用 W04=地图/镜头/选中/遮挡、W05=移动/停靠/状态、W06=联动/验收；其历史明细表把资产放 W04、镜头放 W05、移动放 W06。本草案显式采用最新推进分组，保留原能力追溯，不修改原计划。此编号归并仍需技术/项目负责人批准，不以改名增加范围。

```text
并行：P-1 隔离依赖PoC/审计 | P0 W00V补板与独立视觉复审
                       \      /
                   P1 scoped G2 独立技术复审
                              |
                   P2 scoped G3 项目负责人批准
                              |
                   P3 QA冻结实现前BB版本/hash
                              |
       W04.1 产品依赖/回滚基线 -> W04.2 运行资产/地图
                              |
            W04.3 生命周期 -> W04.4 镜头/命中/遮挡
                              |
            W05.1 寻路占用 -> W05.2 动作与恢复
                              |
            W06.1 DOM联动 -> W06.2 综合验证/VIS-RUNTIME
                              |
            W06.3 回滚演练 -> W06.4 独立评审/QA/报告
```

P-1 只在临时安装或 `--no-save --package-lock=false` 环境验证选型，不更改产品依赖；P1 只冻结设计/合同，P2 只批准计划，P3 才冻结黑盒规格。视觉基线批准不等于运行图集已生成。P3 后测试 fixture 可与资产制作并行，但不能从实现行为反推 BB。

## 3. 工作分解

剩余预算候选为工程 **7.5-12 人日**、原创运行美术/资产整理 **1-2 人日**，另计独立评审等待与缺陷返工；须由项目负责人在 P2 明确批准。Owner 固定到角色：Implementation=当前实现 Agent，Asset=当前实现 Agent/项目原生资产作者，Independent Tech/Code=非实现独立 Agent，QA=独立测试 Agent，Visual=独立视觉评审 Agent，Project Owner=用户。

| ID | 任务/关联 | 产物与退出证据 | 前置 | 估计 |
|---|---|---|---|---|
| P-1 | pre-G2 引擎选型 PoC/审计 | **完成且独立 G2 复审通过**。精确版本临时安装、Vite/TS/离线缓存、license/audit、EasyStar迟到回调、Phaser create/destroy/recreate/context-loss；证据 exit 0 | 冻结设计 | 0.5 人日 |
| P0 | 对齐 B01/TH、W03 与视觉输入 | **完成**。Visual 独立批准 VIS 图号/hash/TH-01..06；VIS-06补齐同一 Dev 会议返回工位连续链 | W00V v3 review | 0.5 人日评审，不含等待 |
| P1 | scoped G2 设计/合同冻结 | **完成**。Independent Tech 复审 v0.2合同、map/assets、导航转换、NFR/威胁和P-1证据；最终版本/hash已记录 | P-1、P0 | 0.5 人日 |
| P2 | scoped G3 计划批准 | Project Owner 批准编号、预算、资产边界、owner、风险和回滚；批准记录入 gate manifest | P1 | 人工确认 |
| P3 | 实现前 BB 冻结 | QA 复核 fixture/oracle、时序、采样和BB ID；记录 `m1-spec`版本/hash/冻结时间，必须早于首个产品代码修改 | P2 | 0.5 人日 |
| W04.1 | 产品引擎依赖与回滚基线，OC-01/13 | Implementation 添加精确 lock；创建变更前hash/文件清单和非Git回滚基线；`npm audit --json`、license、online+offline build | P3 | 0.5 人日 |
| W04.2 | 实际运行资产与地图，TH-01/02/03/06 | 可加载 PNG/atlas/动画/map/来源清单；8工位/6会议锚点；四向帧、门洞、碰撞连通；技术灰盒不是视觉验收 | W04.1、批准视觉输入 | 集成0.5-1 人日；美术另估 |
| W04.3 | 每 root adapter/scene 生命周期 | immediate update、latest pending snapshot、真实 Scene.update、shutdown/destroy幂等；双root/StrictMode/迟到回调证据 | W04.2、W03 bridge | 0.5-1 人日 |
| W04.4 | 投影/镜头/选中/遮挡，B01-09/11 | 0.5..2缩放、6px手势边界、safe rect、脚底排序/墙片；桌面/手机运行截图 | W04.3 | 1-1.5 人日 |
| W05.1 | 导航/预留/门洞队列，B01-10 | EasyStar适配、motion token、四邻接路径、目标/格/边独占、有限重规划、失败不破坏既有移动 | W04.4 | 1-1.5 人日 |
| W05.2 | 走路/停步/离座入座/状态 | 四向精灵、动作优先级、preview标记、减少动画、隐藏/恢复/删除清理；连续录制与错误案例 | W05.1 | 0.5-1 人日 |
| W06.1 | DOM单一选择/回焦/上下文，B01-11/12 | 任务->负责人->Back；Close/selectSame；root内焦点、目录/表单等价、错误/uncertain沿用 | W05.2、W03 v1.1 | 0.5-1 人日 |
| W06.2 | 全矩阵/性能/视觉运行复核 | QA 执行BB/WB/回归/影响/发散、全部首批NFR原始证据；Visual 复核实际运行截图/连续录制（VIS-RUNTIME） | W06.1 | 1-1.5 人日，失败返工另计 |
| W06.3 | 回滚演练 | Implementation 按冻结清单关闭flag/恢复依赖和入口；QA 验证W03 DOM可操作、离线打开、临时Store、真实hash只读不变；记录演练 | W06.2 | 0.5 人日 |
| W06.4 | 独立评审与交接 | Independent Code 做代码/对抗评审；QA签署；Implementation 闭环缺陷、知识回写、修改报告与最终待确认事项 | W06.3 | 0.5-1 人日，不含审批等待 |

W04-W06 工程小计 6.5-10.5 人日，加 P-1/P1/P3 后候选为 7.5-12 人日；原创运行美术另计 1-2 人日。可并行的是 P-1/P0，以及 P3 后的独立 fixture 与资产制作；同一 bridge/store 不并行改写。

## 4. 资产缺口与交接

当前没有已验收的运行地图、tileset、prop atlas、PM/Dev/QA 四向 sprite atlas、动画 manifest、角色脚底 pivot 及完整许可证/hash 清单。VIS 概念板即使获批也不能直接标这些产物完成。

设计契约已具备可执行结构/语义校验。候选 32x24 地图、两张真实 PNG、atlas manifest、60 个角色帧、17 个家具帧和 84 个动画映射已生成且来源审查通过；W04.2负责将它们接入真实 Phaser 场景并补充运行级资产、像素与交互验证。

视觉交接至少给出：批准 VIS-01..04 版本/来源；四区域/门洞构图；角色与桌椅比例；四向/坐姿/前后墙片；DPR/小屏表现；无法由图集提供的动作及合法回退。W04.2 检查实际帧边界、透明留白、脚底对齐、纹理采样、动作循环与家具遮挡。VIS-06 仅作为设计分镜；真正运行后的截图和连续动作另以 VIS-RUNTIME 复核 TH，不接受仅播放概念图或视频背景。

## 5. 验证入口计划

以下入口均指定创建任务、执行阶段和证据路径；不存在的入口在对应任务创建，不能提前声称通过。

| 入口/工作目录 | 范围与交付证据 |
|---|---|
| `node tests/m1_poc.cjs`，repo；P-1创建并执行 | `docs/evidence/m1-poc.json` 与 `.log`：精确版本、生命周期/路径取消、context loss、环境、exit/hash |
| `node tests/m1_contracts.cjs`，repo；P1维护并执行 | `docs/evidence/m1-contracts.json` 与 `.log`：当前合同hash、正反例计数、exit 0 |
| `npm run typecheck`、`npm run test:unit`、`npm run build`，frontend | 保留W03门槛；M1坐标/桥/生命周期/路径适配WB纳入；命令、版本、退出码、日志/hash |
| `npm run test:m1:assets`，frontend；W04.2创建、W04.2/W06.2执行 | 地图/atlas/锚点/来源完整性、静态连通、20人fixture可放置；`docs/evidence/m1-assets-*` |
| `npm run test:m1:e2e`，frontend；P3先冻结规格、W04.4-W06.1分步实现、W06.2执行 | 冻结BB功能、故障、手势、键盘、XSS、双root；临时后端/随机端口、录制/截图 |
| `npm run test:m1:perf`，frontend；W06.2创建/执行 | 帧率/输入/HTTP/冷加载/30分钟稳定性；分离各NFR并保留原始样本和环境 |
| `npm run test:e2e` / `npm run verify`，frontend | 原W03选择、焦点、CRUD、错误屏障、dev/preview代理影响回归，不能被新场景隐藏掉 |
| `npm audit --json` + lock许可证清单，frontend | 新锁文件全依赖与资源分发条件；禁止用历史W03审计替代新依赖审计 |
| bundled Python `-B tests/run_isolated.py`，repo | 原后端/W01/W02隔离回归；四轮策略保留，计数取当次实际发现结果，不写死历史用例数 |

后端合成数据通过临时 Store/独立服务构造，禁止真实 JSON 作为 fixture。运行测试前安装默认存储访问守卫；hash 如需取只能另作只读完整性检查，不计为路径隔离的替代证据。不杀其他进程；端口被占用则另选测试端口，用户已运行服务不覆盖。性能服务无调试热更新；确认生产构建且使用通过 W03 authority 校验的 loopback 入口，不能为了测试放开 CORS/Host。

## 6. 测试策略与 NFR 所有权

回归：W03本地选择/Back/Close、创建/保存/重载、未知结果冻结，W01/W02数据安全。影响：scene bridge、root焦点、resize/隐藏、镜头/气泡、新依赖和资产分发。发散：重复手势、坏map/skin/ID、门口对向竞争、迟到路径、卸载/重载/删除、恶意文本、失败资源和断连。BB 由需求与契约推导，WB 只补内部计时器/监听器/取消/清理观测，不冒充黑盒。

首批六类 M1 验证逐项执行：帧预算、输入/命令响应、冷加载/禁外网、四尺寸可读可达、30分钟稳定性，以及继承的数据/安全零违规约束。详细数据规模、预热/采样/重复、percentile算法和证据在 `m1-spec.md`，不得只运行“快测”就略去长稳或DPR2。

QA确认测量环境和结果，视觉负责人确认TH/VIS-05，独立技术/代码评审人不能是实现 Agent。本设计作者也不冒充自己的独立技术评审人。主线程报告的W00V/W03状态仅作上下文，不能填成本工作包实测通过。

## 7. 风险与回滚

| 风险 | 缓解/停止条件 | 责任 |
|---|---|---|
| 运行实现偏离已批视觉或资产来源变化 | 保持批准资产 hash；任何替换重新做视觉与来源审查；未批准来源不打包 | 视觉/项目负责人 |
| Phaser/EasyStar版本或DPR性能不满足 | 锁版PoC和NFR实测；变更版本需独立评审，不静默改用自写A* | 技术负责人 |
| 双root、销毁或旧路径回调泄漏 | W03签名不变、token失效、幂等cleanup；WB计数与双root浏览器测试 | 前端/QA |
| 预演伪装业务/污染JSON | scene不持有API写入口；POST计数0；压力fixture只在临时实例 | 前端/安全评审 |
| 门洞/工位死锁 | 格/边/目标独占、有限等待与失败终止；压力/对向路径负例 | 前端/QA |
| HUD/抽屉遮住目标、小屏无空间 | safe rect明确0尺寸路径；四尺寸长文本/按钮/回焦测试 | 前端/视觉评审 |
| 性能证据不完整 | 不平均掉失败run；未测NFR=未验证；保留trace/hash/环境和缺陷 | QA |

回滚只撤回新 frontend 场景入口/adapter、运行资产和相关包/lock/config 改动，保留 W03 DOM 工作流与旧 Python 入口，不迁移/覆盖用户 JSON。W04.1 在首次产品改动前生成 `docs/evidence/m1-rollback-targets.json`，记录前置文件hash、精确目标清单、依赖/lock/config边界和 feature flag 默认值；非Git工作区同时生成受影响源文件的只读基线包。场景以 root-local feature flag 可关闭，关闭后 W03 DOM 目录/详情/CRUD 保持可用。

触发条件：任一 Blocker/Critical、演示POST>0、默认Store访问>0、外联>0、数据hash变化、不可终止Walking、P95/P99/冷启动/稳定性任一必需run不达标、实际运行视觉关键TH不通过。Implementation 执行回滚，QA 独立验证：`npm run verify`、离线production打开、W01/W02临时Store回归、场景入口关闭且W03可操作、真实工作区SHA-256只读值不变。局部演示会话可丢弃，业务请求仍按 W03 不确定结果规则处理，不能以回滚UI声称后端未提交。演练证据为 `docs/evidence/m1-rollback-rehearsal.md`。

## 8. 评审与完成定义

| 检查点 | 当前状态 | 所需证据/负责人 |
|---|---|---|
| M1视觉输入 | passed | W00V v3 关闭 TH-01..06；运行验收仍独立 |
| G2 scoped技术设计 | passed | v0.2冻结合同、v0.3冻结设计、P-1证据、独立 v2 复审与资产来源批准 |
| G3 scoped计划 | passed | 项目负责人已批准编号、7.5-12工程人日、1-2资产人日、owner与回滚；见 approval.md |
| 实现前BB冻结 | pending | 经审查的m1-spec版本/hash、实现开始前时间记录 |
| 功能/NFR/运行视觉 | 未执行 | 各BB/WB命令结果、VIS-RUNTIME、全部首批NFR证据 |
| 独立代码/对抗与QA | 未执行 | 当前可执行交付物评审、缺陷闭环、QA签署 |
| 发布/知识回写/最终确认 | 未执行 | 回滚方案、KB回写、修改报告及用户确认 |

当前计划阶段完成定义为“G2 设计已冻结、v0.4 计划已提交项目负责人批准”。交付M1的定义必须同时包含实际位图场景、交互/移动/联动、隔离安全、全NFR和TH运行视觉结论。未满足不标 M1 完成，不复用 W01 的降级评审授权。
