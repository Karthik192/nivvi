# Nivvi — Phase 1 design foundation

Status: approved working design foundation after Phase 1 revisions; name clearance and actual Rive authoring remain pending. Phase 2 now implements the native foundation separately. [Interactive gallery](../design/preview/index.html) requires the local server described in [preview instructions](../design/README.md).

## Brand direction

Recommended working name: **Nivvi**. Short, friendly and easy to set in lowercase; the invented name makes no bank, investment-return or credit promise. Tagline: **A little, further.** Alternatives considered: **Tallo** (tally/growth association, less personal) and **Pocket Pace** (clearer meaning, longer and more generic). These are creative proposals, not cleared trademarks. Search trademarks, domains, app stores and Hindi/regional-language interpretations before public launch; no availability claim is made.

Nivvi helps people feel capable rather than monitored. Its visual signature is a forest-green seed mark, warm oat surfaces, generous rounded shapes and a quietly playful seed companion. Brand voice: plain, reassuring, specific. Say “Saved on this device. Waiting to sync.” rather than “All done!” before server confirmation. Say “You’re close to your planned limit” rather than “You overspent again.” No forced streaks, random praise, infantilizing financial advice or confetti for every expense.

Original source assets in `design/assets`: seed logo mark, adaptive-icon composition study, empty-state pot and milestone rosette. The lowercase wordmark is live text plus the mark until a licensed final font is bundled. These are original editable vector studies created in this project, not final trademark-cleared branding. App-icon SVG is a composition reference; Phase 2 must export/test proper adaptive foreground/background, monochrome and store raster assets against Android masks. Keep the foreground inside the central 66/108 safe region, retain the full-bleed background and test small launch icons. Wordmark minimum height 24 logical pixels, standalone mark 24, clearspace one-quarter mark width. Do not distort or add gradients.

## Single-source tokens

`design/tokens.json` is the machine-readable source. The browser gallery consumes it directly. Phase 2 imports/maps these tokens into typed React Native StyleSheets; it must not copy hardcoded palettes into screens. JSON has no production-package dependency. All dimensions are logical pixels (dp in native, CSS px in gallery); rem-based browser type supports preview scaling. Navigation safe-area insets are added by the native host, not baked into tokens.

| Role | Light | Dark | Intent |
| --- | --- | --- | --- |
| Canvas | Oat #F8F8F2 | Pine-black #151D1A | Quiet background |
| Surface | #FFFFFF | #202C26 | Cards, sheets |
| Raised | #F0F1E8 | #2A3931 | Grouping and secondary controls |
| Ink | #202B28 | #F3F4EB | Primary text |
| Muted | #59665F | #B6C3B8 | Supporting text, never low-opacity text |
| Primary / onPrimary | #284F3B / white | #D6EF9B / #243729 | Main action |
| Accent / onAccent | #D6EF9B / #243729 | #354A2C / #D6EF9B | Selection and encouragement |
| Apricot | #F4DDD0 | #49362E | Personality, not a warning indicator |
| Focus | #365EB5 | #A8C5FF | Keyboard focus ring |

Positive, warning and danger each have paired text/background tokens. Use icon + explicit text, never hue alone. Decorative `line` is not a control boundary; interactive outlines use higher-contrast `outline`. Primary/secondary active feedback uses compression and a focus ring rather than low-contrast opacity. Disabled controls retain readable text and native disabled semantics. Dark mode uses distinct elevation surfaces and a bright primary action; it is not a filter inversion.

## Typography, rhythm and layout

Propose **Manrope** at 400/500/600/700, with tabular numerals for amounts. Its [Google Fonts licence](https://github.com/google/fonts/blob/main/ofl/manrope/OFL.txt) is SIL OFL 1.1; when bundling the actual font, preserve its accompanying licence and record the exact file/source hash. No font binary or remote font request is included in this phase. The gallery intentionally uses installed Manrope if present, otherwise system-ui; final typography needs review with the actual bundled font. Hindi/regional-script expansion requires an appropriate separately licensed fallback and shaping tests.

| Role | Size / line height | Weight |
| --- | --- | --- |
| Display (brand/onboarding only) | 48 / 54 | 700 |
| Screen title | 28 / 36 | 700 |
| Section heading | 20 / 28 | 700 |
| Body | 16 / 24 | 400 |
| Label | 14 / 20 | 600 |
| Caption / helper / category / navigation minimum | 14 / 20 | 500 |
| Financial amount | 36 / 44 | 700 |

The gallery's editorial cover uses larger fluid display type as a presentation treatment, not a mobile screen token. The minimum readable size is now 14 logical pixels for supporting text, captions, category labels, helpers, status copy and navigation; body and form input text use at least 16. There are no smaller editorial exceptions in the previews. Use rem/sp scaling, never shrink a whole phone or cap system font scaling to fit a layout. Amounts use Indian grouping and rupee sign, e.g. ₹1,23,456.78. Keep exact values available even if large layouts require a second line. Default dates: `09 Nov 2026` for prose, `09/11/2026` where numeric; the reporting timezone is explicit when relevant.

Spacing: 4-point scale 0/4/8/12/16/20/24/32/40/48/64. Mobile page inset 24 (16 on narrow layouts when necessary), card padding 24, control padding 12–20, between-related-elements 8–12, between-sections 32. Control radius 16, card 24, feature card 32; pills reserved for short filters/statuses. Android touch targets at least 48dp, usual control height 56; heights expand for text scaling. Icons 24, stroke 1.8–2, round caps. Avoid a border on every card. Shadows are low opacity and reserved for floating/featured surfaces; dark hierarchy primarily uses tonal separation.

## Reusable component contracts

Phase 1 supplies reusable browser factories in `design/preview/components.mjs`; these are executable design prototypes, not React Native components. Reimplement the approved contracts with actual accessibility roles, StyleSheet tokens and native gesture/motion in Phase 2. Do not ship a WebView gallery as the app.

| Component | Contract and states |
| --- | --- |
| Button | label, primary/secondary/quiet/destructive variant, disabled, busy, onPress. Default/focus/pressed/disabled/loading; busy prevents repeated action, stable label communicates progress. Native host must announce completion. |
| Field | persistent label, value, helper, error, disabled. Error text is associated with the input; focus first invalid field after submission. Never rely on placeholder labels. Native amount input and business validation belong to later phases. |
| ProgressCard | label, exact amount text, supporting detail, bounded progress. Track has accessible name/value. Refund-negative or over-target financial values stay truthful in text even when fill is clamped. |
| Status | kind, title, explanation. Separate local save, server acknowledgement and needs-attention samples. Static examples are not live alerts; actual changes use polite status announcements. |
| Navigation | icon plus persistent label, one selected destination, explicit onChange. The gallery changes descriptive content only; native route behavior belongs to Phase 2. |
| Category control | shared vector icon, label, selected state and click action. Do not communicate selection solely through colour; selected outline and pressed semantics are required. |
| Empty state | small contextual illustration, concise heading, useful explanation and action. Gallery action displays an entry hint; no fake transaction form. |
| Mascot | semantic pose/event intent and meaningful adjacent text; decorative art is hidden from accessibility APIs. Runtime failure cannot hide status text or block actions. |

Default-category icon vocabulary includes food, groceries, shopping, transportation, entertainment, bills, health, education, travel, subscriptions, other, salary, freelance, investments and gifts. Expense/income “Other” share a neutral dots icon. Prototype SVG paths are local original line drawings; no emoji dependency or mixed icon packs. Custom categories choose a known icon/style key, not arbitrary uploaded executable SVG. Larger category illustrations can reuse the same object silhouettes with at most three brand fills and consistent soft shading.

## Character and illustrations

**Nim** is an asymmetric little seed with two unequal sprout leaves, short feet, rounded arms, dark oval eyes, soft cheek colour and a small diamond patch. The leaves are its recognisable silhouette; it is not an owl or a copy of another product's mascot. Flat vector shapes with one shallow shadow suggest soft clay without real-time 3D. Anatomy and face proportions stay fixed across poses.

Included static studies cover calm, delighted, curious/surprised, saving, recorded, goal reached, empty and near-limit states. Some states intentionally share a supportive pose; small check/rosette/plant accents distinguish relevant outcomes. `design/nim-states.json` records proposed event-to-state names, copy, duration and reduced-motion fallback. These are semantic authoring contracts, not generated Rive bindings. The illustration grammar extends to empty states (small pot), achievements (leaf ribbon rosette) and future category objects. Achievement SVG is a design asset, not a working reward engine. Positive reactions celebrate logging, reviewing or a self-defined savings milestone. Near-limit reactions are attentive and neutral, never angry. Do not associate a disappointed character with health or essential purchases.

Do not animate these vectors as a substitute for delivering Rive. The original `.riv` files are not yet authored; state requirements, licensed-source requirements and runtime acceptance are in [Rive asset specification](RIVE_ASSET_SPEC.md). Static art is an honest first-release fallback if the native spike or authoring fails.

## Motion language

| Intent | Duration / behavior |
| --- | --- |
| Press feedback | 100ms, scale to 0.98; no bounce on every control |
| Local feedback | 180ms opacity/short translation; no delay before a durable save |
| Screen/card/chart transition | 260ms, easing (0.2, 0.8, 0.2, 1); native stack owns route transitions |
| Milestone flourish | at most 700ms one-shot; dismissible, never blocks use |
| Progress | 260ms to new bounded fill; exact value updates immediately |
| Reduced motion | zero travel, scale, loops or counter tween; use still state + text |

Reanimated owns product UI motion; Rive owns the mascot. No concurrent attention-seeking loops. Pause offscreen/background work. Browser CSS feedback is a design approximation only. No performance claim is made from the gallery; Phase 8 measures launch and frame behavior on a real mid-range Android phone.

## Acceptance and remaining gates

The [four-screen study](../design/preview/screens.html), served locally, shows Home, Add Expense, Transaction History and Insights. Each has a 390×844 logical-pixel viewport at full desktop review size; narrow browser layouts use the available width without scaling down fonts. Scroll within each frame to inspect content below the fold. Both themes have individual screen captures and whole-study renders in `design/review`. This is a Phase 1 browser mockup, not an Expo application or a production ledger.

The expense mockup includes amount/category/merchant/payment/date/note, error focus, optional fields and preview-only save feedback. Home links to entry/history; history supports sample search/filter and no-results copy; Insights provides actual text amounts alongside decorative bars. At 200% text, the bottom navigation stacks, rows reflow and fields remain scrollable. Native implementation must allow font scaling and test real Android system sizes without maximum multipliers or truncated critical labels.

For contrast, apply at least 4.5:1 to all text pairs (including our disabled buttons as a product choice) and 3:1 to required control outlines. [WCAG contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) exempts inactive controls, but this design deliberately retains their readability. [WCAG text resize guidance](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html) calls for 200% enlargement without loss of content/functionality; this is not a universal mandated minimum font size, so the 14px floor is our own design rule. Pair lime with `onAccent`/`onPrimary`, never pale supporting green. Muted green text is reserved for tested canvas/surface/raised backgrounds.

Review both themes, narrow viewport, 200% text, keyboard/focus, field error recovery, selected categories, navigation feedback, local/synced wording and reduced motion. Contrast pairs are programmatically checked at 4.5:1 for text and 3:1 for control boundaries. Automated checks do not replace actual TalkBack/native accessibility or Android physical-device testing.

Decisions awaiting approval: working name/mark, Nim silhouette, palette and component direction. Remaining assets: final font binaries with licence, original authored `.riv` plus authoring source/licence evidence and native validated bindings. Do not imply these have been secured. Keep repository/sync code absent until its authorized phase; evaluate verification friction in Phase 4 and preserve separate widget save/sync feedback in Phase 7.
