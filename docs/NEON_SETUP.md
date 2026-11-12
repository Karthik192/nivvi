# Neon database setup

The backend uses the existing Prisma 7 + `@prisma/adapter-pg` + `pg` stack to connect to Neon Postgres. Keep this driver choice: the Express API is a long-running Node.js process, not an edge runtime.

## Environment files

- The repository root `.env.local` is managed by the Neon CLI and contains branch connection settings. It is ignored by Git and must never be committed.
- `apps/backend/.env.local` contains backend-only development settings. Keep this file private as well.
- The backend scripts load `apps/backend/.env.local` first and then the root `.env.local`. Node uses the last file's value for duplicate keys, so Neon connection values take precedence while backend-only settings remain available.
- The API uses pooled `DATABASE_URL` for normal traffic. Prisma migrations prefer direct `DATABASE_URL_UNPOOLED`, then `DIRECT_DATABASE_URL`, then `DATABASE_URL`.

## Commands

Run from the repository root:

```sh
neon status
neon env pull --service postgres
npm run build
npm run db:migrate --workspace @nivvi/backend
npm run start --workspace @nivvi/backend
```

The service readiness check verifies that the running API can query its configured database:

```sh
curl http://127.0.0.1:3000/health/ready
```

For development, `npm run dev --workspace @nivvi/backend` uses the same environment-file ordering. Do not run migrations against production until reviewing pending migrations and confirming the target branch.

## Neon policy

`neon.ts` keeps the default branch on project defaults and gives newly created non-default branches a seven-day TTL. Postgres is the branch's built-in service; the current app does not declare Neon Auth, Functions, or Object Storage. Apply policy changes with `neon deploy` after reviewing `neon config plan`.
