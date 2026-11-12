# Project working instructions

## Purpose and current phase

Build an original India-first personal finance companion with premium, accessible UI and an encouraging mascot. Default INR, manual capture only; recording UPI as metadata is not payment integration. Never copy Duolingo characters, branding or assets.

Current state: Phases 0–6 are implemented and reviewed; Phase 7's initial Android Glance widget is implemented and awaiting user review. See docs/PHASE_6_REVIEW.md and docs/PHASE_7_REVIEW.md for evidence and limitations. Emulator/physical widget interaction remains unverified. Live API mode is the default; mock preview is selectable only in development. Original Rive assets, TalkBack review and physical performance measurements remain outstanding. This file is intended for Claude Code and other contributors; it does not imply a particular agent is installed.

Read these proposals before implementation:

- [Architecture and technical decisions](docs/ARCHITECTURE.md)
- [Database entities and financial invariants](docs/DATABASE_DESIGN.md)
- [REST/authentication/sync contract](docs/API_DESIGN.md)
- [Phases and approval gates](docs/DEVELOPMENT_ROADMAP.md)

## Mandatory phase gates

Work on one major phase at a time. End each phase with relevant tests, linting, type checking, inspection, fixes, documentation, actual validation results, outstanding issues and an approval request. Wait for explicit approval before the next phase. Mark checks not applicable when no corresponding code exists. Do not claim checks, device tests, finished artwork or production readiness without evidence. Do not deploy or publish without explicit authorization.

Do not implement the entire product at once. Never silently replace working architecture, delete features, introduce integration scope or skip approval. Explain major decisions, alternatives and consequences before implementation. The user's session instructions take precedence over this file.

## Engineering rules

Preserve these user review recommendations throughout later phases:

- Phases 2–6: keep repository and sync abstractions small; do not implement Phase 6 infrastructure prematurely.
- Phases 1–2: verify actual native Rive compatibility and secure original licensed `.riv` assets before relying on animated mascot behaviour.
- Phase 4: evaluate email-verification friction for each sensitive action; do not impose a blanket verification wall. Use appropriate reauthentication and ownership checks.
- Phase 7: clearly distinguish saved-to-device expenses from server-synced transactions in widget feedback.
- Phase 8: measure cold launch and animation performance on a real mid-range Android phone; emulator results are supplementary.

- Preferred stack: Expo React Native/TypeScript/Router, Reanimated, Gesture Handler, Rive, SQLite, TanStack Query and Zustand; Express/TypeScript/PostgreSQL/Prisma/Zod; Kotlin/Glance for isolated Android widget functionality.
- Before adding any dependency, verify current official requirements and compatibility with the chosen Expo/React Native or backend runtime. Record exact pins and native peer requirements. No forced peer resolution to hide incompatibility.
- Small reusable components; UI does not contain business rules. Share DTO schemas and pure money/date rules; keep Prisma/server secrets out of mobile packages. Prefer minimal abstractions and modular monolith.
- Use semantic theme tokens with intentionally designed light/dark surfaces. Avoid generic dashboard layouts, clutter and excessive decorative effects. Every visible interactive control must work or clearly communicate its unavailable state.
- Financial arithmetic uses integer paise and explicit currency; JSON money is an integer string. Always enforce owner scoping, input validation, database constraints and optimistic versions. Refunds offset expenses; goal contributions do not create expenses or income.
- Store refresh credentials in protected native storage, hash server credentials, redact logs and use validated environment configuration. Never hardcode secrets or commit credentials. Every API tenant lookup derives identity from authentication.
- Saved offline records require an atomic entity/outbox write, stable operation ID and visible sync state. Never silently overwrite financial conflicts or drop pending work on logout/account switch.
- Widgets use actual Android capabilities: quick amount entry via Activity, durable private staging, guarded account handoff and explicitly stale cached summaries. Do not assume a launcher widget supports a regular editable text field.
- Reanimated drives UI movement; Rive drives bounded character regions. Respect reduced motion, screen readers, text scaling and 48dp Android targets. Animations cannot block transaction persistence.
- Rive assets require approved original/licensed files, documented bindings and a static fallback. Never fabricate completed assets. Defer brand decisions to Phase 1.
- Important financial/auth/isolation behaviour gets tests when implemented. Check root causes of failures; do not paper over them or fix unrelated code without need.
- Keep documentation and migrations current. No destructive DB reset as an upgrade strategy. No fake records in production functionality.
- Use meaningful commits only when authorized. Do not create branches, commit, push, deploy or publish incidentally.

## Commands and environment

Phase 1's browser gallery remains in `design/preview`. The native Expo app is in `apps/mobile`; the backend is in `apps/backend` and API contracts in `packages/contracts`. PostgreSQL runs locally with separate migration/runtime roles and development/test databases; tests must use `nivvi_test`. Generate Prisma before checks on a clean checkout. Mobile transport, session storage, SQLite/outbox and widget bridge live in `apps/mobile/src/data` and `apps/mobile/modules`. Use adb reverse for Metro 8081 and API 3000 on a USB/emulator development connection. Windows/PowerShell is the current environment; inspect targets before destructive filesystem operations.

## Phase completion report

Report what changed, what ran and its actual result, remaining limitations/decisions and the approval needed. Pause at the phase boundary. Approval for a proposal is not permission to deploy or publish.

## User-requested completion notification

At the end of each completed task in this workspace, after validation and before the final response, send the user's completion notification once:

```powershell
Invoke-RestMethod -Method Post -Uri 'https://ntfy.sh/karthik192-codex-alerts' -Body 'Codex task is complete!' -TimeoutSec 15
```

This is an explicitly authorized external notification. Send only this fixed message, never project files, financial data, credentials or task details. Do not send it for intermediate progress. If delivery fails, report the failure accurately; do not claim it was sent. This is an agent execution instruction, not a claim that a native `[hooks].on_turn_complete` configuration has been installed. Avoid duplicate sends if an equivalent automatic hook is later configured.
