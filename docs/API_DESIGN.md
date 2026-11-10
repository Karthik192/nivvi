# REST API proposal

Status: Phase 0 contract. Endpoints below are planned, not implemented.
Prefix `/api/v1`; JSON over TLS. Runtime schemas in `packages/contracts` will generate OpenAPI in Phase 4. Financial ownership always comes from bearer authentication.

## Transport conventions

- UUID entity/operation identifiers. Money: positive base-10 paise strings with currency INR; versions: positive integers; date-times: ISO 8601 with explicit offset; month: `YYYY-MM`; reporting timezone: IANA name.
- Success: `{ "data": ... }`. Lists additionally return `page: { nextCursor, hasMore }`. Errors: `{ "error": { "code", "message", "fieldErrors"? }, "requestId" }`; never return tokens, stack traces or raw SQL in errors.
- Default page size 25, maximum 100; deterministic sort with ID tie-breaker. Validate every query parameter, reject unknown writable fields and bound strings/request bodies. Invalid bodies cannot mass-assign owner/version/source metadata.
- Every financial create/edit/delete requires `Idempotency-Key` containing the operation UUID. Edits/deletes supply `baseVersion` (delete via required version query parameter). Server stores a request hash and canonical response atomically. Identical retry returns its original outcome; key reuse with different content returns `409 IDEMPOTENCY_KEY_REUSED`.
- Use 201 create, 200 reads/updates/idempotent deletes (delete returns tombstone), 400 malformed request, 401 expired/invalid authentication, 403 insufficient account privilege, 404 absent or foreign entity, 409 version/business conflict, 410 expired sync cursor, 422 semantic validation failure, 429 rate limit with Retry-After, 500 generic unexpected error. Client code uses machine codes, not translated message matching.
- Rate limits by route, account and IP; explicit auth/reset protections, bounded pagination/date spans and sync batches (initial cap 50). CORS is not mobile authentication. Future browser auth requires a separate reviewed cookie/CSRF policy.

## Authentication and profile

| Method | Route | Request / behaviour |
| --- | --- | --- |
| POST | /auth/register | email, password, displayName; atomic user/default categories, session, verification mail job; returns user and token pair |
| POST | /auth/login | email, password, installationId; generic failure; returns user/access token/refresh token/expiry |
| POST | /auth/refresh | refreshToken; atomic rotation; not protected by expired access token |
| POST | /auth/logout | valid refresh credential; revoke its family; local cleanup always available when offline |
| POST | /auth/logout-all | active session and password reauthentication; revoke all sessions |
| POST | /auth/password/forgot | email; generic 202 regardless of account presence; queue reset if eligible |
| POST | /auth/password/reset | resetToken, newPassword; consume once, revoke sessions; no implicit login |
| POST | /auth/email/verify | one-time verificationToken |
| POST | /auth/email/resend | active session; generic 202, rate limited |
| GET | /me | profile and preferences; never password or credential hashes |
| PATCH | /me | displayName, locale, theme, timezone with profile baseVersion; currency remains INR |
| GET | /me/sessions | owned installation sessions, no credentials |
| DELETE | /me/sessions/:id | revoke owned session |
| DELETE | /me | password reauthentication and explicit confirmation; revoke access, start deletion workflow |

Reset/email credentials are one-time high-entropy values, hashed server-side. No refresh token in a URL or analytics event. Logout offline cannot promise immediate server revocation; online logout should revoke before forgetting the credential. Reset requests are never acknowledged as successful email delivery merely because a job was queued.

## Transactions and categories

| Method | Route | Behaviour |
| --- | --- | --- |
| GET | /transactions | cursor, limit, type, categoryId, paymentMethod, from, to, minAmountMinor, maxAmountMinor, q, sort |
| POST | /transactions | create expense/income/refund |
| GET | /transactions/:id | owned canonical record |
| PATCH | /transactions/:id | editable fields and baseVersion; type is immutable |
| DELETE | /transactions/:id?baseVersion= | soft-delete; linked live refunds prevent deleting expense |
| GET | /categories | kind and includeArchived filters |
| POST | /categories | name, kind, iconKey, colourToken; validated design asset keys |
| PATCH | /categories/:id | rename/style/archive/unarchive with baseVersion; kind immutable |

Transaction create fields: `id` (client UUID), `amountMinor`, `currency`, `type`, `categoryId`, optional `description`, optional `merchantOrPayee`, `paymentMethod`, `occurredAt`, and `originalExpenseId` only for refunds. Refund category is validated against the expense. User identity, version, timestamps and capture source are server-controlled; widget operations use their validated sync envelope, but source metadata is never authorization evidence. Require the original expense/category to be owned and active as appropriate. Categories referenced in history are archived rather than deleted.

Allowed sort keys: date ascending/descending, amount ascending/descending; append ID as stable tie-breaker. `from` inclusive, `to` exclusive. Paginated screens may change as records are edited; cursor lists are not a sync mechanism or a frozen financial export.

## Budgets, goals and analytics

| Method | Route | Behaviour |
| --- | --- | --- |
| GET | /budgets | month range and pagination; includes overall and category limits |
| POST | /budgets | id, month, limitMinor, currency; conflict if month exists |
| GET | /budgets/:id | limits plus derived period spending |
| PATCH | /budgets/:id | overall limit and baseVersion |
| DELETE | /budgets/:id?baseVersion= | atomic soft-delete of overall and allocations |
| POST | /budgets/:id/categories | id, categoryId, limitMinor |
| PATCH | /budgets/:id/categories/:allocationId | limitMinor and allocation baseVersion; lock/check parent |
| DELETE | /budgets/:id/categories/:allocationId?baseVersion= | remove allocation |
| GET, POST | /goals | paginated goals / create id, name, targetMinor, currency, optional targetDate and iconKey |
| GET, PATCH | /goals/:id | detail / metadata, archive or target changes with baseVersion |
| DELETE | /goals/:id?baseVersion=&confirmContributions=true | confirmed atomic goal/contribution soft-deletion |
| GET, POST | /goals/:id/contributions | paginated contributions / id, amountMinor, contributedAt, optional note |
| PATCH, DELETE | /goals/:id/contributions/:contributionId | versioned correction/removal, parent ownership required |
| GET | /dashboard?month=YYYY-MM | totals, available budget nullable when unset, goals overview, recent records, freshness |
| GET | /analytics/summary | from/to, groupBy day/week/month; gross expense, refunds, net expense, income, surplus |
| GET | /analytics/categories | same time window; category totals and explicit denominator |
| GET | /analytics/merchants | merchant totals; missing merchant grouped as unspecified |
| GET | /analytics/comparison | month and comparisonMonth; absolute and percentage change |

Empty data returns zeros and empty arrays, not server errors. Unset budget is null, distinct from a zero budget. Percentage change is null when the comparison denominator is zero; charts must show an honest no-baseline state. Net-negative categories cannot be depicted as positive pie slices: use a separate refunds/net breakdown. Server and local analytics use identical shared reporting rules. Do not call a financial surplus confirmed savings.

## Synchronisation (Phase 6)

| Method | Route | Contract |
| --- | --- | --- |
| POST | /sync/bootstrap | create a bounded consistent snapshot session; returns snapshotId, first page and watermark cursor |
| GET | /sync/bootstrap/:snapshotId | owner-bound next page; snapshot expiry requires restart, never partially replace active local data |
| POST | /sync/push | schemaVersion, installationId, operations array; per-operation applied/conflict/invalid outcomes |
| GET | /sync/pull?cursor=&limit= | ordered canonical changes, next cursor, fixed high-water mark and hasMore |

Push operation: `operationId`, `entityType`, `entityId`, `action`, `baseVersion` (null only on create), `payload`. Supported offline mutations initially target transactions/refunds only. Server-generated cascades still emit every changed entity. Dependency failures do not acknowledge dependent operations as successful. Process operations in declared dependency order with one database transaction per operation; clearly report partial batch success. Unknown schema versions return an explicit upgrade-required error.

Bootstrap must use a consistent database snapshot (for example materialized server-side export under a repeatable-read transaction) and a matching per-user change watermark. Publish the snapshot only once complete; cap lifetime/size and garbage-collect expired sessions. Stage pages in a separate local import area, then atomically swap the projection while preserving pending operations. Do not hold a database transaction open across HTTP requests.

Cursor tokens are opaque, integrity-protected, user-bound and versioned; clients cannot select another owner's stream. Expired retention yields `410 SYNC_RESET_REQUIRED`. Financial writes from ordinary REST routes also generate change events and receipts through the same service. See ARCHITECTURE.md for per-user serialization, in-flight edit handling and replay safety.

Example conflict shape (illustrative contract, not fabricated live data):

```json
{
  "error": {
    "code": "VERSION_CONFLICT",
    "message": "This transaction changed on another device.",
    "currentVersion": 4,
    "entityId": "<owned-transaction-uuid>",
    "current": "<canonical record or tombstone>"
  },
  "requestId": "<request-id>"
}
```

## Health and verification

`GET /health/live` reports process liveness; `GET /health/ready` checks required dependencies with bounded timeouts. Neither exposes credentials, hostnames or detailed database errors publicly. OpenAPI will document actual implemented schemas, examples, auth, pagination and errors; this Markdown is the proposal, not proof that any route works.

Required Phase 4 tests include foreign IDs in reads/writes/filters/linked entities, reset and refresh replay, duplicate mutation keys, invalid money, refund races, budget allocation races, invalid date windows, version conflicts and migration constraints. Sync and offline process-death tests follow in Phase 6.
