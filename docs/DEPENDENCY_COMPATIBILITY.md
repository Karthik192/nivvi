# Dependency compatibility record

## Phase 6 offline dependencies — 12 November 2026

Expo was updated to SDK `58.0.24`; `npx expo install --check` now passes with all SDK-owned modules at their expected compatible versions. Added `expo-sqlite ~58.0.16`, `expo-background-task ~58.0.13`, `expo-network ~58.0.5` and `expo-task-manager ~58.0.14`, selected by `npx expo install`. SQLCipher is enabled through the Expo SQLite config plugin; native startup checks `PRAGMA cipher_version` before permitting offline storage. Background Task uses the SDK 58 API and a 15-minute minimum interval, subject to OS scheduling. Expo SDK documentation was checked before installation; no forced peer resolution or React Native upgrade was used.

The Windows native plugin selects already-installed CMake 4.1.2/Ninja 1.12.1 to avoid Ninja's prior 260-character path failure. CMake 4 rejects Expo SQLite's legacy 3.4.1 minimum by default, so its external build receives `CMAKE_POLICY_VERSION_MINIMUM=3.5`. The plugin also overrides React Native's AGP catalog to 9.1.1 for the installed Android Studio's supported range. A clean Expo prebuild and full debug APK build are used to verify these generated settings; the Android generated tree remains ignored.

Sources: [Expo SQLite SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/sqlite/), [Expo BackgroundTask SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/background-task/), [Expo Network SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/network/), [Gradle version catalog override](https://docs.gradle.org/current/userguide/version_catalogs.html).
## Phase 5 mobile integration — 11 November 2026

Added exact pins `@tanstack/react-query` **5.107.1**, `expo-secure-store` **58.0.2** and `expo-crypto` **58.0.7**, plus the local `@nivvi/contracts` workspace. The earlier Expo 58.0.23 SDK's bundled-native-module map selects the SecureStore/Crypto 58 lines; both declare Expo peers, and TanStack Query declares React 18/19 support, covering the installed React 19.3.0. No forced peer resolution or Expo/React Native upgrade was used. The SecureStore config plugin is committed in app configuration; generated native trees remain ignored.

The Android x86_64 development build with these native modules passed in 6m33s (775 tasks) and installed on the API 34 emulator. Actual secure-session restoration and live flow results belong in PHASE_5_REVIEW.md. Hermes exposed that this runtime's Intl number formatter rejects BigInt even though JavaScript arithmetic supports it; exact INR report formatting now groups integer strings directly, without a floating-point conversion or another dependency.

Metro reports that newer Expo 58 patch packages are available. Those are an upgrade follow-up, not a reason to force unrelated package changes during integration. The exact installed lockfile and native validation define this phase's tested combination. The existing 33 advisory inventory remains open; production dependency/reachability review is still required.

Sources checked before installing: [TanStack Query React Native guidance](https://tanstack.com/query/latest/docs/framework/react/react-native), [Expo SDK 58 SecureStore](https://docs.expo.dev/versions/v58.0.0/sdk/securestore/), [Expo Crypto](https://docs.expo.dev/versions/latest/sdk/crypto/), installed SDK bundled-native-module metadata and npm package peer metadata.

## Phase 4 backend selection — 11 November 2026

Backend pins were checked against package engines and official documentation before installation. Node 22.14.0/npm 10.9.2 is the verified workstation pair. Mobile packages and native configuration were not changed.

| Area                                     | Exact selected versions                                      |
| ---------------------------------------- | ------------------------------------------------------------ |
| HTTP / validation                        | Express 5.3.0 / Zod 4.6.7                                    |
| Prisma CLI / client / PostgreSQL adapter | 7.10.1 / 7.10.1 / 7.10.1                                     |
| PostgreSQL / driver                      | Official EDB Windows PostgreSQL 18.6 binaries / pg 8.23.1    |
| Passwords / JWT                          | argon2 0.45.2 / jose 6.2.17                                  |
| HTTP protections                         | helmet 8.3.0 / express-rate-limit 8.7.4                      |
| Logs / mail / timezone                   | pino 10.4.0 / nodemailer 10.5.0 / luxon 3.7.2                |
| Test / TypeScript execution              | Node test runner, supertest 7.3.2 / tsx 4.23.15              |
| Type / lint tooling                      | TypeScript 6.0.3 / ESLint 10.14.0 / typescript-eslint 8.72.2 |

The Prisma CLI's `latest` tag resolved to 8.0.0-rc.33 requiring Node 22.18+, while the selected stable client is 7.10.1. CLI, client and adapter are explicitly pinned to stable 7.10.1, whose engines include Node 22.12+. No forced peer resolution or Node upgrade was used. Prisma 7 uses `prisma.config.ts` for the migration URL, a generated ESM client and the pg driver adapter; the runtime URL uses a separate role from migrations. Generate the ignored client after `npm ci`.

The local server uses the official portable Windows archive linked through PostgreSQL/EDB, extracted under ignored `.local/tools`. These binaries are not committed, deployed or installed as a system service. Database integration results belong in PHASE_4_REVIEW.md; compatibility is not a production certification.

After adding backend dependencies, `npm audit --json` still reports **33 advisories: 1 low, 32 moderate, 0 high/critical** across the combined workspace. Existing transitive toolchain findings remain open; no forced audit fix was applied. The exact lockfile remains authoritative.

Sources: [Prisma 7 system requirements](https://www.prisma.io/docs/orm/v7/reference/system-requirements), [Prisma PostgreSQL support](https://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/postgresql), [PostgreSQL Windows distributions](https://www.postgresql.org/download/windows/), [EDB portable binaries](https://www.enterprisedb.com/download-postgresql-binaries). Package engine metadata was also checked through npm before installation.

## Earlier mobile validation

Windows Studio build follow-up (10 November 2026): Studio has been upgraded to 2026.2.2, resolving the AGP 9.2.1 IDE mismatch. Its default Gradle cache did not contain the CMake override used by prior command-line builds, exposing Ninja 1.10.2's 260-character path limit again. The new Windows-only `with-windows-cmake.cjs` config plugin selects the already installed SDK CMake 4.1.2/Ninja 1.12.1 in generated project properties. Other hosts keep Expo defaults; no dependency versions changed. Prebuild was run twice and retained one CMake property. Plugin regression tests cover both non-Windows hosts and repeat application while preserving unrelated Gradle properties. All 37 Jest tests, type checking, lint and formatting pass. ARM64 debug assembly passed with Studio's default Gradle cache in 9m24s (537 tasks); see [native build record](review/phase3/native-build-arm64-cmake.json). This fix did not install or run the ARM64 APK on a device.

Phase 3 follow-up (10 November 2026): no dependencies added or versions changed. Expo Doctor 1.21.6 passes 20/20 and `expo install --check` reports versions current for this SDK. The native debug APK rebuilt/installed in 7m22s (537 tasks); focused Android Back checks pass after returning `predictiveBackGestureEnabled` to Expo's default false. Final Android/Hermes and web exports pass. The existing advisory inventory below remains open; see PHASE_3_REVIEW.md for current native evidence and limitations.

Status: selected/installed versions checked; native debug APK built, installed and rendered on Android Emulator. Original Rive animation acceptance remains gated on a real asset.

Checked official Expo SDK reference, Router/manual setup, Reanimated, Gesture Handler, Jest and Rive runtime documentation on 9 November 2026. Queried npm metadata before installing. Node available: 22.14.0, npm 10.9.2.

- Selected stable Expo 58.0.23 (SDK 58). Official SDK matrix pairs SDK 58 with React Native 0.88 and React 19.3; Expo package engine accepts Node ^22.13.0. Runtime peers and exact patch versions will be selected through Expo installation tooling and recorded from the lockfile.
- Current Rive 0.5.12 requires Nitro >=0.35.10 and <0.37. Nitro latest 0.37.2 is incompatible. Select 0.36.5, within Rive's range and above the documented 0.36.2 minimum for React Native 0.87+.
- No `.riv` file has been authored or supplied. Native rendering/bindings cannot be accepted using a placeholder. Install/check the runtime boundary, retain original static art and report the original-asset gate honestly.
- Styling uses React Native StyleSheet and existing JSON tokens. No NativeWind compiler dependency. Do not implement repository/outbox/SQLite/sync infrastructure in Phase 2.
- Existing Node satisfies selected Expo tooling without upgrading global Node. Existing Android Studio, JBR and SDK were used; no replacement installation was needed.

## Installed matrix

Exact full inventory: [installed versions](review/phase2/installed-versions.json). npm lockfile is the reproducibility source; no forced peer-dependency resolution was used.

| Area                                     | Installed / observed                                                                                        |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Expo / React Native / React              | 58.0.23 / 0.88.1 / 19.3.0                                                                                   |
| Router / development client              | 58.0.30 / 58.0.18                                                                                           |
| Reanimated / Worklets / Gesture Handler  | 4.7.1 / 0.13.0 / 3.3.0                                                                                      |
| Rive / Nitro                             | 0.5.12 / 0.36.5; native Rive Android SDK 11.16.0 configured; no authored `.riv` rendered                    |
| SVG / Safe Area / Screens                | 15.16.0 / 5.11.1 / 4.30.1                                                                                   |
| Font / Manrope / Zustand                 | expo-font 58.0.11 / font package 0.4.3 / 5.1.0                                                              |
| TypeScript / config loader               | 6.0.3 / tsx 4.23.15                                                                                         |
| Jest / jest-expo                         | 30.5.2 / 58.0.14                                                                                            |
| ESLint / TypeScript ESLint / React hooks | 10.14.0 / 8.72.2 / 7.1.1                                                                                    |
| Prettier                                 | 3.9.10                                                                                                      |
| Android tools                            | Android Studio JBR 21.0.10, Gradle 9.4.1; RN build plugin provisions JDK 17 toolchain                       |
| Windows native build tool                | CMake 4.1.2 / Ninja 1.12.1, selected in project-local Gradle user properties; OS long paths already enabled |
| Android native configuration             | min API 24, compile API 37, target API 36, NDK 27.1.12297006, Kotlin plugin 2.2.10                          |
| Emulator                                 | existing Pixel_7 AVD, Android 14/API 34, x86_64; debug app built, installed and rendered                    |

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
