| Document | W00V artifact register |
|---|---|
| Version | 2.3 |
| Date | 2026-09-14 |
| Status | Generated candidates; VIS-05/06 closure boards added for independent re-review |
| Links | B01-08; VIS-01..06 |

## Source and Authorization

All PNGs below are original AI-generated design references. VIS-01 through VIS-04 were produced using the bundled imagegen CLI with the user-confirmed compatible provider and `gpt-image-2`; VIS-05/06 were produced with Codex built-in `image_gen`, which does not consume the user credential. Only design prompts and explicitly listed reference images were transmitted. No original Theme Hospital assets, repository source, workspace data or chat history are inputs.

The key is entered via masked terminal input into a short-lived image process environment, never saved in project files, prompts or system configuration. Historical failed credential checks on September 9/10 are not the current blocker. The isolated tool environment is `.cache/imagegen-venv`; it does not change application dependencies.

Generated output is for project design/reference use. Third-party service output terms and redistribution rights have not been independently audited; this register does not invent an MIT, CC0 or original-game license. Runtime distribution requires its own source/rights review. Boards are not loadable atlases, exact viewport proofs or M1 runtime evidence.

## Version Lineage

Paths are relative to `output/imagegen/`; prompts are under `prompts/`. Machine-generated `w00v-artifact-manifest.json` records each existing file's actual SHA-256, byte length and PNG dimensions, including historical versions. Refresh with `node tests/visual_artifacts.cjs`.

| Artifact | Prompt | Reference inputs | Disposition |
|---|---|---|---|
| vis01-overview-v1.png | vis01-overview.txt | none | Historical draft; desk count unclear |
| vis01-overview-v2.png | vis01-refine.txt | overview v1 | Current overview candidate; 8 desks/6 meeting chairs |
| vis02-closeups-v1.png | vis02-closeups.txt | overview v2 | Current character/furniture reference; not atlas |
| vis03-storyboard-v1.png | vis03-storyboard.txt | overview v2, closeups v1 | Rejected: missing docking human |
| vis03-storyboard-v2.png | vis03-refine.txt | storyboard v1 | Superseded: movement direction issue |
| vis03-storyboard-v3.png | vis03-direction.txt | storyboard v2 | Superseded candidate; approach/doorway/task-band gaps |
| vis03-storyboard-v4.png | vis03-six-steps.txt | overview v2, closeups v1 | Superseded: wrong direction, duplicate chair, missing demo label |
| vis03-storyboard-v5.png | vis03-final-corrections.txt | storyboard v4 | Superseded: duplicate chair remains |
| vis03-storyboard-v6.png | vis03-single-chair.txt | storyboard v5 | Rejected: duplicate chair persists |
| vis03-storyboard-v7.png | vis03-clean-storyboard.txt | none, new generation | Current simplified action candidate; independent review pending |
| vis04-responsive-v1.png | vis04-responsive.txt | overview v2 | Superseded draft |
| vis04-responsive-v2.png | vis04-refine.txt | responsive v1 | Superseded draft |
| vis04-responsive-v3.png | vis04-drawer.txt | responsive v2 | Superseded candidate; QA silhouette/return gaps |
| vis04-responsive-v4.png | vis04-qa-identity.txt | responsive v3, closeups v1 | Current candidate; QA high bun restored |
| vis04-mobile-scene-v1.png | vis04-mobile-scene.txt | overview v2 | Actual bitmap for layout study only |
| vis05-continuation-board-v1.png | prompt recorded in current task/image generation result | none, new generation | Current TH-03/TH-04 closure candidate: meeting demo/return, occupied, unreachable and Back context |
| vis06-meeting-return-v1.png | prompt recorded in current task/image generation result | overview v2 and closeups v1 as style/identity references | Focused TH-03 closure candidate: blue PM/green Dev/amber QA, continuous meeting demo to original workstation |

Historical input associations are reconstructed from the continuation record; no provider-signed request receipt is available. Output hashes identify local bytes, not proof of provider authorship. Current CLI requests use the explicit reference inputs above.

## Engineering Evidence

`docs/assets/office-engineering.html` is original project-native HTML/SVG by the implementing Codex agent, not model-generated raster artwork or a third-party asset. It defines 64x32 world tiles (128x64 diagram), four common 32x48 positioning frames with (16,48) foot pivot, front/back wall depth examples and five consecutive door-route positions. Positioning proxies are explicitly not final characters. The VIS-02 PNG remains unmodified.

`node tests/visual_engineering.cjs` renders this standalone document with local Edge/Playwright, blocks external HTTP, checks ratio/pivots/doorway route and 1440/390 widths. Report: `w00v-engineering.json`; screenshots: `w00v-engineering-1440.png`, `w00v-engineering-390.png`. These tests do not validate an A* engine, final sprite pixels, animation or Phaser.

`w00v-visual-review-final-v2.md` accepted VIS-05 for TH-04 but kept TH-03 open because its identities drifted and the narrative mixed a restored meeting endpoint with the workstation return. VIS-06 is a focused six-frame correction using the original blue PM/green Dev/amber QA identities and an uninterrupted meeting-demo-to-original-workstation sequence. W00V remains pending until independent re-review; even a W00V pass does not pass M1.

## Responsive Study

`docs/assets/office-mobile-study.html` is a native standalone design document, using the original mobile-scene PNG and lucide-react 1.43.0 ISC icon markup exported from the installed library. The creator of the HTML/test is the implementing Codex agent; no original-game assets are embedded. `tests/visual_mobile.cjs` produces `w00v-mobile.json` and eight 390/1024-width closed/open/task/returned screenshots. The original bounds test missed a clipped 1024-width button; on September 14 the test reproduced it using clipping ancestors and actual hit points, then passed after spacing corrections. Five frozen design acceptance cases at both widths now pass locally; independent re-review is pending. See `w00v-review-resolution.md`. The study fixes the bitmap plane while toggling a height-constrained details layer, retains a fixed demo Dev and restores keyboard focus. It performs no workspace API call, actual movement or Phaser camera operation. This evidence supplements VIS-04; it does not pass M1 or prove complete accessibility compliance.
