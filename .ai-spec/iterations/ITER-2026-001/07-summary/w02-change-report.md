| 文档 | W02 修改报告 |
|---|---|
| 版本 | v1.0 |
| 日期 | 2026-09-10 |
| 状态 | 提交；等待最终确认，非正式发布 |
| 关联 | docs/evidence/w02-tests.md；W01/W02 |

## 修改与原因
- tests/support.py、test_isolation.py、run_isolated.py：补齐线程构造失败清理、无默认文件和空测试集处理。W01独立复核通过。
- core/validation.py：严格字段、类型、枚举、引用列表和审批输入边界。
- core/store.py：先校验引用/房间锁再变更；新记忆未审批；会议归档幂等、历史关联修复；同一锁下候选状态、临时文件/fsync/replace原子保存；主题保存失败回滚。
- core/models.py：拒绝不完整/错误类型历史snapshot，保留合法数值几何和旧可选字段默认，不静默清空活跃工作区。
- web/server.py：稳定JSON错误、loopback/Host/Origin、请求大小/深度/编码、严格ID解码、静态根目录/内容类型、CSP与Windows早拒绝连接清理。
- web/static/app.js：动态文本和属性转义、固定SVG几何/颜色、路径ID编码、安全错误提示。保留旧UI结构，不冒充M1。
- tests/test_security.py、test_persistence.py、browser_fixture.py、browser_security.cjs：临时数据的安全、归档、并发、故障、中断和浏览器回归。
- .ai-spec设计/契约/测试规格/门禁与docs/evidence：保留独立评审、版本修订、red和green证据。docs/plan.md、progress-assessment.md、visual-production-brief.md更新真实进度；W00V新增提示词与产物登记，不虚构剩余视觉图。

## 结果
最终48用例四轮共192次通过，默认工作区访问0、残留线程0、真实JSON哈希不变；浏览器10类动态表面无注入；W02独立代码复核关闭CR01..04。报告见docs/evidence/w02-tests.md。

## 未完成与下一步
W00V只有总览v1草案，本机图片密钥不可用，VIS02..04尚无实际图；W03正进入独立设计评审，M1地图/资产/动画/联动/性能尚未实现。没有发布、数据迁移或默认前端替换。所有最终人审门禁保持待确认，不要求重新确认已经批准的范围和风格。
