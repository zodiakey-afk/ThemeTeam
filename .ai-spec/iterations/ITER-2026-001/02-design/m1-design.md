| 文档 | M1 / W04-W06 技术设计草案 |
|---|---|
| 版本 | v0.3 |
| 日期 | 2026-09-14 |
| 状态 | Frozen；scoped G2 独立复审通过，运行验收与 G3/BB 门禁仍独立 |
| 关联 | ITER-2026-001；B01-09..12；OC-01/02/03/05/11/13；m1-plan.md；m1-spec.md |

## 1. 输入、优先级与门禁

M1 延续当前 `feature` 模式：新增客户端可见场景及渲染热路径。W03 有局部 G2/G3/G4 记录，M1 仍必须按 pre-G2 PoC、scoped G2、scoped G3、实现前 BB 冻结、W04-W06 实施顺序推进。当前修订只闭合设计和计划问题并允许隔离的依赖 PoC；不会因为文档或 PoC 通过而把应用实现、运行资产或 M1 标为完成。

依据及冲突优先级：已确认 [首批范围](/C:/repos/ThemeTeam/docs/first-batch.md) > [W03 v1.1](/C:/repos/ThemeTeam/.ai-spec/iterations/ITER-2026-001/02-design/contracts/w03-v1.1.json) 与其保留的 [v1.0 桥契约](/C:/repos/ThemeTeam/.ai-spec/iterations/ITER-2026-001/02-design/contracts/w03.json) > [办公室需求](/C:/repos/ThemeTeam/docs/office-canvas.md) 中适用于首批的部分 > 本草案候选参数。后者的真实运行、会议编排、上传、WS、SQLite、审批及迁移属于后续批次，不引入 M1。

已从 `docs/kb/INDEX.yaml` 检索并使用：KB-PRODUCT-0001/0002 的 TH-01..06 和首批边界；KB-TST-0002 的 root-local 焦点、未知结果屏障及代理约束；KB-SEC-0001 的隔离/原子保存验证；KB-ARCH-0001 的原型与场景差距。未找到已批准的 M1 地图/图集规格或帧率基线，不虚构组织知识。知识回写候选为“场景生命周期、投影与演示占用验证”，由主线程在实际验证后处理，当前不回写通过结论。

W00V 已由独立 v3 复审关闭 TH-01..06。VIS-01/02/03/04/06 仅作为已批准设计输入，不加载为整张办公室背景来冒充运行场景；历史 SVG 同样不是运行资产。批准图号、版本和 hash 记录于 W00V manifest 与复审报告，运行证据仍须由 M1 单独提供。

## 2. 范围与技术决策

| 决策 | 具体方案与理由 | 不包含/待验证 |
|---|---|---|
| ADR-M1-01 引擎 | Phaser **3.90.0** + easystarjs **0.4.4**，精确锁版；沿用 W03 React/TypeScript/Zustand/Vite；不手写核心 A* | pre-G2 临时安装/构建/生命周期 PoC 已通过；产品依赖与 lock 仍只在 BB 冻结后添加 |
| ADR-M1-02 真实渲染 | Phaser tile/sprite、相机与逐帧更新；固定 2:1 等轴测，运行地图拆层、人物独立动画 | 无 Three.js/自由旋转；无整张概念图交互热点替代品 |
| ADR-M1-03 事实与演示 | W03 快照是唯一业务事实；相机、插值、姿态、预留和演示状态是每 root 局部会话 | 无后端 schema/HTTP 路径变更；旧 seatId 仍为 roomId；不新增真实 Seat 或 motion 字段 |
| ADR-M1-04 导航 | EasyStar 四邻接、禁止对角、单位格成本；动态占用由局部预留协调，不宣称 A* 自动解决多人避让 | 不做服务器座位授权、跨浏览器同步预留、多层导航 |
| ADR-M1-05 生命周期 | 一个 root 创建一个 Game/adapter 和一个 W03 bridge；粗粒度更新与 frame update 分离 | 无模块级 Game/store/event bus；无每帧 React 全量更新 |

可交付闭环：同一办公室四区域、3 人默认种子画像、8 个视觉工位、6 个会议锚点；可选人、聚焦、合法行走与停靠、查看来源明确的状态、回到任务/目录上下文。人物为有四向帧的可运行精灵，而不是圆点头像。现代主题只换 DOM 皮肤，地图拓扑/投影/角色比例不变。

默认不改现有数据数量，不把历史工作区重置为三人。保留全部实体及目录访问；无法分配合法视觉锚点的成员显示未定位/容量提示，不伪造空位，不覆盖其他成员。20 人仅为完整渲染路径上的合成压力画像，不等同于 20 个持久化工位或产品动态扩容。

## 3. 模块、接口与局部状态

候选模块归属为 `frontend` 下的 scene adapter、map/asset loader、coordinate adapter、motion controller、root-local scene session、DOM overlay。具体文件名可在技术评审中调整；不得扩散至 Python 模型、存储或 legacy UI。

```text
W03 API queue -> validated WorkspaceSnapshot -> root-local W03 client store
                                                    | one subscription
React DOM <--- same snapshot/selection --------------+--> bridge.update
     | root-local commands/selection                         |
     +--> client.select / scene session intents       Phaser adapter
                                                        | Scene.update(time,delta)
                                                 sprites / camera / local motion
```

| 接口/所有者 | 输入与处理规则 | 输出/生命周期 |
|---|---|---|
| W03 `adapter.update(snapshot, selection)` | 保留签名；首次订阅立即调用。snapshot=null 时保留加载/空态。异步建图期间只保留最新的一组参数 | 按实体 ID 增量投影，不重建 Game，不把后端 selection 当导航源 |
| adapter 构造参数，候选 | root 的容器、只指向本 root 的 select 回调、asset/map 描述、局部 session 引用 | 不接收服务端写权限；没有 fetch、直接 Store 或全局 DOM 查询能力 |
| `adapter.navigate(transition)`，M1 新增可选接口 | controller 在提交匹配的 selection 变化之前发送 root-local `sequence/reason/from/to/cameraAction`；随后既有 `update(snapshot,selection)` 传递结果 | W03 的 update/destroy 签名不变；旧 adapter 可忽略可选接口；事件不持久化、不跨 root |
| scene session，候选 | `camera:{centerX,centerY,zoom,followId}`、`previousCamera`、`mode:workspace|preview`、`reducedMotion`、当前 hover/menu/intentSeq | 不持久化到 localStorage/sessionStorage/BroadcastChannel/API；选中仍由 W03 单独拥有，不能复制成第二事实 |
| motion 记录，候选 | `agentId, motionId, mapRevision, targetAnchorId, phase, direction, segment, elapsed, reservations` | 仅 scene 实例拥有连续位置；起止/拒绝/受阻等离散结果通知本 root DOM |
| `Scene.update(time,delta)` | 消费最新投影/意图、分片寻路、移动、脚底深度、相机与 overlay 投影 | 每帧不写全量快照或 React store；DOM 气泡内容至多 5Hz，位置可由 scoped transform 更新 |
| `adapter.destroy()` | 幂等；先失效 root generation/motion token，再解绑输入、ResizeObserver、媒体查询、overlay、scene/game 资源 | bridge 先 unsubscribe；Game 销毁一次；加载/路径迟到回调不可重建资源或发选择回调 |

Phaser 的 `Scene.update(time,delta)` 是真实帧循环，不是 W03 的 `adapter.update(snapshot,selection)` 别名。Scene shutdown 释放本 Scene 输入、计时器、tween、路径请求、预留；Game destroy 负责 canvas/纹理等 Game 所有资源。共享的 dispose 函数幂等，不能让 shutdown 与 destroy 重复释放其他 root 的资源。React StrictMode 的 mount/unmount/remount 按独立 generation 处理。

资源加载未完成就销毁、父容器尺寸为 0、切换看板隐藏画布、WebGL context lost 均有明确路径：隐藏暂停动画时钟；context lost 展示场景不可用与 DOM 入口，停止局部移动并释放预留；显式重试只重建本 root 场景，不重新 POST。刷新从快照重建位置，不恢复旧帧插值。

W03 的 FIFO、dispatch 起算 10000ms 超时、零自动重试和 uncertain 写屏障保持不变。选择/平移/演示移动不进 API 队列，不影响 dirty。正常 CRUD 仍经 W03 commands；未知结果只读刷新不解冻写入，场景不能在“恢复动画”时重发业务命令。dispose 只保证客户端不再发布，不声称后端已取消。

## 4. 待建地图与运行资产契约

候选逻辑地图 32x24；地砖 64x32 世界像素；角色约 32x48、脚底 pivot 一致。准确帧矩形、墙高和家具尺度须对齐批准 VIS-02 后冻结，当前不是已交付参数。建筑由老板室、开放工位、会议室、咖啡角及连续走廊构成；走廊优先两格宽，门洞和 approach 路径不可被桌椅 footprint 堵塞。

| 资源/层 | 内容及加载前验证 |
|---|---|
| `office-map.v0.2.json`，候选已生成 | 32x24、64x32、origin、4个显式 roomId、mapRevision、collision/doors/props/anchors/spawns；严格 Schema 与语义测试通过；独立复审前不冻结 |
| 房间/碰撞 | 逻辑 room key 与 snapshot roomId 的显式映射；二维矩阵为唯一静态可走来源；门格开放、墙桌椅格禁行；未知/锁定区域禁行；不把旧 x/y 直接转格子 |
| 锚点，候选字段 | `id,kind,roomId,approach:{col,row},stand:{col,row},sit:{worldX,worldY},facing,footprintRef`；整数网格、有限世界坐标、引用存在、ID 唯一 |
| 工位/会议 | 正好 8 个 workSeat、6 个 meetingSeat，另有门外等待/出生点；sit 是局部渲染锚点，不是可走桌面格；所有 approach 从合法出生点可达 |
| `office-props.v0.2.png`，候选已生成 | 项目原生 Canvas 基元生成；17帧，含地砖、墙、桌椅、CRT、会议桌、白板、咖啡角与反馈标记；透明 PNG，无外部图片输入 |
| `office-agents.v0.2.png`，候选已生成 | PM/Dev/QA 三种可辨颜色/头部；四方向，idle/walk1/walk2/sit/work，共60帧，32x48、pivot(16,48) |
| `office-assets.v0.2.json`，候选已生成 | 84个角色动作映射、source/author/license/path/hash；2026-09-15 独立源码权利审查批准用于 ThemeTeam 项目运行时打包，不构成商标许可或第三方法律意见 |

来源于快照的角色外观字段只映射到本地 allowlist 的纹理/动作键，不当作路径或 URL。未知皮肤使用可辨认的本地备用人物与原姓名；单动作缺帧降为同一人物静止姿态并保留状态。整套资产缺失展示明确加载失败和 DOM 入口，不能用空 canvas、整张概念图或临时几何人通过 TH 验收。

出生和视觉固定工位分配按稳定 agentId 顺序初始化，保留本会话已有分配，新成员只取空闲合法锚点；选择/无关快照更新不重新洗牌。roomId 未映射、锁定或合法位置不足时保留目录实体和原因。压力 fixture 提供 20 个不同合法出生/站立点，复用同一渲染/导航逻辑与完整美术，不新增 12 个工作座位，不靠隐藏人物降低负载。

2026-09-14 的修订契约为 `contracts/m1-v0.2.json`、`m1-map-v0.2.schema.json` 与 `m1-assets-v0.2.schema.json`。v0.2 在保持既有 update/destroy 边界的同时新增 root-local 导航转换协议；地图增加显式 snapshot `roomId`、`movementEnabled`、实例级 `mapRevision`、`stand/approach/sit` 和 props；资产增加明确 author。`tests/m1_contracts.cjs` 对三份当前文件、实际候选 map/manifest 与 collision oracle 重新计算 hash，接受6个结构及6个语义正例、拒绝29个负例，并记录 exit code/原始日志。候选资产由 `tests/generate_m1_design_assets.cjs` 可重现生成，证据 `docs/evidence/m1-design-assets.json`；权利复审已批准项目运行时打包。v0.1 保留为历史草案，不再作为冻结候选。

## 5. 坐标、镜头、命中与遮挡

采用统一坐标适配，所有 sprite 以脚底作为 ground point。W=64、H=32 的候选投影为 `x=ox+(col-row)*W/2`、`y=oy+(col+row)*H/2`；逆变换为 `col=((x-ox)/(W/2)+(y-oy)/(H/2))/2`，row 使用两项相减。DOM CSS 坐标先减 canvas DOMRect、处理逻辑 viewport 比例，再经 Camera 逆变换；DPR 只影响 backing buffer，禁止重复乘 DPR。格子边界先候选取整再菱形命中验证，图外不钳成合法移动目标。

Camera 缩放范围 0.5..2；工具停靠级别 0.5/0.75/1/1.5/2，滚轮/捏合以指针/中心为锚连续缩放后停靠；nearest sampling，停止时屏幕像素对齐。总览按整个地图外包围盒 fit 后夹到范围，不能为了 fit 小屏突破 0.5；小屏看不全时可平移。相机限制地图边界；目标聚焦由 drawable safe rect 决定，不把选人等同强制全图拉近。

| 手势 | 候选判定/结果 |
|---|---|
| 主键点击人物 | 选中、开详情；点击同一正在行走者不重启路径；空白点击选择 null，不改镜头 |
| 中键或 Space+主键拖动 | 位移大于 6 CSS px 后平移，未超过不发移动；输入框聚焦时不接管 Space |
| 右键 | 未超过 6 CSS px 且释放仍在目标上，显示本 root 对象菜单；超过阈值转平移，释放不弹菜单、不执行命令 |
| 触控 | 单指空白平移/对象轻触选中；双指中心缩放，双指介入取消单击候选；可见更多按钮提供右键等价入口 |
| 滚轮/键盘 | 只在画布实际交互区域消费缩放，不吞 DOM 面板滚动；按钮/数字缩放与目录导航等价可用 |
| pointercancel/失焦 | 释放 capture、清除未提交手势、关 hover；不取消已确认移动或业务任务 |

命中优先级 DOM > 可見人物的自定义脚底/身体 hit area > 交互锚点 > 家具/房间 > 地面。同层重叠按可见渲染顺序逆序命中。菜单只含本批有语义的查看、跟随、演示移动/回座与关闭，不挂接真实审批/运行/上传操作。

地板独立底层；人物与可遮挡家具按 groundY、稳定 ID 排序；长墙/桌子拆片，不能全家具在人物下方。仅移动/显隐/布局变化时更新动态深度。选中不提高到全局最前；必要时淡化遮挡该目标的前景墙，保持碰撞不变。测试须覆盖同一桌/墙前后移动的像素证据，不仅断言 depth 数字。

DOM 抽屉/导航/底部区测量为遮挡矩形，通过 ResizeObserver 更新 scene safe rect。>=1280 使用侧栏布局；1024..1279 折叠左栏并扣除覆盖抽屉；<1024 导航/详情互斥，390x844 采用上方场景与下方详情，保留选中人物及脚下标记的可见安全区，关闭后恢复原镜头/选择。详情正文可独立滚动，但主命令不得部分藏在底栏后；有效44px命中区须同时满足裁剪祖先和遮挡检查，而非只看viewport外包框。无可用画布时暂停并保留状态，不能以0x0 viewport计算相机，也不能以此通过指定尺寸验收。hover延迟250ms，拖动/离开关闭；最多5个详细气泡，阻塞提示 > 选中 > 预演发言 > 常规状态，完整文本留DOM。

## 6. 移动、占用与姿态状态机

默认 workspace 视图从快照重建人物；旧 status=Walking 没有路径上下文时站在已映射合法点并说明原型状态待核对，不永久播放 Walking。进入明确的 `preview` 演示会话后才允许本地换座/入会预演；这是真实运行的精灵移动，不是真实模型执行。预演的 Working/Thinking/Blocked 标为演示；业务快照状态标为工作区记录，不声称存在实时调用、token 或审批。

候选有限状态：`standing -> planning -> walking -> docking -> seated`，以及 `waiting / obstructed / removed`。业务 activity、四向 facing、standing/sitting pose 分开。具体速度暂定 4 格/秒、docking 300ms、undocking 300ms；均为待技术/视觉确认的局部参数，不是新增已批准 NFR。

1. 意图包含本 root 的递增 motionId、agentId、目标 anchorId、当前 mapRevision。形状/实体/地图/解锁/预留检查全部成功后才取代旧意图；非法目标不释放旧座、不取消旧路线。
2. 目的地预留唯一；同一 JS 事件队列中按提交序分配，竞争者收到 occupied 并保持原位置/路径。只保留一个活动意图/成员，不覆盖他人的预留。离座计划成功后经 undocking 到 stand，再释放旧 occupied seat；新座只有到达 sit 才从 reserved 变 occupied。
3. EasyStar 对包含静态障碍和当前不可占单元的矩阵寻路；禁止对角。候选每帧最多 200 次搜索迭代、最多 20 个待计算请求；超限不排无限队列，返回忙碌。迟到结果必须同时匹配 root generation、motionId、mapRevision，否则丢弃。
4. walking 沿格边逐段插值、四向帧匹配行进方向，不能穿墙或切桌角。下一格和有向边预留后才推进；禁止同一格同时占用和对向交换边。窄门 FIFO，禁止互相穿过；离开段后释放占用和门票。沿途成员仍可选中。
5. 动态受阻进入 waiting；前台有效时间 2 秒无进展后重规划，最多 2 次；再等 2 秒仍失败即 obstructed，停在最近合法格、释放目的地/后续路径预留并显示原因。不能靠无限重试维持 Walking，也不能穿墙/瞬移解决死锁。
6. 到 approach 后验证预留仍归本 motion，进入 docking，脚底过渡到 sit、使用座位 facing，完成后 seated。原地目标直接确认已有 seated，不重复订阅、动作或预留。return-home 也是同一条局部意图路径。
7. 用户新合法意图替换旧 motion，停止于当前合法段端点再重新规划；不回弹起点。成员删除、地图版本变化、退出 preview、root dispose 统一失效 token/释放预留。无关任务更新、选择同人、关闭详情不重启移动。
8. delta 限幅候选 50ms，隐藏页/画布暂停局部运动时钟，恢复不补算长时间路径。保留地图时从合法点继续；地图/身份变化则明确恢复定位。减弱动画保留寻路/占用校验，跳过装饰和镜头 tween，以短离散合法路段/即时合法停靠表达结果，不跳过阻塞校验。

可观察超时候选：首次 planning 前台 1 秒未完成 -> 显示失败并释放候选预留；已获路径长度 L 的前台终止上界 `L*250ms + 600ms + 3*2000ms + 1000ms`。32x24 无重复简单路径 L<=767，上界不足 200 秒；达到上界必须明确停止/失败。精确动画时序已按 scoped G2 冻结，测试不能把后台挂起算永久 Walking，也不能排除真实前台阻塞样本。

## 7. DOM 联动、错误与安全

沿用 W03 selectDifferent/selectSame/close/back/prune：Close 隐藏详情但保留场景选择；同人重开不增加历史；Back 消耗 previousSelection；对象删除后不从后端 selection 复活。controller 通过 additive `navigate(transition)` 显式给出转换原因，且在提交 selection 前发送，scene 不再从连续当前 selection 猜测 Back。`select-different/capture` 替换一层 `previousCamera`，`select-same/close/keep` 不推历史，`back/restore` 同步消耗 previousSelection 与 previousCamera，`prune/deleted/drop` 丢弃被删引用及书签。双 root 各自递增 sequence；错序、重复或旧 sequence 忽略。完整确定性表冻结在 `m1-v0.2.json`，不新建无限导航栈。所有回焦仅查本 root，触发按钮不存在回本 root 主标题，画布触发可回画布可访问容器。

任务负责人 DOM 按钮选人并聚焦；人物关联任务打开原任务详情；房间/会议桌打开本批已有记录/房间入口，不自动创建会议。未定位成员保留列表/详情及容量原因，不把相机拉到其他人。键盘目录、目标锚点选择表单与移动确认是鼠标/触控的等价路径。Esc 仅关当前菜单/面板或取消未提交手势，不把取消动画解释为取消任务。

名称、摘要、文档、状态/模型标签始终纯文本；DOM 不使用危险 HTML，气泡只截短展示，不截断原记录。场景文字/颜色/资源键受限，不能由数据构造脚本、CSS URL、远程纹理或文件路径。离线/error/uncertain 沿用 W03 可见反馈；不伪造成功 toast。本批选中、镜头、演示移动及停靠网络 POST 计数必须为 0。

## 8. NFR、威胁模型与可观测性

首批阈值逐项原样列在 [测试草案](/C:/repos/ThemeTeam/.ai-spec/iterations/ITER-2026-001/05-testing/m1-spec.md) NFR 表。以下矩阵冻结设计机制、观测点和责任，不表示尚未执行的阈值已通过。

| NFR | 设计机制 | 观测/测试 | 阈值与环境 | Owner |
|---|---|---|---|---|
| NFR-M1-01 帧预算 | 本地图集、静态层缓存、每帧单入口、仅动态实体排序、DOM 内容 <=5Hz | rAF frame marks、浏览器 trace、BB-M1-01/06、WB-M1-03 | 1440x900 DPR1/2，20人/8移动/5气泡，P95<=20ms、P99<=33ms | Frontend owner；QA 复核 |
| NFR-M1-02 响应 | root-local 同步选择反馈、相机 tween 可取消、命令仍走 W03 队列 | 输入 event 到可见提交 mark；BB-M1-02/18/20 | 四尺寸，各动作30次；输入P95<=100ms，本地命令P95<=300ms | Frontend owner；QA 复核 |
| NFR-M1-03 加载/离线 | 仅构建内 PNG/JSON；无 CDN/远程纹理；资源校验失败回 DOM | 冷 context trace、阻断非loopback请求、BB-M1-07/26 | 三次冷启动均<=3s；外网请求0 | Asset owner + Frontend owner；QA 复核 |
| NFR-M1-04 可读可达 | ResizeObserver safe rect、DOM语义控件、44px目标、Canvas ROI/像素非空检查 | 四尺寸DPR1/2截图、键盘流、实际 hit-test；BB-M1-03/20/21 | 390x844、1024x768、1366x768、1920x1080；文字对比>=4.5:1 | Frontend owner；Visual/QA 复核 |
| NFR-M1-05 稳定性 | 幂等 destroy、generation/path token、root 资源登记、隐藏时钟暂停 | CDP heap/GC、listener/resource counters、BB-M1-14/19/26、WB-M1-03 | DPR1/2各30分钟；10-30分钟heap增长<=20%；监听器不持续增长 | Frontend owner；QA 复核 |
| NFR-M1-06 数据/安全 | scene 无 fetch/Store 写权限；纯文本；资源 allowlist；临时 Store；W03 unknown 屏障 | POST计数、默认路径守卫、XSS/坏资源、W01-W03回归；BB-M1-23..25 | 默认存储打开0、跨实例影响0、脚本/外联/演示POST/业务变更均0 | Security reviewer + QA |

测量插桩归 scene adapter：生产构建只保留低成本 `performance.mark` 和 root-local 计数器，测试通过显式 query flag 才采集详细样本；不得写业务 Store 或网络。帧采样由浏览器 trace 与 rAF 双证，heap 仅在支持 CDP 强制 GC 的固定浏览器执行；若 CDP/trace 不可用，该 NFR 停在 pending，不以 JS heap 猜测替代。禁外网由浏览器 request interception 加 loopback allowlist 证明；离线 build 不能替代运行外联检查。

| 资产/信任边界 | 威胁 | 控制 | 残余风险/停止条件 | Owner |
|---|---|---|---|---|
| Snapshot 文本 -> DOM/Canvas | HTML/script/CSS 注入、超长文本耗尽 | `textContent`/React文本；气泡截短但完整DOM可读；角色/动作 allowlist | 浏览器或字体极端布局仍需四尺寸测试；出现脚本或外联即阻塞 | Security reviewer |
| Map/atlas JSON -> Phaser | 路径遍历、远程 URL、NaN/越界帧、恶意大资源 | 固定构建路径、严格Schema、语义/尺寸/hash/rights校验；最大4096边 | 构建链被篡改不在客户端自证范围；hash/rights缺失禁止打包 | Asset owner |
| DOM controller <-> Canvas scene | 选择分叉、伪造Back、跨root事件 | 显式 transition sequence/reason、root generation、单层书签、无全局查询 | 实现若改公共 W03 签名须回 G2；双root失败阻塞 | Frontend owner |
| EasyStar 异步回调/动态预留 | 迟到路径接管、穿墙、同格/换边、无限 Walking | generation+motionId+mapRevision；目标/格/边所有权；有限重规划与超时 | 浏览器隐藏时钟暂停；前台超过上界即阻塞 | Frontend owner |
| W03 unknown write -> scene | 场景重试绕过写屏障或重复POST | scene 无写能力；重试只建本root；POST计数0 | 任何演示网络写或屏障解锁为 Blocker | Security reviewer |
| 20人/坏输入资源耗尽 | 路径队列、气泡、纹理、listener泄漏 | pending paths<=20、iterations/frame<=200、详细气泡<=5、幂等清理 | NFR-M1-01/05任一run失败则不发布 | QA |

风险暂定 M：渲染热路径高轴，跨前端模块/局部占用并发中轴，无新增后端授权或数据迁移。若桥契约破坏性变更、增加服务端意图/座位或远程资产输入，必须重新分级/回需求，不暗中扩展本方案。

pre-G2 PoC 已用 `--no-save --package-lock=false` 临时安装完成：精确版本、TypeScript/Vite 构建、离线 package-lock、漏洞0、Phaser 4次 create / 4次 destroy 最终 canvas=0、WebGL context loss、EasyStar 四邻接/取消/迟到 generation 丢弃均通过。许可证记录为 Phaser/EasyStar/eventemitter3 MIT、heap 0.2.6 PSF；详见 `docs/evidence/m1-poc.json`、`.log` 与 `m1-dependency-audit.json`。该结果只证明选型可行，不是产品代码或性能验收。scoped G2 独立技术评审已通过；下一顺序是项目负责人批准 G3、QA 冻结 BB；功能、性能和长稳须在实现后执行。
