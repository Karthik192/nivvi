# Phase 2 review — mobile foundation

Status: Phase 2 foundation implemented and verified on Android Emulator, ready for approval with the original Rive asset gate explicitly outstanding. Phase 3 is not authorized.

## Scope delivered

Npm workspace with one lockfile; Expo SDK 58, TypeScript/Router, semantic StyleSheet tokens, light/dark/system themes, bundled Manrope, accessible UI primitives, Studio/Motion/Settings tabs, About modal and not-found route. Reanimated drives press/progress/gesture samples; Gesture Handler is rooted at the app boundary. OS reduced motion always wins over app preferences. System font scaling stays enabled without a maximum multiplier.

Rive/Nitro's checked versions compile in the installed native APK; Android runtime logs show Rive native registry loading. The guarded lazy adapter and original static Nim fallback are implemented. **No original `.riv` file has been supplied/authored or rendered**, so actual state-machine/data-binding/animation acceptance remains incomplete. Native linkage alone does not establish animation compatibility.

Development/production configuration has separate package IDs/schemes, validates optional API URLs and contains no hardcoded credentials. Production EAS profile metadata does not mean a production build, deployment or publishing occurred. In-memory preferences are the only Zustand state; no repository, SQLite/outbox or sync infrastructure was introduced early.

## Validation record

| Check | Actual result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed with maintained ESLint 10 + compatible TS/hooks rules |
| `npm test` | Passed: 6 foundation tests for environment validation, theme selection, readable tokens, preference state and OS reduced-motion priority |
| `npm run format:check` | Passed |
| `npm run design:verify` | Passed: 52 contrast pairs and design invariants |
| `expo install --check` | Passed; SDK dependencies up to date |
| Expo Doctor 1.21.6 | 19/20 passed; documented generated-native-folder/config warning in non-Git workspace |
| Android/Hermes export | Passed; verifies JS/asset bundling only |
| Web static export | Passed; supplementary portability check, not emulator proof |
| Production public config | Evaluated successfully: Nivvi, `com.nivvi.app`, `nivvi`, production environment; no API configured |
| Native build/install | Passed: current Gradle debug build (7m26s, 537 tasks), installed `com.nivvi.app.dev` on Pixel_7 Android 14/API 34, x86_64 |
| Emulator rendering/interactions | Passed: tabs/modal/back, both themes, progress 40→80%, reduced motion, live font scale 1.0→2.0→1.0, enlarged tab bar and retained navigation/progress state; no current-process ReactNativeJS/AndroidRuntime errors |
| Original Rive animation | Not run: original `.riv` absent |
| Actual TalkBack speech / physical-device performance | Not run; separate later acceptance |
| Dependency audit | 33 low/moderate findings (1 low, 32 moderate), no high/critical; not a clean security result |

Installed versions and audit evidence are in [review artifacts](review/phase2/README.md), [version inventory](review/phase2/installed-versions.json) and [audit JSON](review/phase2/dependency-audit.json). Setup: [root README](../README.md). Implementation boundaries: [mobile foundation](MOBILE_FOUNDATION.md).

## Native evidence and reproducibility

The installed development APK is `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk` (104,692,788 bytes; SHA-256 `5CCA84A61405FB3BB694330D134B9029291392AFB268D54940402C99CEA518D1`). It requires Metro; it is not a signed production release or a performance benchmark. Native SDK configuration: min API 24, compile API 37, target API 36. Emulator capture dimensions are 1080×2400 at density 420 (approximately 411dp wide).

Run `scripts/android-smoke.ps1` after Metro is ready on port 8081. It cold-launches the development client, exercises actual native controls, captures screens and restores the previous Android font scale even on failure. It retries transient null UI roots, rejects stale hierarchy dumps and fails on runtime errors. Font checks compare native text/tab bounds and verify progress state survives scaling. Assertions are recorded in [smoke results](review/phase2/smoke-results.json); [filtered runtime error output](review/phase2/runtime-errors.txt) is blank for this run. UI-tree checks do not verify TalkBack speech or animation frame rates.

Captures: [Studio light](review/phase2/studio-light.png), [Studio dark](review/phase2/studio-dark.png), [Motion](review/phase2/motion.png), [Settings dark](review/phase2/settings-dark.png), [Android text at 200%](review/phase2/studio-system-font-200.png). Enlarged text wraps and scrolls rather than being capped. These are foundation screens; the four Phase 1 product mockups remain design references until Phase 3.

Two host-tool causes were fixed: older Ninja rejected long C++ codegen paths (project-local CMake 4.1.2/Ninja 1.12.1 selection), and Metro was crawling the project-local Gradle cache (supported exclusion preserving Expo defaults). A fresh export also caught and corrected mixed regex flags in that exclusion. No dependency source was patched. The automatic review rejected optional generated-cache removal; that removal was not performed, and the successful rebuild did not need it.

The resumed run also excludes generated dependency Android build/CMake/Gradle outputs from Metro scans. Final Android export passed with the actual source and these exclusions. Android's live font-scale change previously recreated the activity and produced overlapping Router roots. A checked Expo config plugin adds `fontScale` while preserving existing manifest flags; the rebuilt APK now handles it without the warning. The screenshot then exposed a clipped tab bar: it now sizes from actual rendered label heights and safe-area insets instead of relying on a lagging JavaScript font-scale value. Final captures were visually inspected after the strengthened native checks passed. Enlarged text is the Android 2.0 setting; Android 14 scaling is nonlinear.

## Outstanding issues / approval boundary

- Obtain original authored `.riv`, source/rights manifest and validate rendering/bindings before relying on animated Nim. Static artwork is the available behavior.
- Revisit compatible transitive dependency fixes and upstream generated AGP warnings; no forced SDK downgrade or node_modules patching.
- Native TalkBack speech review and performance on a real mid-range Android phone remain unverified. Emulator results cannot substitute for physical measurements.
- No financial features, authentication, backend, widget, Git commit, deployment or publishing were implemented. Preserve all five user recommendations and wait for explicit approval before Phase 3.
