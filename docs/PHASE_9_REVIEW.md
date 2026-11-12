# Phase 9 — QA and security review

Status: automated checks and repository review completed; phase acceptance remains open.

## Changes made

- Replaced a fixed transaction UUID in the sync bootstrap test with the test suite's UUID helper. The fixed identifier collided with rows left in the persistent test database on repeat runs.
- Removed an unused `serialize` import that caused backend ESLint to fail.

## Validation

| Check | Result |
| --- | --- |
| `npm run test` against the dedicated `nivvi_test` PostgreSQL database | Passed after the fixes: 68 backend tests and 53 mobile tests. The first run exposed the repeat-run UUID collision described above. |
| `npm run typecheck` | Passed for shared contracts, backend and mobile. |
| `npm run lint` | Passed after removing the unused import. |
| `npm run design:verify` | Passed: 52 contrast pairs, theme parity, spacing/type/motion invariants and four local SVG assets. |
| `npm run format:check` | Fails on 21 files, including the two touched backend files and existing mobile offline/UI files plus backend OpenAPI/analytics test files. Formatting has not been applied broadly because it would create unrelated diffs. |
| `npm audit --omit=dev` | Failed: five moderate advisories in the Expo dependency tree (`expo`, `@expo/cli`, `@expo/fingerprint`, `glob`, `minimatch`); no high or critical advisories were reported. npm's suggested Expo fix is a downgrade to 52.0.49, a major SDK change incompatible with this Expo 58 project. No dependency change was applied. Investigate a compatible patched Expo release and advisory applicability before release. |

The full test command was run again after making the sync fixture unique. Tests use the dedicated test database and local file mail configuration; development data was not reset.

## Security review findings

### Controls verified in code and tests

- Passwords use Argon2id; refresh credentials and account action tokens are opaque and stored as digests. Access tokens have a short lifetime, fixed algorithm, issuer and audience checks, and are also checked against a live session.
- Refresh credentials rotate; replay revokes the token family. Password reset consumes its token once and revokes sessions. Generic authentication/reset responses and request limits have automated coverage.
- Authenticated user identity scopes financial API queries. Composite user/entity constraints prevent cross-user references for categories, budgets, transactions and goals. Backend tests exercise foreign-record isolation, concurrent financial updates, integer money bounds and database constraints.
- Express uses Helmet, bounded JSON bodies, no-store responses, request IDs and centralized errors. The server logger records request metadata and redacts known credential/configuration fields.
- The runtime database role is tested as unable to create schemas; local provisioning separates migration and runtime roles. Production config requires SMTP and an HTTPS app URL.
- Mobile refresh credentials and the SQLCipher database key use Android-protected SecureStore; Android backup is disabled. Widget status distinguishes synced from device-only/pending data.

### Open risks and verification gaps

1. **Dependency advisories:** the production dependency audit currently reports five moderate findings. Do not downgrade Expo blindly; resolve against a compatible Expo SDK and re-run the audit before a release candidate.
2. **Rate limiting in a deployed topology:** current Express limiters use process-local memory. Limits are not shared across multiple server instances. `trust proxy` is disabled; if deployed behind a proxy, client-IP handling and trusted proxy configuration must be designed alongside a shared limiter store. No deployment topology exists yet.
3. **Encrypted local database recovery:** a prior Android run surfaced SQLite error code 26 (`file is not a database`) while opening the encrypted local cache. No destructive reset or key rotation was performed. Online account data loaded, but offline durability and safe recovery of that device database remain unresolved; preserve existing user data until a reviewed recovery path exists.
4. **Widget privacy and acceptance:** the launcher widget displays monthly spend and category names. Launcher/lock-screen privacy behavior varies by device, and placement, rapid taps, process death, reboot and accessibility have not been verified on a real device.
5. **Accessibility/performance:** TalkBack, increased system font scaling and reduced-motion behavior have not been accepted on hardware. Mid-range cold-launch and animation measurements from Phase 8 are still outstanding.
6. **Production operations:** TLS termination, secret storage/rotation, database backup and restore, retention workflows and multi-instance behavior have not been tested in a deployed environment. Production readiness is not established.

## Scope not verified

- No Android UI automation, SQLCipher corruption/recovery test, two-device sync/conflict acceptance, native widget launcher test or real-device accessibility/performance run was completed in this review.
- The current mobile Jest suites are unit/component/transport checks; they do not constitute full end-to-end acceptance of every screen or native widget.
- No independent penetration test or security certification was performed.

## Gate

Phase 9 has useful automated coverage and several strong server-side controls, but it is not accepted as release-ready. Resolve the dependency audit, agree on device-data recovery, and complete native device/widget/accessibility checks before presenting a release candidate. Phase 10 deployment preparation remains gated on explicit user approval.
