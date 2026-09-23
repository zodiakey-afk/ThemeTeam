| 文档 | P1-P5 / M2 基础能力验证报告 |
|---|---|
| 版本 | v1.2 |
| 日期 | 2026-09-23 |
| 状态 | P1-P5/M2 基础与 P4/P5 工程闭环验收完成；Claude/OpenCode 真实 smoke、地图重排和 M1 人工门禁待后续 |
| 关联 | `docs/next-development-plan-unified.md`；`docs/agent-cli-architecture.md` |

## 完成范围

| 阶段 | 结果 | 证据 |
|---|---|---|
| P1 配置模型 | PASS | `runtimeProfiles`、`projectDirectories` 兼容迁移、schema、设置页 |
| P2 CLI adapter 基础 | PASS（Mock + Codex 只读 probe + 统一 adapter 契约） | `ProcessSupervisor`、工程目录 guard、Codex/Claude/OpenCode argv 契约、设置页探测 |
| P3 Agent 创建 | PASS | 团队页新建成员、办公室新增员工入口、模型/CLI/工程目录选择 |
| P4 任务执行闭环 | PASS（示例闭环） | `/api/runtime/mock-project`、项目文件产物、事件记录 |
| P5 容量前置 | PASS（策略前置） | 20 人容量边界、扩容房间数据、未定位/后续扩容计划 |
| 八字示例项目 | PASS | `projects/bazi-prediction-demo`、`bazi-project-verification.json` |

## 测试结果

- Python 后端回归：48/48 PASS。
- 前端类型检查：PASS。
- 前端单元测试：48/48 PASS。
- M1 完整 verify：PASS。
- 八字项目浏览器验收：桌面 1440x900 DPR1、移动 390x844 DPR2 均 PASS。
- 八字项目：4 柱结果生成、表单交互、免责声明、0 外部请求、0 页面错误。
- 生成接口：`POST /api/runtime/mock-project` 返回 201，生成 `index.html`、`styles.css`、`app.js` 和 `README.md`。
- Codex CLI smoke：`docs/evidence/codex-cli-smoke.json`，真实 `codex exec` 只读读取测试文件，退出码 0，工作区文件保持不变。
- Python 隔离回归：`tests/run_isolated.py --rounds 2`，57/57 × 2 通过；默认 workspace hash 不变，线程无泄漏。
- P4/P5 专项：`tests/test_p4_p5_dispatcher.py` 5/5 通过；覆盖独立 settings、任务状态机、artifact、重试、恢复、双目录并行和统一 adapter 契约。
- 最新后端隔离回归：64/64 × 2 通过；覆盖任务运行 API、自动扩容和 dispatcher 生命周期。

## 明确边界

- Codex 已完成受控 workspace-write 任务边界、artifact、取消/超时/重试/恢复和任务页入口；真实业务任务浏览器长链路与审批 UI 仍未完成。
- Claude/OpenCode 已完成统一 adapter 契约和测试骨架；本机真实 executable 探测与 smoke 仍未完成。
- P5 已完成满载后的扩容房间分配和 `Unplaced` 状态；地图重排、碰撞 oracle、镜头边界和 21/40/60 人正式验收仍未完成。
- P5 本轮完成容量策略前置和扩容数据入口，不声称自动地图重排已经完整完成。
- 八字结果只是传统文化/娱乐性演示，不构成科学、医疗、投资、婚姻或其他现实决策依据。
