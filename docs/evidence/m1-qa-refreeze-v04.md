| 文档 | M1 v0.4 受控规格重冻结记录 |
|---|---|
| 版本 | v1.0 |
| 日期 | 2026-09-22 |
| 状态 | 主线程重冻结完成；等待独立 QA 复核 |
| 关联 | CHG-M1-004；M1 v0.4；G4/G5 |

## 原因与边界

用户在 v0.3 实现后批准了默认镜头、工位容量和房间比例变更。v0.3 的实现前冻结记录与 hash 继续作为历史证据；当前执行基线升级为 v0.4。v0.4 没有降低既有 NFR，也没有改变后端接口、业务状态或持久化边界。

## 冻结输入

| 输入 | SHA-256 |
|---|---|
| `.ai-spec/iterations/ITER-2026-001/05-testing/m1-spec.md` v0.4 | `0777ba0a3a61647b76fa025c5d701dbb685e84740af270c57ceb4b6d7cb81e42` |
| `.ai-spec/iterations/ITER-2026-001/01-requirements/nfr.md` v1.0 | `71c4beb808b6ee03bc945c417c231b5424a84ed5d0d64be2168c23e6d70eda1b` |
| `.ai-spec/iterations/ITER-2026-001/01-requirements/m1-change-record-v0.4.md` | `d721a2dfd85184854da3fb580978d760bfe9db7ad13e3d7677c1659f37d41d2d` |
| `.ai-spec/iterations/ITER-2026-001/02-design/contracts/m1-v0.4.json` | `c43e3c2e92c351d00cb9668a5eff01c8a7f5e78ce910fb9200e67d18e1676f1a` |
| `.ai-spec/iterations/ITER-2026-001/02-design/contracts/m1-map-v0.3.schema.json` | `24a56e5740ac736034bf892fd7959078e57b3ef453ea7211b1263e49381ce9a8` |
| `.ai-spec/iterations/ITER-2026-001/02-design/contracts/m1-assets-v0.3.schema.json` | `fecd13e3b8f74a81f47c7c81bc305f6ee8ecb518b0d87a7cdebc35eb3b6e4b3a` |
| `frontend/public/assets/office/office-map.v0.3.json` | `af9c38d31943f2512578f59589ad6423308fef93040c529c15d5ed82ce3f6852` |
| `frontend/tests/fixtures/m1/collision-oracle.v0.3.json` | `b22d3a825cd2a699eb5571678638df0bb9a4068dc3f0f5e90176336bd24f7607` |

## 复核要求

独立 QA 必须确认 v0.4 的 20 工位、100% 默认总览、空白清选、移动跟随/退出跟随、未知身份高对比回退和同一遮挡物前后深度切换均有可观察判据；还需确认 v0.3 atlas 的作者、来源、条款和打包链可独立追溯。复核前不得把本记录视为 QA 签署或 G4/G5 通过。
