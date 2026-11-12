# Phase 6 — Offline transactions and synchronisation

Status: Implementation complete; user approval requested after local validation. Updated: 12 November 2026.

## Delivered

- Native persistence uses Expo SQLite compiled with SQLCipher. A random 256-bit key is stored in Android SecureStore. Startup checks `PRAGMA cipher_version` and refuses offline writes if encryption is unavailable; there is no plaintext fallback. Android backup is disabled.
- Transaction create, edit and delete commit the local projection and account-scoped outbox row in one SQLite transaction before showing success. The outbox retains the operation UUID, method, path/query and exact body. Ambiguous retries reuse these values; edits queued behind earlier writes receive the version returned by the preceding acknowledgement before their first attempt.
- Transient failures keep the operation and use capped retry delays. Non-retryable failures block the queue. Version conflicts preserve the local candidate and remote row/tombstone; transaction detail offers an explicit server-version or keep-local choice where rebasing is valid.
- Backend adds authenticated `GET /sync/bootstrap` and `GET /sync/pull`. Bootstrap pages are capped at 100, owner-bound by signed cursor, and carry a fixed per-account sequence watermark. Pull pages are capped at 100 and use string sequence cursors. The routes reuse the backend's existing change log and mutation receipts; no database migration was needed.
- On successful account restore, startup, foreground/resume and network recovery trigger sync. Android background sync uses Expo BackgroundTask at a 15-minute minimum and remains subject to OS scheduling. Web remains online-only.
- Offline Home, transaction history and Insights use device transaction projections and label their device-only source. Categories and transactions bootstrap locally; budgets and goals remain online-only.
- Local logout clears this device's refresh credential and account pointer while retaining the encrypted database/outbox. Another account cannot flush those records because the worker requires a matching authenticated account ID.

## Validation

Commands and results:

- `npm run build --workspace @nivvi/backend` — passed.
- PostgreSQL integration suite (`node --import tsx --env-file=.env.test.local --test --test-concurrency=1 tests/*.test.ts`) — 68 tests passed, including bootstrap paging, sequence pull, authentication, tampered cursor and cross-account cursor isolation.
- Mobile Jest suite — 53 tests passed. Offline native SQLite was not mocked as if it were a real Android database.
- Mobile lint and TypeScript typecheck — passed after the final sync queue and account-session changes.
- Expo dependency compatibility check — passed. Expo prebuild generated SQLCipher and BackgroundTask configuration. Windows config pins AGP 9.1.1 and supplies CMake 4 policy compatibility for Expo SQLite's CMake 3.4.1 declaration.
- Android `assembleDebug` — passed for all four ABIs. A second x86_64-only debug build also passed (about 113 MB APK versus 340 MB universal APK).
- Emulator check — Installed the x86_64 debug APK on the Android 14 x86_64 emulator, loaded the Metro bundle, and reached the signed-in Home screen. The app created `files/SQLite/nivvi-offline.db` and successfully hydrated its local profile through `openOfflineDatabase`; the SQLCipher `cipher_version` guard therefore passed at runtime. Home showed the offline state, but no selectable categories were available and Add expense was disabled. Offline transaction creation, force-stop persistence of a saved transaction, and exactly-once reconnect sync remain unverified.
- `git diff --check` — passed.

## Known limits and remaining checks

- Emulator acceptance remains required: determine why the account has no locally selectable categories, create a transaction in airplane mode, force-stop/reopen, restore connectivity, and confirm exactly one server record is created. The emulator is useful for functional verification but does not represent a physical mid-range device.
- Two-device stale edit/delete conflict flows and abrupt process termination during a write still need explicit manual acceptance checks.
- Budgets, goals, categories and contributions are not offline writable; offline reports contain transactions only and say so.
- Background execution is deferred by Android and is never promised to occur immediately. Foreground and connectivity recovery are the primary sync triggers.
- Change events are currently retained indefinitely. No pruning, expired-cursor reset endpoint, or bounded event retention is implemented; do not prune events until a client reset/reconciliation protocol exists.
- Retry-After is not yet honored. Account deletion with pending local work and device key loss/uninstall need a future recovery UX review.
- SQLCipher encrypts local database pages, not server records or data after the authenticated server returns it. This is not end-to-end encryption or a security certification.

## Approval gate

Review the implemented behavior and the remaining limits above. Phase 7 (Android home-screen widget) starts only after explicit approval.
