| 文档 | P4/P5 实现与验证报告 |
|---|---|
| 版本 | v1.0 |
| 日期 | 2026-09-23 |
| 状态 | P4/P5 工程闭环机器验证完成；M1 人工门禁保持 pending |
| 关联 | `p4-p5-cli-spec.md`；`docs/next-development-plan-unified.md` |

## 已完成

| 范围 | 结果 |
|---|---|
| 独立本机 settings store | `SettingsStore`，Runtime/工程目录不再作为 workspace JSON 的唯一来源；测试 Store 使用内存 settings |
| P4 dispatcher | `queued/running/succeeded/failed/cancelled/timed_out/interrupted`；超时、取消、重试、重启恢复 |
| Codex 真实任务执行边界 | workspace-write argv、受控 artifact 目录、退出码/输出/产物记录；不记录 prompt 原文和密钥。真实业务 smoke 已启动但被当前 Windows ACL/提升权限测试夹具阻断，未计为通过 |
| Claude/OpenCode adapter | 统一 argv、目录、安全环境和 ProcessSupervisor 契约；本机真实 executable 探测/执行仍需独立验收 |
| 双目录并行 | 两个 cwd、artifact 和取消 token 互不共享 |
| P5 自动扩容基础 | 工位满载后自动启用扩容房间，新成员标记 `Unplaced`，不覆盖既有 20 工位 |
| 前端入口 | 任务页对已绑定可写 Runtime/工程目录的任务显示“运行”命令 |

## 验证

- P4/P5 专项：5/5 通过。
- Python 后端隔离回归：64/64 × 2 通过，0 failure/error，0 线程泄漏，默认 workspace hash 不变。
- 前端类型检查：通过。
- 前端单元测试：48/48 通过。
- 前端正式构建：通过。
- Codex 业务任务 smoke：环境阻断；`docs/evidence/codex-task-smoke.json` 记录 CLI 启动、artifact `--add-dir` 生效，但子进程对提升权限创建的临时目录仍返回 Access Denied，状态为 `timed_out`，不宣称通过。
- ACL 处理原则：产品运行和正式任务执行不要求管理员权限；smoke 应由同一用户身份创建并使用临时目录。提权仅可作为环境排查的显式补偿，不写入应用启动流程。
- 临时 workspace 快照不包含 `runtimeProfiles`、`projectDirectories`；只保存业务状态。
- 符号链接创建测试因当前 Windows 沙箱权限限制跳过。

## 尚未完成

- Claude/OpenCode 本机 CLI 的真实 executable 探测和 smoke。
- P4 真实 Codex 业务任务的浏览器端长链路验收、产物预览和人工审批 UI；需在同一用户 ACL 的本机临时目录重跑真实 artifact smoke。
- P5 自动地图重排、碰撞 oracle 更新、镜头边界更新及 21/40/60 人正式性能验收。
- M1 G4/G5/G6/G7 QA、项目负责人和最终人工签署。
