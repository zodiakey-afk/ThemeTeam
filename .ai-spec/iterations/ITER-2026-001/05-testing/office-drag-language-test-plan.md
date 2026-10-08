| 文档 | Office 画布拖拽与中英文切换测试计划 |
|---|---|
| 版本 | v1.0 |
| 日期 | 2026-10-07 |
| 状态 | 待执行完整浏览器验收 |
| 关联 | office-drag-language-clarification.md |

## Frozen black-box cases

| ID | 场景 | 预期 |
|---|---|---|
| BB-UI-01 | 鼠标在空白区拖拽 | camera scroll 改变；无 POST；选择状态不被误选 |
| BB-UI-02 | 鼠标在成员上点击 | 成员被选中；Inspector 可打开 |
| BB-UI-03 | 鼠标在成员上拖动 | 超过阈值不提交点击选择；不平移画布 |
| BB-UI-04 | 空白区点击 | 清除选择 |
| BB-UI-05 | English 切换 | Office、footer、导航、任务状态和设置文案为英文 |
| BB-UI-06 | 刷新页面 | `themeteam-language=en` 保持 English |
| BB-UI-07 | 触摸拖拽 / 双指缩放 | 保留既有平移与缩放；不产生业务写入 |
| BB-UI-08 | Demo mode | 成员本地移动和退出 Demo 语义不变 |

## White-box additions

- `sceneAdapter.ts` 的空白区 / 成员命中分流。
- `i18n.ts` 中英文资源键完整性由 TypeScript 检查覆盖。
- `styles.css` 的 `grab/grabbing` 光标状态。

## Execution evidence

- TypeScript typecheck: passed on 2026-10-07.
- `git diff --check`: passed on 2026-10-07.
- Existing browser test extended in `frontend/tests/m1-e2e.cjs`; full execution remains pending environment/browser runner availability.
- Existing live page is reachable at `http://127.0.0.1:5173/`; visible Chinese office canvas and drag hint were observed.
