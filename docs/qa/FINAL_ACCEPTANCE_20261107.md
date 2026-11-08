# SHINPO Final Acceptance — 2026-11-07

## Candidate identity

- Branch: `fix/release-blockers-20261106`
- HEAD: `21244694469cfc9b85b6b877744aa458ddaa188d`
- Source under test: the current dirty worktree at that HEAD, not a clean checkout.
- At capture: 62 modified tracked paths and 51 untracked entries. Exact pre-report status: `FINAL_ACCEPTANCE_20261107_WORKTREE_STATUS.txt`.
- After the November 7 follow-ups: 63 modified tracked paths and 60 untracked entries. Current snapshot: `FINAL_ACCEPTANCE_20261107_FOLLOWUP_WORKTREE_STATUS.txt`.
- Recovery: `/home/eonx/SHINPO-recovery-20261107-worktree.patch` records the complete tracked diff against HEAD (mode 0600, 848,661 bytes, SHA-256 `d26d8556ba7c3b2cc81944e9683521d7f178fd2df178b10ae962ce4bf1256fc9`). Untracked files remain untouched in the worktree and are enumerated in the status snapshot; no commit/stage/reset was performed.
- The source changes were preserved; no reset, clean, merge, commit, or push was performed.

## Real Fedora runtime evidence

- Initial shell-only attempt: the development binary started, but the first capture was not SHINPO and was deleted. That attempt did not count as GUI evidence.
- **Superseding real native-window run:** `npm run test:tauri:native` launched `/home/eonx/Projects/SHINPO/frontend/src-tauri/target/release/shinpo-desktop` through Tauri Driver and WebKit WebDriver on Fedora Wayland. The WebView reported protocol `tauri:`. This was the actual Tauri app, not Vite/Chromium and not a mocked native bridge.
- Disposable profile: `/tmp/shinpo-native-wdio-YgFO2x/`; vault: `/tmp/shinpo-native-wdio-YgFO2x/data/com.shinpo.app/vaults/qa_wdio_1793983749790/`. The isolated SQLCipher database was created (114,688 bytes); `file` identified it as `data`, and an explicit header check confirmed it does not begin with the plaintext SQLite signature. No owner vault or browser profile was accessed.
- Runner preflight confirmed ports 8080 and 5432 had no listeners. They remained stopped for the native journey. Tauri, Tauri Driver and WebKit WebDriver exited after the test.
- Native screenshots (1400×900) and SHA-256 hashes are preserved under `docs/qa/screenshots/tauri-native-acceptance-20261106/`.
- Harness note: `@wdio/tauri-service` emitted warnings because the optional SHINPO Tauri window-state plugin is not registered. Basic WebDriver DOM interaction still completed; the test did not use mocks. A first expanded run reached the 5-minute Mocha timeout after Guardian; the test timeout was increased to 15 minutes and the complete run then passed in 9m59s.

## Authentication and authenticated-screen matrix

Results below reflect actual WebDriver interaction with a fresh Tauri release binary and disposable account. They cover page rendering/navigation only unless explicitly stated; they are not full control or persistence acceptance.

| Screen or workflow | Result | Evidence / limitation |
|---|---|---|
| Register workspace, recovery-key display and confirmation | PASS (limited) | Actual form submitted; recovery key UI appeared and confirmation was completed. Key recovery, and testing an unlock with the key, were not tested. |
| Lock, correct/incorrect unlock, relaunch, recovery | NOT TESTED | The registered disposable vault was not locked, reopened, or unlocked again. |
| Dashboard | PASS (render/navigation only) | Actual sidebar navigation and screenshot; empty account. Controls and actions were not exercised. |
| Goals & Tasks | PASS (render + create) | Follow-up run created a Goal and Task through the real WebView and verified both remained visible after navigating away/back. Edit/delete/complete and restart persistence remain untested. |
| Focus Engine | PASS (render/navigation only) | Actual sidebar navigation and screenshot; no Focus session was started. |
| Schedule / Calendar | PASS (render/navigation only) | Actual sidebar navigation and screenshot; booking and internal scroll behavior were not exercised. |
| Focus Protection / Guardian | PASS (inactive screen only) | Actual page rendered Inactive with 15 built-in catalog entries. It explicitly says this is not installed-app inventory and app selection/enrollment is unavailable. No process observation or enforcement was exercised. |
| Analytics / Rewards | PASS (render/navigation only) | Both pages rendered against the empty disposable account; no seeded values or data reconciliation. |
| Settings | PASS (open/close only) | Real settings dialog opened, screenshot captured and closed. Theme changes, persistence and other controls were not tested. |
| Onboarding | PARTIAL | Account registration/recovery-confirmation UI ran; no guided tutorial was completed. |
| EONPAI | PASS (empty/offline state only) | Actual screen showed `Offline · local planning` and `AI provider unavailable`; no model request or conversation was sent. |
| Browser Companion pairing and website policy | NOT TESTED | No disposable browser profile loaded or paired. |
| Windows installer/runtime | NOT TESTED | No Windows execution in this environment. |

### Confirmed Guardian product gap (source inspection)

The local Protection UI explicitly states that its built-in process catalog is not an installed-app inventory and that selection/custom app enrollment is unavailable. Therefore, the requested selectable installed-app rules are **not implemented**. This is a release blocker for that requirement; source inspection is not runtime verification.

## Linux package

- Command: `npm run tauri:build -- --bundles rpm` from `frontend/`.
- Result: build succeeded; RPM: `frontend/src-tauri/target/release/bundle/rpm/SHINPO-1.0.0-1.x86_64.rpm` (11,138,565 bytes).
- SHA-256: `a5d8e48c011615cd0125034685216cac66836c19d52c68c2c67756e8f943900d`.
- RPM metadata: `shinpo` 1.0.0-1, x86_64. Payload inspection confirmed the desktop binary, Browser Host, Chromium and Firefox extension files, registration scripts, and install instructions.
- `ldd` showed no `not found` libraries on this Fedora host. The extracted RPM binary ran for 12 seconds and was stopped by the planned timeout (exit 124, meaning it remained running through the smoke window). This was not an RPM installation or GUI acceptance.
- A non-root alternate-root RPM install was attempted and failed with `Operation not permitted` while creating the RPM transaction lock. No package was installed on the host or in the alternate root. No sudo was used.
- Windows installer build or runtime was not performed in this acceptance.

## Verification performed

- `npm test` from `frontend/`: PASS, 153 tests, 0 failures, 0 skipped.
- `npx eslint src/components/layout/Sidebar.tsx` and `npx eslint e2e/tauri-native/guardian.spec.js`: PASS.
- `npm run build`: PASS (TypeScript and Vite production build). Existing ineffective dynamic-import warnings remain for `focusSessions.ts` and `goalsAndMissions.ts`.
- `npm run tauri:build -- --no-bundle`: PASS; current release binary SHA-256 `f2be8d027bdee893c4b4556a26ae64615a529ae2bd2f1d43804e4c72c248e7dd`.
- `npm run test:tauri:native`: PASS, one real native WDIO scenario, 1 passed / 0 failed, elapsed 9m59s. It created a disposable account, confirmed the recovery-key screen, navigated all seven primary tabs, checked the Guardian beta catalog/status and limitation copy, opened/closed Settings, and captured nine screenshots. It did **not** exercise domain mutations, Focus, Guardian process observation/enforcement, lock/restart, Browser Companion, or AI provider requests.
- Sidebar defect fixed after first actual screenshot: warning-only `AUDIT_ONLY` had displayed as “Guardian ready” with the raw enum. It now displays “Monitoring only” and a human-readable `MONITORING ONLY` badge. Rebuilt and reran the native scenario; the assertion and screenshot confirm the corrected UI.
- `git diff --check`: PASS.
- Hosted CI, dependency audit, installed RPM, Browser Companion pairing, Windows installer/runtime were not rerun in this acceptance.
- Packaged RPM payload smoke: PASS for remaining alive through 12 seconds; not installed-runtime acceptance.
- Hosted CI, full test suites, dependency audit, native authentication, and provider/browser flows were not rerun as part of this acceptance.

## Follow-up: native Goal/Task interaction and modal accessibility — 2026-11-06

- Exact executable: `frontend/src-tauri/target/release/shinpo-desktop`, SHA-256 `bafdd14b6485342435b940a16b269d3ab15bfe7d94a02a19a4c405f3a0a8f8ce`.
- Command: `LD_LIBRARY_PATH=/tmp/shinpo-webkit-driver.QJK2v0/root/usr/lib64:$LD_LIBRARY_PATH WEBKIT_WEBDRIVER_PATH=/tmp/shinpo-webkit-driver.QJK2v0/root/usr/bin/WebKitWebDriver npm run test:tauri:native` from `frontend/`.
- Actual Tauri/WebKit run: PASS, 1 spec passed / 0 failed, elapsed 14m34s. Full output is preserved at `docs/qa/logs/tauri-native-goal-task-20261106.log`. The runner confirmed ports 8080 and 5432 closed; the WebView protocol was `tauri:`.
- Disposable profile: `/tmp/shinpo-native-wdio-poKugd/`; encrypted DB: `/tmp/shinpo-native-wdio-poKugd/data/com.shinpo.app/vaults/qa_wdio_1793986435680/shinpo.db`. The database was identified as binary `data`; the plaintext SQLite header signature was absent. Password/recovery key were not logged. No app restart/unlock was performed.
- Real form actions: created a Goal and Task in the WebView; clicked the Goal name label and confirmed focus moved to `create-goal-name-input`; verified both records appeared, navigated to Dashboard and back, then verified both remained visible. This demonstrates the UI/native save path and in-process reload, not persistence across process restart. Screenshot: `docs/qa/screenshots/tauri-native-goal-task-20261106/goals-task-created-native.png`.
- Reproduced accessibility defect and fix: Create Goal dialog heading and input shared `id="create-goal-title"`, colliding the dialog accessible name with the label target. The heading now uses `create-goal-dialog-title`; input and label use `create-goal-name-input`. The real interaction above verified label-to-input focus.
- The same run rendered Dashboard, Goals & Tasks, Focus, Calendar, Analytics, Rewards and EONPAI; Guardian showed 15 built-in catalog entries and stated installed-app selection is unavailable; Settings opened and closed. These checks cover rendering/navigation, not every control. Ten screenshots and SHA-256s are under `docs/qa/screenshots/tauri-native-goal-task-20261106/`.
- One earlier expanded run failed to find the Guardian catalog after navigation. This passing run rendered 15 entries; the earlier intermittent failure's cause is unknown and is not considered fixed.
- Fresh verification after changes: `npm test` PASS (153/153, zero skipped); ESLint on changed modal/sidebar/WDIO files PASS; JS syntax checks and `git diff --check` PASS; `npm run build` PASS (TypeScript + Vite, 1019 modules). `npm run tauri:build -- --no-bundle` passed before this runtime run; the tested executable includes the Goal modal ID correction.
- Release remains **NO-GO**. Goal/Task edit, complete, delete and restart persistence; Focus completion/reflection, midpoint-break lifecycle and restart recovery; lock/restart/recovery; live Guardian observations/intervention; Browser Companion; provider-backed EONPAI actions; RPM installation; Windows runtime; and compact-window/theme acceptance remain unverified. Installed-app selection remains a confirmed missing product requirement.

## Follow-up: native Focus controls — 2026-11-07

- Branch/HEAD remain `fix/release-blockers-20261106` / `21244694469cfc9b85b6b877744aa458ddaa188d`; tested binary remains `frontend/src-tauri/target/release/shinpo-desktop` (SHA-256 above).
- Added a focused native WDIO scenario and runner argument forwarding so the real desktop journey can be run independently: `cd frontend && LD_LIBRARY_PATH=/tmp/shinpo-webkit-driver.QJK2v0/root/usr/lib64:${LD_LIBRARY_PATH:-} WEBKIT_WEBDRIVER_PATH=/tmp/shinpo-webkit-driver.QJK2v0/root/usr/bin/WebKitWebDriver npm run test:tauri:native -- --spec e2e/tauri-native/focus-lifecycle.spec.js`.
- **PASS, real Fedora Tauri/WebKit UI:** disposable profile `/tmp/shinpo-native-wdio-YtUJhs/`; preflight confirmed ports 8080 and 5432 not listening; WebdriverIO reported `Spec Files: 1 passed, 0 failed, 1 total` in `00:04:46`. The actual UI entered ACTIVE, PAUSED, ACTIVE after resume, and READY after cancel. These are rendered-state observations from the running Tauri app, not mocked tests. Evidence screenshots and hashes: `docs/qa/screenshots/tauri-native-focus-20261106/`.
- The complete navigation journey was also rerun with Focus actions added. It exercised start/pause/resume/cancel, then rendered through Analytics, but exceeded the configured 900-second Mocha test timeout while continuing to Rewards. Captured log: `docs/qa/logs/tauri-native-focus-navigation-timeout-20261106.log`. This combined run is **FAIL (harness timeout)** and does not invalidate the separate focused pass; tabs after Analytics were not covered by this run. The prior Goal/Task run had already navigated through Rewards, EONPAI and Settings.
- Visual inspection of the focused-run screenshots confirmed those are native app captures. WebDriver scroll-to-element behavior shifted the document before the active-state captures, so their clipped top edge is not treated as a reproduced user-facing layout defect. The Focus session ended by cancellation; no long-duration timing was consumed.
- Runner warnings about the unregistered optional `@wdio/tauri-plugin` remain. The external WebKit driver setup is sensitive to `LD_LIBRARY_PATH` and explicit `WEBKIT_WEBDRIVER_PATH`; without those, driver startup fails before app launch.
- Focus control coverage is now **PASS for start/pause/resume/cancel only**. Session completion/reflection, midpoint break/grace/return-required, lock/restart recovery, persisted timing/XP, Guardian observation during Focus, and actual enforcement remain **NOT TESTED**. Release remains **NO-GO**; installed-app selection remains a confirmed missing product requirement.

## Follow-up: EONPAI composer clipping — 2026-11-07

- The saved native EONPAI screenshot showed the long composer placeholder wrapping into a second line that was clipped in the one-row textarea. Shortened it to `Ask EONPAI a question...` in `frontend/src/views/EonpaiView.tsx`; no provider behavior or layout contract changed.
- Rebuilt `frontend/src-tauri/target/release/shinpo-desktop`; the rebuilt binary SHA-256 is `7ba5003e1d53e50c12841290fc107c129f6b49f15a3dabf08f5f8b5740d6a0f2`.
- **PASS, native retest:** targeted WDIO run `npm run test:tauri:native -- --spec e2e/tauri-native/focus-lifecycle.spec.js`, with the documented WebKit environment, reports 1 spec passed in 5m25s. On a new disposable profile `/tmp/shinpo-native-wdio-YqzNNF/`, it reverified Focus ACTIVE → PAUSED → ACTIVE → READY and opened EONPAI; the actual textarea exposed the concise placeholder and the resulting 1400×900 screenshot was visually inspected. Full run output: `docs/qa/logs/tauri-native-focus-eonpai-20261107.log`; screenshots/hashes: `docs/qa/screenshots/tauri-native-focus-eonpai-20261107/`.
- Regression checks after the fix: `npm test` PASS, 153/153, zero skipped; `npm run build` PASS (TypeScript + Vite, 1019 modules); targeted ESLint and JS syntax checks PASS; `npm run tauri:build -- --no-bundle` PASS; `git diff --check` PASS. Existing Vite ineffective dynamic-import warnings and Tauri's macOS bundle-identifier advisory remain.
- Provider requests, offline EONPAI message submission/actions, and persistence across app restart were not exercised in this pass. The screenshot also shows the first-run welcome card until the user chooses a tutorial action; it intentionally overlays the lower-right workspace during onboarding.
- Release remains **NO-GO**: only Focus start/pause/resume/cancel and EONPAI composer display were added to real native interaction coverage. Account lock/unlock/recovery, goal/task edit/complete/delete and restart persistence, Focus completion/reflection/break lifecycle, Guardian process discovery/intervention, browser pairing, RPM installation, Windows runtime, and narrow-window/theme matrix remain unverified. Installed-app selection is still a confirmed product gap.

## Owner-assisted next steps

The automated native session has exited. Its disposable password and recovery key were generated only in the test process and intentionally were not logged, so that profile is not reusable for manual login. To repeat with a fresh profile, run `cd /home/eonx/Projects/SHINPO/frontend && npm run test:tauri:native` with `PATH` including `/home/eonx/.cargo/bin` and `WEBKIT_WEBDRIVER_PATH` set to an installed compatible WebKitWebDriver; the runner prints the generated profile path and keeps its artifacts.

1. Create a disposable workspace; record the recovery key privately and complete its confirmation.
2. Lock; unlock once correctly and once with an incorrect password; confirm the error is generic.
3. Close and relaunch the same isolated app; unlock and verify the account remains available; test recovery only with the disposable key if needed.
4. Create a Goal and linked Task, edit it, complete it, navigate away, and confirm persisted state.
5. Schedule a session; start, pause, resume, and complete using the shortest supported duration without changing the system clock. Confirm the persisted session and reward values.
6. Inspect Guardian consent/status and process observations. Do not authorize closure against personal apps. The installed-app selector requirement remains missing; report it as a failure if required for acceptance.
7. Open EONPAI, verify whether a provider is actually configured, send a safe prompt, and confirm any proposed mutation explicitly. Check history after restart.
8. Inspect Analytics, Rewards, Settings, onboarding, Classic/Aurora, and a compact window; report visible clipping or broken controls.
9. Use a separate disposable Chrome profile for extension loading/pairing and test policy only after pairing is visibly confirmed.

## Release recommendation

**NO-GO for release.** Real disposable account registration, Goal/Task creation, Guardian inactive-state rendering, primary-tab rendering/navigation, Settings open/close, and Focus start/pause/resume/cancel are verified. Authentication lock/restart/recovery, Goal/Task edits/completion/deletion and restart persistence, Focus completion/reflection and break lifecycle, live Guardian process discovery, Browser Companion pairing/policies, actual RPM installation, and Windows runtime remain unverified. Installed-app selection is a confirmed product gap.
