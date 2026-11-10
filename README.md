# Nivvi

An India-first personal finance companion, built one approved phase at a time. The current native application is a **Phase 2 foundation preview**, not a functioning financial ledger. No authentication, backend, transaction storage or synchronization is implemented.

## Workspace

- `apps/mobile`: Expo Router, React Native/TypeScript, semantic token styling, bundled Manrope, Reanimated, Gesture Handler and a guarded Rive adapter/static Nim fallback.
- `design`: original Phase 1 tokens, vector studies and browser mockups; the native app imports the same tokens.
- `docs`: architecture, API/database proposals, design system, compatibility record and phase reviews.

## Install and validate

Use a Node version satisfying `package.json` (tested with 22.14.0), npm and an Android SDK/JDK setup compatible with the selected Expo SDK.

```powershell
npm ci
npm run typecheck
npm run lint
npm test
npm run format:check
npm run design:verify
```

One root lockfile controls the workspace. React/React DOM overrides enforce the Expo SDK pair across peer dependencies. Do not use `--legacy-peer-deps` or `npm audit fix --force` to hide compatibility issues.

## Run Android

Start a virtual device in Android Studio's Device Manager. In PowerShell, set the SDK and JDK paths for your machine. The paths below are the inspected locations on this workstation; no global environment settings are changed by the project.

```powershell
$env:JAVA_HOME = 'D:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:GRADLE_USER_HOME = "$PWD\.local\gradle"
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:Path"
npm run android
```

This creates a native development build, installs it and starts Metro. Expo Go is not the native acceptance environment. Initial Gradle/JDK/Maven downloads may take time. For an already installed development client, `npm run mobile` starts Metro without rebuilding. To connect an emulator explicitly, use `adb reverse tcp:8081 tcp:8081`; development credentials are not required.

On this Windows workstation, long paths are already enabled and SDK CMake 4.1.2/Ninja 1.12.1 is installed. The project-local `.local/gradle/gradle.properties` selects `android.cmakeVersion=4.1.2`; preserve this setting when reusing this Gradle cache. For a fresh cache on the same setup, `scripts/gradle-windows.properties.example` is the template. Use an installed CMake with Ninja ≥1.12 on other Windows machines; do not impose this Windows-only choice on Linux/cloud builds. See [Expo's Windows path guidance](https://docs.expo.dev/troubleshooting/windows-long-paths/). No registry change was made by this project.

Native `android/ios` trees are generated and ignored. Reproduce native configuration through `app.config.ts` and future config plugins/local modules; rerun prebuild after native dependency/config changes. No existing hand-edited native source should be discarded. Do not commit a generated debug keystore.

## Configuration

Copy `apps/mobile/.env.example` to `.env.local` only if local overrides are needed. `APP_VARIANT=development` is the default. `APP_VARIANT=production` changes application name, scheme and package ID. An optional production API URL must use HTTPS and must not contain credentials; there is no API integration yet. Expo public configuration is visible in the application and cannot contain secrets.

`eas.json` defines development/production profiles only. No EAS project, cloud build, signing, deployment or publishing has been performed. Production release work remains Phase 10 and requires approval.

## What to review

The native **Studio**, **Motion** and **Settings** tabs demonstrate components, native progress/gesture behavior, intentional light/dark themes, reduced motion, system text scaling and an About modal. Theme/motion preferences are in-memory only. Static Nim is original project artwork; **no original `.riv` asset has been supplied or validated**. See [mobile foundation](docs/MOBILE_FOUNDATION.md), [compatibility](docs/DEPENDENCY_COMPATIBILITY.md) and [Phase 2 review](docs/PHASE_2_REVIEW.md).

The earlier four-screen browser mockups remain available through `node design/preview/server.mjs` and `http://127.0.0.1:4173/preview/screens.html`. They are design references for later feature implementation.

After Metro is ready on port 8081 and the development APK is installed, run `./scripts/android-smoke.ps1` for emulator navigation/theme/motion checks and captures. It temporarily sets Android system text to 200% and restores the previous setting. Native evidence is in [Phase 2 captures](docs/review/phase2/README.md); TalkBack speech, original Rive animation and physical-device performance are still outstanding.

Phase 3 requires explicit approval. No Git commits, pushes or publishing are implicit in this setup.
