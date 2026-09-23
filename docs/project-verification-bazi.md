| 文档 | 八字预测示例项目验收说明 |
|---|---|
| 版本 | v1.0 |
| 日期 | 2026-09-23 |
| 状态 | 已完成 |
| 关联 | P1-P5；M2；`bazi-project-verification.json` |

## 项目产物

生成目录：`projects/bazi-prediction-demo`

文件：

- `index.html`
- `styles.css`
- `app.js`
- `README.md`

## 生成方式

通过 ThemeTeam 受控接口：

```text
POST /api/runtime/mock-project
runtimeProfileId=runtime_mock
projectDirectoryProfileId=project_theme_team
template=bazi-prediction
```

该接口只允许受控 `runtime_mock`，不执行任意 shell 命令，不读取聊天中的 API key，不访问外部网络。

## 浏览器验收

`docs/evidence/bazi-project-verification.json` 已确认：

- 桌面视口 1440x900、DPR1 可打开。
- 移动视口 390x844、DPR2 可打开。
- 日期、时间、出生地表单可提交。
- 四柱演示结果生成 4 个柱。
- 页面包含免责声明。
- 外部请求 0。
- 页面错误 0。

八字项目是传统文化/娱乐性网页演示，不构成科学结论或现实决策建议。
