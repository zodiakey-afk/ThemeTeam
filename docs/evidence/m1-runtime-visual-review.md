| Document | M1 Independent Runtime Visual and Interaction Review |
|---|---|
| Version | v2.0 (replaces the environment-blocked v1.0 report) |
| Review date | 2026-09-16 (Asia/Shanghai) |
| Status | Independent review complete; **FAIL** |
| Iteration | `ITER-2026-001 / M1` |
| Reviewer | OpenAI Codex, independent runtime visual and interaction reviewer |
| Reviewer scope | Frozen requirements, W00V manifests/reviews, current built artifact, generated runtime screenshots/recording, and black-box runtime evidence only |
| Independence | No implementation source or implementation history was inspected. No product code or frozen specification was modified. |
| Review host | Windows 10-compatible host; Node `v22.23.0`; Edge `153.0.4234.32` used for independent video-frame inspection |

# M1 Independent Runtime Visual and Interaction Review

## Verdict

**FAIL.**

The environment blocker from v1.0 is closed. The current executable is nonblank, contains a real 32x24 isometric map with four connected regions, separate runtime agent/prop atlases, and an executable movement flow. The recorded flow demonstrates selection while walking, four directional facings, doorway waiting and obstruction, two replans, meeting-seat docking, and return-to-workstation docking with visible status feedback.

M1 still does not pass the frozen visual gate. The runtime presentation is materially below the approved Theme Hospital-inspired W00V baseline, the runtime PM/Dev/QA identities do not preserve the approved W00V identity system, the 390px detail layout reverses the frozen scene-above/details-below order, and the evidence set does not adequately prove dynamic front/back occlusion, long-text behavior, contrast, or M1 keyboard accessibility. These are product/evidence failures, not environment failures.

## Review Basis

| Input | SHA-256 / role |
|---|---|
| `docs/office-canvas.md` | `16c06f4dfaf061fadd4cb0e6a64bdd3fd03067915a8090a66ae44f2c18a34146`; TH-01..06 and responsive baseline |
| `.ai-spec/iterations/ITER-2026-001/05-testing/m1-spec.md` | `2ca7b60f5efb148229ee8b417ee67f95306b6cba5f417ef922f0ad2350d1ce9e`; frozen BB/NFR baseline |
| `docs/evidence/w00v-artifact-manifest.json` | `9d8094d9efe0088af49c301cf6df23e1cac3a022db8091077cb91ffdbdba3183`; approved design inventory |
| `docs/evidence/w00v-visual-review-final-v3.md` | `1de7e6d82e5e47a8f41f966e01e04845a1f20ecf243b0c343d61fbc26944b285`; W00V design-level TH-01..06 pass and explicit M1 separation |
| `output/imagegen/vis01-overview-v2.png` | W00V overview baseline; hash `8bf32ed83e602c206bfece14f915d0bfb71b400be6814f2df0691d8a048e91cd` |
| `output/imagegen/vis02-closeups-v1.png` | Workstation, meeting furniture, identity, and action baseline; hash `56784cbab7bef767c4205f6414c0c7d65922388ab28a5026f8ce36ea923137e7` |
| `output/imagegen/vis06-meeting-return-v1.png` | Approved design-level meeting-to-workstation continuity; hash `302eb93715709fedd45e75aaf5c8719d292beb254f26776a216951e47a671c7d` |

## Executable And Runtime Evidence

| Evidence | Result |
|---|---|
| `frontend/dist/index.html` | Current built entry; SHA-256 `ccd19b4ce254eb40af21ef92b434252fac7dfc2590fc1953eaed0283ceced336` |
| `frontend/dist/assets/index-BIturEUA.js` | Current application bundle; SHA-256 `105ba7d8eadf4df0035fb5c490a9ea5e6de28a7de6fd0069fd6ee9cf6a92a24a` |
| `frontend/dist/assets/index-D_ONKRF2.css` | Current stylesheet; SHA-256 `42284acc7c6920c6af3f63703976a26b6b382736982eb5be28d1c432b0f90b85` |
| `frontend/dist/assets/office/office-map.v0.2.json` | 32x24 map, four regions, four open doors, eight work anchors, six meeting anchors; SHA-256 `13997cae10a3664ce502b0c683328101852c760d7cb0301edde15abd6f9c36d3` |
| `frontend/dist/assets/office/office-agents.v0.2.png` | 320x288 runtime atlas, 60 PM/Developer/Tester frames; SHA-256 `07cf53079fff7ebc969cb6bcb6109d18d8ee2c95119a30db5e12a14a7980dbe4` |
| `frontend/dist/assets/office/office-props.v0.2.png` | 512x256 runtime atlas, 17 floor/wall/furniture/effect frames; SHA-256 `3025eabc9810dc62391a6e1acaa68c09de36e31f7af6a9d2d6f935b139a05656` |
| `npm --offline run test:m1:e2e` from `frontend` | Re-run during this review outside the broken sandbox; exit `0`; 8 viewport/DPR cases, 8 movement runs, 2 recovery runs, 1 concurrency run, 1 gesture run, 1 dynamic-block run, scene POST `0`, external requests `0` |
| `docs/evidence/m1-browser-matrix.json` | Re-run output; SHA-256 `9ea185501ffa906c38cf02664876cdb3042611ac11aff4cd8ce7ae1b0bb42996` |
| `docs/evidence/m1-motion-evidence.webm` | 25.698s, 1174x500 continuous canvas recording; SHA-256 `37964783c0f209661b1097e4e0f768088a8959ec393a3308070a9ffcaf6c21ed` |
| `docs/evidence/m1-motion-evidence.json` | 159-event trace: NE/NW/SE/SW, planning/walking/waiting/obstructed/docking/seated, final three seated agents; SHA-256 `35624a14fca25faa052848f7f379db529b07cc9a990694e7668493059a97d6d4` |
| `docs/evidence/m1-motion-selected-walking.png` | Selection preserved while Dev-02 walks; status reads `Dev-02 正在前往 meeting-6`; SHA-256 `88e177c26ad9517a6d0340dbd91f863189f7b2ab3717aa60d35071c0d4826ed7` |
| `docs/evidence/m1-motion-doorway-waiting.png` | Doorway waiting/blocked frame; SHA-256 `55446042201965a145320ec6b439f468a211a8920e9b793948b29144832d369e` |
| `docs/evidence/m1-motion-complete.png` | Return docking complete; target `工位 1 · 已占用`, status `Dev-02 已入座, WORK DEMO`; SHA-256 `6395f78dac651b5f6a30e7713e98b178f59e0061182e9b51a2fcdf3e30c9152c` |
| `docs/evidence/m1-motion-trace.zip` | Browser trace; SHA-256 `da43b4d65d806e00b887ffcc5faed3a4ced18dfb0befc896da1dbf9c84695251` |

## Viewport Evidence

The browser matrix reports a nonblank canvas, no horizontal overflow, no page errors, no scene POSTs, and no external requests for all eight cases. Direct inspection covered all four DPR1 images and the DPR2 dimensions/hashes.

| CSS viewport / DPR | Canvas report | Screenshot evidence | Visual result |
|---|---|---|---|
| 390x844 / 1, 2 | 390x405 CSS; 614 sampled colors | `docs/evidence/m1-390x844-dpr1.png`, `m1-390x844-dpr2.png` | Nonblank; **layout fail**: detail precedes scene and full-page capture is 1272 CSS px high |
| 1024x768 / 1, 2 | 854x460 CSS; 426 colors | `docs/evidence/m1-1024x768-dpr1.png`, `m1-1024x768-dpr2.png` | Nonblank and horizontally contained; full-page capture is 889 CSS px high |
| 1366x768 / 1, 2 | 1174x500 CSS; 343 colors | `docs/evidence/m1-1366x768-dpr1.png`, `m1-1366x768-dpr2.png` | Nonblank; scene/labels are too small at fit view; full-page capture is 904 CSS px high |
| 1920x1080 / 1, 2 | 1728x500 CSS; 212 colors | `docs/evidence/m1-1920x1080-dpr1.png`, `m1-1920x1080-dpr2.png` | Nonblank; excessive empty field and weak use of available viewport; full-page capture is 1128 CSS px high |

The DPR2 screenshots have true 2x bitmap dimensions, so DPR capture itself is credible. However, all screenshots are full-page captures taller than the named viewport. `layout.outside: []` checks document width only; it does not prove that controls, feedback, and long content remain visible within the requested viewport height.

## TH-01..06 Decision

| Criterion | Result | Independent observation |
|---|---|---|
| TH-01 continuous isometric building | **PASS** | Runtime uses a real isometric map rather than a concept-image backdrop. Four colored regions, internal walls, door openings, corridors, and a shared floor plan are visible in every desktop capture. |
| TH-02 furniture defines room purpose | **FAIL** | Eight desk/chair/CRT stations are countable, but the single-tile meeting table and repeated block chairs do not read as the approved six-seat meeting setup at normal fit zoom. Boss/cafe props are sparse tokens. The runtime prop atlas is a primitive engineering set, materially below VIS-01/02. |
| TH-03 trackable people and actions | **FAIL** | Motion mechanics pass, but visual identity continuity does not. W00V approved blue PM, green Dev, and amber high-bun QA; the runtime atlas presents mustard PM, green Developer, and magenta Tester, with PM/Dev silhouettes nearly identical at fit zoom. The approved PM/Dev/QA identity system is not preserved. |
| TH-04 local object feedback | **PASS** | Selection diamond, target select, movement status, doorway wait/obstructed state, docking, occupied target text, and final work feedback are evidenced across the recording, JSON timeline, and three screenshots. |
| TH-05 compact controls and readable state | **FAIL** | DOM controls are compact and unclipped horizontally, but in 1366/1920 fit views the sprites and canvas labels are too small for reliable tracking. The 1920 layout leaves a large unused field instead of using the viewport to improve state readability. |
| TH-06 unified pixel assets and occlusion | **FAIL** | Pixel density/pivots are internally consistent, but runtime assets lack the approved lighting/shadow depth and the recording does not provide a sufficiently close front/behind traversal of a desk or wall to judge dynamic depth ordering. Technical render-layer metadata is not visual proof. |

## Frozen BB/NFR Visual Decisions

| Frozen item | Result | Evidence / reason |
|---|---|---|
| BB-M1-01 map, three agents, furniture, controls | **FAIL** | Four regions and real assets pass, but agent/room readability and TH-02/03 fidelity fail. Evidence: four viewport screenshots, runtime atlases, VIS-01/02 comparison. |
| BB-M1-02 zoom controls and bounds | **PASS** | Controls are visible and the matrix records bounded zoom behavior, including pinch `0.5 -> 1`; no canvas POST. |
| BB-M1-03 DPR/offset interaction | **PASS** | DPR1/2 backing evidence is present at four sizes; matrix reports matching CSS/backing ratios, no page errors, and no outside-width elements. |
| BB-M1-06 front/back occlusion while moving | **FAIL** | No inspectable close-range traversal proves sprite depth before and behind the same desk/wall. The overview-scale WebM is insufficient to close this visual requirement. |
| BB-M1-08 legal path and four facings | **PASS** | Motion JSON contains NE/NW/SE/SW and cell-by-cell four-neighbor progression through door cells; video shows continuous movement without visible teleport. |
| BB-M1-09 approach, dock, seated, repeat return | **PASS** | Timeline reaches `docking -> seated`, occupies `meeting-6`, returns, then occupies `work-1`; completion screenshot shows occupied target and work feedback. |
| BB-M1-12 doorway contention/replan/blocked feedback | **PASS** | Timeline shows waiting, attempts 1 and 2, then obstructed; doorway screenshot and matrix dynamic-block run corroborate it. |
| BB-M1-13 selection while moving | **PASS** | `m1-motion-selected-walking.png` shows Dev-02 selected with detail open and movement feedback; movement continues in the trace. |
| BB-M1-17 state/source honesty | **PASS** | Runtime labels use explicit demo feedback (`MEETING DEMO`, `WORK DEMO`, `THINK DEMO`) and the UI states that demo positions are not saved. No model/token/progress claim is shown. |
| BB-M1-20 keyboard/touch accessibility | **FAIL** | The approved M1 evidence does not record the required keyboard directory selection, target-form completion, camera controls, Esc flow, 44px target measurements, or M1 focus return. W03 keyboard evidence cannot substitute for M1 canvas evidence. |
| BB-M1-21 responsive safe area and mobile order | **FAIL** | The 390 screenshot places the selected-object detail before the office heading, controls, and scene, opposite the frozen `scene above / details below` requirement. Full-page screenshots do not prove viewport-height reachability. |
| BB-M1-24 long text and safe display | **FAIL** | No approved M1 screenshot/report demonstrates long Chinese text, an unbroken long ID, wrapping, five-bubble pressure, or injection strings in the visible canvas/DOM. |
| NFR-M1-04 readable/reachable visual matrix | **FAIL** | Nonblank pixels, DPR1/2, four widths, and horizontal containment pass. The item fails overall because mobile ordering fails and long-text, contrast `>=4.5:1`, open drawer/menu/bottom states, keyboard access, and dynamic occlusion lack sufficient visual evidence. |

## Findings By Severity

### High - M1-RV-001: Runtime art and identity do not meet the approved W00V baseline

The runtime is a functional engineering scene, but its flat room fills, repeated wall blocks, tiny token-like furniture, and simplified sprites are materially different from VIS-01/02/06. Most importantly, the PM/Dev/QA identity colors and silhouettes approved by W00V are not preserved in the runtime atlas. This fails TH-02, TH-03, TH-05, BB-M1-01, and contributes to NFR-M1-04 failure.

### High - M1-RV-002: The 390px detail layout violates the frozen responsive order

`m1-390x844-dpr1.png` and its DPR2 counterpart show the selected-object detail first, followed by the office title, controls, and scene. BB-M1-21 requires the scene above and details below on phone. The full-page image is 1272 CSS px tall for an 844px viewport, so the named screenshot also cannot prove same-viewport reachability.

### High - M1-RV-003: Readability and accessibility evidence is incomplete

The matrix proves nonblank pixels and horizontal containment, but it does not record long Chinese/unbroken IDs, contrast measurements, 44px target measurements, M1 keyboard workflows, or open menu/drawer/bottom-bar hit testing. No approved M1 evidence path closes those frozen checks. NFR-M1-04 and BB-M1-20/24 therefore fail rather than remain assumed.

### Medium - M1-RV-004: Dynamic occlusion is not independently judgeable

The WebM is a useful movement record, but its fit-view scale is too distant to verify a character passing both in front of and behind the same desk or wall. The map/asset manifests declare render layers and depth offsets, but TH-06 and BB-M1-06 require rendered visual evidence. No clear clipping defect was observed; the failure is insufficient acceptance evidence plus the absence of the approved shadow/lighting treatment.

## Positive Observations

- The canvas is nonblank at all four target sizes and both DPR values.
- The runtime uses separate map, agent, and prop assets; it is not a flattened W00V concept image.
- Four regions, eight work anchors, six meeting anchors, doors, and room-specific props exist in the executable data.
- The movement recording and trace close the previous selection/walking/waiting/blocked/docking/return evidence gap.
- Selection remains visible while walking, and the final DOM feedback names the occupied target and work state.
- The scripted matrix completed with no page errors, no external requests, and no scene POSTs.

## Limitations

- The built app requires the approved temporary workspace fixture to render the office. Direct loopback launch without that fixture correctly showed `Error: not_found / 工作区未连接`; runtime judgments use the black-box fixture evidence, not fabricated production data.
- The M1 E2E output does not record the browser executable/version used by that suite. Edge `153.0.4234.32` was used only for independent inspection of the local WebM and current bundle surface.
- Only overview-scale motion video exists. It is sufficient for route/state continuity, not for close-range occlusion or animation-pixel quality.
- Full-page screenshots are taller than the declared CSS viewports, so they are not complete proof of within-viewport vertical reachability.
- This review did not re-run formal frame-time or 30-minute stability profiles; those are outside the visual/interaction verdict except where their existing outputs support scene population claims.

## Required Closure Evidence

1. Replace or materially revise runtime agents/props/map presentation to preserve the approved W00V PM/Dev/QA identities and Theme Hospital-inspired room readability at normal fit zoom.
2. Correct the 390px order to scene above/details below, then capture true viewport screenshots with drawer closed/open and selection/camera restoration.
3. Record a close-range occlusion sequence showing the same agent both behind and in front of a desk and wall/door, with selection retained and no global z-order override.
4. Add M1-specific evidence for long Chinese text, unbroken long IDs, five-bubble pressure, contrast, 44px targets, keyboard-only selection/move/Esc/focus return, and open menu/drawer/bottom-bar hit testing.
5. Re-run this independent visual review against the revised executable; automated movement and NFR timing passes alone cannot close the visual failures.

## Final Decision

**M1 independent runtime visual and interaction gate: FAIL.**

The prior environment-blocked conclusion is superseded. Runtime interaction continuity is now demonstrated, but TH-02, TH-03, TH-05, TH-06, BB-M1-01, BB-M1-06, BB-M1-20, BB-M1-21, BB-M1-24, and NFR-M1-04 remain failed.
