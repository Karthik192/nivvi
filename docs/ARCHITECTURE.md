# Personal finance tracker — architecture and implementation boundaries

Phase 6 update: native transaction changes now commit to SQLCipher SQLite and an account-scoped outbox before a network attempt. A server bootstrap and sequenced change feed support catch-up; foreground, connectivity and best-effort background triggers run serialized sync. The app retains retry keys/bodies after ambiguous responses and exposes version conflicts for explicit resolution. Web remains online-only. See [Phase 6 review](PHASE_6_REVIEW.md) for tested coverage and remaining device-level limits.

Status: Phases 0–5 are complete; Phase 6 is implemented and under user review. Updated: 12 November 2026. Backend and mobile validation are recorded in [Phase 6 review](PHASE_6_REVIEW.md). SQLCipher native runtime behavior and offline lifecycle still require emulator/device verification; this is not production certification.

## 1. Product boundaries

Build an Android-first, India-first personal finance companion with original characters and premium, accessible light and dark interfaces. Manual expenses, income and refunds are the only transaction capture methods in release one. Recording UPI as a payment method does not connect to UPI. No bank credentials, SMS permissions, notification reading, payment initiation or Account Aggregator connection is required.

The first release covers authentication, transactions, categories, monthly budgets, savings goals, analytics, offline transactions and an Android widget. Web is a future client, not an initial deliverable. iOS portability is preserved; an iOS release requires separate build and device validation. Windows can support Android development, but local iOS builds require macOS.

Product defaults proposed for approval:

- INR only, `en-IN` formatting, Asia/Kolkata reporting timezone and Monday-start weeks. Store the user's IANA reporting timezone; changing it explicitly recomputes reporting boundaries.
- Account creation and first login require connectivity. An existing signed-in installation can record locally offline after Phase 6. No guest-account merge in release one.
- Savings goals are manually tracked earmarked money, not bank balances. Available budget means monthly limit minus net expenses, not money available in a bank account.
- Refunds offset spending on their refund date, not the original expense date. Net spending can be negative; progress visuals clamp their fill but retain the true numeric value.
- No debt ledger, recurring billing engine, transfers, foreign-exchange conversion or multi-account reconciliation in the first release.
- No shaming, punitive streaks or moral judgements about spending. Reactions celebrate tracking and user-defined progress; essential spending never triggers ridicule.

## 2. Architecture and trade-offs

Use a TypeScript monorepo with npm workspaces and one lockfile, an Expo React Native client and a modular Express REST service backed by PostgreSQL/Prisma. Prefer a modular monolith over microservices: transactions, budgets and sync need atomic writes; splitting services adds operational cost without a current scaling benefit. Defer Nx/Turborepo until build times justify them.

Use React Native StyleSheet with typed semantic tokens initially. It is a supported alternative to NativeWind, avoids another compiler compatibility surface and supports intentional themes. NativeWind can be reconsidered before Phase 2 if its checked Expo compatibility and team benefits justify it. No styling dependency is necessary for Phase 0.

```text
Mobile screens -> feature hooks -> application services -> repository interface
                                             |                |
                                      validated API client    SQLite (Phase 6)
                                             |                | outbox
                                             +---- sync ------+
                                                       |
Express routes -> auth + Zod -> domain services -> Prisma -> PostgreSQL
                                                       |
                                            change log + job outbox

Glance -> compact quick-entry Activity -> native inbox -> mobile repository
       <- private, versioned summary snapshot <- SQLite projections
```

Phase 3 uses an explicit mock repository. Phase 5 uses an online repository; success means the server has acknowledged the record, and failures preserve the draft. Phase 6 replaces that adapter with a SQLite-first repository and sync worker. The interface and mutation/version contracts are designed now; offline execution is not implemented early. Mock mode must never be enabled in production builds.

State ownership:

| Concern                                     | Owner                                                                     |
| ------------------------------------------- | ------------------------------------------------------------------------- |
| Financial records after Phase 6             | SQLite local working copy; server canonical cross-device state            |
| Network requests and derived view caching   | TanStack Query, account-scoped keys, invalidated after repository changes |
| Ephemeral UI, theme preference, modal state | Zustand; no ledger or token duplication                                   |
| Form draft                                  | Feature form state, persisted drafts where loss would harm the user       |
| Refresh credential                          | Expo SecureStore only                                                     |
| Native widget staging                       | Private Android inbox, no credentials                                     |

Business rules live in pure shared domain functions or backend services, never screen components. Share DTO validation with Zod; transport DTOs must not expose Prisma models. Server authorization and database checks remain mandatory even for shared validated input. Avoid separate `types` and `validation` packages that duplicate the same schemas.

## 3. Repository structure and reserved future directories

```text
apps/
  mobile/
    app/                         # Expo Router routes and layouts only
    src/
      features/                  # auth, dashboard, transactions, budgets, goals, analytics
      components/ui/             # accessible reusable primitives
      design/                    # semantic tokens, themes, motion
      services/                  # API client, auth lifecycle, repository adapters
      storage/                   # SQLite migrations, repositories, sync and outbox
      assets/                    # approved fonts, illustrations, .riv files and manifests
    modules/finance-widget/      # local Expo module: Kotlin widget, Activity, inbox bridge
    plugins/                     # reproducible native configuration
  backend/
    src/
      auth/                      # auth/profile routers, JWT/session checks, credential lifecycle
      core/                      # config, errors, HTTP, database/mutations, pagination, defaults, mail
      finance/                   # categories, transactions/refunds, budgets, goals/contributions
      analytics/                 # dashboard, reporting boundaries and aggregations
      generated/prisma/          # generated server-only Prisma client
      app.ts                     # HTTP assembly, security headers, rate limits, health routes
      server.ts                  # configured HTTP entry point
      mail-worker.ts             # account-mail job worker entry point
      openapi.ts                 # OpenAPI document assembly
    prisma/                      # schema, SQL constraints, migrations, default-category seed
    tests/                       # service, HTTP, isolation and sync integration tests
packages/
  contracts/                     # Zod request/response schemas and inferred DTOs
  domain/                        # future extraction when shared implementations are needed
  tooling/                       # future shared lint/TypeScript config when actually needed
infrastructure/                  # reserved for deployment/backup configuration
docs/
CLAUDE.md
```

Create directories only when used. Reserve `apps/web` conceptually; do not scaffold it now. Keep native widget source in the local Expo module and config plugin rather than making fragile edits that prebuild can erase. Never put backend secrets or Prisma imports in mobile/shared bundles.

## 4. Authentication and privacy

### Phase 4 backend implementation

Public auth routes mount at `/api/v1/auth`; protected profile, session, financial and analytics routes mount under `/api/v1`. Shared strict Zod schemas reject unknown writable fields and bound input. Registration creates the user, SyncState, 16 owned default categories with change events, an installation session, a refresh credential and verification mail job in one database transaction. Ordinary tracking does not require verified email. The session's installation ID is metadata, never an authentication credential.

Passwords use Argon2id with memory cost 19,456 KiB, time cost 2 and parallelism 1; registration/reset passwords are 12–128 characters. Login returns the same failure for unknown accounts, incorrect passwords and inactive users, and verifies a dummy Argon2id hash for an unknown account. This reduces a timing distinction but is not a constant-time account-enumeration guarantee. Forgot-password returns the same 202 response for present and absent accounts; queuing a job does not claim email delivery.

Access tokens use HS256 with a 600-second expiry, issuer and audience checks, required subject/session/expiry/issued-at claims and a fixed algorithm allowlist. Every protected request checks that the claimed session belongs to the subject, is unrevoked and within its family lifetime, and that the database user is ACTIVE. Profile/session responses select public fields and never expose password or credential hashes. Profile edits use `profileVersion`; stale versions return 409.

Refresh tokens are 32 cryptographically random bytes encoded as base64url; only their SHA-256 digests are stored as refresh credentials. Each installation session has an absolute 30-day family expiry, preserved across rotations. Refresh works without a valid access token. Refresh and logout acquire the user's SyncState row lock before the Session row lock; refresh then rereads the credential under the locks. Rotation consumes the old credential and creates a child atomically. Consumed hashes remain available for replay detection. Reusing a consumed credential revokes that family; the transaction commits the revocation before the route throws its HTTP error. Other families remain active. There is no reusable-token grace period.

Reset and email-verification credentials also contain 32 random bytes, are stored as SHA-256 digests in AccountToken and expire after 15 minutes. Issuing a replacement consumes earlier unconsumed tokens of the same purpose. Consumption checks purpose, expiry and one-use state under the per-user SyncState lock. Password reset updates the password and revokes every session in the same transaction, without implicitly logging in. Auth/profile writes recheck active user/session state under their locks; login also rechecks that the password hash verified before locking is still current. Logout-all requires an active session and password reauthentication. Deleting an owned session revokes only that family; a foreign session ID returns 404.

Account deletion requires an active session, password reauthentication and the exact confirmation `DELETE MY ACCOUNT`. Its transaction sets DELETION_PENDING, revokes sessions, consumes outstanding account tokens and queues ACCOUNT_DELETE. The mail worker processes account-email jobs only. No hard-purge worker, retention approval, backup erasure or device cleanup is implied by this endpoint.

Outside test mode, the app applies a 30-request/15-minute IP limit to auth routes, with a separate auth-router IP bound and a 10-request/15-minute account limit per auth action after validation. Account keys hash normalized email or the resolved user identity, so credential rotation, separate sessions, route casing and trailing-slash aliases do not create fresh account buckets. Protected reauthentication and resend actions use the authenticated user identity. Limit responses include Retry-After. These counters use process-local memory: process restarts or multiple server instances do not share limits. A reviewed shared limiter and proxy configuration are deployment work; the current app does not trust forwarded client-IP headers. Ordinary tests bypass limits; dedicated limiter tests construct a development-mode app against the same isolated test database.

Account mail is written as an AES-256-GCM encrypted Job payload in the transaction that creates its AccountToken. The worker checks that the corresponding token is unconsumed, unexpired and belongs to an ACTIVE user before attempting delivery; obsolete jobs are cancelled and redacted. Delivered jobs are redacted, while retries use bounded attempts/backoff. Failed encrypted payload retention still needs a policy. Links carry only the one-use account token in a URL fragment; refresh tokens never enter URLs. Fragment handling and safe exchange are future client work. Test-only helpers decrypt pending jobs; no HTTP route returns account tokens. Local file delivery is development/test tooling and writes plaintext mail artifacts on disk; it is not SMTP delivery and is disabled in production configuration. File permissions, cleanup and filesystem access controls require care on the actual operating system. SMTP transport exists, but no provider selection or successful real delivery is claimed here. Mail delivery is not guaranteed exactly once across worker crashes or lease expiry.

Tenant queries derive ownership from authentication, and composite foreign keys constrain links to categories, original expenses, budgets and goals. Financial writes use the shared mutation service, per-user serialization, versions, change events and idempotency receipts. Domain/constraint rejections roll back to a savepoint before their canonical outcome is stored; malformed requests rejected before execution do not consume an operation key. `mutate()` rechecks the active session under the SyncState lock before consulting receipts or executing a write, closing the middleware-to-mutation revocation race. A deterministic HTTP regression test pauses a request after authentication, commits logout and then attempts the mutation. PostgreSQL constraints, isolation and race behavior remain subject to the pending database suite. Least-privilege database roles, TLS termination, disk/backup encryption and restore procedures remain operational requirements, not verified deployment properties. PostgreSQL RLS is not implemented as an additional authorization layer.

### Future mobile, offline and deployment boundaries

Phase 4 does not connect the mobile preview to these routes. Phase 5 must implement an online API client, session restoration, access tokens in memory, refresh credentials in SecureStore, guarded routes and safe reset/verification link exchange. Keep financial data and credentials out of AsyncStorage, logs, crash breadcrumbs and analytics. No refresh credential may enter a deep link. Email-address replacement is not implemented; a future flow must confirm the replacement address before changing it. Browser cookie authentication and CSRF policy are not implemented.

The future client must serialize refresh requests and must not blindly retry an ambiguous refresh response. A lost rotated response requires login while preserving pending local work; otherwise retrying the consumed token revokes the family. Local logout cannot promise server revocation without connectivity. Server revocation rejects subsequent authenticated requests; it cannot erase an offline device or retract data already returned to a request in flight.

Phase 6 implementation uses SQLCipher with a random per-installation key in SecureStore and fails closed if the native cipher is absent. Transactions/refunds use SQLite-first writes; categories and transaction history bootstrap/pull locally. Budgets and goals remain online-only. The app preserves queued work across local logout and only pushes the matching authenticated owner. Remote logout cannot be guaranteed while offline. This is not end-to-end encryption: the backend processes financial records. Phase 7 adds the native widget and its durable private inbox. Emulator/device tests are required before claiming durable behavior after process death or restart.

## 5. Offline synchronisation protocol (Phase 6 implementation)

1. Native transaction create/edit/delete writes the projection and durable outbox entry in one SQLCipher SQLite transaction. Only then show saved feedback. Use client-generated UUIDs, positive integer paise, and an operation UUID. Never use client timestamps for ordering conflicts. Categories, budgets, goals and contributions are not offline writable in this phase.
2. A single account-scoped worker pushes bounded operations in dependency order: category/goal before dependent transaction/contribution. Each carries `operationId`, `entityId`, operation kind, `baseVersion`, schema version and payload. Retries reuse the operation ID.
3. Server validates, authorizes and atomically checks the base version, mutates the row, appends its change event and stores the operation result. A database uniqueness constraint on `(userId, operationId)` prevents duplicate application, including contributions and refunds. Persist receipts for account lifetime initially; later compaction requires a safe client acknowledgement protocol.
4. Server assigns integer row versions. An update/delete against a stale version returns a conflict containing the canonical entity or deletion state. Preserve the local candidate separately and ask the user to keep server data or resubmit their candidate against the latest version. No silent last-write-wins for money. Aggregate constraints (such as concurrent refunds) are checked under locking even if row versions do not conflict.
5. Pull uses an opaque per-user cursor and a durable change log, not `updatedAt`. Serialize all ledger writes with a per-user database lock and increment a per-user change sequence within that transaction. This prevents a later committed sequence from hiding an earlier uncommitted write. Batches use a fixed high-water mark; repeated pages are safe.
6. Apply pulled rows, tombstones and cursor advancement together locally. Do not overwrite a dirty local candidate: update its server shadow and mark conflict. Only acknowledge an outgoing revision if it still matches the revision sent; an edit made while upload was in flight stays pending and is rebased on the acknowledged version.
7. Retry transient failures with bounded exponential backoff and jitter; respect `Retry-After`. Pause on authentication failure and surface validation failures. Foreground/resume, connectivity recovery and manual retry are reliable triggers. OS background work is best effort and must not be advertised as immediate or guaranteed.
8. Bootstrap is capped at 100 transactions per page and uses a signed, owner-bound keyset cursor with a fixed sequence watermark. Pull is capped at 100 events and records a decimal-string sequence cursor. Change events currently have no pruning/expiry policy; therefore cursors do not expire. Add retention and a `410 SYNC_RESET_REQUIRED` reconciliation flow before introducing event pruning.

States: saved locally, synced, needs attention. Home, history and insights read local transaction projections while offline and label the source. Android background execution is deferred/best effort (minimum interval 15 minutes), never an immediate-save guarantee. Dashboard summaries and category/budget/goal values are not all cached offline yet. TanStack Query is not used as the durable outbox.

## 6. Navigation and mobile experience

Expo Router root layout handles splash, session restoration, fonts and theme. Route groups:

```text
/(onboarding)                 # first-launch introduction; skippable
/(auth)/login, register, forgot-password, reset-password, verify-email
/(app)/(tabs)/home, transactions, insights, goals
/(app)/transaction/new        # expense/income/refund form, modal presentation
/(app)/transaction/[id]       # detail and edit
/(app)/budgets, budgets/[id]
/(app)/categories
/(app)/goals/[id]
/(app)/profile, settings
```

A prominent add action opens expense entry with an income switch. Budgets are reachable directly from Home and Insights; profile is accessible from the main header. Validate deep-link parameters, enforce route session guards and preserve a safe return destination through login. Do not automatically submit incoming widget/deep-link data. Protect unsaved forms, support Android back behaviour, keyboard insets, screen readers, font scaling and at least 48dp Android tap targets. Validate at compact phone sizes, large fonts and TalkBack.

## 7. Animation and Rive boundary

Reanimated owns UI movement: press feedback, counters, progress, sheet gestures and chart transitions. Gesture Handler owns gesture recognition; prefer Router/native-stack transitions rather than overlapping animation systems. Financial totals commit independently of decorative motion. Cancel offscreen work, avoid per-frame JS updates and respect system reduced motion.

Rive owns bounded mascot regions only. Wrap the runtime in a `Mascot` component with semantic events such as `transactionSaved`, `goalMilestone` and `budgetNearLimit`; features never depend on artboard input names. Map approved asset bindings through a versioned manifest. Pause background/offscreen animations, limit simultaneous instances, use a static illustrated fallback on runtime/asset errors and a still pose under reduced motion. No actual `.riv` asset exists yet.

Phase 1 specifies artboards, states, data-binding contracts, licences, still exports and asset performance budgets with an animator. A soft-clay visual style may be drawn as efficient 2D/2.5D Rive artwork rather than assuming expensive real-time 3D. Current Rive documentation recommends `@rive-app/react-native` plus Nitro Modules rather than the legacy runtime. Confirm the exact Expo/React Native/Nitro/Rive combination in a native spike in Phase 2; minimum versions alone do not prove compatibility. Lottie remains optional for an identified advantage, not a second default mascot runtime.

## 8. Android widget

Phase 7 implementation status (12 November 2026): an initial Glance widget and local Expo module now provide a monthly spend snapshot, account/sync label and shortcuts that open the existing transaction form with amount/category prefilled. This is a deliberately smaller first slice than the native inbox/Activity flow described below. No direct widget save or durable native inbox is implemented. See [Phase 7 review](PHASE_7_REVIEW.md) for build evidence and remaining acceptance checks.

Glance renders a responsive monthly summary, data freshness label, privacy toggle, category shortcuts and add action. Standard widget surfaces are constrained; do not promise an embedded editable amount field. Amount input opens a small native Kotlin Activity with a numeric keyboard, category choice, validation and save. Launch the Activity directly from the widget action rather than through a background receiver trampoline. Expanded entry opens the guarded React Native form.

Native code must work when the JS process is stopped. On save, the Activity writes a private durable inbox record with stable operation/entity IDs, account generation and captured input; only after commit show saved-to-device feedback. A local Expo module imports it into SQLite and its outbox atomically, retaining a unique source ID so a crash before inbox acknowledgement cannot duplicate it. The native inbox does not share the SQLCipher database or store a refresh token; this avoids competing database migration/key owners. Use the same paise/range rules in Kotlin and TypeScript, verified by shared contract fixtures. Refresh the widget snapshot after import and sync.

Widget summary remains a labelled cached projection until JS reconciliation. Native save marks it pending rather than claiming a server-confirmed total. Queue import occurs on app launch/resume; no guaranteed sync while the app stays closed. If eventual autonomous native sync becomes a requirement, revisit this decision explicitly.

An account generation marker, checked under the native inbox lock, prevents logout/switch races. Logout invalidates the marker, clears snapshot and locks/clears staging only after the pending-work decision. Disable entry without a valid local account marker; the Activity applies device authentication before sensitive entry if the app is locked. External Activity inputs are untrusted; keep components non-exported unless explicitly required and use immutable, scoped PendingIntents. Do not show amounts on the launcher unless the user enables the summary. Test resize, reboot, force-stop, process death, repeat taps, time rollover and logout on emulator and real hardware.

## 9. Dependencies and compatibility gate

Phase 0 installed no packages; the current workspace manifests and lockfile now contain the Phase 3 mobile and Phase 4 backend dependencies. Backend pins include Express 5.3.0, Prisma/client/pg-adapter 7.10.1, Argon2 0.45.2 and jose 6.2.17. Installed packages and successful static checks do not establish PostgreSQL migration behavior, native-device compatibility or production suitability. At each phase's first dependency addition, record exact versions, official requirements, peer dependencies and build evidence in the compatibility matrix; commit the resulting lockfile only with authorization to commit. Choose Expo-compatible native dependencies using Expo's installation tooling and Doctor. Do not force incompatible peer dependencies or select a prerelease just because it is newer.

| Area               | Proposal and verification                                                                                                               |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Workspace/runtime  | npm workspaces; supported Node LTS common to chosen Expo tools and Prisma; pin after checking both                                      |
| Mobile             | Expo Router, Reanimated, Gesture Handler, TanStack Query, Zustand, Zod; verify native peers                                             |
| Local storage/auth | expo-sqlite, expo-secure-store, network/background APIs compatible with selected SDK                                                    |
| Character          | Current official Rive runtime and Nitro Modules; native development build, asset feature support spike                                  |
| Backend            | Express, Prisma, PostgreSQL, Zod, structured logger, JWT and Argon2 libraries; verify OS/native binaries and supported database/runtime |
| Native             | Kotlin, JDK, Gradle, Android Gradle plugin, Glance and Compose versions aligned with Expo-generated Android project                     |
| QA                 | ESLint, Prettier, TypeScript, Jest/jest-expo and RN Testing Library; backend HTTP/PostgreSQL tests; Maestro candidate for device flows  |
| Charts             | Select after rendering/accessibility spike; prefer minimal SVG primitives if they meet required charts without a large renderer         |

Use local Android Studio development builds from Phase 2; Expo Go is not the acceptance environment for custom native modules. Build hosting is optional and no deployment is authorized.

## 10. Operational and quality design

Central API client supplies request IDs, auth refresh, timeouts, cancellation and consistent errors. Structured server logs redact credentials and financial text; report route, status, latency and request ID. Central error middleware does not leak stack traces or SQL. Validate environment at startup and separate local, preview and production credentials. Mobile public environment values are visible to users; no server secret belongs there.

Use migrations, database constraints and transactional writes. Analytics aggregate indexed raw records initially, not independently writable totals. Durable email/alert jobs use a PostgreSQL outbox with retry and unique dedupe keys; no Redis requirement initially. Budget alerts are in-app and local notifications with consent; dedupe by budget period/threshold and mark offline results provisional.

Provisional performance targets to measure, not claims: durable local saves p95 under 200ms on the reference Android device; interactive motion at device refresh rate with a 60fps baseline; cold usable start under 3s on the agreed mid-range device; ordinary API requests p95 under 500ms excluding network. Choose datasets and devices before measuring. Document all device/emulator and production-build results.

Security and isolation tests begin in Phase 4 rather than waiting for Phase 9. Unit-test money/refunds/date boundaries, integration-test migrations/auth/ownership, and later test process death, conflicting offline edits, widget handoff and accessibility. Deployment requires restore drills, privacy/data retention review and explicit approval. No production-readiness or security-certification claim is made by this proposal.

## 11. Principal risks and decisions still pending

| Risk                                   | Response / decision gate                                                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Rapid native dependency changes        | Exact compatibility/build proof in Phase 2; revisit before additions                                                           |
| Missing original Rive artwork          | Asset specification in Phase 1; honest still placeholders, external authoring if needed                                        |
| Financial inconsistency across devices | Integer paise, versions, idempotency, serialized per-user changes and explicit conflicts                                       |
| Widget input/OS scheduling limits      | Activity input plus durable native inbox; no instant-sync promise                                                              |
| Device key loss/backup                 | Exclude encrypted DB/key mismatches from automatic backup; server restore for synced data; disclose unsynced loss on uninstall |
| Refund and goal interpretation         | Explicit ledger rules in DATABASE_DESIGN.md; approve before UI implementation                                                  |
| Offline scope creep                    | First release offline writes: transactions/refunds; cache budgets/goals/categories read-only offline                           |
| Privacy/release obligations            | Review actual applicable Indian requirements and provider terms at release with qualified advice; no legal compliance claim    |

Phase 0 defaults and architecture were approved, followed by the Phase 3 preview and Phase 4 backend implementation work. Current dependency pins are recorded in the workspace; they do not authorize deployment. Email provider, hosting/region, retention and purge policy, production operations and remaining native/art asset validation remain separate decisions. PostgreSQL integration verification is still pending.

## Official sources checked for this proposal

- [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/): custom native development workflow.
- [Expo SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/): persistence and native configuration options.
- [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/): protected credential storage and lifecycle limitations.
- [Rive React Native](https://rive.app/docs/runtimes/react-native/react-native): recommended runtime and native peer requirements.
- [Glance](https://developer.android.com/develop/ui/compose/glance), [widget overview](https://developer.android.com/develop/ui/views/appwidgets/overview), [Glance actions](https://developer.android.com/develop/ui/compose/glance/user-interaction): widget capabilities and Activity navigation constraints.
- [Prisma requirements](https://www.prisma.io/docs/orm/reference/system-requirements): recheck version-specific runtime support at installation; versioned documentation matters.
- [OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html): Argon2id selection; benchmark parameters before release.
