# Phase 3 native review

This directory contains actual Android development-build captures and native UI checks, not the Phase 1 browser mockups. Test device: Pixel_7 AVD, Android 14/API 34, x86_64, 1080×2400 at density 420 (approximately 411dp wide). Records are sample data kept only in memory.

The four key product views are captured in light and dark themes: `home-*.png`, `expense-*.png`, `history-*.png`, `insights-*.png`. Additional captures cover onboarding/auth forms, transaction detail, goal milestones and loading/error/empty states. `*-system-font-200.png` uses Android's actual system font setting of 2.0; Android 14 text scaling is nonlinear.

`native-SECTION.json` records the actual passed/failed status for each native test section. A failed result must not be represented as acceptance. `runtime-errors.txt` contains filtered current-process ReactNativeJS/AndroidRuntime error output and is blank when none were logged.

The review does not certify TalkBack speech, physical-device performance, security or authored Rive animation. See [Phase 3 review](../../PHASE_3_REVIEW.md).

## Key screens

| Screen | Light | Dark |
| --- | --- | --- |
| Home | [Capture](home-light.png) | [Capture](home-dark.png) |
| Add Expense | [Capture](expense-light.png) | [Capture](expense-dark.png) |
| Transaction History | [Capture](history-light.png) | [Capture](history-dark.png) |
| Insights | [Capture](insights-light.png) | [Capture](insights-dark.png) |

Chart detail: [light](insights-chart-light.png), [dark](insights-chart-dark.png). Enlarged Android text: [Home](home-system-font-200.png), [Goals](goals-system-font-200.png), [Add Expense](expense-system-font-200.png). At this setting long tab labels can reflow across two lines; the bar grows rather than truncating them.

## Evidence scope

[Native build](native-build.json), [unsaved navigation](native-back.json), [budget regression](native-budget-regression.json) and [static production gate](production-gate.json) record focused checks. Historical failures are retained in `history/`. The concurrent-export ANR log is diagnostic evidence; it is not a passing performance result. Current full-run acceptance, when passed, is recorded in `native-all.json`.

The latest combined run in `native-all.json` records five passed core-flow groups and a later scroll assertion failure. Remaining sections were rerun independently: [recovery](native-states.json), [themes/text scaling](native-captures.json), [profile/session](native-session.json) and [final layout](native-layout.json); all four passed. Do not describe that combined run as wholly passed. `scripts/android-phase3-layout.ps1` verifies the compact History controls and refreshes layout captures after visual inspection.
