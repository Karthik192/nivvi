# Nivvi

An India-first personal finance companion, built one approved phase at a time. **Phase 5 connects the mobile app to real authentication and PostgreSQL-backed financial APIs.** Manual entries save after server confirmation. Offline persistence/synchronization remain Phase 6; current drafts are not durable across app termination. The original sample preview remains an explicit development mode.

See [Phase 5 review](docs/PHASE_5_REVIEW.md) for actual checks, remaining acceptance gates and the next approval boundary.

## Workspace

New to the technology? Read the [illustrated beginner's guide (PDF)](output/pdf/Nivvi-Technology-Explained.pdf) for the earlier Phase 3 screens and technology introduction. That PDF predates live integration; use this README and the Phase 5 review for current run/authentication instructions.

- `apps/mobile`: Expo Router, React Native/TypeScript, semantic token styling, bundled Manrope, Reanimated, Gesture Handler and a guarded Rive adapter/static Nim fallback.
- `apps/backend`: Express REST API, Prisma migrations, PostgreSQL, authentication, financial records and analytics.
- `packages/contracts`: strict Zod API request schemas and inferred types; no database or secrets imported into mobile.
- `design`: original Phase 1 tokens, vector studies and browser mockups; the native app imports the same tokens.
- `docs`: architecture, API/database proposals, design system, compatibility record and phase reviews.

## Install and validate

Use a Node version satisfying `package.json` (tested with 22.14.0), npm and an Android SDK/JDK setup compatible with the selected Expo SDK.

```powershell
npm ci
npm run db:generate --workspace @nivvi/backend
npm run typecheck
npm run lint
npm test
npm run format:check
npm run design:verify
```

One root lockfile controls the workspace. React/React DOM overrides enforce the Expo SDK pair across peer dependencies. Do not use `--legacy-peer-deps` or `npm audit fix --force` to hide compatibility issues.

Backend tests require the migrated local test database described below. `npm test --workspace @nivvi/mobile -- --runInBand` runs mobile tests independently.

## Run the backend locally

Install PostgreSQL or extract the official Windows PostgreSQL binaries locally. On this workstation, the portable binaries live under the ignored `.local/tools/postgresql/pgsql/bin`; they are not bundled in Git. Then run:

```powershell
./scripts/setup-backend-local.ps1
npm run db:migrate --workspace @nivvi/backend
npm run db:migrate:test --workspace @nivvi/backend
npm test --workspace @nivvi/backend
npm run dev --workspace @nivvi/backend
```

Pass `-PgBin 'C:\path\to\PostgreSQL\bin'` to the setup script for another installed location. It starts a localhost-only PostgreSQL cluster on port 55432, creates separate development/test databases with migration and runtime roles, and writes ignored environment files with random local credentials. Preserve `.local/backend` and never commit those files. It does not install a Windows service or change global configuration.

The API listens on `http://127.0.0.1:3000`; `/health/ready` checks the database and `/openapi.json` describes the routes. Local account mail is written to an ignored folder only when `npm run mail:work --workspace @nivvi/backend` processes a job; it is explicitly labelled **not sent**. SMTP-provider delivery has not been verified. Account deletion currently records a pending request and revokes access; it does not purge data. See [backend operations](apps/backend/README.md) and [Phase 4 review](docs/PHASE_4_REVIEW.md) for contracts and boundaries.

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

Start the backend with `npm run dev --workspace @nivvi/backend`, then start Metro. With a connected emulator/USB phone, run `adb -s YOUR_DEVICE_SERIAL reverse tcp:3000 tcp:3000` as well as the Metro 8081 reverse mapping. The development API defaults to `http://127.0.0.1:3000`; another host can be configured with `EXPO_PUBLIC_API_BASE_URL` before starting Metro. Use HTTPS for production.

Once Nivvi opens, finish or skip the introduction and **create an account** or sign in with an existing local backend account. Previous sample preview details do not create or authenticate a real account. Home has Add Expense/Add Income plus History, Insights and Goals. Saved entries persist in PostgreSQL. Keep both Metro and the backend running for this local development build.

Keep Metro running in a separate terminal:

```powershell
cd D:\Projects\expense-tracker\apps\mobile
npx expo start --dev-client --localhost --port 8081 --max-workers 2
```

Studio may use its default Gradle cache or `.local/gradle`; the Windows CMake config plugin applies to either. A local, ignored `android/local.properties` points at the installed Android SDK. The 10 November Studio launch recovered an Expo startup `EventEmitter` error after restarting Metro with `--clear` and cold-launching the client; no application source or dependency change was required for that startup issue.

## Configuration

Copy `apps/mobile/.env.example` to `.env.local` only if local overrides are needed. `APP_VARIANT=development` is the default. `APP_VARIANT=production` changes application name, scheme and package ID. An optional production API URL must use HTTPS and must not contain credentials; the mobile client now uses this URL for live requests. Expo public configuration is visible in the application and cannot contain secrets.

`eas.json` defines development/production profiles only. No EAS project, cloud build, signing, deployment or publishing has been performed. Production release work remains Phase 10 and requires approval.

## What to review

The native **Home**, **History**, **Insights** and **Goals** tabs use live account data by default. Forms await API confirmation, preserve their current draft on failure and protect against duplicate requests. History pages/filtering and financial summaries come from the server. Native refresh credentials use SecureStore; sessions can restore after process restart. No SQLite/offline save is claimed.

For the historical sample adapter, stop Metro, set `$env:EXPO_PUBLIC_DATA_MODE='preview'`, and restart it in a development build. This mode exposes Studio/Motion and simulated states under Preview tools; do not use real financial details there. Remove the variable and restart Metro to return to live mode. Production ignores the preview selection. Static Nim remains the original fallback; no original `.riv` asset has been supplied or validated. Theme/motion preferences currently remain local UI preferences.

`./scripts/android-phase5-smoke.ps1` exercises live native flows; see its `-Section` options. It writes synthetic test account credentials only to ignored `.local/phase5-account.json` and captures to `docs/review/phase5`. Historical Phase 3 drivers use old preview labels and are not a current live acceptance suite.

The earlier four-screen browser mockups remain available through `node design/preview/server.mjs` and `http://127.0.0.1:4173/preview/screens.html`. They are design references for later feature implementation.

After Metro is ready on port 8081 and the development APK is installed, run `./scripts/android-phase3-smoke.ps1` for current native flows and captures. It temporarily sets system text to 200% and restores the previous setting. `-Section` supports focused reruns against an authenticated preview session. See [current native evidence](docs/review/phase3/README.md). The Phase 2 driver/evidence are historical for commit `1283f69`. TalkBack speech, original Rive animation and physical-device performance are still outstanding.

Phase 5 was authorized by the user's continuation. Stop for explicit approval before Phase 6 offline functionality. No deployment or publishing has been performed.
