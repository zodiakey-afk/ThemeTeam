# ThemeTeam

ThemeTeam 是一个本地优先的 AI Agent 工作区，使用受《主题医院》启发的办公室画布承载员工、工位、房间、任务状态和运行时交互。

![ThemeTeam 办公室画布，默认 100% 缩放](docs/evidence/readme-office-100.png)

## 当前状态

- 办公室画布：20 个工位、6 个会议席、等轴地图、选中、移动演示、遮挡和响应式镜头。
- 默认办公室总览：**100%**。手动缩放范围：50%–200%。
- P4 dispatcher：支持排队、运行、成功、失败、取消、超时、中断、重试、恢复和 artifact 隔离。
- Codex CLI：已完成只读探测和受控 workspace-write 任务边界。
- Claude Code/OpenCode：已完成统一 adapter 契约；本机 CLI smoke 需在可执行文件存在时单独验收。
- P5：已完成满载后的扩容房间分配和 `Unplaced` 状态；完整地图重排以及 21/40/60 人性能验收仍待完成。
- M1 G4/G5/G6/G7：仍保持 pending，等待 QA、项目负责人、发布、回滚和最终人工签署。

## 本地启动

```powershell
# API
python run.py --host 127.0.0.1 --port 8000 --no-open

# 前端
cd frontend
npm install
npm run dev
```

打开 [http://127.0.0.1:5173/](http://127.0.0.1:5173/)。

API 仅绑定本机回环地址。Runtime profile 和工程目录 profile 保存在独立本机 settings store 中，不依赖 workspace snapshot 作为唯一来源。凭据不会写入 workspace、日志或 README。

## 测试与验证

```powershell
python tests/run_isolated.py --rounds 2

cd frontend
npm run typecheck
npm run test:unit
npm run build
npm run verify
```

详细证据位于 `.ai-spec/iterations/ITER-2026-001/05-testing/` 和 `docs/evidence/`。

## 目录说明

- `frontend/`：React、Zustand、Phaser、EasyStar 办公室应用。
- `themeteam/core/`：工作区模型、持久化、settings store、dispatcher 和运行时 adapter。
- `themeteam/web/`：本地回环 API 和静态服务。
- `tests/`：后端隔离、安全、dispatcher 和 CLI smoke 测试。
- `docs/`：架构、设计、验收标准和证据。
- `projects/`：生成的示例项目，包括八字预测示例。

## 许可证

本项目采用 MIT License，详见 [LICENSE](LICENSE)。
