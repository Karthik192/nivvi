# Phase 2 dependency compatibility record

Status: selected/installed versions checked; native debug APK built, installed and rendered on Android Emulator. Original Rive animation acceptance remains gated on a real asset.

Checked official Expo SDK reference, Router/manual setup, Reanimated, Gesture Handler, Jest and Rive runtime documentation on 9 November 2026. Queried npm metadata before installing. Node available: 22.14.0, npm 10.9.2.

- Selected stable Expo 58.0.23 (SDK 58). Official SDK matrix pairs SDK 58 with React Native 0.88 and React 19.3; Expo package engine accepts Node ^22.13.0. Runtime peers and exact patch versions will be selected through Expo installation tooling and recorded from the lockfile.
- Current Rive 0.5.12 requires Nitro >=0.35.10 and <0.37. Nitro latest 0.37.2 is incompatible. Select 0.36.5, within Rive's range and above the documented 0.36.2 minimum for React Native 0.87+.
- No `.riv` file has been authored or supplied. Native rendering/bindings cannot be accepted using a placeholder. Install/check the runtime boundary, retain original static art and report the original-asset gate honestly.
- Styling uses React Native StyleSheet and existing JSON tokens. No NativeWind compiler dependency. Do not implement repository/outbox/SQLite/sync infrastructure in Phase 2.
- Existing Node satisfies selected Expo tooling without upgrading global Node. Existing Android Studio, JBR and SDK were used; no replacement installation was needed.

## Installed matrix

Exact full inventory: [installed versions](review/phase2/installed-versions.json). npm lockfile is the reproducibility source; no forced peer-dependency resolution was used.

| Area | Installed / observed |
| --- | --- |
| Expo / React Native / React | 58.0.23 / 0.88.1 / 19.3.0 |
| Router / development client | 58.0.30 / 58.0.18 |
| Reanimated / Worklets / Gesture Handler | 4.7.1 / 0.13.0 / 3.3.0 |
| Rive / Nitro | 0.5.12 / 0.36.5; native Rive Android SDK 11.16.0 configured; no authored `.riv` rendered |
| SVG / Safe Area / Screens | 15.16.0 / 5.11.1 / 4.30.1 |
| Font / Manrope / Zustand | expo-font 58.0.11 / font package 0.4.3 / 5.1.0 |
| TypeScript / config loader | 6.0.3 / tsx 4.23.15 |
| Jest / jest-expo | 30.5.2 / 58.0.14 |
| ESLint / TypeScript ESLint / React hooks | 10.14.0 / 8.72.2 / 7.1.1 |
| Prettier | 3.9.10 |
| Android tools | Android Studio JBR 21.0.10, Gradle 9.4.1; RN build plugin provisions JDK 17 toolchain |
| Windows native build tool | CMake 4.1.2 / Ninja 1.12.1, selected in project-local Gradle user properties; OS long paths already enabled |
| Android native configuration | min API 24, compile API 37, target API 36, NDK 27.1.12297006, Kotlin plugin 2.2.10 |
| Emulator | existing Pixel_7 AVD, Android 14/API 34, x86_64; debug app built, installed and rendered |

### Decisions found during installation

Npm initially installed React 19.3.1 for broad peer ranges as well as the workspace's SDK-selected 19.3.0. The root override constrains React and React DOM to 19.3.0, which satisfies the installed peer ranges. Duplicate React would risk invalid hooks and mismatched renderer state; Expo Doctor now passes the duplicate-native-dependency check.

The initially considered Expo ESLint config pulls React/import plugins whose peer ranges stop at ESLint 9; npm marks that ESLint line deprecated. Rather than force those plugins onto ESLint 10 or suppress peer errors, the project uses a small flat configuration with checked ESLint 10, TypeScript ESLint (supports TS <6.1 and ESLint 10), and React hooks (declares ESLint 10 support). This changes lint tooling only, not the application architecture.

Expo config's TypeScript loader does not automatically resolve nested TypeScript validators under this Node setup. `tsx/cjs` is registered explicitly before importing the validator, as an isolated dev-tool dependency; environment rules remain shared/tested rather than duplicated inline.

The existing Android installation is on this workstation's `D:\Program Files\Android\Android Studio` with SDK under `%LOCALAPPDATA%\Android\Sdk`. The build uses a project-local Gradle cache and provisions missing versioned SDK components through the SDK's existing accepted licences. No replacement SDK/Studio installation or global Node upgrade was needed.

## Checks and unresolved tooling issues

- `expo install --check`: dependencies up to date for SDK 58.
- Expo Doctor: 19/20, remaining config/native-folder warning because this workspace has no Git metadata for ignored generated folders. Regenerate native configuration through prebuild; do not claim this check passed or disable it globally.
- TypeScript, ESLint, six Jest tests, formatting and existing design contrast checks pass.
- Android/Hermes bundle export and web static export pass; separate APK build/install/render evidence is recorded in PHASE_2_REVIEW.md.
- [Dependency audit](review/phase2/dependency-audit.json): 33 findings (1 low, 32 moderate, 0 high/critical) as currently reported. Root advisories involve deepmerge, glob and minimatch in transitive toolchain paths. This is not a clean security audit or a completed runtime reachability review. No automatic forced downgrade to obsolete Expo/Jest versions was applied. Track compatible upstream fixes and re-audit before release.
- Generated native builds emit upstream AGP legacy-DSL and version-catalog warnings. Do not patch node_modules/generated Gradle files to silence them; retain the SDK-compatible toolchain and revisit on supported upgrades.

The first APK build failed at app C++ codegen because default CMake 3.22.1 bundles Ninja 1.10.2, which rejects paths over 260 characters. Verified Windows `LongPathsEnabled=1`; existing SDK CMake 4.1.2 includes Ninja 1.12.1. Selected it in `.local/gradle/gradle.properties` rather than patching dependencies, moving the repository or changing global registry settings. The source template is `scripts/gradle-windows.properties.example`. [Expo documents this host-tool issue and the SDK 57+ `android.cmakeVersion` property](https://docs.expo.dev/troubleshooting/windows-long-paths/). A requested optional generated-cache cleanup was blocked by automatic review; it was not performed. The non-destructive rebuild succeeded in 7m30s (537 tasks), and the debug APK installed and ran on the emulator.

Metro also required excluding the workspace-local Gradle cache from crawling/watching. The exclusion preserves Expo defaults and their regex flags; mixing an added case-insensitive pattern with Expo's patterns fails export. A fresh Android export verifies the resulting configuration. Generated `expo-env.d.ts` is ignored by Git and formatting because Expo owns and rewrites it.

Resume verification: native debug rebuild passed in 7m26s (537 tasks), installed and tested on the API 34 emulator. Generated dependency Android build/CMake/Gradle output folders are also excluded from Metro scans. The `fontScale` config plugin preserves existing manifest flags and was checked for idempotence. Live font size changes now retain one Router root; the tab bar uses measured label heights to avoid clipping when JavaScript font-scale metrics lag native layout. The native smoke check verifies enlargement, bar growth, shrinkage, retained progress and absence of current-process runtime errors. The final Android export includes the resulting tab-layout source. No new library dependency was needed.

Sources: [Expo SDK matrix](https://docs.expo.dev/versions/latest/), [Expo Router](https://docs.expo.dev/router/installation/), [Expo monorepos](https://docs.expo.dev/guides/monorepos/), [Reanimated](https://docs.expo.dev/versions/latest/sdk/reanimated/), [Gesture Handler](https://docs.expo.dev/versions/latest/sdk/gesture-handler/), [Rive requirements](https://rive.app/docs/runtimes/react-native/react-native), [Expo Jest setup](https://docs.expo.dev/develop/unit-testing/).
