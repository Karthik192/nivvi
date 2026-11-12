# Release preparation runbook

Status: preparation only. No production server, database, signing key or store account has been configured here. Nothing in this document has been deployed or published.

## Release blockers

- Resolve the five moderate Expo dependency advisories in [Phase 9 review](PHASE_9_REVIEW.md) against an Expo-compatible version set.
- Complete real-device Phase 8 performance/accessibility review and Phase 7 launcher/widget checks.
- Decide the safe recovery behavior for the existing encrypted local database read error before calling offline storage durable.
- Select a backend host, region, TLS domain, managed PostgreSQL plan, SMTP sender/provider, and secrets manager.
- Configure a production HTTPS `EXPO_PUBLIC_API_BASE_URL` in the Expo production build environment. Production app config now rejects a missing or non-HTTPS API URL.
- Configure an Android production upload key using EAS managed credentials or local Gradle properties. Keep all keystores and passwords out of Git.
- Define, implement and rehearse account deletion/retention processing. `DELETE /api/v1/me` currently queues a retention job but no worker completes erasure.
- Define backups, retention, restore objectives and perform a restore rehearsal in an isolated database.

## Backend production configuration

Set these values in the selected hosting provider's secret/configuration store. Do not commit a production `.env` file.

| Variable | Required value/handling |
| --- | --- |
| `NODE_ENV` | `production` |
| `HOST` / `PORT` | Bind to the hosting platform's required interface and port. The backend defaults to loopback, so container deployments must set the correct host explicitly. |
| `DATABASE_URL` | PostgreSQL URL for the restricted runtime role; TLS/database network access must be configured for the chosen host. |
| `DIRECT_DATABASE_URL` | Migration-owner connection, available only to the controlled migration job. |
| `ACCESS_TOKEN_SECRET` | Independently generated random secret, at least 32 characters; rotate with a planned session invalidation strategy. |
| `JOB_ENCRYPTION_KEY` | Independently generated 32-byte hex key. Back it up in the secrets manager; losing it makes queued encrypted mail payloads unreadable. |
| `MAIL_MODE` | `smtp` |
| `SMTP_URL` | Authenticated SMTP endpoint with TLS (`smtps://` or verified STARTTLS configuration). Test delivery and bounce behavior outside production first. |
| `MAIL_DIRECTORY` | Required nonempty path even in SMTP mode; use a private writable scratch location. |
| `MAIL_FROM` | Verified sender identity at the selected provider. |
| `PUBLIC_APP_URL` | The real HTTPS app/deep-link base URL, with working reset and email-verification routes. |

The reverse proxy must terminate TLS, limit request size, forward client addresses only through a deliberately configured trusted-proxy setup, and apply health checks. The current rate limiter uses in-process memory; production multi-instance deployments need a shared store and verified client-IP semantics before exposure. Monitor `/health/live`, `/health/ready`, error rates, rate-limit events, mail-job outcomes, database capacity and backups. Do not log credentials, finance payloads or reset links.

## Database migration and recovery

1. Provision a managed PostgreSQL instance with private network access, TLS, encrypted storage, a restricted app role and a separate migration owner. Do not run the runtime role as owner/superuser.
2. Configure automated encrypted backups and point-in-time recovery if offered. Restrict backup access separately from application access.
3. On a staging clone, restore a recent backup into a new isolated database and verify users, transaction/refund relationships, categories, budgets, goals, migrations and application startup.
4. Deploy additive/expand migrations using the migration owner through the controlled migration job (`npm run db:migrate --workspace @nivvi/backend` with production environment loaded in the job). Never run it from this workspace.
5. Deploy the backend and verify liveness/readiness and authenticated smoke flows against staging. Review schema compatibility before rolling back application code; there are no automatic Prisma down migrations.
6. Before production changes, take a verified backup. Prefer forward-fix migrations. Restore a backup only under an incident-specific recovery plan because restoring may discard newer financial writes.
7. Record backup timestamp, encryption/key reference, retention deadline and restore test result without placing secret values in the record.

No production migration, backup, restore or deployment was run for this phase.

## Android production build

The Android native directory is Git-ignored, so the tracked `app.config.ts` is the source of truth and EAS generates the native project using Continuous Native Generation. It sets a development identifier/scheme for development builds and `com.nivvi.app` / `nivvi` for production. Expo documents that app config is the source of truth when native directories are ignored and that EAS injects managed signing credentials during Android builds. See [Expo variant guidance](https://docs.expo.dev/build-reference/variants/) and [Android build/signing guidance](https://docs.expo.dev/build-reference/android-builds/).

Before a production build:

1. Resolve and configure the production API URL in the EAS production environment; it is public app configuration, not a secret.
2. Configure EAS-managed Android credentials (recommended) or secure local credentials through Expo's credential workflow. Never put keystores or credential values in this repository. Expo documents managed and local Android credentials in its [app signing guide](https://docs.expo.dev/app-signing/app-credentials/).
3. Increment and review `versionCode`/`versionName` for every Play release.
4. From `apps/mobile`, inspect `eas.json`, then run `eas build --platform android --profile production` only after Phase 9 blockers and environment values are approved. EAS uses the production app config and its default release bundle task. The cloud build may incur account usage and stores credentials with the chosen EAS credential mode; that command has not been run.
5. Verify the generated AAB's application ID, version, signing certificate, permissions, embedded API URL, R8 output and dependency scan. Retain a checksum and artifact provenance.
6. Install an internal test APK/AAB-derived APK on an emulator and real Android device. Test fresh install, update over prior version, login, expense save, offline queue, process death, widget, deep links, font scaling, TalkBack, backup exclusion and crash reporting.

The development APK is not a production candidate. It is debug-signed, contains the development client and is substantially larger than a release package.

## Rollout and rollback plan

- Start with internal QA distribution and a small controlled Play testing track; monitor crash-free sessions, API readiness, authentication, sync failures and mail processing before expanding.
- Keep backend and app artifacts, migration versions, checksums and release notes tied to one release record.
- For an application-only regression, roll back the backend image or publish a forward-fix app build if the schema remains compatible. Mobile downgrades may not be available through the store and should not be assumed.
- For a schema/data incident, stop writes if necessary, preserve logs and backups, assess newer writes, and follow a reviewed restore plan. Do not run a destructive rollback command by default.
- Store signing credentials and backup encryption keys under separate access policies, with documented rotation/recovery owners.

No canary, internal release, store upload or public rollout has been performed.
