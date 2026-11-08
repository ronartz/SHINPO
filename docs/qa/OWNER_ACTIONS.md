# Owner actions for Fedora Guardian qualification

## Step 5 — disposable desktop acceptance (2026-11-05)

The current Tauri dev app is already running with a fresh disposable profile at `/tmp/shinpo-step5-tauri.eCyc2T`. Do not enter personal credentials or reuse a personal vault. The profile is not the installed release build.

Please test when available and report PASS/FAIL plus any visible error text (never send the password, recovery key, or pairing code):

1. Register a disposable account; note that the recovery key is shown only for the test and keep it private. Lock and unlock once.
2. Create a Goal and linked Task/Objective. Edit the task, mark it complete, and verify the displayed result.
3. Open Focus and confirm the preview changes with the midpoint option. Example: `30 min focus → 5 min midpoint break → 30 min focus · 60 min total focus` (the exact text depends on selected work/break durations). With midpoint disabled, it should state continuous focus and no break. Do not start with app observation unless explicitly choosing its consent control.
4. Separately create a scheduled session in Calendar. In Focus, use a disposable short custom test: 2 minutes work, midpoint enabled, 1 minute break, 1 minute grace, late-return penalty disabled. Observe start, pause/resume, first work block, break, grace, Return Required, return to Focus, and completion/reflection. This takes several real minutes; stop if the UI or timing appears unsafe or inconsistent.
5. Check Guardian defaults and status. It must not claim app closure; keep the app running and do not use personal/system processes as test targets.
6. Open EONPAI with provider disabled. Verify it identifies deterministic/offline mode, propose a safe task action, inspect the exact preview, and approve explicitly. Check the new task in Goals & Tasks. Inspect Analytics, Rewards, and Settings for consistent real counts and clear empty/error states.
7. Close SHINPO normally. Relaunch using the same disposable XDG profile below, unlock, and verify the Goal, Task, completed Focus/reflection and EONPAI conversation/action remain.

Relaunch command (only after closing the currently running QA window):

```bash
cd /home/eonx/Projects/SHINPO/frontend
export XDG_DATA_HOME=/tmp/shinpo-step5-tauri.eCyc2T/data
export XDG_CONFIG_HOME=/tmp/shinpo-step5-tauri.eCyc2T/config
export XDG_CACHE_HOME=/tmp/shinpo-step5-tauri.eCyc2T/cache
export XDG_STATE_HOME=/tmp/shinpo-step5-tauri.eCyc2T/state
npm run tauri:dev
```

The short-duration path is for manual functional checking only. Do not treat it as proof of full-hour Focus timing, installed-package behavior, browser pairing, or release readiness.

The agent cannot install system RPMs without the owner's sudo authentication or approve Fedora desktop-control permissions. No OS permission was bypassed.

## 1. Install the current QA RPM

Install the current QA RPM (SHA-256 `a91ccb7e6020eca08f225ad936e5794d1fa87ecde98b4045b6bb265a80fd59bf`):

```bash
sudo dnf install /home/eonx/Projects/SHINPO/frontend/src-tauri/target/release/bundle/rpm/SHINPO-1.0.0-1.x86_64.rpm
```

This installs the QA package system-wide. Confirm the package list includes the `browser-companion/` resources before continuing:

```bash
rpm -ql shinpo | rg 'browser-companion|shinpo-desktop'
```

## 2. Pair only a disposable browser profile

Use a new temporary Chromium profile (do not use the everyday profile for this qualification). In the installed SHINPO resource directory, run the registration script with exactly one selected browser, for example:

```bash
bash /usr/lib/SHINPO/browser-companion/register-browser-companion.sh --chrome
```

In `chrome://extensions`, enable Developer mode and choose **Load unpacked**, selecting `/usr/lib/SHINPO/browser-companion/chromium`. Restart Chrome. In SHINPO, create/unlock a disposable QA vault, open Settings, generate a pairing code, and pair the extension. Do not send the pairing code in chat or include it in logs.

The automated Chrome 155 diagnostic used a new profile and recorded that `--disable-extensions-except` is ignored by Google Chrome; no SHINPO service worker appeared, and opening its uninstalled `chrome-extension://` URL was blocked. Load unpacked through Chrome's own extension page; do not try to override the browser policy with more command-line switches. After loading, inspect the extension's service-worker entry and its own console for host connection errors.

Record whether the extension service worker starts, whether its status says paired and connected, and whether a current policy revision is visible. Then manually verify one known catalogued site in each Guardian mode and each Focus phase, noting that no unsafe process termination is enabled. Use disposable test sites/processes only; do not rely on enforcement for important work.

To remove the per-user native-host registration afterward, run the same script with `--uninstall`. Remove the temporary browser profile using the browser's profile manager. The app uninstall is separate and owner-controlled.

## Acceptance still blocked

System RPM installation and interactive app/browser operation are required before the installed Fedora acceptance can be marked passed. Windows runtime acceptance is a separate, unverified owner/platform action.

## November 6 final acceptance — disposable extracted-RPM profile

**Current package:** `/home/eonx/Projects/SHINPO/frontend/src-tauri/target/release/bundle/rpm/SHINPO-1.0.0-1.x86_64.rpm` (SHA-256 `a91ccb7e6020eca08f225ad936e5794d1fa87ecde98b4045b6bb265a80fd59bf`). It is extracted under `/tmp/shinpo-step6-rpmroot-20261105/rootfs`; this is an extracted-package QA run, not a privileged RPM installation. The isolated profile root is `/tmp/shinpo-final-acceptance-20261106`; it is separate from your normal SHINPO data. Keep the existing dev QA profile separate too.

Run this in one terminal to start the actual packaged Tauri binary with a new disposable profile and with no Spring/PostgreSQL/Ollama services required:

```bash
profile=/tmp/shinpo-final-acceptance-20261106
mkdir -p "$profile"/{data,config,cache,state}
env \
  XDG_DATA_HOME="$profile/data" \
  XDG_CONFIG_HOME="$profile/config" \
  XDG_CACHE_HOME="$profile/cache" \
  XDG_STATE_HOME="$profile/state" \
  /tmp/shinpo-step6-rpmroot-20261105/rootfs/usr/bin/shinpo-desktop
```

The same extracted payload can be installed on the owner's Fedora system with `sudo dnf install /home/eonx/Projects/SHINPO/frontend/src-tauri/target/release/bundle/rpm/SHINPO-1.0.0-1.x86_64.rpm`; installation was not performed by the agent. To validate the isolated extracted package, launch the Chromium companion in another terminal with this disposable native-host config and browser profile:

```bash
profile=/tmp/shinpo-final-acceptance-20261106
companion=/tmp/shinpo-step6-rpmroot-20261105/rootfs/usr/lib/SHINPO/browser-companion
XDG_CONFIG_HOME="$profile/config" bash "$companion/register-browser-companion.sh" --chrome
XDG_CONFIG_HOME="$profile/config" \
XDG_DATA_HOME="$profile/data" \
XDG_CACHE_HOME="$profile/cache" \
chromium --user-data-dir="$profile/chromium-profile" --no-first-run
```

In `chrome://extensions`, enable Developer mode → **Load unpacked** → select `$companion/chromium`. Inspect the extension's service worker and its console. In SHINPO, register a disposable account, keep the recovery key private, pair using the one-time code without sharing it, and verify the connected status/revision.

Record **PASS/FAIL** and visible outcomes for each item below; mark untouched items NOT TESTED. Never send passwords, recovery keys, pairing codes or private task text.

| # | Manual check | Result |
|---|---|---|
| 1 | Register disposable account in the packaged WebView | NOT TESTED |
| 2 | Lock and unlock; wrong password is rejected | NOT TESTED |
| 3 | Create Goal and linked Task | NOT TESTED |
| 4 | Edit and complete Task | NOT TESTED |
| 5 | Schedule a short Focus session | NOT TESTED |
| 6 | Start, pause, resume and finish Focus; note phase/time display | NOT TESTED |
| 7 | Guardian displays actual consent and warning-only enforcement | NOT TESTED |
| 8 | Offline EONPAI proposal preview; explicitly approve one safe task action | NOT TESTED |
| 9 | Analytics and Settings reflect the disposable account; note errors | NOT TESTED |
| 10 | In the disposable Chromium profile, verify one allowed learning site and one explicitly blocked test site during Focus | NOT TESTED |
| 11 | Cancel Focus; verify browser restriction is removed; close browser and lock vault, then confirm status is disconnected/safe | NOT TESTED |
| 12 | Quit and relaunch SHINPO with the same XDG profile; unlock and verify Goal, Task, Focus and EONPAI action persisted | NOT TESTED |

For host cleanup, close Chromium and SHINPO, then run `XDG_CONFIG_HOME="$profile/config" bash "$companion/register-browser-companion.sh" --uninstall`. Remove only this disposable browser profile with Chromium's profile UI; do not delete app or system data. App process termination remains warning-only. Do not install the Windows QA installer as trusted software; it will be unsigned and internal-only.

## November 6 — current-source visual and functional acceptance

Current source revision: `21244694469cfc9b85b6b877744aa458ddaa188d` on `codex/final-completion-20261031`. The current-source Tauri development app is running with a fresh profile at `/tmp/shinpo-visual-acceptance-20261106`. Startup screenshot: `/tmp/shinpo-visual-acceptance-20261106/tauri-startup.png` (1420×948; unauthenticated sign-in view). This is not an installed release build. Before launch, no listeners were present on 8080, 5432, or 11434. No registration, login, navigation, or control was activated by the agent because desktop input is unavailable in this Fedora Wayland session.

Continue in the open window to create a disposable account. Do not use a personal login or save the displayed recovery key in screenshots. Record the result for each page and theme; capture the active SHINPO window with `spectacle --activewindow --background --nonotify --output /tmp/shinpo-visual-acceptance-20261106/<name>.png` after navigating to it.

Acceptance checklist (mark only actions actually performed):

- [ ] Register disposable account; lock/unlock; wrong password rejected.
- [ ] Dashboard: empty and populated data; expand/collapse sidebar; change window to compact width; inspect overflow and controls.
- [ ] Goals & Tasks: create/edit/complete a goal and linked task; inspect board/list and empty states.
- [ ] Focus: inspect midpoint plan preview; start/pause/resume/complete a short disposable session; inspect reflection and persisted duration.
- [ ] Focus Protection: verify consent and observation status are truthful; only harmless test process fixtures; never target personal/system processes.
- [ ] Calendar: schedule a session; scroll page and calendar; inspect event selection, edit and cancel.
- [ ] Analytics and Rewards: confirm values follow the disposable account and empty states are clear.
- [ ] EONPAI with provider disabled: verify offline labeling, proposal preview, explicit confirmation, and persisted action.
- [ ] Settings: inspect theme and account controls; verify lock and relaunch persistence.
- [ ] Onboarding/tutorial: complete or skip with the disposable account; verify placement and keyboard controls.
- [ ] Repeat visual review for Classic dark/light and Aurora dark/light, collapsed/expanded sidebar and compact desktop width. Mark each unvisited combination NOT TESTED.
- [ ] Browser Companion: use a separate disposable browser profile; pair the extension and verify one allowed and one restricted site, then cancel Focus and verify policy removal. Do not use a personal browser profile.
- [ ] Standard/Strict Guardian: record whether foreground use is measurable and whether intervention is limited/warning-only. Do not test closure on personal applications.

The window currently open is the disposable dev build. After closing it, it can be relaunched with:

```bash
cd /home/eonx/Projects/SHINPO/frontend
profile=/tmp/shinpo-visual-acceptance-20261106
mkdir -p "$profile"/{data,config,cache,state}
env XDG_DATA_HOME="$profile/data" XDG_CONFIG_HOME="$profile/config" XDG_CACHE_HOME="$profile/cache" XDG_STATE_HOME="$profile/state" npm run tauri:dev
```

Agent evidence: Tauri shell initialization succeeded and the screenshot above was inspected. Account and all authenticated workflows are **NOT TESTED**; browser pairing/site enforcement, process intervention, all four theme combinations, compact authenticated layout, WebKitGTK frame-time profiling, installed RPM, and Windows runtime are **NOT TESTED**. Release status remains **NO-GO** pending security and runtime gates.
