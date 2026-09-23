| 文档 | KB-ARCH-0002 M1 场景边界与资产来源 |
|---|---|
| 版本 | v1.0 |
| 日期 | 2026-09-15 |
| 状态 | Active |
| 关联 | ITER-2026-001；docs/evidence/m1-design-review-v2.md |

# M1 场景边界与资产来源

- 业务事实继续由 W03 snapshot/selection 提供；镜头、移动、预留和演示状态只属于单个 root，会话不持久化且不发业务写请求。
- 场景桥保持 update(snapshot, selection) 与幂等 destroy()，导航通过先于 selection 提交的 root-local transition 传递。
- 运行地图必须以显式 roomId、movementEnabled、mapRevision、stand/approach/sit、碰撞和稳定锚点为边界。
- 生成式设计图只用于视觉方向；运行图集由项目本地 Canvas 基元生成器生成。独立来源审查通过后才可将 manifest 标记为 approved。
- 设计通过不等于运行通过；帧预算、四向行走、停靠、遮挡、响应式安全区和 30 分钟稳定性仍需 G4/G5 证据。
