# Database design proposal

Status: Phase 0; conceptual schema, not a migration or implemented Prisma model.
See [architecture](ARCHITECTURE.md) and [API contract](API_DESIGN.md).

## Money, time and reporting invariants

- Persist positive integer paise as PostgreSQL BIGINT and SQLite INTEGER. Public money fields are base-10 integer strings (`"129900"` = INR 1,299.00) to avoid JSON BigInt/float ambiguity. Proposed maximum per amount: `999999999999` paise; reject zero except budget limits, which may be zero. Validate aggregate bounds too. Perform arithmetic with BigInt; convert only bounded chart coordinates to numbers.
- Store `currency = INR`, not an implicit currency. No float arithmetic or silent multi-currency totals. Parse user decimal input as text with at most two fractional digits.
- Transaction `occurredAt` is an offset-qualified instant stored as UTC timestamptz. Preserve entered offset for display/audit if useful, but reporting uses the user's IANA timezone. Creation/update timestamps are server-generated UTC. Month queries use half-open local-month bounds converted to UTC, never device timezone guesses. Phase 1 decides display copy; default dates use day/month/year and Indian digit grouping.
- Positive amounts and explicit `EXPENSE`, `INCOME`, `REFUND` kinds; no negative income masquerading as a refund. Refund requires an owned live expense, inherits its expense category and is independently dated. Sum of live linked refunds cannot exceed expense amount. Lock the original expense for every refund create/update/delete and expense edit/delete; validate the combined state. Reducing the expense below its refunded sum or changing its category while live refunds exist is rejected. Delete linked refunds first before deleting their expense.
- Gross expense = expense sum; refunds = refund sum; net expense = gross minus refunds; surplus = income minus net expense. Budgets use net expenses in the period, including refunds for older purchases. Show gross/refund/net separately in analytics. Goal contributions are earmarking records and never counted as expenses or deducted again from surplus. No claim that surplus is an actual account balance.

## Entity catalogue

All owned mutable financial entities have UUID `id`, `userId`, `createdAt`, `updatedAt`, integer `version` starting at 1, and nullable `deletedAt`. IDs are client-generated where offline creation is supported; ownership and server metadata are never writable by clients. Tombstones retain IDs and versions without retaining unnecessary description text indefinitely.

| Entity | Main fields / constraints |
| --- | --- |
| User | id, normalized unique email, passwordHash, displayName, currency INR, locale en-IN, timezone Asia/Kolkata, theme system/light/dark, emailVerifiedAt, status, createdAt, updatedAt, profileVersion |
| Session | id, userId, installationId, familyExpiresAt, revokedAt, createdAt, lastUsedAt; installation ID is not authentication |
| RefreshCredential | id, sessionId, unique tokenHash, parentId, consumedAt, expiresAt; keep consumed hashes through family expiry for replay detection |
| AccountToken | id, userId, purpose VERIFY_EMAIL/RESET_PASSWORD, unique tokenHash, expiresAt, consumedAt; one-time atomic consumption |
| Category | owned mutable fields, kind EXPENSE/INCOME, name, normalizedName, iconKey, colourToken, optional defaultKey, archivedAt |
| Transaction | owned mutable fields, amountMinor, currency, type, categoryId, description nullable (max 500 chars), merchantOrPayee nullable (max 120), paymentMethod, occurredAt, originalExpenseId nullable, source MANUAL_APP/MANUAL_WIDGET |
| MonthlyBudget | owned mutable fields, month local DATE first day, limitMinor, currency; one live overall budget per user/month |
| CategoryBudget | owned mutable fields, monthlyBudgetId, categoryId, limitMinor; one live allocation per parent/category; expense categories only |
| SavingsGoal | owned mutable fields, name (max 80), targetMinor, currency, targetDate optional local DATE, iconKey, archivedAt |
| GoalContribution | owned mutable fields, goalId, amountMinor, contributedAt, note optional; positive, manual earmark, correction via versioned edit/delete |
| AlertDelivery | id, userId, budgetId, month, threshold, channel, state, deliveredAt; unique budget/period/threshold/channel to avoid repeats |
| SyncState | userId primary key, lastSequence BIGINT; transactional lock serializes financial writes |
| ChangeEvent | userId, sequence, entityType, entityId, entityVersion, operation UPSERT/DELETE, immutable canonical payload, recordedAt; primary key userId/sequence |
| MutationReceipt | userId, operationId, requestHash, entityId, canonical result/status, createdAt; unique userId/operationId; reject same key with different content |
| Job | id, type, minimal payload, dedupeKey, attempts, nextAttemptAt, lockedUntil, status; durable email/alert work with bounded retention |

Payment methods: UPI, CASH, DEBIT_CARD, CREDIT_CARD, NET_BANKING, OTHER. Each is metadata only. Category references are required for transactions. Archive categories rather than deleting referenced history. Changes to category naming/icons affect current presentation, not historic transaction amounts.

## Relationships and ownership

```text
User 1--N Session 1--N RefreshCredential
User 1--N AccountToken
User 1--N Category 1--N Transaction
Transaction(EXPENSE) 1--N Transaction(REFUND)
User 1--N MonthlyBudget 1--N CategoryBudget N--1 Category
User 1--N SavingsGoal 1--N GoalContribution
User 1--1 SyncState; User 1--N ChangeEvent / MutationReceipt / AlertDelivery
```

Use `(userId, id)` unique keys on owned referenced entities and composite foreign keys for category, goal, budget and original expense links. Check expense/income category compatibility and refund parent type in services under transactions; SQL CHECK constraints cannot validate another row's fields alone. User deletion uses a deliberate purge workflow rather than casual cascading deletes on public endpoints.

Each user receives owned default categories atomically at registration with deterministic per-user default keys. Expenses: Food, Groceries, Shopping, Transportation, Entertainment, Bills, Health, Education, Travel, Subscriptions, Other. Income: Salary, Freelance, Investments, Gifts, Other. This avoids mixing globally writable categories with tenant-owned data. Default keys are unique per user; users can rename/archive defaults. Custom category normalized names are unique among live categories of the same user/kind. Recreating an archived name requires unarchiving or a distinct name.

## Budget and savings semantics

Monthly budget is a limit, not an account balance. Category limits are allocations within the overall budget; their sum must not exceed the monthly limit. Lock the parent budget when editing any allocation or overall limit, including concurrent requests. No automatic rollover. Copying a month is an explicit later convenience. Historical limits remain editable with version checks and change events; the UI must distinguish reporting month from modification time.

Savings progress is sum of live contributions, may exceed the target and must never be added to income. Display overfunding accurately. Goal target reduction can complete a goal; completion is derived, not a second mutable balance. Milestone reactions are deduplicated locally by goal and milestone, without allowing animation to block writes. Archive completed goals; deleting a goal with contributions requires explicit confirmation and an atomic soft-delete of its contributions with corresponding change events.

## Indexes, constraints and migrations

- Unique normalized email; positive and bounded money CHECKs; allowed enum values; INR CHECK; month-start CHECK; versions positive. Add raw SQL migrations when Prisma cannot express partial indexes or constraints.
- Live transaction indexes `(userId, occurredAt DESC, id DESC)`, `(userId, categoryId, occurredAt DESC, id DESC)`, `(userId, type, occurredAt DESC, id DESC)`; index originalExpenseId within user. Reverse scans support ascending order where applicable. Add amount/merchant indexes only after measured query plans.
- Unique live overall budget user/month; unique live category allocation parent/category; indexed goals and contributions by user/goal/date. Match all composite foreign keys with suitable indexes.
- Parameterized bounded case-insensitive merchant/description search initially. Add PostgreSQL trigram indexing only when query measurements justify the extension. Cursor tokens bind sorting and filters to avoid invalid pagination.
- Every public REST write and sync write shares the same transaction service, row-version check, mutation receipt and change-log emission. No bypass path for financial writes.
- Check cross-row sums under locks; use a consistent lock order (user SyncState, parent records, child records) and bounded deadlock/serialization retries. Never depend on UI checks alone.
- Version all PostgreSQL and SQLite migrations; test fresh installs and upgrades with realistic rows. Destructive changes require backup and a reviewed forward/restore plan. No database reset as a migration shortcut.

## Local tables added in Phase 6

SQLite holds synchronized category/transaction/budget/goal projections plus `outbox`, `server_shadows`, `conflicts`, `sync_metadata`, `drafts`, and `import_receipts`. Money uses checked integer paise; database keys map to the same UUIDs. Outbox stores operation ID, entity, base server version, local revision, payload, attempts and status. Cursor and server versions are not inferred from timestamps. Budgets/goals/categories are cached read-only offline in release one; transactions/refunds can be created, edited and deleted offline. Refund caps can fail on sync after another device refunds the same expense; retain the candidate for correction.

Android widget uses a separate private native inbox and projection store, scoped by account generation. Import receipts and stable operation IDs make handoff crash-safe. Plain native staging data must have a short lifecycle, private app storage, backup exclusion and device-lock protection; it is not claimed to have SQLCipher ledger protection. Evaluate encrypted staging in the Phase 7 threat model.

Change-event payloads contain financial data: restrict access, redact logs and expire old events. Proposed 180-day log retention and account-lifetime dedupe receipts must be reviewed for storage/privacy impact before production. Purged entities retain minimal non-reusable identity markers until the supported replay window is safely closed. Backups have a separately documented retention policy; soft deletion is not a promise of immediate physical erasure.
