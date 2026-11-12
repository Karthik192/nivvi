# Phase 10 — Build and deployment preparation

Status: local release preparation completed; production release is blocked and no deployment or publishing was performed.

## Changes

- Production app configuration now refuses a missing API base URL and still rejects non-HTTPS URLs.
- Added [RELEASE_RUNBOOK.md](RELEASE_RUNBOOK.md) with backend configuration, migration/restore, Android signing, installation QA, rollout and rollback steps.

The native `apps/mobile/android/` directory is Git-ignored, so a clean EAS build uses Continuous Native Generation (CNG) from the tracked `app.config.ts`; production package and scheme are configured there. Local edits under the ignored native directory are not part of this change. Expo documents that app config is the source of truth when native directories are ignored, and EAS injects managed signing credentials during Android builds. See [Expo app variants](https://docs.expo.dev/build-reference/variants/), [Expo Android build process](https://docs.expo.dev/build-reference/android-builds/) and [app credentials](https://docs.expo.dev/app-signing/app-credentials/).

## Validation

| Check | Result |
| --- | --- |
| Mobile Jest | Passed: 7 suites, 53 tests, including missing/insecure production API configuration. |
| Mobile TypeScript | Passed. |
| Mobile ESLint | Passed. |
| Prettier on changed TypeScript/EAS configuration | Passed. |
| Design invariants | Passed: 52 contrast pairs, theme parity, spacing/type/motion invariants and four local SVG assets. |
| `:app:assembleDebug -PreactNativeArchitectures=arm64-v8a` | Passed after restoring the Git-ignored native directory to its original development configuration. APK created at `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk` (109.3 MB). APK metadata reports `com.nivvi.app.dev`, version `0.1.0`, min SDK 24 and target SDK 36. This is a debug development build; it was not installed on a device. |
| Production Expo config | Passed with a temporary example HTTPS URL: resolved to app name `Nivvi`, package `com.nivvi.app`, scheme `nivvi`, and the supplied API base URL. The example URL was not saved to project configuration. |
| Production AAB build/install | Not run; signing, production API URL and EAS build credentials are not configured. |
| Backend deployment/database migration/backup restore | Not run. No host, production database, SMTP provider or backup target is selected. |

## Remaining release blockers

- Phase 9 is not release-accepted. Its moderate Expo dependency advisories, local encrypted-database recovery issue, real-device accessibility/performance and widget checks remain open.
- No production API domain, hosting provider/region, production secrets, SMTP service, managed database or EAS project/credentials have been configured.
- Account deletion currently queues a job without a worker to complete erasure.
- No backup/restore rehearsal, production migration rehearsal, signed AAB, installation/update test or internal distribution build exists.
- The debug APK is only a development artifact and must not be distributed as a release.

## Gate

Phase 10 preparation is documented, but a production release candidate is not available. Resolve the blockers, configure the actual production environment and EAS signing credentials, then produce reviewable signed artifacts and complete installation/restore rehearsals. No backend deploy, database mutation, EAS build upload or Play Store submission occurred. Publishing/deployment remains a separate explicit approval.
