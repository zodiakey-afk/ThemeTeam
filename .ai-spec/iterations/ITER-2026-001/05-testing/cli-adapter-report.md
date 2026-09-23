| 文档 | P2 Codex CLI 适配器验证报告 |
|---|---|
| 版本 | v1.0 |
| 日期 | 2026-09-23 |
| 状态 | Codex 只读切片完成；完整 P4 任务执行未完成 |
| 关联 | `cli-adapter-spec.md`；`docs/agent-cli-architecture.md` |

## 实现

| 项目 | 结果 |
|---|---|
| ProcessSupervisor | argv 数组、`shell=false`、超时、取消、进程树清理、stdout/stderr 上限 |
| ProjectDirectoryGuard | realpath、允许根目录、目录存在性、只读/可写检查、符号链接逃逸拒绝 |
| CodexCliAdapter | executable allowlist、`--ephemeral`、`--sandbox read-only`、最小环境白名单 |
| 设置页探测 | `/api/runtime-profiles/{id}/probe`，仅已登记 Codex profile 可调用 |
| 凭据处理 | 不读取或注入 API key；输出脱敏 session/token/key 字段 |

## 证据

| 检查 | 结果 | 证据 |
|---|---|---|
| Codex 真实只读 smoke | PASS，退出码 0，工作区文件未改变 | `docs/evidence/codex-cli-smoke.json` |
| 设置页 HTTP probe | PASS，HTTP 200，独立 Store 未落盘 | `tests/run_codex_probe_route_smoke.py` |
| Python 后端隔离回归 | PASS，57/57 × 2，0 failure/error，0 泄漏线程 | `tests/run_isolated.py --rounds 2`；默认 workspace hash 前后相同 |
| 前端单元测试 | PASS，48/48 | `npm run test:unit` |
| TypeScript | PASS | `npm run typecheck` |
| 前端正式构建 | PASS | `npm run build` |
| 前端完整 verify | PASS；类型、48 单测、M1 合同、双 root、E2E、motion、NFR、发散、无障碍、稳定性和最终 E2E 全部通过；secret scan 0 findings | `npm run verify`；`docs/evidence/m1-verification.json` |
| 符号链接测试 | 环境跳过 | 当前 Windows 沙箱禁止创建测试符号链接；后端静态资源符号链接测试仍通过 |

## 尚未完成

- Codex 真实业务任务执行和产物写入。
- `queued/running/waiting/succeeded/failed/cancelled` dispatcher。
- Claude Code/OpenCode adapter。
- 两个工程目录并行 CLI 作业和完整临时副本清理验收。
