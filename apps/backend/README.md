# Nivvi backend

Operational guide as of **2026-11-11**. The Express/Prisma backend implements Phase 4 auth, profiles, transactions/refunds, categories, budgets, goals and analytics. See the [dated API inventory](../../docs/API_DESIGN.md) for route contracts and limits. This guide records commands and source behavior; it makes no test-pass, deployment or SMTP-delivery claim.

## Prerequisites and local configuration

Run the commands below from the repository root unless another working directory is shown. Use a Node.js version satisfying the root `package.json` engines, npm workspaces and PostgreSQL. Install the existing lockfile dependencies with `npm ci`. Prisma generation is a separate step; do not expect ignored generated files to exist in a fresh checkout.

The Windows helper provisions localhost PostgreSQL on port **55432**, separate `nivvi_development` and `nivvi_test` databases, a migration owner and a restricted application role. It expects PostgreSQL binaries at `.local/tools/postgresql/pgsql/bin` or an explicit directory:

```powershell
.\scripts\setup-backend-local.ps1
# Alternative: point to an existing installation's bin directory.
.\scripts\setup-backend-local.ps1 -PgBin 'C:\PostgreSQL\18\bin'
```

Choose the command appropriate to your installed binaries; the helper does not download PostgreSQL. It writes ignored `apps/backend/.env.local` and `.env.test.local` files only if absent, and retains database data/state under `.local/backend`. Rerunning reuses the saved state and does not reset databases. If a data directory exists without matching setup state, it refuses initialization. Existing environment files are not automatically refreshed or rotated. Local setup is a development convenience, not production provisioning.

For manually managed PostgreSQL, copy [`.env.example`](.env.example) to `.env.local`, supply real credentials and independent secrets, and create `.env.test.local` targeting only the dedicated test database. The application and CLI scripts load environment files explicitly; do not expect a generic `.env` file to be loaded by every command.

| Variable              | Meaning / current requirement                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `NODE_ENV`            | `development`, `test` or `production`; defaults to development                                                                 |
| `DATABASE_URL`        | PostgreSQL application connection string; runtime uses the application role                                                    |
| `DIRECT_DATABASE_URL` | Prisma migration connection string; migration owner recommended; Prisma falls back to `DATABASE_URL` if omitted                |
| `HOST`, `PORT`        | Bind address/port; defaults `127.0.0.1:3000`                                                                                   |
| `ACCESS_TOKEN_SECRET` | Independent random secret, at least 32 characters; signs JWTs and list cursors                                                 |
| `JOB_ENCRYPTION_KEY`  | 32 random bytes encoded as exactly 64 hexadecimal characters; encrypts queued account-mail payloads                            |
| `MAIL_MODE`           | `file` (default) or `smtp`                                                                                                     |
| `MAIL_DIRECTORY`      | Required nonempty output directory, including when SMTP is selected; relative paths resolve from the process working directory |
| `MAIL_FROM`           | Required syntactically valid sender email                                                                                      |
| `PUBLIC_APP_URL`      | Required absolute base URL for generated reset/verification links; HTTPS is required in production                             |
| `SMTP_URL`            | SMTP connection URL; required in production; use `smtps://` for implicit TLS or `smtp://` with required STARTTLS               |

Production configuration rejects file mail, absent SMTP URL and non-HTTPS public app URLs. The HTTP listener itself does not terminate TLS; deploy behind appropriately configured TLS infrastructure. `trust proxy` is currently false, and rate limiting uses process memory, so forwarded client IPs and shared quotas need explicit deployment work before scaling. A syntactically valid configuration does not verify SMTP credentials, delivery, public link handling or infrastructure readiness.

Keep environment files and `.local/backend` out of version control. Local state contains database credentials, and file mail contains usable account links. Keep the job encryption key available while pending jobs still need decryption; changing it without migration makes those payloads unreadable. Secrets in this guide are variable names/placeholders, not runnable example credentials.

## Generate, migrate and run

After dependencies, PostgreSQL and environment files are ready:

```powershell
npm run build --workspace @nivvi/contracts
npm run db:generate --workspace @nivvi/backend
npm run db:migrate --workspace @nivvi/backend
npm run db:migrate:test --workspace @nivvi/backend
npm run dev --workspace @nivvi/backend
```

The dev command rebuilds contracts, loads `apps/backend/.env.local`, and watches `src/server.ts`. Database generation creates `src/generated/prisma`; it does not apply migrations. Migration scripts load the relevant development/test environment and deploy committed migrations from `prisma/migrations`, using `DIRECT_DATABASE_URL` when present. They do not use `db push`, reset databases or generate a new migration. Preserve reviewed SQL constraints and indexes; apply future schema changes through new versioned migrations. Do not use the test database as a development or production data store.

For compiled execution:

```powershell
npm run build --workspace @nivvi/backend
npm run start --workspace @nivvi/backend
```

The build emits `dist/server.js` and other runtime modules; start loads `.env.local`. In managed deployments, provision environment values securely and choose the corresponding invocation rather than relying on local example files. Startup connects PostgreSQL before listening. SIGINT/SIGTERM close the HTTP server and database connection, with a ten-second shutdown deadline.

## Health and OpenAPI

With the default local bind address:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/health/live
Invoke-RestMethod http://127.0.0.1:3000/health/ready
Invoke-WebRequest http://127.0.0.1:3000/openapi.json -OutFile .local/backend/openapi.json
```

Liveness returns `{data:{status:"ok"}}`; readiness performs a PostgreSQL query and returns `{data:{status:"ready"}}` or generic 503 `NOT_READY`. It does not verify email delivery or deletion processing. Runtime database connections have connection/statement/lock timeouts.

OpenAPI 3.1 is a plain JSON object generated by `src/openapi.ts`, with input schemas derived from the shared Zod runtime contracts. Its default server is `/api/v1`; health and `/openapi.json` override the server to `/`. Query operations list individual parameters and link strict query schemas through `x-query-schema`. The document includes bearer authentication, required financial `Idempotency-Key`, body/query `baseVersion`, success/error envelopes and reporting rules. No Swagger UI or `/sync/*` API is implemented.

## Tests and checks

Prepare `.env.test.local` with `NODE_ENV=test`, independent test secrets, `MAIL_MODE=file`, a test mail directory and `DATABASE_URL` whose database name is `nivvi_test`. The helpers reject other environments/database names. Apply the test migrations before running tests:

```powershell
npm run db:migrate:test --workspace @nivvi/backend
npm run test --workspace @nivvi/backend
npm run typecheck --workspace @nivvi/backend
npm run lint --workspace @nivvi/backend
```

The test script rebuilds contracts and runs Node tests through `tsx`, with test modules sequential. Integration tests use real PostgreSQL and isolated UUID users; they do not truncate or purge existing records. Repeated runs accumulate fixtures in the dedicated test database. The analytics precision case creates 9009 transactions to exercise aggregates above JavaScript's safe integer. Rate limiters are skipped in test mode; tests in that mode cannot establish deployed quota behavior. These commands are instructions, not a report of their results.

To run only analytics from the backend directory:

```powershell
Set-Location apps/backend
node --import tsx --env-file=.env.test.local --test tests/analytics.test.ts
```

## Account mail worker

Registration, eligible forgot-password requests and verification resends enqueue encrypted `ACCOUNT_EMAIL` jobs. Queuing a job is not delivery. A separate invocation processes **at most one eligible job**, then exits:

```powershell
npm run mail:work --workspace @nivvi/backend
```

Schedule repeated invocations externally if continuous processing is required. The worker claims due jobs using a database lease and skips locked rows. It checks that the account and one-time token are still eligible before sending; obsolete jobs become `CANCELLED`. Leases last 60 seconds. Failures retry with exponential delay, up to five attempts, then become `FAILED`; there is no built-in administrator retry endpoint. Successful/cancelled jobs redact their encrypted payloads. Monitor job states and the `mail_delivery_failed` log event; a worker invocation can exit after recording a failed/retry attempt.

In `MAIL_MODE=file`, the worker writes one `<job-id>.json` artifact under `MAIL_DIRECTORY`, marked `LOCAL_FILE_ONLY_NOT_SENT`. The job's internal `DELIVERED` status then means the local artifact was produced, **not that an email was sent**. Inspect the artifact locally to exercise the token flow; do not publish its links. Reset/verification tokens expire after 15 minutes. Generated links put the token in the URL fragment under `reset-password` or `verify-email`; a compatible frontend/deep-link handler still needs integration.

In `MAIL_MODE=smtp`, the worker uses Nodemailer with authenticated TLS-required SMTP. Actual SMTP connectivity, acceptance and inbox delivery are not verified by this guide or by file-mode tests. Network sending and the subsequent job update cannot commit atomically: a crash can cause a retry/duplicate email. A deterministic message ID helps correlate attempts but is not an exactly-once delivery guarantee.

## Current operational boundaries

- `DELETE /api/v1/me` requires bearer authentication, password and `confirmation: "DELETE MY ACCOUNT"`. It marks the account `DELETION_PENDING`, revokes sessions/tokens and queues an `ACCOUNT_DELETE` job. The account-mail worker does not consume that job. No purge worker or completed-erasure guarantee exists yet.
- Dashboard budget alerts are computed from current monthly/category net spending: near at 80% for positive limits, over above 100%. They are in-app report data. There is no implemented push/email budget-notification pipeline, even though the schema includes alert-related storage.
- Financial writes persist mutation receipts and change events, but Phase 6 bootstrap/push/pull, offline sync and widget integrations are future work. Current mobile screens are not wired to these backend routes.
- Reports use exact integer paise strings, user-local month/Monday-week boundaries and dated refund offsets. Goal contributions are earmarks, not income/expenses. Surplus and budget availability are not bank balances. See the API inventory for limits, percentages, unset-versus-zero budgets and live pagination behavior.
