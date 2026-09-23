| Document | W00V mobile design-study acceptance |
|---|---|
| Version | 1.0 |
| Date | 2026-09-11 |
| Status | Frozen before study implementation; review pending |
| Links | B01-08; VIS-04; V00-03; not M1 acceptance |

This narrow standalone layout study supplements the generated responsive board. It does not add a scene to the application, touch backend data or implement movement. Source art is the unmodified generated `vis04-mobile-scene-v1.png`.

| Test | Observable expectation |
|---|---|
| BB-V04-01 | At 390x844, selected Dev is visible above a bottom details panel, with no horizontal overflow. |
| BB-V04-02 | Open details, inspect the linked task, return, close: the selected person and the rendered bitmap bounds/crop stay identical. |
| BB-V04-03 | Buttons are at least 44x44 CSS pixels, named for assistive technology; keyboard activation opens details and Escape closes/restores invoking focus. |
| BB-V04-04 | At 390x844 and 1024x768, no actionable controls are outside the viewport or hidden beneath another panel; long Chinese/IDs wrap. |
| BB-V04-05 | Uses only local files; no HTTP or workspace API requests; console page errors zero. |

Implementation-aware supplements must be WB. Persist screenshots for closed/open/task/returned states, browser/environment, bounds and test outcomes. This cannot prove real Phaser camera restoration, sprite rendering, walking, performance, or complete production accessibility. Independent visual review remains mandatory before W00V closes.
