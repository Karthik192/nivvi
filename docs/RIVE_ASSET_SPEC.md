# Nim — Rive authoring and native acceptance specification

Status: specification only. Original static vector studies exist in the design gallery; **no `.riv` file, authoring project, animation licence, tested runtime pairing or completed native integration exists**.

## Asset delivery

Create original Nim artwork from the approved Phase 1 silhouette. Deliver editable Rive source/project ownership, exported `nim-v1.riv`, a still export for each expression, source licence/assignment evidence and a manifest recording author, version, SHA-256, artboard, exported bindings and feature requirements. Do not download a community character and call it original. Confirm runtime redistribution rights and artwork rights separately. Store approved assets locally so basic feedback works without network access.

Target artboard 240×240 logical units, transparent background, visual centre near the lower-middle, 16-unit margin protecting leaves/arms. No embedded text, audio, remote textures or runtime 3D requirement. Prefer vector geometry; at most one small embedded texture only if it makes a measured improvement. Target exported `.riv` under 200KB and a single active mascot instance; these are provisional budgets requiring an actual export/profile, not fabricated measurements.

## Proposed semantic behavior

The machine-readable proposal is `design/nim-states.json`. Gallery state buttons preview static illustrations/copy for all eight intents. Proposed Rive state names below are an authoring brief, not confirmed names from an exported asset.

| User moment | Trigger and guard | Proposed Rive state / visual | Exit, accessible copy and reduced motion |
| --- | --- | --- | --- |
| Saving expense | `saveRequested`, while persistence is pending; never fire success on tap | `Attentive`: focus eyes, still leaves, no celebration | Pending ends on commit/error. Announce “Recording your entry” once; not per frame. Use still under reduced motion. No minimum animation wait. |
| Expense recorded | `storageCommitted`, after local durable commit in offline mode or server acknowledgement in online-only Phase 5 | `ContentNod`: closed-eye content smile, small nod, ≤400ms | Return Calm. Say “Saved on this device; waiting to sync” or “Synced to your account” according to actual state. Nod never implies sync. Static content pose under reduced motion. |
| Goal reached | `goalTargetReached`, derived committed contributions cross target; dedupe per goal/target version | `GoalCheer`: arms lift, leaf lift, small rosette, ≤700ms | Return Calm; “You reached your goal.” Repeated screen mounts must not retrigger. Static happy/rosette still under reduced motion. |
| No entries | `noEntries`, loaded empty result, not loading/error | `Patient`: soft smile, small plant beside Nim, no infinite movement | Exit when records load or user leaves. “A little space to begin” plus useful entry action. Same still under reduced motion. |
| Near budget limit | `budgetThresholdCrossed`, proposed 80% threshold of a configured positive limit; dedupe per budget/month/threshold | `Supportive`: attentive eyes, relaxed arms, no tears/red face, ≤350ms | Return Calm; state true amount remaining. At zero/negative limits use exact text, not invalid division. Pending offline projection explicitly provisional. Same supportive still under reduced motion. |

Save failure never triggers ContentNod; keep the draft and announce the actionable error outside the mascot. Conflicts/error feedback take priority over celebratory decoration. Explicit goal achievements outrank generic delighted feedback; near-limit and saved messages may coexist as separate text, with one calm mascot pose. Do not queue stale events for playback after background/resume, and never obscure controls with the character.

| App intent | Pose/transition to author | Limits |
| --- | --- | --- |
| idle | calm breathing/blink | 3–5s subtle cycle, no large travel, paused offscreen |
| transactionSaved | content nod | 350–500ms, celebrates recording, does not assert server sync |
| reviewComplete | delighted | 500–700ms one-shot |
| goalMilestone | small arm raise/leaf lift | ≤700ms; milestone deduped by host |
| unexpectedChange | curious/surprised | open eyes, small mouth; no alarm or shame |
| budgetNearLimit | attentive | neutral supportive still or small nod |
| emptyState | patient | still with adjacent useful copy |
| celebration | excited | ≤700ms; no repeated full-screen overlay |

Propose an asset state machine/view model named `Nim`, numeric/enum expression and discrete event triggers. Exact binding names and supported input types must be agreed with the actual author and runtime, not asserted as existing APIs. The mobile adapter maps semantic events to the delivered manifest. If the runtime lacks a required binding feature, simplify the art export rather than scattering runtime-specific hacks across screens.

## Native compatibility gate — Phase 2

The [official React Native runtime documentation](https://rive.app/docs/runtimes/react-native/react-native) currently recommends `@rive-app/react-native` with Nitro Modules. The exact selected Expo SDK/React Native/Rive/Nitro/JDK/Android combination must be pinned and tested in a development build; documentation minimums do not prove that combination works. Do not install or depend on the legacy runtime from an old tutorial.

Use an original delivered file to verify rendering, every intended binding, route changes, background/resume, reduced motion, error fallback and release-build asset packaging. A temporary licensed technical sample may verify runtime mechanics, but does not satisfy original mascot delivery. Record the source and licence of any sample. Real `.riv` ownership and native compatibility are separate required checks before promising animated behavior. If unavailable, use the static original studies and report the incomplete gate.

## Host rules

- Informative text and persistence success do not depend on animation completion or asset loading.
- Reduced motion shows the corresponding still; never leave a loop running invisibly. OS background/offscreen pauses playback and releases unused resources.
- Events queue only within a short visible interaction; discard stale congratulations on navigation/resume. Budget reactions must never override a user action or an error requiring attention.
- Runtime/asset failure yields a still and the same accessible text, not a blank screen. Meaningful text is outside decorative artwork; don't assume all Rive semantics map consistently to TalkBack.
- Profile actual rendering and memory on a real mid-range Android phone in Phase 8. No “60fps” claim without a measured release-like build.

## Asset readiness ledger

| Item | State |
| --- | --- |
| Original seed mark, icon composition, empty pot, rosette | Editable SVG studies included |
| Nim calm/delighted/curious art | Original static SVG composition in gallery factory |
| Original authored .riv and editable source | Not supplied / not authored |
| Rive artwork licence/assignment | Pending actual authoring |
| Installed native runtime compatibility | Not tested; Phase 2 |
| Final mobile still exports | Pending approved art sizes and native integration |
| Real-device rendering/performance | Not measured; Phase 8 |
