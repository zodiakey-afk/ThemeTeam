# M1 独立技术复审 v2

| 文档 | ITER-2026-001 M1 scoped G2 独立技术复审 |
|---|---|
| 版本 | v1.0 |
| 日期 | 2026-09-15 |
| 状态 | 已批准 |
| 范围 | M1-G2-B01..B05；候选运行资产来源与项目内打包权利 |

## 结论

**Scoped M1 G2：通过。** 本结论覆盖当前需求、v0.2 合同、v0.3 设计、候选资产来源证据和 pre-G2 PoC，不评审尚不存在的 Phaser 产品实现，也不替代运行验收。

| 门禁项 | 结论 | 依据 |
|---|---|---|
| M1-G2-B01 合同、哈希与版本 | PASS | 合同已版本化；最新合同检查通过，负例均被拒绝；合同与候选运行文件的记录哈希同独立采集值一致。 |
| M1-G2-B02 地图、图集边界与语义 | PASS | 房间、门、锚点、出生点、家具、帧引用、可走性、footprint 与有限 sit 坐标满足 Schema 和语义约束；PNG 非空且尺寸匹配 manifest。 |
| M1-G2-B03 导航、镜头与生命周期 | PASS | 设计保留 adapter 兼容性，并明确 root-local 导航顺序、镜头、generation/dispose、context loss、投影/DPR、有限移动终止、预留和恢复规则。仅为设计/合同结论。 |
| M1-G2-B04 依赖可行性与许可证 | PASS | Phaser、EasyStar、EventEmitter3 与 heap PoC 通过；许可证适用于当前范围；离线 lock、audit=0、构建和生命周期/寻路验证通过。 |
| M1-G2-B05 NFR、威胁模型与回滚 | PASS | 帧预算、响应、加载、稳定性、viewport/DPR 和访问隔离目标均量化并映射测试；威胁控制、回滚阈值、触发器和责任明确。 |

## 资产权利

**批准用于 ThemeTeam 项目运行时打包。** 两张图集由项目生成器使用 Canvas 基元和字面颜色生成，未检测到导入位图、字体、网络资源或外部素材输入。批准仅限这批项目原创生成资产，不构成商标许可或第三方法律意见。

- `office-agents.v0.2.png`：320x288 RGBA8，46,180 个非透明像素，SHA-256 `07cf53079fff7ebc969cb6bcb6109d18d8ee2c95119a30db5e12a14a7980dbe4`。
- `office-props.v0.2.png`：512x256 RGBA8，20,777 个非透明像素，SHA-256 `3025eabc9810dc62391a6e1acaa68c09de36e31f7af6a9d2d6f935b139a05656`。
- 生成器 SHA-256：`24519070723faa900dcec0d653691066784fd9f9012d831b8fa6098f9c4ff568`；仅使用本地 Canvas/Playwright 生成与本地文件写入。

## 剩余门禁

- M1-G3-B01：PENDING，项目负责人批准计划。
- M1-G3-B02：PENDING，G3 后由独立 QA 冻结黑盒测试规格。

技术评审人不能代签以上两项。

## 冻结后一致性复核

独立评审人确认状态与证据对齐修改继续保持 PASS：未批准 fixture 仍被阻断，当前已批准运行候选可通过打包语义。资产权利批准范围不变；G3 与 QA 仍 pending。

- 冻结合同 SHA-256：41302acd3aaac207b9585900d11c10d3f1075eb8b304584c4b494d7b516bf08f
- 冻结设计 SHA-256：139467a1b1701debb9ff7f38d56caa9837df5917827bd49dceec4e44688804b6
- 已批准资产 manifest SHA-256：ec453750039f4e7bf059868c6a0d23d8802bd63e94de33b1d027bf33f1743b6b
- 合同证据 SHA-256：04692008e8fc1056476f28be1477d1f578d2d0c42656eec01f04a9efc33a2dac