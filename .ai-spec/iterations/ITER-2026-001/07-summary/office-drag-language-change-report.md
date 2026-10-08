| 文档 | Office 画布拖拽与中英文切换修改报告 |
|---|---|
| 版本 | v1.0 |
| 日期 | 2026-10-07 |
| 状态 | UI 范围已人工确认；发布验收仍待 QA/E2E |
| 关联 | office-drag-language-clarification.md；office-drag-language-test-plan.md |

## 修改总览

| 修改项 | 路径 | 内容 |
|---|---|---|
| UI-DRAG-01 | `frontend/src/office/sceneAdapter.ts` | 鼠标 / 触摸空白区平移、成员命中保护、反馈文案语言化 |
| UI-I18N-01 | `frontend/src/i18n.ts` | 中英文产品 UI 资源、状态、办公室反馈和设置文案 |
| UI-I18N-02 | `frontend/src/App.tsx` | 语言切换、语言持久化、任务 / 设置 / Inspector / footer 翻译接入 |
| UI-I18N-03 | `frontend/src/office/OfficeCanvas.tsx` | 画布工具栏、目标席位和场景菜单翻译接入 |
| UI-UX-01 | `frontend/src/styles.css` | 语言切换样式、`grab/grabbing` 光标 |
| UI-TEST-01 | `frontend/tests/m1-e2e.cjs` | 空白拖拽、清选、成员点击保护和 English 验收断言 |

## 已验证

| 检查 | 结果 |
|---|---|
| TypeScript typecheck | PASS |
| `git diff --check` | PASS |
| 现有服务首页 HTTP | PASS，`http://127.0.0.1:5173/` 返回 200 |
| 画布运行态 | 已观察到办公室画布、中文就绪反馈和拖拽提示 |
| 完整 Vitest | PENDING，Windows `spawn EPERM` |
| 完整 Vite build | PENDING，运行中的服务锁定生成文件 / 后续构建触发 `spawn EPERM` |
| 完整浏览器 E2E | PENDING，需在可用浏览器自动化环境重跑 |

## 遗留风险

- 当前工作树仍包含既有 M2 未提交改动；本次 UI 需求没有将其拆分为独立提交。
- M2 G5 QA 签署、G6 项目负责人批准、G7 最终确认仍未取得。
- Codex workspace-write、Claude/OpenCode 真实 CLI smoke 仍受环境限制。
- 浏览器完整 E2E 证据尚未绑定到本次最新工作树。

## 最终确认

| 时间 | 角色 | 结论 | 范围 |
|---|---|---|---|
| 2026-10-08 | 需求负责人 / 项目负责人 | 已确认 | 本报告及本次 UI 功能的发布范围 |
