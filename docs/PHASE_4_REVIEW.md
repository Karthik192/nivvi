# Phase 4 review — backend and database

Completed locally on **11 November 2026**, after the user approved continuation. Stop here for explicit Phase 5 approval. No mobile API integration, deployment, publishing or Phase 4 Git push was performed.

## Delivered

- An Express 5/TypeScript modular backend in `apps/backend`, strict shared Zod request contracts in `packages/contracts`, one npm lockfile and generated ESM Prisma client.
- PostgreSQL schema and versioned initial migration covering users, sessions, hashed refresh/account credentials, categories, transactions/refunds, monthly/category budgets, goals/contributions, mutation receipts, change events and durable jobs. SQL constraints and composite owner references supplement service checks.
- Registration, login, rotating refresh credentials with family revocation on replay, logout/session management, profile versions, one-use reset/verification tokens, password reauthentication for sensitive actions and pending account deletion. Registration atomically creates 16 owned categories. Email verification is optional for ordinary financial CRUD.
- Owned financial CRUD with integer-string paise, strict metadata, immutable transaction types, optimistic versions, UUID operation keys, canonical response replay, error receipts, soft deletion and bounded refund/allocation/contribution rules. Categories archive/restore to preserve references.
- Dashboard and grouped analytics with local-time month/Monday-week boundaries, exact SQL aggregates, dated refunds, zero/unset budgets, derived alerts and manually earmarked goal totals. Reports are bounded to 366 days; surplus is not a bank balance.
- Centralized errors, request IDs, redacted structured logging, security headers, body limits, account/IP throttling, validated configuration, OpenAPI 3.1, health endpoints and an encrypted account-mail worker with bounded retries/leases.
- A reusable Windows setup script that starts a localhost-only portable database cluster, separates development/test data and migration/runtime roles, and writes ignored random local credentials. No service, registry or global environment configuration was installed.

The backend follows the approved modular-monolith design. Prisma CLI/client/adapter are pinned together to stable 7.10.1 because the CLI's current `latest` tag selected an incompatible version 8 release candidate. No mobile dependency or screen was changed. See [compatibility](DEPENDENCY_COMPATIBILITY.md), [database design](DATABASE_DESIGN.md), [API inventory](API_DESIGN.md) and [backend operations](../apps/backend/README.md).

## Actual verification

| Check                                               | Observed result                                                                                                                   |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Official portable PostgreSQL                        | `postgres --version`: 18.6, localhost port 55432                                                                                  |
| Initial migration                                   | Applied successfully to `nivvi_development` and `nivvi_test` using the migration role                                             |
| Repeat setup/migration                              | Setup reused the cluster/state; both migration reruns reported no pending migrations                                              |
| `npm test --workspace @nivvi/backend`               | **63 passed, 0 failed/skipped**, real PostgreSQL; first complete run approximately 17.1 seconds                                   |
| `npm test --workspace @nivvi/mobile -- --runInBand` | **37 passed** across four suites                                                                                                  |
| `npm run build --workspace @nivvi/backend`          | Pass; compiled ESM output                                                                                                         |
| `npm run typecheck`                                 | Pass across backend, mobile and contracts                                                                                         |
| `npm run lint`                                      | Pass across all workspaces                                                                                                        |
| `npm run format:check`                              | Pass after formatting corrections                                                                                                 |
| `npm run design:verify`                             | Pass: 52 contrast pairs and existing theme/type/motion/SVG invariants                                                             |
| Compiled server smoke                               | `npm run start --workspace @nivvi/backend` started on port 3000; live/ready returned `ok`/`ready`, OpenAPI returned version 3.1.0 |
| Dependency audit                                    | 33 existing workspace advisories: 1 low, 32 moderate, 0 high/critical; no forced audit fix                                        |

The final root `npm test` also passed all **63 backend + 37 mobile tests** after tightening the test-environment guard. `prisma validate` passed after schema formatting. Backend type checking and linting were rerun successfully after that guard change.

Tests exercise actual HTTP routes and PostgreSQL constraints, rather than mocked database behavior. Coverage includes cross-user record/filter/child isolation; JWT claims/expiry/live sessions; refresh reuse and concurrent refresh/reset/logout; one-use account tokens; password reset revocation; strict inputs; SQL ownership/money/month checks; canonical idempotency success/failure replay; concurrent edit/refund/allocation caps; tombstones/cascades; archived references; exact totals above JavaScript's safe integer; timezone/DST boundaries; budget and goal semantics; and OpenAPI contracts. Test helpers reject non-test database names and SMTP delivery. Fixtures accumulate only in the dedicated test database; no production/user ledger was seeded or reset.

Review fixed malformed-money validation throwing, a route-alias bypass of account throttling, saves authenticated before session revocation, and final mail leases that could otherwise remain stranded. Goal-list totals use one bounded grouped query rather than one query per goal. All affected behavior is covered by the backend checks above.

## Remaining limits and acceptance decisions

- **Mobile remains the Phase 3 preview.** Actual account screens, secure native token storage, live API state/error handling and real ledger UI verification belong to Phase 5. Do not enter real financial information into the in-memory preview expecting persistence.
- **Mail uses local files in this environment.** They explicitly say `LOCAL_FILE_ONLY_NOT_SENT`; actual SMTP/provider/inbox delivery is unverified. Generated reset/verify link handling needs frontend integration. Encrypted database jobs are redacted after completion/cancellation, but local mail artifacts and private setup state require workstation protection/retention. Delivery can repeat after a crash; deterministic message IDs do not guarantee exactly-once SMTP.
- **Deletion is pending, not erased.** The route revokes access and queues `ACCOUNT_DELETE`. No purge worker exists until retention/backup policy is approved.
- **Budget alerts are derived response data.** No push/email budget-notification service or `AlertDelivery` writer is claimed.
- **Throttles are process-local and proxy trust is false.** Shared quotas, explicit proxy topology/TLS, hosting, secrets rotation, mail scheduling, backup/restore and operational monitoring need deployment work. No production infrastructure is configured.
- **Offline and widget work remain deferred.** Versions/receipts/events are the approved backend groundwork, not SQLite, mobile outbox, bootstrap/push/pull or widget infrastructure. Offset list cursors are signed and bounded but are not frozen snapshots or sync cursors.
- **Security/scale testing remains broader than this phase.** There is no certification, completed penetration/load test, production backup recovery or runtime advisory reachability claim. PostgreSQL ownership FKs supplement explicit API scoping; no RLS policy or database cross-row aggregate triggers are implemented. All writers must use the guarded service boundary.
- Original Rive `.riv` assets, TalkBack speech/focus acceptance and real mid-range launch/frame measurements remain the earlier mobile gates. Phase 4 did not change or retest native UI behavior.

## Next approval

Approve **Phase 5 — frontend/backend integration** to replace preview authentication/records with live API behavior, secure token storage, preserved drafts and real-database device flows. Do not begin it automatically.
