# Phase 2 emulator evidence

This folder holds captures from the native development build, not the Phase 1 browser mockups. Validation results and any incomplete native gates are recorded in `docs/PHASE_2_REVIEW.md`. Automated Android UI inspection does not establish actual TalkBack speech quality or physical-device performance.

- `studio-light.png` / `studio-dark.png`: shared native tokens, original static Nim and reusable components.
- `motion.png`: native progress sample after selecting 80%.
- `settings-dark.png`: dark appearance selection and accessibility preferences.
- `studio-system-font-200.png`: actual Android `font_scale=2.0`, not browser zoom.
- `smoke-results.json`: native UI assertions from `scripts/android-smoke.ps1`.
- `runtime-errors.txt`: filtered ReactNativeJS/AndroidRuntime error output for the tested app process; blank when none were logged.
- `installed-versions.json` / `dependency-audit.json`: exact runtime/tooling inventory and unresolved advisory summary.

Captures use Pixel_7 Android 14/API 34, x86_64, 1080×2400 at density 420. They demonstrate debug-build behavior only. No original Rive asset or physical-device benchmark is included.
