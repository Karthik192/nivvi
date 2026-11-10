# Phase 2 — mobile foundation

Current application note: Phase 3 has moved Studio and Motion to developer tools and made Home, History, Insights and Goals the main tabs. This page records the Phase 2 foundation decisions; [Phase 3 review](PHASE_3_REVIEW.md) describes the current in-memory preview and guards. Original Phase 2 evidence remains historical.

Phase 2 handoff status: native foundation implemented and running on Android Emulator; evidence and remaining asset/accessibility gates are recorded in PHASE_2_REVIEW.md. Phase 3 was subsequently approved and implemented; see the current review linked above.

## Boundaries

The foundation has Studio, Motion and Settings tabs, About modal and a not-found route. It intentionally does not implement Phase 3's product screens, authentication, API clients, repository abstractions, SQLite, sync, notifications or widgets. Phase 1 mockups remain separate reference artifacts, not WebViews inside the native app.

`app/` files compose screens/navigation; `src/components/ui` contains semantic reusable primitives; `src/design` maps the existing JSON tokens and reduced-motion policy; `src/state` contains only ephemeral preferences; `src/config` validates environment values. Native and browser previews share one token source, with no duplicate hardcoded financial palette in feature screens. Original illustration fills remain art-specific rather than theme tokens.

## Native setup

Expo SDK 58 / React Native 0.88 / React 19.3 pair selected from the checked stable SDK matrix and `expo/bundledNativeModules.json`. Library versions and lockfile evidence are documented in DEPENDENCY_COMPATIBILITY.md. Root npm workspaces and Metro's built-in monorepo support are sufficient; no custom resolver, second lockfile or task orchestration framework is introduced.

Root providers: GestureHandlerRootView, SafeAreaProvider, font loading with splash handoff, semantic ThemeProvider, MotionProvider, status bar and Expo Router stack. Font failure falls back to system type rather than holding the splash forever. Only four Manrope weights are imported from per-weight entries to avoid bundling unused weights. The complete SIL OFL notice from the pinned font package is bundled in `assets/manrope-license.json` and readable through About.

The root stack uses native route transitions with `animation: none` when reduced motion is active. The three tab destinations are foundation demonstrations, not misleading empty product screens. About and not-found controls navigate back to Studio. Insets, scrollable content and keyboard-aware layout support compact devices and larger system text.

Phase 3 will introduce the approved product navigation (Home, Transactions, Insights, Goals). Preserve the foundation gallery/motion/settings examples as development review tools when moving them out of the primary tabs; explain that navigation change before implementing it rather than silently discarding these working demonstrations.

## Design primitives and accessibility

AppText uses semantic roles, fonts and at least 14sp supporting/16sp body text. It explicitly leaves native font scaling enabled without a maximum multiplier. Button has 56dp minimum height, native role/name, disabled/busy state, retained caller-selected semantics and Reanimated press feedback through compiler-compatible shared-value get/set. Input has persistent label, native accessible label/hint, associated Android label ID and error text. Card/Notice provide theme surfaces and paired readable colours.

Motion preview includes a bounded pan that returns to rest and a button alternative for users who cannot drag. Progress announces its exact value, updates the visible text immediately and animates only the decorative fill. Reduced motion combines OS and in-app preference with logical OR, defaults conservatively to reduced while querying the OS, and prevents a late initial query from overriding a newer OS event. It does not permit an app switch to turn off the OS preference.

One root MotionProvider owns the OS query/subscription; individual controls consume its context rather than creating a native listener for every button. Horizontal gesture activation fails for vertical movement so the surrounding screen can scroll, and cancellation returns the card to rest.

The tab bar measures each rendered label with `onLayout`, retains the largest height and includes the bottom safe-area inset. This keeps uncapped text readable during a live Android font change even when the JavaScript window font-scale value lags native layout. The labels and bar can shrink again when text size is restored; no application restart or font-size cap is used.

Automated/browser checks and emulator inspection are evidence, not a full TalkBack certification or physical-device performance result. Later accessibility acceptance must include actual TalkBack reading order/speech, error focus and maximum OS text on real Android hardware.

## Rive boundary — original asset still missing

The compatible Rive/Nitro pair is installed for native linking. `Mascot` renders original static vector artwork by default. An explicitly approved future asset can enter the native adapter only while the route is focused, the app is active and reduced motion is off. Lazy module loading, an error boundary and load/render error handling keep the static illustration available for JS/runtime/asset failures. Native binary incompatibility must still be caught by real build/runtime tests, not hidden by this fallback.

`RiveSurface.native.tsx` uses the installed package's actual `useRiveFile` and `RiveView` contracts. The generic/web module is deliberately a static fallback. No authored state-machine binding names or completed animation are invented. The adapter does not establish that every proposed Nim event is authored or rendered correctly. Original `.riv` ownership, authored source, manifest, feature support, binding tests and animation performance remain required before relying on animated Nim.

Metro extends Expo's default asset extensions with `riv` while preserving its monorepo defaults. The `.local` host-tool/cache subtree and dependency Android `build`, `.cxx` and `.gradle` outputs are excluded from file crawling/watching. Native compiler outputs are not JavaScript modules/assets and can otherwise flood file scans during a rebuild. There are no custom watch-folder or dependency-resolution rewrites. Actual asset packaging still requires a real approved `.riv` file and a successful native rendering test.

## Environment and reproducibility

`readEnvironment` rejects unknown variants, non-HTTP(S) URLs, embedded credentials and HTTP in production. An API URL is optional in Phase 2; nothing attempts network authentication or queries financial data. Public configuration is not secure secret storage. The dynamic Expo TypeScript configuration loads the checked `tsx/cjs` registration so its imported TypeScript validator is resolvable under the installed Node/config loader.

Development uses a separate package ID and deep-link scheme from production. Native trees are generated through Expo prebuild and ignored in the root `.gitignore`; no hand-maintained Kotlin widget is introduced. Development/production EAS profile metadata is present without initiating cloud builds or releases.

`plugins/with-font-scale.cjs` adds Android's `fontScale` configuration-change flag without replacing existing flags. The purpose is to keep one Router root while React Native handles updated text metrics; verify actual enlarged/reduced text, navigation continuity and tab reflow on the built APK. This is not a font-size cap. See [Android configuration changes](https://developer.android.com/guide/topics/resources/runtime-changes) and [React Native window dimensions](https://reactnative.dev/docs/usewindowdimensions). TypeScript lint rules are scoped to TypeScript; this native-generation plugin uses Node CommonJS rules and is included in `npm run lint`.

## Verification workflow

Use the root README commands for TypeScript, lint, Jest, formatting and design contrast checks. Additional native preparation checks:

```powershell
cd apps/mobile
npx expo install --check
npx expo-doctor@1.21.6
npx expo export --platform android --output-dir dist/android
```

The Android export verifies JavaScript/Hermes bundling, not APK compilation or installation. A successful `expo run:android` plus actual emulator rendering is required separately. Generated native folders can produce Expo Doctor's config-sync warning in a workspace without Git ignore tracking; document it and regenerate with prebuild rather than claiming it passed or suppressing warnings globally.
