| Document | W00V responsive study design and plan |
|---|---|
| Version | 1.0 |
| Date | 2026-09-11 |
| Status | Scoped low-risk design self-review; independent artifact review pending |
| Links | B01-08; w00v-mobile-spec.md; V00-03 |

Scope: a standalone document under docs/assets, no changes to the reviewed React application, API, workspace data or dependencies. Risk S: local single-document behavior, no persistence/security/concurrency boundary. Requirement authorization is the approved W00V scope. This design study is not runtime M1 implementation.

Design: unmodified local office bitmap on a fixed square plane inside the scene viewport. An independent lower details layer never resizes the plane. Selection is a fixed demo Dev, not a duplicate business entity. Details can display one sample linked task and return. Closing/Escape restores the actual invoking button; controls have names, visible focus and 44px minimum bounds. Local ResizeObserver recomputes the plane only on container resize. No external resources or API requests. Native icon markup is exported from installed lucide-react 1.43.0 (ISC), not hand-drawn.

Plan: freeze BB-V04-01..05 before document implementation; implement local HTML; execute `node tests/visual_mobile.cjs`; inspect closed/open/task/return screenshots; independently review alongside VIS-04. Rollback is removal of this standalone study reference, no data migration. Test output does not infer actual Phaser camera behavior or complete production accessibility. Implementing-agent low-risk design/plan self-review permits this document work only; independent review and overall W00V gate remain pending.
