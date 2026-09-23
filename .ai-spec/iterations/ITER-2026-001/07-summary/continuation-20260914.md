| 文档 | 2026-09-14 续作修改报告 |
|---|---|
| 版本 | v1.0 |
| 日期 | 2026-09-14 |
| 状态 | 本地修订与回归完成；独立复核/技术门禁及最终确认待完成 |
| 关联 | W00V；M1准备；V00-03-A；B01-08..12 |

## 实际修改

- 生成并保留分镜v4-v7、适配v4和移动场景位图；v4-v6入座重复椅子弃用，v7为简化动作语义候选。使用用户指定第三方平台与gpt-image-2、bundled CLI；只发送设计提示词/已有生成参考图，密钥仅临时进程输入。完整提示词和版本谱系见 `docs/evidence/w00v-assets.md`，不将产物生成成功当视觉通过。
- 新增 `docs/assets/office-mobile-study.html` 和 `tests/visual_mobile.cjs`，验证本地位图设计中的上下分区、详情/任务/返回、键盘焦点与取景保持。独立发现的V00-03-A已用祖先裁剪和5点真实命中检查复现，随后缩减详情空白修复；没有降低44px或修改冻结BB期待。修改原样机和测试，不改变已评审React应用。
- 完善工程附板/测试、15份PNG与17项工程证据清单、来源限制与版本哈希。清单是本地完整性检查，不是版权或独立视觉证书。
- 恢复并整合M1设计/计划/26项功能BB、6类NFR、4组WB草案；新增意图、地图、图集三份机器可读候选契约及跨字段验证，纠正手机详情遮住人物的候选表述。实际运行地图/atlas资产、独立技术评审仍待完成。
- 更新进展、制作简报、工作包状态/门禁及KB-TST-0003；不改独立评审报告中的结论，不把未复核问题自行关闭。

## 验证证据

| 检查 | 结果 | 证据 |
|---|---|---|
| `node tests/visual_mobile.cjs` | 5项规格×2尺寸本地通过；8态截图；祖先裁剪/实际命中、焦点、无外联 | docs/evidence/w00v-mobile.json |
| `node tests/visual_engineering.cjs` | 2:1、4向统一pivot、5个门洞位置与2尺寸通过；非运行美术验收 | docs/evidence/w00v-engineering.json |
| `node tests/visual_artifacts.cjs` | 15张PNG、17项工程证据校验通过 | docs/evidence/w00v-artifact-manifest.json |
| `npm.cmd run verify`，frontend | typecheck、24项单元、build、临时后端浏览器流程通过；启发式凭据扫描无发现 | docs/evidence/w03-verification.json |
| `python -B tests/run_isolated.py --rounds 2` | 48项×2轮=96次通过，失败/错误/跳过/默认路径访问/线程泄漏均0 | docs/evidence/backend-regression-20260914.log |
| M1候选机器契约 | Ajv严格模式与语义层接受2份合法fixture、拒绝19份畸形fixture；权利未批准禁止打包；非M1运行测试 | docs/evidence/m1-contracts.json |

受限环境首次verify在Vite配置缓存写入时报EPERM，失败日志保留为 `w03-test-unit-sandbox-20260914.log`；权限审批后的重跑全通过，没有改业务代码绕过测试。

真实数据SHA256保持 `106f669a107c9b7900387574879e25ee0b094bc82e71a22a787e7ec2e8f14190`。本轮未迁移数据、未安装Phaser/EasyStar、未提交或发布。工作目录非Git仓库。

## 未完成与继续点

独立评审恢复返回usage-limit错误，无法复核新版分镜、V00-03-A修复和最终来源集合。W00V仍pending；M1 G2/G3及BB冻结仍pending，W04-W06运行场景、四向移动/入座、联动与性能验证未实施。W01/W02/W03先前局部代码评审结果保留，QA/发布/最终人审未由本报告替代。

下一步是独立视觉复核 -> M1契约/计划评审与BB冻结 -> W04运行资产/地图/镜头/选中/遮挡 -> W05移动/停靠/状态 -> W06联动与完整验收。不重复首批风格和范围讨论。当前报告提交给需求负责人，未收到最终确认前不关闭迭代。
