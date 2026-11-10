# Nivvi

An India-first personal finance companion, built one approved phase at a time. The current native application is a **Phase 3 interactive design preview** with sample entries, budgets and goals in memory. No real authentication, backend, durable transaction storage or synchronization is implemented. Use sample details; preview changes reset on restart.

## Workspace

New to the technology? Read the [illustrated beginner's guide (PDF)](output/pdf/Nivvi-Technology-Explained.pdf) for real app screens, diagrams, the complete direct mobile-library inventory and daily run instructions.

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
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:GRADLE_USER_HOME = "$PWD\.local\gradle"
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:Path"
npm run android
```

This creates a native development build, installs it and starts Metro. Expo Go is not the native acceptance environment. Initial Gradle/JDK/Maven downloads may take time. For an already installed development client, `npm run mobile` starts Metro without rebuilding. To connect an emulator explicitly, use `adb reverse tcp:8081 tcp:8081`; development credentials are not required.

On this Windows workstation, long paths are already enabled and SDK CMake 4.1.2/Ninja 1.12.1 is installed. `plugins/with-windows-cmake.cjs` writes `android.cmakeVersion=4.1.2` into the generated Android project on Windows, so command-line and Studio builds use it regardless of their Gradle cache location. Install CMake 4.1.2 through Android Studio's SDK Tools on other Windows machines before prebuild/build. Linux/macOS prebuilds keep Expo's default CMake selection. The older `scripts/gradle-windows.properties.example` remains an optional user-cache configuration. See [Expo's Windows path guidance](https://docs.expo.dev/troubleshooting/windows-long-paths/). No registry change was made by this project.

Native `android/ios` trees are generated and ignored. Reproduce native configuration through `app.config.ts` and future config plugins/local modules; rerun prebuild after native dependency/config changes. No existing hand-edited native source should be discarded. Do not commit a generated debug keystore.

## Run from Android Studio

IDE requirement: this React Native toolchain selects AGP 9.2.1. Use Android Studio Panda 4 (2025.3.4) or a newer stable version supporting AGP 9.2; the installed Panda 3 (2025.3.3) rejects sync above AGP 9.1.1. See [Google's compatibility table](https://developer.android.com/studio/releases#android_gradle_plugin_and_android_studio_compatibility). Update Studio rather than forcing a different AGP into the generated project or dependencies. Command-line APK builds passed independently of this IDE sync restriction.

Open `apps/mobile/android` as the Android Studio project, then wait for Gradle sync. Select the `app` run configuration and the Pixel_7 emulator, then click Run (Shift+F10). View the running emulator under View → Tool Windows → Running Devices. The JavaScript/TypeScript application source remains in `apps/mobile/app` and `apps/mobile/src`.

If Run opens **Development servers** instead of Home, that is Expo's launcher. Start Metro below, then select its development server. For a USB-connected phone, run `adb devices` and `adb -s YOUR_DEVICE_SERIAL reverse tcp:8081 tcp:8081`; replace the serial with the connected phone's ID. In the launcher's URL field enter `http://127.0.0.1:8081` and connect. Keep Metro running while reviewing the development build.

Once Nivvi opens, finish or skip the introduction. For the session-only preview, enter `preview@example.com` and sample password `Preview123`, then choose **Enter preview**. Home has Add Expense/Add Income and the History, Insights and Goals tabs. These details do not create a real account.

Keep Metro running in a separate terminal:

```powershell
cd D:\Projects\expense-tracker\apps\mobile
npx expo start --dev-client --localhost --port 8081 --max-workers 2
```

Studio may use its default Gradle cache or `.local/gradle`; the Windows CMake config plugin applies to either. A local, ignored `android/local.properties` points at the installed Android SDK. The 10 November Studio launch recovered an Expo startup `EventEmitter` error after restarting Metro with `--clear` and cold-launching the client; no application source or dependency change was required for that startup issue.

## Configuration

Copy `apps/mobile/.env.example` to `.env.local` only if local overrides are needed. `APP_VARIANT=development` is the default. `APP_VARIANT=production` changes application name, scheme and package ID. An optional production API URL must use HTTPS and must not contain credentials; there is no API integration yet. Expo public configuration is visible in the application and cannot contain secrets.

`eas.json` defines development/production profiles only. No EAS project, cloud build, signing, deployment or publishing has been performed. Production release work remains Phase 10 and requires approval.

## What to review

The native **Home**, **History**, **Insights** and **Goals** tabs share editable preview data. Expense/income/refund forms, categories, budgets, profile and settings are functional session previews. Enter through onboarding and the labelled sample auth forms. Production builds show a development-build notice and do not expose the preview routes or seed records. The original **Studio** and **Motion** screens remain in Profile → Preview tools. Theme/motion preferences are in-memory only. Static Nim is original project artwork; **no original `.riv` asset has been supplied or validated**. See [Phase 3 review](docs/PHASE_3_REVIEW.md), [mobile foundation](docs/MOBILE_FOUNDATION.md) and [compatibility](docs/DEPENDENCY_COMPATIBILITY.md).

The earlier four-screen browser mockups remain available through `node design/preview/server.mjs` and `http://127.0.0.1:4173/preview/screens.html`. They are design references for later feature implementation.

After Metro is ready on port 8081 and the development APK is installed, run `./scripts/android-phase3-smoke.ps1` for current native flows and captures. It temporarily sets system text to 200% and restores the previous setting. `-Section` supports focused reruns against an authenticated preview session. See [current native evidence](docs/review/phase3/README.md). The Phase 2 driver/evidence are historical for commit `1283f69`. TalkBack speech, original Rive animation and physical-device performance are still outstanding.

Phase 4 requires explicit approval. No deployment or publishing has been performed.
