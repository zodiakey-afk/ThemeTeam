| 文档 | W02 加固验证报告 |
|---|---|
| 版本 | v1.0 |
| 日期 | 2026-09-10 |
| 状态 | 实现与独立代码复核通过；发布/最终确认未执行 |
| 关联 | B01-04..07；W02；w02-code-review.md |

## 最终结果
Windows 11 build26200，Python3.12.14，Node22.23.0，cwd C:/repos/ThemeTeam。使用随 Codex 安装的 Python 和 Playwright，浏览器为本机 Edge。没有添加 Python 运行依赖。

| 检查 | 结果 | 证据 |
|---|---|---|
| 两个独立进程各1轮、第三进程2轮 | 48用例/轮，合计192次通过，0失败/错误/跳过 | w02-complete-a.log、w02-complete-b.log、w02-complete-c.log |
| 真实工作区完整性 | 每轮前后SHA256相同；默认文件访问0，残留线程0 | 同上 |
| 独立代码/对抗复核 | CR01..04已关闭，27个安全测试和105条探测断言通过，含20次传输检查 | w02-code-review.md 2026-09-10追加结论 |
| 浏览器文本安全 | 10类动态表面，注入节点0、外部请求0、page error0 | node tests/browser_security.cjs；w02-browser.json、w02-browser.png |
| 正常旧界面流程 | 加载、主题、选择、移动、保存通过 | 浏览器报告 |
| 保存与恢复 | 序列化/write/flush/fsync/replace故障保留旧状态；save/save、save/reload、reload/mutation串行；replace后进程退出可恢复已提交文件 | test_persistence.py、test_security.py |
| Windows路径边界 | 编码/分隔符/目录联接逃逸被拒绝；SVG按文本附件交付 | test_security.py |

最终矩阵命令：bundled python `-B tests/run_isolated.py` 两次，`-B tests/run_isolated.py --rounds 2` 一次。三次退出0。命令输出经 Tee-Object 写入上表日志。全套48用例包括W01、原有合法API/Store流程和W02新增测试。代码覆盖率未测：环境未安装coverage，未因此宣称覆盖率达标；本工作包未指定覆盖率百分比门槛。

真实文件SHA256：`106f669a107c9b7900387574879e25ee0b094bc82e71a22a787e7ec2e8f14190`。该文件仅用于只读完整性检查，未作为fixture、未迁移、未覆盖。

## 回归、影响、发散
- 回归：原有创建/状态/归档/保存/加载和W01实例生命周期继续通过。
- 影响：正常HTTP成功快照未改字段；只拒绝非法输入。手动保存仍保留，不把移动或任务状态当真实模型执行。
- 发散：seed20260909的40条无效命令、畸形/深层JSON、代理字段/Host/Origin、历史模糊归档、孤立代理字符、带空格/斜杠/中文的历史ID、故障/并发调度。未宣称穷尽fuzz。

## 已处理问题和限制
旧red baseline和中间w02-run-b/c.log保留：初版存在早拒绝未读完请求体后TCP reset，客户端偶发收不到JSON。修复为先半关闭输出、限量丢弃未读数据，再关闭；最终矩阵无此错误。独立评审另关闭了空/坏snapshot重载、浮点历史几何、编码ID和错误优先级问题。
不包含真实模型、M1画布性能/资产验收、生产认证、同路径多进程写入、恶意本机文件系统竞态或断电持久性保证。W03/M1不得据此认定完成。QA/发布与用户最终报告确认仍需对应流程记录。
