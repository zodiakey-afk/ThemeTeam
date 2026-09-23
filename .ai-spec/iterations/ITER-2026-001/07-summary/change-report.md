| 文档 | ITER-2026-001 / M1 修改报告 |
|---|---|
| 版本 | v1.0 |
| 日期 | 2026-09-22 |
| 状态 | 待最终确认 |
| 关联 | M1 v0.4；W01/W00V/W02/W03 |

## 修改总览

| 修改 ID | 路径 / 产物 | 修改内容 | 原因 | 实现能力 |
|---|---|---|---|---|
| M1-01 | `frontend/public/assets/office/*v0.3*` | 替换批准 v0.3 agent/prop 图集与 manifest | 人物和家具需要达到批准候选视觉方向 | 可辨人物、家具、状态动画和本地资源溯源 |
| M1-02 | `frontend/public/assets/office/office-map.v0.3.json` | 20 工位、6 会议席、压缩老板室/休息区 | 支持当前 worker 规模并提升默认视图密度 | 固定 20 工位办公室布局与合法路径 |
| M1-03 | `frontend/src/office/*` | 镜头、跟随、空白清选、移动/停靠/遮挡/回退和 root 生命周期 | 完成办公室画布核心交互 | 选中、行走、入座、工作反馈、双 root 隔离 |
| M1-04 | `frontend/tests/*` | 完整回归、发散、正式 NFR、稳定性和回滚演练 | 关闭首批验收风险 | 可重复的机器验证与恢复证据 |
| M1-05 | `.ai-spec/*`、`docs/*` | v0.4 规格、NFR、测试、发布、回滚、知识库文档 | 建立可追溯交付链 | 支持 G4/G5/G6 审核和后续维护 |
| M1-06 | `tests/pack_m1_prop_atlas_v03.cjs`、`tests/validate_m1_visual_candidate_v03.cjs`、`frontend/public/assets/office/office-props.v0.3.png` | 修复家具 atlas 统一裁切导致的左侧/下沿缺失；家具保留源格几何，地板/墙/效果保持清理裁切 | 用户目视发现会议桌、老板桌、咖啡台和饮水机轮廓缺失 | 完整家具轮廓、稳定 192x128 frame geometry、可追溯像素验证 |
| W03-07 | `frontend/src/workspace.ts`、`frontend/tests/workspace.test.ts` | 对 API 空响应和非 JSON 响应增加明确错误处理 | 仅启动前端时 502 被解析为 `Unexpected end of JSON input`，用户无法判断是 API 未启动 | 可读的连接错误、不会泄漏底层 JSON 解析异常 |
| M2-01 | `themeteam/core/models.py`、`store.py`、`validation.py`、`frontend/src/App.tsx`、`workspace.ts` | 增加 runtime profile、工程目录 profile、设置页、员工选择和受控 Mock Runtime | 推进 P1-P5/M2，并验证本系统可生成独立项目 | 配置模型、员工运行绑定、工程目录隔离和示例项目产物链 |
| M2-02 | `projects/bazi-prediction-demo`、`tests/test_bazi_project.cjs` | 使用 ThemeTeam 受控 Mock Runtime 生成并验收八字预测示例网页 | 验收真实工程开发效果 | 可运行静态网页、表单交互、四柱演示、双视口浏览器证据 |

## 验证结果

机器验证全部通过，详见 `.ai-spec/iterations/ITER-2026-001/05-testing/test-report.md`；最新家具 atlas promotion、E2E、accessibility、motion 和 API 启动链路证据已更新。独立复审仍待重新针对最新图集签署，因此本报告不宣称 G5/G6 已关闭。

## 遗留风险

固定 20 工位不是无限自动扩建；独立复审可能仍发现视觉、移动端顺序、可读性或遮挡问题；部分历史回滚归档不是完整旧版部署包。上述风险已写入测试缺陷、发布和回滚文档。

## 最终确认

| 时间 | 角色 | 结论 | 范围 |
|---|---|---|---|
| 待填写 | 需求负责人 / 项目负责人 | 待确认 | M1 v0.4 全部修改、证据和遗留风险 |
