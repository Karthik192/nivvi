# Phase 5 — live mobile integration

Status: implementation and automated verification complete; Android flow review is partial. Phase 6 requires explicit approval. No deployment, release publishing, commit or push is part of this phase.

## Implementation

The mobile app defaults to the live Express/PostgreSQL API. Existing layouts and original Nim artwork are retained. Set `EXPO_PUBLIC_DATA_MODE=preview` in a development environment to review the original sample-data adapter explicitly; it is never selectable in production. Sample records are not seeded into a live account.

`apps/mobile/src/data` contains the platform-independent HTTP client, secure credential adapter, account-scoped TanStack Query cache, DTO mappings, small online projection store and live reporting screens. It does not implement SQLite, an offline queue, bootstrap/push/pull or background synchronization. Server acknowledgement is required before an entry is presented as saved. Drafts remain on the current screen after a rejected or disconnected save; they are not durable across process death in this phase.

Authentication uses real registration/login/forgot/reset/verification endpoints. Native refresh credentials are stored with Expo SecureStore; access credentials stay in memory. Browser development sessions are memory-only, without localStorage credentials. Concurrent 401s share one refresh operation. A failed/ambiguous refresh is not blindly replayed because server-side token rotation may already have consumed the old credential; the user signs in again. Ordinary CRUD does not require email verification. Verification/reset tokens can be entered on the account-action screen; local email still requires the backend file worker and is not inbox delivery.

Financial forms await API results and use shared Zod request contracts. Transactions, categories, budgets, goals and contributions carry server versions. Editor versions are captured when the draft opens, rather than silently adopting a background refresh's version. Exact repeated attempts retain their operation key after ambiguous transport failure. The transaction form also retains its client-generated entity ID. Confirmed saves update their local projection and invalidate the account's reports; a report refresh failure does not turn an acknowledged contribution into a failed save.

History uses server-side search/filter/sort and cursor pagination. Home and Insights use authoritative API totals and grouped reports, independently of loaded transaction pages. Financial values remain exact integer paise strings at the API boundary. Individual form amounts map to safe integers; large report totals use a string/BigInt Indian currency formatter that also works on Hermes. Numeric conversions for charts affect presentation ratios only.

## Backend integration changes

- `PUT /api/v1/budget-plans/:month` atomically creates/replaces a whole monthly plan. It validates the parent version plus the complete existing allocation ID/version set, owned expense categories, uniqueness and summed limits. It writes parent/allocations/events/receipt in one database transaction, preventing partially saved form submissions.
- `originalExpenseId` is an optional owned transaction-list filter used to retrieve complete linked refunds for a detail/editor, without relying on whichever history pages happen to be loaded.
- OpenAPI describes the new plan request, month parameter, idempotency and create/update responses. Existing CRUD routes remain available.

## Verification record

- Android x86_64 development APK built successfully in **6m33s** (775 Gradle tasks) with SecureStore/Crypto native modules and installed on the API 34 emulator. This is a development build, not a release build.
- Mobile Jest: **52 tests passed**. Root typecheck, ESLint, Prisma schema validation and the 52-pair design verification passed. Prettier checks passed for the changed implementation files.
- Backend: **66 PostgreSQL-backed tests passed**, including the real mobile HTTP transport, lost-response recovery, shared refresh rotation, budget-plan atomicity and allocation-version conflicts.
- Production web export completed for 28 static routes. `npm run production:verify` checks six product entry routes for preview fixtures; the static markup shows only the secure-session startup screen. This is not a deployed web build or an Android release check.
- Native API 34 smoke review confirmed a live expense draft survives an intentionally disconnected save, retry reaches the server and the resulting `₹125.50` transaction opens in details with the server-confirmed “Saved to your account” notice. The captured view also exposed stale preview-only supporting copy from the emulator's previously cached bundle. Clearing Metro's cache caused the dev client to lose its 8081 connection; full native edit/search/Insights/planning/restart review therefore remains incomplete. Do not treat that partial walkthrough as full native acceptance.

Native review previously found an auth/loading navigation transition that could replace the root navigator and a Hermes `Intl.NumberFormat(BigInt)` incompatibility. The navigator now stays mounted while metadata loads; currency grouping uses exact strings rather than the unsupported native Intl overload. ADB UI hierarchy automation became unreliable after overlapping dumps (`UiAutomationService ... already registered`), so no UI automation pass is claimed. Earlier interrupted registration attempts created synthetic accounts in the local development database; no database reset was used. Native test credentials live only in ignored `.local/phase5-account.json`.

## Boundaries carried forward

Actual SMTP-provider/inbox delivery, production reset-link hosting, production TLS/proxy/shared quotas, account erasure/retention and deployment remain unverified or deferred. Local file mail is explicitly marked not sent. Account deletion still queues a pending workflow rather than purging data. Android-only development execution does not establish iOS/release acceptance.

Original `.riv` assets and actual Rive states, TalkBack speech/focus acceptance, and measured launch/frame performance on a real mid-range phone remain outstanding mobile gates. No physical-device performance claim is made. Phase 6 must add durable local saves and reconciliation; this phase only preserves current in-memory drafts on request failure.

## Phase 5 decision requested

Review the implementation and limitations above. If accepted, explicitly approve Phase 6 (offline-first local persistence and synchronization). The incomplete native edit/search/analytics/planning/relaunch walkthrough is a known verification limitation to revisit before release.
