# Nivvi design preview

Phase 1 only: machine-readable tokens, original vector studies and reusable browser component prototypes. This is not an Expo app, live ledger or production web client. It uses Node built-ins and browser APIs without packages, remote fonts, tracking or database writes.

From the repository root:

```powershell
node design/preview/server.mjs
```

Open `http://127.0.0.1:4173`. The server binds loopback only. Stop it with Ctrl+C. Opening the HTML directly via file URL will not load JSON/module resources reliably; use the server. Node 22.14.0 is available in the current environment; no package installation is required.

Review theme (system/light/dark), text scale, reduced motion, button states, invalid/valid field submission, category selection, navigation descriptions, slider progress and eight semantic Nim states illustrated with static poses. Open `http://127.0.0.1:4173/preview/screens.html` for Home, Add Expense, Transaction History and Insights in realistic scrollable phone viewports. All numbers are illustrative. Sample local/synced labels demonstrate wording only; there is no sync implementation. Disabled/loading samples are explicitly noninteractive, not broken controls.

```powershell
node design/verify.mjs
node --check design/preview/components.mjs
node --check design/preview/gallery.mjs
node --check design/preview/server.mjs
```

`verify.mjs` checks token integrity and contrast of specified actual text/control pairs. Browser QA is available with the preview server running and a locally installed Chrome/Chromium executable:

```powershell
node design/browser-check.mjs "C:\Program Files\Google\Chrome\Application\chrome.exe"
```

It launches an isolated headless browser profile under the OS temporary directory and checks gallery/screen interactions, both themes, rendered text contrast, a 14px text floor, accessible control names/chart table, reduced motion, 320px/390px layouts and 100%/130%/150%/200% text. It writes eight individual screen screenshots, study boards, detail/large-text captures and `accessibility-results.json` to `design/review/`. It does not install a browser or any dependencies. These checks inspect the browser accessibility tree, not an actual screen-reader speech session; they do not prove native TalkBack, Android system-font behaviour, Rive compatibility or device performance. This phase has no TypeScript source or ESLint setup; JS syntax checks are not represented as TypeScript checking or full linting.

See [design system](../docs/DESIGN_SYSTEM.md), [Rive asset gate](../docs/RIVE_ASSET_SPEC.md) and [Phase 1 review](../docs/PHASE_1_REVIEW.md). Approval is required before Phase 2.
