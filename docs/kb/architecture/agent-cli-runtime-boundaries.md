| 文档 | Agent CLI 运行边界与 Codex 只读探测 |
|---|---|
| 版本 | v1.0 |
| 日期 | 2026-09-23 |
| 状态 | active |
| 关联 | P2；`themeteam/core/agent_runtime.py`；`docs/evidence/codex-cli-smoke.json` |

Codex CLI 接入必须经过 `ProjectDirectoryGuard -> CodexCliAdapter -> ProcessSupervisor`。adapter 只接受 allowlist executable，使用 argv 数组和 `shell=false`；只读 probe 使用 `--ephemeral` 与 `--sandbox read-only`。环境变量采用最小白名单，stdout/stderr 有上限并执行 key/token/session 脱敏。只读 smoke 通过不等于真实业务任务 dispatcher 已完成。
