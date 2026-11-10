# Personal finance tracker — architecture proposal

Status: Phases 0–2 approved; Phase 3 interactive frontend explicitly authorized. Updated: 10 November 2026.
The native application now has a development-only in-memory product preview. No real authentication, backend, durable ledger or sync is implemented. See [Phase 3 review](PHASE_3_REVIEW.md), [mobile setup](MOBILE_FOUNDATION.md) and [compatibility record](DEPENDENCY_COMPATIBILITY.md).

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

| Concern | Owner |
| --- | --- |
| Financial records after Phase 6 | SQLite local working copy; server canonical cross-device state |
| Network requests and derived view caching | TanStack Query, account-scoped keys, invalidated after repository changes |
| Ephemeral UI, theme preference, modal state | Zustand; no ledger or token duplication |
| Form draft | Feature form state, persisted drafts where loss would harm the user |
| Refresh credential | Expo SecureStore only |
| Native widget staging | Private Android inbox, no credentials |

Business rules live in pure shared domain functions or backend services, never screen components. Share DTO validation with Zod; transport DTOs must not expose Prisma models. Server authorization and database checks remain mandatory even for shared validated input. Avoid separate `types` and `validation` packages that duplicate the same schemas.

## 3. Proposed repository structure

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
      modules/                   # route -> validation -> service -> persistence
      middleware/                # auth, errors, rate limits, request IDs
      config/                    # validated environment
      jobs/                      # durable email and notification work
    prisma/                      # schema, SQL constraints, migrations, default-category seed
    tests/                       # service, HTTP, isolation and sync integration tests
packages/
  contracts/                     # Zod request/response schemas and inferred DTOs
  domain/                        # money, reporting boundaries, budget/refund rules
  tooling/                       # shared lint/TypeScript config when actually needed
infrastructure/                  # local PostgreSQL and later deployment/backup configuration
docs/
CLAUDE.md
```

Create directories only when used. Reserve `apps/web` conceptually; do not scaffold it now. Keep native widget source in the local Expo module and config plugin rather than making fragile edits that prebuild can erase. Never put backend secrets or Prisma imports in mobile/shared bundles.

## 4. Authentication and privacy

Use email/password, Argon2id password hashing, short-lived signed JWT access tokens (proposed 10 minutes) and cryptographically random opaque refresh tokens. Store only refresh-token hashes on the server; model installation-specific token families. Proposed refresh lifetime: 30-day absolute family expiry, with rotation on every use. Validate issuer, audience, signature, algorithm allowlist, expiry and active session/user status. The database session check permits immediate logout/reset revocation; avoid a premature distributed session cache.

Refresh and reuse detection run in a database transaction. Reusing a consumed token revokes its family. The mobile API client serializes refresh requests; it must never blindly retry an ambiguous refresh response. If the rotated response is lost, require login while preserving pending local work. This is a deliberate security/usability trade-off rather than an unsafe reusable-token grace window.

Keep access tokens in memory, refresh credentials in SecureStore and financial data out of AsyncStorage, logs, crash breadcrumbs and analytics payloads. No token in a deep link. Generic login/reset messages, credential rate limits, bounded input and password hashing prevent common abuse. Reset links carry a single-use random credential, expire after 15 minutes and are exchanged over TLS; hash them in storage. Reset completion revokes all sessions atomically. Email delivery uses a durable database job and a provider chosen in Phase 4. Offer email verification without blocking ordinary tracking. In Phase 4, assess the actual risk of each sensitive action and the friction of verification; prefer targeted ownership confirmation or password reauthentication over a blanket verified-account gate. Confirm a new email address before replacing the current address.

All tenant queries derive ownership from the authenticated subject, never a submitted `userId`. Cross-user IDs return 404. Use composite foreign keys to prevent attaching another user's category, expense or goal. A constrained database role and isolation tests are required; PostgreSQL RLS is optional additional defence, not a substitute for application authorization.

TLS in transit; managed disk/backups encryption at rest. Propose SQLCipher for the local ledger using Expo SQLite's supported native configuration, with a per-installation key in SecureStore; verify backup exclusions, recovery and Android builds in Phase 6. This is not end-to-end encryption: the backend processes financial records. Local databases are account-isolated. Logout locks the store, clears credentials/query caches and removes widget summaries. If pending edits exist, offer sync first or an explicit discard choice; never silently lose edits. A revoked remote session prevents sync but does not magically erase an offline device; document that boundary. Account deletion needs an online confirmation, session revocation, local cleanup and documented backup retention.

## 5. Offline synchronisation protocol (implementation in Phase 6)

1. Every local financial mutation writes the entity, local revision and durable outbox entry in one SQLite transaction. Only then show saved feedback. Use client-generated UUIDs, positive integer paise, and an operation UUID. Never use client timestamps for ordering conflicts.
2. A single account-scoped worker pushes bounded operations in dependency order: category/goal before dependent transaction/contribution. Each carries `operationId`, `entityId`, operation kind, `baseVersion`, schema version and payload. Retries reuse the operation ID.
3. Server validates, authorizes and atomically checks the base version, mutates the row, appends its change event and stores the operation result. A database uniqueness constraint on `(userId, operationId)` prevents duplicate application, including contributions and refunds. Persist receipts for account lifetime initially; later compaction requires a safe client acknowledgement protocol.
4. Server assigns integer row versions. An update/delete against a stale version returns a conflict containing the canonical entity or deletion state. Preserve the local candidate separately and ask the user to keep server data or resubmit their candidate against the latest version. No silent last-write-wins for money. Aggregate constraints (such as concurrent refunds) are checked under locking even if row versions do not conflict.
5. Pull uses an opaque per-user cursor and a durable change log, not `updatedAt`. Serialize all ledger writes with a per-user database lock and increment a per-user change sequence within that transaction. This prevents a later committed sequence from hiding an earlier uncommitted write. Batches use a fixed high-water mark; repeated pages are safe.
6. Apply pulled rows, tombstones and cursor advancement together locally. Do not overwrite a dirty local candidate: update its server shadow and mark conflict. Only acknowledge an outgoing revision if it still matches the revision sent; an edit made while upload was in flight stays pending and is rebased on the acknowledged version.
7. Retry transient failures with bounded exponential backoff and jitter; respect `Retry-After`. Pause on authentication failure and surface validation failures. Foreground/resume, connectivity recovery and manual retry are reliable triggers. OS background work is best effort and must not be advertised as immediate or guaranteed.
8. A consistent bootstrap returns a bounded snapshot and matching cursor. Retain change events/tombstones for at least 180 days initially. Expired cursors return `410 SYNC_RESET_REQUIRED`; preserve outbox/conflict candidates and reconcile them against a fresh snapshot before replay. Deleted IDs cannot be reused; receipt retention prevents old offline operations from resurrecting data.

States: saved locally, syncing, synced, needs attention. Dashboard and history use the same repository projections, including pending transactions, so a network change cannot make a saved transaction disappear. Show freshness and pending counts for provisional analytics. Account changes stop workers before opening another account store. Do not assume TanStack Query persistence alone is a sync engine.

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

Glance renders a responsive monthly summary, data freshness label, privacy toggle, category shortcuts and add action. Standard widget surfaces are constrained; do not promise an embedded editable amount field. Amount input opens a small native Kotlin Activity with a numeric keyboard, category choice, validation and save. Launch the Activity directly from the widget action rather than through a background receiver trampoline. Expanded entry opens the guarded React Native form.

Native code must work when the JS process is stopped. On save, the Activity writes a private durable inbox record with stable operation/entity IDs, account generation and captured input; only after commit show saved-to-device feedback. A local Expo module imports it into SQLite and its outbox atomically, retaining a unique source ID so a crash before inbox acknowledgement cannot duplicate it. The native inbox does not share the SQLCipher database or store a refresh token; this avoids competing database migration/key owners. Use the same paise/range rules in Kotlin and TypeScript, verified by shared contract fixtures. Refresh the widget snapshot after import and sync.

Widget summary remains a labelled cached projection until JS reconciliation. Native save marks it pending rather than claiming a server-confirmed total. Queue import occurs on app launch/resume; no guaranteed sync while the app stays closed. If eventual autonomous native sync becomes a requirement, revisit this decision explicitly.

An account generation marker, checked under the native inbox lock, prevents logout/switch races. Logout invalidates the marker, clears snapshot and locks/clears staging only after the pending-work decision. Disable entry without a valid local account marker; the Activity applies device authentication before sensitive entry if the app is locked. External Activity inputs are untrusted; keep components non-exported unless explicitly required and use immutable, scoped PendingIntents. Do not show amounts on the launcher unless the user enables the summary. Test resize, reboot, force-stop, process death, repeat taps, time rollover and logout on emulator and real hardware.

## 9. Dependencies and compatibility gate

No packages are installed or version-pinned in Phase 0. At each phase's first dependency addition, record exact versions, official requirements, peer dependencies and a verified build in a compatibility matrix; commit the resulting lockfile only with authorization to commit. Choose a supported stable Expo SDK, its React/React Native pair and matching Router/Reanimated/Gesture Handler/Worklets packages using Expo's installation tooling and Doctor. Do not force incompatible peer dependencies or select a prerelease just because it is newer.

| Area | Proposal and verification |
| --- | --- |
| Workspace/runtime | npm workspaces; supported Node LTS common to chosen Expo tools and Prisma; pin after checking both |
| Mobile | Expo Router, Reanimated, Gesture Handler, TanStack Query, Zustand, Zod; verify native peers |
| Local storage/auth | expo-sqlite, expo-secure-store, network/background APIs compatible with selected SDK |
| Character | Current official Rive runtime and Nitro Modules; native development build, asset feature support spike |
| Backend | Express, Prisma, PostgreSQL, Zod, structured logger, JWT and Argon2 libraries; verify OS/native binaries and supported database/runtime |
| Native | Kotlin, JDK, Gradle, Android Gradle plugin, Glance and Compose versions aligned with Expo-generated Android project |
| QA | ESLint, Prettier, TypeScript, Jest/jest-expo and RN Testing Library; backend HTTP/PostgreSQL tests; Maestro candidate for device flows |
| Charts | Select after rendering/accessibility spike; prefer minimal SVG primitives if they meet required charts without a large renderer |

Use local Android Studio development builds from Phase 2; Expo Go is not the acceptance environment for custom native modules. Build hosting is optional and no deployment is authorized.

## 10. Operational and quality design

Central API client supplies request IDs, auth refresh, timeouts, cancellation and consistent errors. Structured server logs redact credentials and financial text; report route, status, latency and request ID. Central error middleware does not leak stack traces or SQL. Validate environment at startup and separate local, preview and production credentials. Mobile public environment values are visible to users; no server secret belongs there.

Use migrations, database constraints and transactional writes. Analytics aggregate indexed raw records initially, not independently writable totals. Durable email/alert jobs use a PostgreSQL outbox with retry and unique dedupe keys; no Redis requirement initially. Budget alerts are in-app and local notifications with consent; dedupe by budget period/threshold and mark offline results provisional.

Provisional performance targets to measure, not claims: durable local saves p95 under 200ms on the reference Android device; interactive motion at device refresh rate with a 60fps baseline; cold usable start under 3s on the agreed mid-range device; ordinary API requests p95 under 500ms excluding network. Choose datasets and devices before measuring. Document all device/emulator and production-build results.

Security and isolation tests begin in Phase 4 rather than waiting for Phase 9. Unit-test money/refunds/date boundaries, integration-test migrations/auth/ownership, and later test process death, conflicting offline edits, widget handoff and accessibility. Deployment requires restore drills, privacy/data retention review and explicit approval. No production-readiness or security-certification claim is made by this proposal.

## 11. Principal risks and decisions still pending

| Risk | Response / decision gate |
| --- | --- |
| Rapid native dependency changes | Exact compatibility/build proof in Phase 2; revisit before additions |
| Missing original Rive artwork | Asset specification in Phase 1; honest still placeholders, external authoring if needed |
| Financial inconsistency across devices | Integer paise, versions, idempotency, serialized per-user changes and explicit conflicts |
| Widget input/OS scheduling limits | Activity input plus durable native inbox; no instant-sync promise |
| Device key loss/backup | Exclude encrypted DB/key mismatches from automatic backup; server restore for synced data; disclose unsynced loss on uninstall |
| Refund and goal interpretation | Explicit ledger rules in DATABASE_DESIGN.md; approve before UI implementation |
| Offline scope creep | First release offline writes: transactions/refunds; cache budgets/goals/categories read-only offline |
| Privacy/release obligations | Review actual applicable Indian requirements and provider terms at release with qualified advice; no legal compliance claim |

Approval covers the Phase 0 defaults and architecture. Brand/name, exact dependency pins, email provider, hosting/region, retention policy and final art assets remain later explicit decisions. No unresolved selection blocks this documentation phase.

## Official sources checked for this proposal

- [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/): custom native development workflow.
- [Expo SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/): persistence and native configuration options.
- [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/): protected credential storage and lifecycle limitations.
- [Rive React Native](https://rive.app/docs/runtimes/react-native/react-native): recommended runtime and native peer requirements.
- [Glance](https://developer.android.com/develop/ui/compose/glance), [widget overview](https://developer.android.com/develop/ui/views/appwidgets/overview), [Glance actions](https://developer.android.com/develop/ui/compose/glance/user-interaction): widget capabilities and Activity navigation constraints.
- [Prisma requirements](https://www.prisma.io/docs/orm/reference/system-requirements): recheck version-specific runtime support at installation; versioned documentation matters.
- [OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html): Argon2id selection; benchmark parameters before release.
