| 文档 | D2 M2 概要设计 |
|---|---|
| 版本 | v1.0 |
| 日期 | 2026-09-24 |
| 状态 | 修订候选，等待独立技术复审 |
| 关联 | M2 / W07-W10；m2-delta-brief.md |

## 上下文

```text
React/Zustand + Phaser projection
        |
        | HTTP command / WebSocket events
        v
FastAPI loopback API
        |
        v
Application services
  - WorkspaceService
  - TaskService
  - RunService
  - ApprovalService
  - MigrationService
        |
        +--> SQLite repository + outbox transaction
        +--> ArtifactStore (run-scoped filesystem)
        +--> Runtime adapters / ProcessSupervisor
```

旧 `http.server` API 保留为兼容层，读取 SQLite 投影；不再向 JSON 写入新的业务事实。

## 模块职责

| 模块 | 职责 |
|---|---|
| `api_v1` | 请求 schema、loopback/Origin 约束、错误 envelope、命令确认。 |
| `services` | 业务状态机、权限、版本冲突、幂等键和事务边界。 |
| `repositories` | 参数化 SQLite 查询、事务、唯一约束和游标读取。 |
| `migration` | JSON backup/import/validate/rollback。 |
| `runtime` | 受控 adapter、进程树、超时、取消、输出脱敏。 |
| `events` | outbox 写入、发布、cursor replay、gap detection。 |
| `projection` | 生成旧快照和 M1 画布需要的轻量状态。 |
| `artifact_store` | 校验 run 专属根目录，列举相对 artifact，拒绝越界。 |

## 部署视图

- 单进程 FastAPI + 单 worker 起步。
- SQLite 位于本机应用数据目录；开发/测试可显式传入临时路径。
- artifact 位于已登记工程目录下的 run 专属目录。
- WebSocket 与 HTTP 共用同一 application service，不创建第二套业务事实。

## 兼容与切换

1. 启动时检测 SQLite；不存在则从 JSON 导入到临时数据库。
2. 导入校验通过后原子替换数据库并保留 JSON backup。
3. 旧 `/api/state` 由 projection 返回 snapshot。
4. 新前端逐步切换到 `/api/v1`; 旧入口在 M2 发布期间保留。
5. 回滚时停止服务，恢复 JSON 入口和旧数据库备份，不删除新数据库。
