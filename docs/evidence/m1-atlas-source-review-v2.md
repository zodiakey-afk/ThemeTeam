| 文档 | ITER-2026-001 / M1 候选图集来源与几何独立审计 v2 |
|---|---|
| 版本 | v2.0 |
| 日期 | 2026-09-21 |
| 状态 | 已完成（限定范围批准） |
| 关联 | W00V；M1；冻结规格 `m1-spec.md` v0.3 |

# M1 候选图集来源与几何独立审计 v2

## 审计结论

**Decision: approved**，仅批准当前候选图集用于 **ThemeTeam project-runtime packaging**。

该结论只覆盖资产来源、文件完整性、图集几何兼容性和 `--candidate-only` 写入边界。它不构成视觉质量审批、商标审查、第三方法律意见、M1 功能验收、性能验收或 G4/G5 总门禁通过。

| 字段 | 值 |
|---|---|
| Reviewer | Codex independent asset-source and geometry auditor (ITER-2026-001 / M1) |
| Reviewed at | 2026-09-21T09:26:45.5390753+08:00 |
| Generator SHA-256 | `994c6681b836395d8ab171afed1205fbfe3bc974a5925464a66a8337fd6905f9` |
| Frozen spec SHA-256 | `2ca7b60f5efb148229ee8b417ee67f95306b6cba5f417ef922f0ad2350d1ce9e` |
| Geometry unchanged | true |
| Candidate-only safe | true |

## 输入范围

- `tests/generate_m1_design_assets.cjs`
- `output/m1-visual-candidate/candidate-manifest.json`
- `output/m1-visual-candidate/office-agents.v0.2.png`
- `output/m1-visual-candidate/office-props.v0.2.png`
- `frontend/public/assets/office/office-assets.v0.2.json`
- `.ai-spec/iterations/ITER-2026-001/05-testing/m1-spec.md`

未读取或审查候选图集的视觉质量结论，也未修改候选文件、运行资产、地图、oracle、冻结规格或其他证据。

## 核验结果

### 1. 来源与外部资产隔离

通过。生成器仅导入 Node 内置 `assert`、`crypto`、`fs`、`path`，以及用于执行本地 HTML/Canvas 绘制的 Playwright。图像内容由 `buildPage()` 内联脚本中的 Canvas 2D primitive（路径、矩形、填充、描边）绘制，再经 `canvas.toDataURL('image/png')` 输出。

在指定生成器中未发现外部图片读取、网络图片地址、`drawImage`、`loadImage` 或《主题医院》原始资产导入路径。候选 manifest 的来源声明 `Project-local Canvas primitives; no external image input` 与实现一致。

### 2. 文件完整性

通过。重新计算的 SHA-256 与 `candidate-manifest.json` 完全一致：

| 文件 | SHA-256 | PNG 尺寸 |
|---|---|---|
| `office-agents.v0.2.png` | `de3cc2e922337b0144809a5a07bd60af34a9ad2e79d4f3cbd41b6980966fa088` | 320 x 288 |
| `office-props.v0.2.png` | `3d6024bbd92de6c7bef785da56440de7876dbabc54c7ab8df343ec30abe07351` | 512 x 256 |

两文件 PNG 签名均为 `89 50 4E 47 0D 0A 1A 0A`。候选 manifest 记录的 generator SHA-256 也与当前生成器一致。

### 3. Frame ID 与几何兼容性

通过。

- Agents：候选 60 帧、运行 manifest 60 帧，ID 均唯一；画布 320 x 288，每帧 32 x 48。
- Props：候选 17 帧、运行 manifest 17 帧，ID 均唯一；画布 512 x 256，每帧 64 x 64。
- 对每一帧逐项比较 `id`、`x`、`y`、`width`、`height`、`pivotX`、`pivotY`、`kind`，agents 和 props 的差异数均为 0。
- 因 frame ID 与几何保持一致，当前运行 manifest 的 84 项动画引用与 fallback frame 命名可继续使用；本审计未评价动画视觉效果。

### 4. `--candidate-only` 写入边界

通过。启用 `--candidate-only` 时，`output` 被解析为 `output/m1-visual-candidate`。生成器只在该目录写入两张 PNG 和 `candidate-manifest.json`，随后立即 `return`。

运行资产 manifest、`office-map.v0.2.json`、collision oracle 和设计资产证据的写入语句均位于该 `return` 之后，因此 candidate-only 分支不会覆盖这些文件。该分支会确保既有 fixture 目录存在，但不向其中写入文件。

## 限制

- 不审查候选图集是否达到已批准 W00V/《主题医院》参考方向的视觉质量。
- 不批准 M1 整体功能、交互、可访问性、遮挡、性能、稳定性或发布验收。
- 不提供商标许可或第三方法律意见。
- 不将当前运行 manifest 对旧图集的既有 rights approval 自动转移为视觉审批；本结论仅批准这里列出的候选文件用于项目运行打包。
- 候选文件、生成器或 frame manifest 任一内容变化后，本结论失效，必须基于新哈希重新审计。
