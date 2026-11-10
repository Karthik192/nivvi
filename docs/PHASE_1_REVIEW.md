# Phase 1 review — Nivvi design foundation

Status: approved after readability, screen-mockup, Nim-state and accessibility revisions; user authorized Phase 2. The evidence below records the Phase 1 closeout, not a native application claim.

## Delivered

- Working brand **Nivvi**, tagline **A little, further.**, alternative-name rationale and original seed mark/icon composition.
- Original **Nim** seed character with eight semantic state studies, empty-state pot, milestone rosette and 15 category icon shapes (both “Other” categories share one icon). Proposed Rive mappings specify pending-save versus recorded, goal reached, empty and near-limit behavior without claiming an authored `.riv`.
- Single-source JSON tokens: intentional light/dark colours, type, spacing, radii, elevation, controls and motion.
- Reusable browser component factories: button, field, status, progress card, category icon, bottom navigation and mascot. An interactive gallery demonstrates enabled/disabled/busy/focus/pressed/error/success states without creating financial records.
- Readability revision: minimum 14px supporting text/labels/captions/helpers/navigation, 16px body/input text. Added Home, Add Expense, Transaction History and Insights as realistic 390×844 scrollable phone mockups in both themes; no mobile application implementation.
- Design documentation and explicit Rive asset/compatibility specification. No `.riv` is fabricated or represented as completed.
- The five user review recommendations are preserved in CLAUDE.md and the roadmap; email verification wording was narrowed to risk-based per-action review rather than a blanket gate.

## How to review

Run `node design/preview/server.mjs` from the repository root, then open `http://127.0.0.1:4173`. If a preview process is already running on that port, use it instead of starting another. Controls demonstrate design behavior only; illustrative money is not a saved ledger. See [preview instructions](../design/README.md).

Saved browser renders:

- [Four-screen light study](../design/review/screens-light.png)
- [Four-screen dark study](../design/review/screens-dark.png)
- [Home light](../design/review/home-light.png) / [Home dark](../design/review/home-dark.png)
- [Add Expense light](../design/review/expense-light.png) / [Add Expense dark](../design/review/expense-dark.png)
- [History light](../design/review/history-light.png) / [History dark](../design/review/history-dark.png)
- [Insights light](../design/review/insights-light.png) / [Insights dark](../design/review/insights-dark.png)
- [Expense save feedback light](../design/review/expense-feedback-light.png) / [dark](../design/review/expense-feedback-dark.png)
- [320px expense at 200% text](../design/review/expense-200-percent.png)
- [Machine-readable accessibility results](../design/review/accessibility-results.json)

- [Desktop light](../design/review/desktop-light.png)
- [Desktop dark](../design/review/desktop-dark.png)
- [320px mobile light](../design/review/mobile-light.png)
- [320px mobile dark](../design/review/mobile-dark.png)

## Actual verification

| Check | Result |
| --- | --- |
| `node design/verify.mjs` | Passed: 52 text/control contrast pairs including disabled/muted/lime surfaces, matching theme keys, token invariants, 14px type floor and four self-contained SVG assets |
| `node --check` on all design `.mjs` files | Passed syntax checks; not represented as full lint/type checking |
| `node design/browser-check.mjs <installed Chromium path>` | Passed gallery regression plus four-screen load, navigation, expense form invalid/valid feedback, history search/filter/no-results, browser accessibility-tree names and chart table, reduced motion, 320px/390px viewports at 100%/130%/150%/200% text with no horizontal document/content overflow |
| Rendered text audit | 156 text/control nodes per theme checked against computed foreground/background: minimum 14px; all checked text meets 4.5:1. Programmatic inspection is not a screen-reader speech test. |
| Screenshot inspection | Inspected both four-screen study boards, entry detail/feedback, dark expense and large-text layout. Phone content scrolls below the fold; screenshots are not substitutes for the interactive forms. |
| Local documentation links/code fences | Checked at phase closeout |
| ESLint/Prettier | Not configured; no dependency/formatter was installed solely for the gallery. Source formatting and JS syntax were inspected. |
| TypeScript checking | Not applicable to this phase: no TypeScript source or Expo project exists yet |
| Android emulator, TalkBack, native Rive, physical-device performance | Not run; mobile foundation is Phase 2, physical performance measurements Phase 8 |

The initial sandboxed browser target crashed; rerunning with approved outside-sandbox browser access allowed validation. Earlier checks fixed root-URL routing, page-load polling and cover wrapping. Readability revisions also fixed long status-message reflow at 200%, stacked large-text navigation to avoid split labels, and removed tiny nonzero bars for zero spending periods. Final checks pass. No dependency or mobile implementation was introduced. The gallery is not a security or accessibility certification.

## Native accessibility acceptance still required

The browser font-size controls simulate scaling; real Android system font scaling and TalkBack have not been tested. Phase 2–3 acceptance must exercise default/large/maximum system text (including 200% where supported), 320–412dp devices, keyboard/IME visibility, error focus/announcements, reading order, radio selection, scroll reachability, chart text, disabled/busy controls and reduced motion. Do not disable native font scaling or apply an unreviewed maximum multiplier to force layouts to fit. Phase 8 performance measurements still require real mid-range Android hardware.

## Outstanding decisions and assets

1. User approval of working name, mark, Nim concept, palettes and component direction. Trademark/domain/store and regional-language clearance is still pending.
2. Bundle the actual proposed Manrope files with their licence in Phase 2; current gallery uses the system fallback unless Manrope is already installed. Final font metrics require another visual review.
3. Commission/author original `.riv` plus editable source and licence evidence. Validate the selected native runtime/Expo/Nitro pairing with an actual asset before relying on animated mascot behavior. Static art remains available.
4. Produce final Android adaptive/monochrome/raster icon exports and native accessible components after approval. Browser factories are design prototypes, not a mobile foundation or WebView implementation.
5. Keep offline abstractions small through Phases 2–6; no repository/outbox/sync implementation was introduced here. Evaluate verification friction in Phase 4, preserve local-versus-synced widget states in Phase 7, and measure cold launch/animation on real mid-range Android hardware in Phase 8.

No backend, authentication implementation, storage, synchronization, mobile routes, dependency installation, Git commit, deployment or publishing occurred. Wait for explicit approval before Phase 2.
