| 文档 | ITER-2026-001 / M1 缺陷与观察登记 |
|---|---|
| 版本 | v1.0 |
| 日期 | 2026-09-22 |
| 状态 | 当前已知项已分类；无未解决机器 Blocker |
| 关联 | M1 v0.4；`test-report.md` |

| ID | 严重度 | 描述 | 状态 | 处理 / 证据 |
|---|---|---|---|---|
| M1-T-001 | Test defect | 发散测试在随机相机移动后使用不可见 worker 坐标，导致选择动作误报失败 | Closed | 改为等待镜头稳定、选择可见候选并保留真实 canvas 点击；`m1-divergence.json` PASS |
| M1-T-002 | Test harness defect | 初版回滚演练把部分历史归档误当完整旧版应用，导航到不存在的办公室入口 | Closed | 将演练边界改为归档完整性与当前版恢复；`m1-rollback-rehearsal.json` PASS |
| M1-T-003 | Review pending | 当前 v0.3/v0.4 运行版需要独立复审确认视觉身份、手机顺序、动态遮挡和图集溯源 | Pending independent review | 新报告路径 `docs/evidence/m1-independent-rereview-v04.md`；未以旧 v0.2 视觉报告替代 |
| M1-T-004 | Scope observation | 当前 M1 按批准范围固定 20 个工位；worker 超过 20 人不触发无限地图扩容 | Accepted scope boundary | `m1-change-record-v0.4.md`、`m1-spec.md` F-M1-C；后续扩容需单独需求 |
| M1-T-005 | High, fixed | v0.3 props atlas 对所有帧统一 `trim + resize`，造成会议桌、老板桌、咖啡台和饮水机左侧/下沿轮廓缺失 | Closed | 家具帧改为保留源格 192x128 几何；地板/墙/效果仍走清理裁切；`m1-atlas-v03-promotion.json`、`m1-motion-evidence.json`、最新桌面截图 |
| W03-T-001 | High, fixed | 仅启动 Vite 前端而未启动 8000 API 时，`/api/state` 代理返回 502/空响应，客户端直接 `response.json()` 抛出 `Unexpected end of JSON input` | Closed | `frontend/src/workspace.ts` 增加空响应/非 JSON 防护；单测覆盖 502 空响应和 HTML 响应；本地双服务验证 `/api/state` 200 + 合法 JSON |
| M2-T-001 | Scope boundary | P1-P5 基线只允许受控 Mock Runtime 生成业务项目；完整 Codex/Claude/OpenCode 任务执行不在本轮直接开放 | Updated / accepted boundary | Codex 只读 probe 已通过 `docs/evidence/codex-cli-smoke.json`；完整 dispatcher、写任务、Claude/OpenCode 仍待 P4 |

没有发现当前机器验证中的 Blocker/Critical；M1-T-003 在独立复审完成前阻止 G5 自动通过。
