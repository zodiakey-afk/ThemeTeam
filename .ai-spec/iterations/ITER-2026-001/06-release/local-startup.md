| 文档 | M1 本地启动与健康检查 |
|---|---|
| 版本 | v1.0 |
| 日期 | 2026-09-22 |
| 状态 | 已验证 |
| 关联 | W03-T-001；M1 v0.4；`release-plan.md` |

## 启动顺序

先启动后端 API：

```powershell
python run.py --host 127.0.0.1 --port 8000 --no-open
```

再启动前端：

```powershell
cd frontend
npm run dev
```

访问 `http://127.0.0.1:5173/`。

## 健康检查

```powershell
Invoke-WebRequest http://127.0.0.1:8000/api/state
Invoke-WebRequest http://127.0.0.1:5173/api/state
```

两个请求都应返回 `200`、`application/json`，且响应体可被 JSON 解析。若只启动前端，Vite 代理会对 `/api/state` 返回 502；前端现在会显示可读连接错误，但不会把底层 JSON `SyntaxError` 暴露给用户。

## 后续自动化

正式启动脚本应同时管理 API 与 Vite 两个进程，并在打开浏览器前等待两个健康检查通过。当前 M1 不把开发服务进程本身作为发布产物，生产/预览环境仍需使用完整发布包。
