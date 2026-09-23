| 文档 | W03 前端基础验证报告 |
|---|---|
| 版本 | v1.0 |
| 日期 | 2026-09-10 |
| 状态 | 机器检查与独立代码复核通过；QA/发布及最终确认待完成 |
| 关联 | W03；w03-v1.1.json；w03-spec-v1.1.md |

## 结果与复现
在 `C:/repos/ThemeTeam/frontend` 执行 `npm.cmd run verify`，退出 0。Windows x64、Node22.23.0、Python3.12.14、Playwright + 本机 Edge。Vite 缓存目录在沙箱内出现 EPERM，获准后以相同命令运行，不关闭应用安全校验。

| 检查 | 结果 | 证据 |
|---|---|---|
| TypeScript | 0 error | w03-typecheck.log |
| 状态/队列/场景桥契约 | 24/24，通过，无跳过 | w03-test-unit.log |
| 后端影响回归 | 48用例两轮96次通过，默认文件访问0、残留线程0 | w03-backend-regression.log |
| 浏览器工作流 | 创建任务/成员、状态、关联对象、返回、关闭重开、保存、重新加载、未知结果写入冻结通过 | w03-browser.json、w03-test-e2e.log |
| 键盘交互 | 弹窗首输入、Escape 返回触发按钮、Close准确回重复列表触发者、双root隔离、Back回任务、重载移除对象回标题 | 同上 |
| 响应式 | 1440x900、1024x768、390x844；横向溢出0、越界控件0；截图人工查看未见布局重叠 | w03-1440.png、w03-1024.png、w03-390.png |
| 安全/代理 | 恶意名称纯文本呈现；页面错误0；12项恶意Host/Origin请求拒绝且上游命中0，合法请求命中1 | w03-browser.json |
| 备用preview入口 | 3项恶意请求403；合法本地API404；代理转发0 | w03-browser.json |
| 弹窗适配 | 三尺寸完整显示且无横向溢出；手机表单控件高度至少44px；截图人工查看通过 | w03-dialog-1440.png、w03-dialog-1024.png、w03-dialog-390.png |
| 构建 | npm offline 模式，使用已安装锁定依赖，成功 | w03-build.log |
| 依赖审计 | npm.cmd audit --json，退出0，已知漏洞0 | 2026-09-10命令；下列审计摘要 |
| 许可证 | 锁文件78项均有许可元数据 | w03-licenses.json |
| 凭据扫描 | 源码/规范/文档启发式检查，命中0；扫描文件数以机器报告为准 | w03-verification.json |
| 真实数据 | 验证前后SHA256相同 | w03-verification.json |

日志哈希、锁文件哈希、运行环境和完整性结果统一记录于 `w03-verification.json`。测试后端使用临时 Store 与随机端口；测试服务均清理。真实数据未用于测试。

## 回归与边界
回归覆盖基础任务/成员/保存流程。影响测试覆盖独立 root、纯本地选择、单订阅桥接及销毁。发散测试覆盖迟到提交、丢失/无效响应、网络失败、读取body超时、排队时钟起点、结构化拒绝与未知错误、重载裁剪选择和代理恶意authority。

补充键盘测试先复现弹窗首焦点断言失败，随后修复 `App.tsx` 的显式焦点管理；未更改冻结验收标准。弹窗提交前捕获表单节点，避免 await 后读取已清空的 React event.currentTarget。负责人按钮提供可见对象焦点定位，详情卸载后的焦点有稳定回退。

## 许可证与限制
78项锁文件许可证：MIT58、ISC3、Apache-2.0 3、BSD-3-Clause2、MPL-2.0 12。MPL 项为构建期 lightningcss 及各平台可选二进制，其中本机安装2项；未修改其源码。未把这些开发工具作为应用运行时发布。未来分发工具链/安装包时需保留相应许可和源码义务，不能把本次清单当发行合规批准。

审计摘要：auditReportVersion2，vulnerabilities空，info/low/moderate/high/critical均0；dependency total78。扫描不包括node_modules、构建/生成输出，不能证明无所有秘密或PII。offline 是 npm 离线模式构建，不是断网全新安装证明。未测代码覆盖百分比、M1帧率或画布像素/动画，未宣称达标。

独立评审 Gauss 恢复后返回R01..03，详见 `w03-code-review.md`。已修复备用preview代理、畸形错误结构及重复按钮焦点；新增错误结构测试先得到19pass/5fail，再修复为24pass。2026-09-10 14:35独立复核关闭全部3项：42个preview请求转发0、45组畸形响应和7组合规拒绝、真实浏览器精确回焦与双root隔离通过。W03 G4通过，G5 QA/发布与最终确认仍pending。修复记录见迭代 `04-implementation/w03-review-resolution.md`。
