# Phase 3 review — interactive product UI

Status: Phase 3 implementation and scoped verification complete; awaiting user review and approval. Outstanding asset/accessibility/device gates are listed below. Phase 4 is not authorized.

## Product scope

The development build now has onboarding; login, registration and password-reset previews; Home; expense/income/refund entry; transaction history and details; category management; monthly/category budgets and history; savings goals with contributions and milestones; Insights; profile and settings. Home, History, Insights and Goals are the four primary tabs. The original Studio and Motion demonstrations remain under Profile → Preview tools. No working demonstration was removed.

Every product page identifies the session as a design preview. Entries, profile, categories, budgets and goals are in a small in-memory Zustand store. They reset on application restart; signing out resets the sample data and profile. This is not local SQLite persistence, offline synchronization, real authentication, email delivery or bank integration. There is no premature repository/outbox/sync infrastructure. No new dependencies were installed.

Production builds cannot enter the preview routes: Router guards require `__DEV__` and a preview profile, the root displays a development-build notice, and production initialization does not seed sample records. This is a preview restriction, not an authentication security boundary. Real access tokens, refresh handling and server authorization remain future work.

## Interaction and calculation behavior

- Forms validate amounts, categories, dates and lengths; errors are associated with fields. Auth samples clear password fields and never retain or send credentials. Reset feedback explicitly says no email was sent.
- Expense/income/refund creation, editing and confirmed deletion update the same preview records and all derived views. Unsaved form navigation is guarded through Expo Router's installed `usePreventRemove` API and an accessible confirmation modal.
- Money uses bounded integer paise. Refunds link to their original expense, cannot exceed its remaining refundable amount, and reduce spending on the refund date. Expenses with refunds cannot be casually deleted or edited in ways that invalidate those refunds. Archived categories remain on existing entries; their names are reserved and restoration retains the same category ID.
- History supports month, type, category and payment-method filters, merchant/note/category search and amount/date sorting. Native FlatList renders rows incrementally.
- The default History header prioritizes search and visible entries; month navigation and detailed filters live in the expandable panel. A summary keeps active filters visible after collapsing it.
- Budgets validate monthly/category limits and allocation totals; goals accept manually tracked contributions that never become ledger income or expenses. Numeric values remain truthful when decorative progress is clamped.
- Insights derives weekly (Monday-start), monthly, category, merchant and comparison values from the actual preview records. Chart amounts are also available as text. Surplus and goal totals are not described as bank balances.
- Theme tokens, Manrope, uncapped text scaling, native press/progress feedback and reduced-motion policy are reused. Nim uses original static states; no original `.riv` has been authored or rendered.
- Expense categories use two columns for readable labels. A fixed Save action stays available below the scrollable form and follows the keyboard. Budget validation is repeated beside Save; goal contributions show feedback beside their action.

## Verification

Native driver: `scripts/android-phase3-smoke.ps1`, supported by `scripts/android-ui.ps1`. `-Section auth|ledger|planning|states|captures|session` allows focused reruns against the same preview session; `all` cold-launches and exercises the full flow. Captures and per-section results live in [review artifacts](review/phase3/README.md).

| Check | Result |
| --- | --- |
| Jest | 34 tests across three suites passed: foundation, planning forms and preview money/store rules. |
| TypeScript, ESLint, Prettier | Passed on the final source. |
| Design verification | 52 contrast pairs, theme parity, spacing/type/motion invariants and local SVG checks passed. |
| Dependency compatibility | Expo Doctor 20/20; Expo version check passed. No Phase 3 dependencies added. |
| Native build/install | Debug x86_64 APK rebuilt and installed on Pixel_7 API 34; 537 tasks, 7m22s. |
| Android Back regression | Header Back, Cancel, physical Back and deep-link return passed on the rebuilt APK; see native-back.json. |
| Native product flows | Auth, ledger create/edit/delete/search, income/refund validation, goal milestone and custom category exercised. Budget validation was rerun after adding feedback beside Save. Per-section JSON records retain actual outcomes. |
| Recovery states | Focused native run passed loading completion, error retry, empty data and sample reset; see native-states.json. |
| Themes and text scaling | Home, Add Expense, History and Insights captured in both themes; reduced-motion setting and 200% Android text navigation passed. |
| Preview session | Profile editing, confirmed sign-out/reset and valid sign-in passed through native controls. |
| Final layout regression | Compact History type filters/search/Add entry passed; light/dark History and chart detail captures refreshed. Settled Home and Add Expense captures at 200% text passed, with Save reachable; font scale restored to 1.0. See native-layout.json. |
| Production exports | Android/Hermes and web export passed; 27 static routes. Static production gate verifies the root notice and absence of rendered preview UI/sample records on protected pages. An iOS JavaScript bundle exported too; no iOS native build or device test was run. |

The full driver stopped at its budget assertion because focus/scroll and the keyboard hid the inline error. The form correctly rejected the invalid allocation. Feedback is now repeated beside Save, and the driver dismisses the keyboard before checking it. Earlier failed runs are retained as diagnostic evidence, not represented as a complete passing run.

The next full run passed all five core product-flow groups through planning, then stopped when a retained scroll position hid Preview tools controls. The driver now confirms the page header after navigation before proceeding. The focused recovery-state rerun passed. `native-all.json` retains that failed combined run; acceptance for remaining sections is recorded separately rather than overwriting the failure as a success.

Visual inspection also moved History's detailed controls into its expandable panel so sample entries appear in the first viewport. The focused layout run passed type filtering, search, clearing and entry navigation on the final source. A chart-capture overscroll assertion was corrected before the passing layout rerun; its failed result remains under `history/`. Home's temporary Fast Refresh banner was replaced by a settled native capture. [Light/dark and enlarged-text gallery](review/phase3/README.md) contains the final images.

One subsequent recovery-state run stopped on an Android input-dispatch ANR while a multi-platform export was running concurrently. The app reported a 5-second input timeout; CPU/IO pressure was present in the emulator log. Concurrency is a possible contributor, not an established root cause. The driver fails on app ANRs. See [recorded timeout](review/phase3/export-concurrent-anr.txt); final native checks run after exports finish. This development-emulator observation does not establish release-device performance.

Native QA found an Android Back issue in the prior development APK: on-screen route removal was guarded, but the physical Back event did not reach JavaScript on API 34. Installed React Native's `ReactActivity.java` registers its predictive-back workaround only for API/target 36+, while this app had opted into predictive back on API 34. `predictiveBackGestureEnabled` now uses [Expo's default `false`](https://docs.expo.dev/versions/latest/config/app/#predictivebackgestureenabled), and the APK was rebuilt (7m22s, 537 tasks). This removes the problematic opt-in for the tested runtime combination without changing dependency versions or patching native libraries. [Android's migration guidance](https://developer.android.com/guide/navigation/custom-back/predictive-back-gesture) describes the flag's callback/animation effects. Android 16 and physical gesture testing remain separate gates.

Root/index and Home tab anchors preserve a return destination for deep links; the tab navigator uses `backBehavior="initialRoute"` consistently with its anchor. The stack defaults explicitly to card presentation, with modal presentation reserved for transaction entry and About. This resolves the implicit-presentation warning when opening screens above a modal. The shared unsaved hook covers route removals and Android Back, re-arms when revisiting a form, and keeps its bypass state in sync after a successful save. The focused regression driver `scripts/android-phase3-back.ps1` passed on the rebuilt APK; see [native-back.json](review/phase3/native-back.json).

The older `scripts/android-smoke.ps1` records Phase 2's original navigation and is historical for commit `1283f69`. Use the Phase 3 driver for current routes. Prior Phase 2 results remain evidence of that earlier version, not new Phase 3 acceptance.

## Remaining gates

- Original licensed/authored Rive asset, authoring source and native animation/binding acceptance remain absent. Static original Nim is the actual implemented behavior.
- Actual TalkBack speech/focus review, real mid-range phone launch/frame measurements and release-build execution remain unverified. Emulator captures are not a physical performance result.
- Retain the existing dependency-advisory record; no unsupported forced upgrades were made. Security testing and production readiness are not claimed.
- Phase 4 backend/database work, deployment, publishing and further GitHub pushes require their own applicable authorization. Stop for explicit approval at this phase boundary.
