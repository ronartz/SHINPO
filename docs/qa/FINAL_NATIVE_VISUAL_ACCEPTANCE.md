# Final Native Visual Acceptance — 2026-11-07

## Candidate and recovery

- Branch: `fix/release-blockers-20261106`
- HEAD: `21244694469cfc9b85b6b877744aa458ddaa188d`
- Worktree: dirty before and after this pass; no reset, clean, commit, or push.
- Pre-change recovery patch: `/home/eonx/SHINPO-uiux-20261107-worktree.patch`, SHA-256 `3a8738cbc846d84958009553cc4cb8308f1e2fcf8c6ab8a468d96391c8992e03`.
- Pre-change worktree inventory: `/home/eonx/SHINPO-uiux-20261107-worktree-status.txt`, SHA-256 `dc2cd1cf2fd89b81c0b41053f926a2656ac11e996c14c6b36ea1213904ad57c0`.
- Source modified by this pass: `frontend/src/components/layout/Sidebar.tsx`, `frontend/src/App.tsx`, `frontend/src/styles/app-shell-refinement.css`, `frontend/src/views/FocusView.tsx`, `frontend/src/styles/views/study-resources.css`, `frontend/src/styles/views/focus-engine.css`, `frontend/src/views/GoalsView.tsx`, `frontend/src/styles/views/goals.css`, `frontend/playwright.config.ts`, `frontend/e2e/comprehensive-tabs-audit.spec.ts`.
- Additional files for this native pass: `frontend/src/views/ScheduleView.tsx`, `frontend/e2e/tauri-native/ui-layout.spec.js`, `frontend/e2e/tauri-native/views-smoke.spec.js`, and the screenshot directory below.

## Current-pass captures

These are Playwright Chromium renders with mocked HTTP API responses, not Tauri/WebKit screenshots and not evidence of persisted user data:

| View | Viewport | Evidence | Checks |
|---|---:|---|---|
| Sidebar | 1440×900 browser viewport; sidebar capture | [sidebar-browser-after.png](screenshots/final-ui-repair-20261107/sidebar-browser-after.png) | Sidebar search absent; global TopBar search visible. Other sidebar changes were not introduced by this pass. |
| Goals & Tasks | 1440×900 | [goals-browser-after.png](screenshots/final-ui-repair-20261107/goals-browser-after.png) | Header, status filters, action toolbar and task content geometry; no horizontal overflow. |
| Goals & Tasks | 1280×720 | [goals-browser-1280x720.png](screenshots/final-ui-repair-20261107/goals-browser-1280x720.png) | Same structure remains within viewport. |
| Focus | 1440×900 | [focus-browser-1440x900.png](screenshots/final-ui-repair-20261107/focus-browser-1440x900.png) | Timer bounds remain inside its panel; no horizontal overflow. |
| Focus | 1280×720 | [focus-browser-1280x720.png](screenshots/final-ui-repair-20261107/focus-browser-1280x720.png) | Timer bounds remain inside its panel; no horizontal overflow. |

Historical real native captures (taken before the current UI changes) are preserved at [native Dashboard](screenshots/tauri-native-acceptance-20261106/dashboard-native.png), [native Goals/Task](screenshots/tauri-native-goal-task-20261106/goals-task-created-native.png), and [native Focus](screenshots/tauri-native-goal-task-20261106/focus-native.png). They are baseline evidence only and do not verify these current changes.

## Native verification update — 2026-11-07

- Current branch/HEAD at verification: `fix/release-blockers-20261106` / `21244694469cfc9b85b6b877744aa458ddaa188d`; source worktree remains dirty.
- Rebuilt the current dirty source with `npm run build` and `npm run tauri:build -- --no-bundle` from `frontend/`. The executable is `frontend/src-tauri/target/release/shinpo-desktop` (27,394,432 bytes; SHA-256 `47e0e0c25279ecd7b086d749c84e0ad762893ae57de5c8486546a7010c84adce`; built Nov 7, 12:50 IST).
- Restored WebKitWebDriver without a system package change: downloaded Fedora-signed `webkitgtk6.0` RPMs into `/tmp/shinpo-wd-extract.ntbi6x`, verified RPM signatures, extracted to that temporary directory and ran with its `usr/lib64` in `LD_LIBRARY_PATH`. `tauri-driver` is `/home/eonx/.cargo/bin/tauri-driver`.
- Driver caveat: `@wdio/tauri-service` still logs that `WebKitWebDriver` is not on PATH and that its optional Tauri plugin is unavailable. Explicit `WEBKIT_WEBDRIVER_PATH` made actual W3C WebDriver interaction and native screenshots work. The tests did not use browser mocks or claim the optional plugin API.
- Native QA runner creates a new disposable XDG profile for each run and refuses to start when ports 8080 or 5432 are listening. No owner profile or vault was accessed.

### Native evidence

| View / interaction | Result | Evidence |
|---|---|---|
| Focus READY at 1400×900, 1280×720, 1440×900 | **PASS** — centered timer; configuration, consent and mode controls are visible; no page horizontal overflow. Light/Standard/Strict selection and observation consent toggles responded. | [1400×900](screenshots/final-ui-repair-20261107/native-current/focus-1400x900-native.png), [1280×720](screenshots/final-ui-repair-20261107/native-current/focus-1280x720-native.png), [1440×900](screenshots/final-ui-repair-20261107/native-current/focus-1440x900-native.png) |
| Focus lifecycle controls | **PASS** — start, pause, resume and cancel were clicked through the current Tauri UI. | [active Focus](screenshots/final-ui-repair-20261107/native-current/focus-active-native.png) |
| Goals & Tasks at all three requested sizes | **PASS** — at 1280px filters stack above the toolbar and search remains 210px wide; at 1400/1440px they share the row without overlap. Goal and linked Task creation succeeded and the Task appeared in the view. | [1280×720](screenshots/final-ui-repair-20261107/native-current/goals-1280x720-native.png), [1400×900](screenshots/final-ui-repair-20261107/native-current/goals-1400x900-native.png), [1440×900](screenshots/final-ui-repair-20261107/native-current/goals-1440x900-native.png), [Goal + Task](screenshots/final-ui-repair-20261107/native-current/goals-task-created-native.png) |
| Calendar week grid and scrolling | **PASS after fix** — the native check reproduced a clipped Sunday column at 1400px. Reducing the weekday minimum from 96px to 84px (84px per overlap lane) makes the full week fit: 708px scroll/client width. A native wheel action scrolled the calendar internally (816px content/610px viewport); continued wheel input at its boundary scrolled the parent page. | [Calendar](screenshots/final-ui-repair-20261107/native-current/calendar-native.png), [internal scroll](screenshots/final-ui-repair-20261107/native-current/calendar-internal-scroll-native.png), [page scroll handoff](screenshots/final-ui-repair-20261107/native-current/calendar-page-scroll-handoff-native.png) |
| Sidebar search removal | **PASS** — no input in expanded or collapsed main navigation; global TopBar search remained visible. | [expanded](screenshots/final-ui-repair-20261107/native-current/sidebar-expanded-native.png), [collapsed](screenshots/final-ui-repair-20261107/native-current/sidebar-collapsed-native.png) |
| Dashboard, Calendar, Analytics, Focus Protection, EONPAI, Rewards, Settings | **PASS for render smoke only** — awaited each view's actual root after lazy loading and confirmed no document-level horizontal overflow. Settings dialog opened and closed. These were not full feature acceptance tests. | [Dashboard](screenshots/final-ui-repair-20261107/native-current/dashboard-native.png), [Calendar](screenshots/final-ui-repair-20261107/native-current/calendar-native.png), [Analytics](screenshots/final-ui-repair-20261107/native-current/analytics-native.png), [Focus Protection](screenshots/final-ui-repair-20261107/native-current/focus-protection-native.png), [EONPAI](screenshots/final-ui-repair-20261107/native-current/eonpai-native.png), [Rewards](screenshots/final-ui-repair-20261107/native-current/rewards-native.png), [Settings](screenshots/final-ui-repair-20261107/native-current/settings-native.png) |

Commands/results:

```text
frontend: npm run build                                      PASS (TypeScript + Vite)
frontend: npm run tauri:build -- --no-bundle                 PASS (current dirty source, Calendar width fix included)
frontend: LD_LIBRARY_PATH=<extracted usr/lib64> WEBKIT_WEBDRIVER_PATH=<extracted WebKitWebDriver> npm run test:tauri:native -- --spec e2e/tauri-native/ui-layout.spec.js
                                                               PASS 1/1; disposable profile /tmp/shinpo-native-wdio-9UJ4Xs
frontend: LD_LIBRARY_PATH=<extracted usr/lib64> WEBKIT_WEBDRIVER_PATH=<extracted WebKitWebDriver> npm run test:tauri:native -- --spec e2e/tauri-native/views-smoke.spec.js
                                                               PASS 1/1; disposable profile /tmp/shinpo-native-wdio-PsicUF
Latest rebuild retest: ui-layout.spec.js PASS 1/1 (/tmp/shinpo-native-wdio-W2kUyu); views-smoke.spec.js PASS 1/1 (/tmp/shinpo-native-wdio-V1njOn)
QA preflight: ports 8080 and 5432 not listening in both native runs.
```

`views-smoke.spec.js` now waits for each view's actual root element rather than treating selected navigation as completed rendering. A previous capture made before this wait showed the lazy-loading placeholder and is superseded by the current screenshots.

## Theme and viewport coverage

- Current native captures used the selected appearance shown by the disposable account; this pass did not cycle every theme. The selected rendered palette is visible in the screenshots.
- The existing desktop browser suite also checks Classic dark/light and Aurora dark/light for auth, Analytics error states, and general tab rendering/accessibility, but this does not cover every page/state/theme combination.
- Full interaction coverage for Dashboard/Analytics/Focus Protection/EONPAI/Rewards/Settings (render smoke only), Classic/Aurora all-page matrix, 1920×1080, narrower-than-1280 window, Windows WebView2, screen-reader behavior, vault lock/restart persistence, Guardian enforcement, and Browser Companion: **NOT TESTED**.
