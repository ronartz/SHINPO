# SHINPO Release Gate — 2026-11-03

**Source revision:** `cdb80f653f3176504484fbb5528edf026c065bba` plus uncommitted changes.  
**Decision:** **NO-GO.** This checklist records evidence gathered, not an approval.

| Gate | Status | Evidence / exact check |
|---|---|---|
| Clean-VM Linux installer install/launch/upgrade/uninstall | NOT TESTED | No clean VM install was run. `cargo test --manifest-path frontend/src-tauri/Cargo.toml --lib` is source-level verification, not installer evidence. |
| Clean-VM Windows installer install/launch/upgrade/uninstall | NOT TESTED | No Windows runtime is available in this Fedora session. Cross-compilation would not establish Windows runtime acceptance. |
| Sentinel protected-process exclusions and dry-run | NOT TESTED | Native closure remains disabled/warning-only; no real protected-process or packaged dry-run session was executed. |
| Tauri CSP and capability audit | PARTIAL / OPEN | Step 3 narrows production `connect-src` to `ipc: http://ipc.localhost`, removes broad HTTPS/WSS and external font requests, and tests CSP/network boundaries. `style-src 'unsafe-inline'` remains; no complete per-command capability audit was run. |
| Updater signing key custody and signed update verification | NOT TESTED | No signed updater artifact or clean-machine update verification was produced in this slice. Do not place signing secrets in source or local build logs. |
| Focus behavior across sleep, crash, and restart | PARTIAL | `native_vault::tests::native_heartbeat_keeps_ordinary_focus_alive_and_refreshes_policy`, `native_heartbeat_keeps_pomodoro_focus_alive_and_pauses_after_suspend`, `stale_focus_checkpoint_pauses_without_counting_sleep_time`, and restart/persistence tests pass. No hardware suspend, process-kill, or installed-app recovery test was performed here. |
| Rust idle expiry rejects privileged vault IPC | PASS (targeted) | `cargo test --manifest-path frontend/src-tauri/Cargo.toml --lib native_vault::tests::expired_native_vault_rejects_privileged_ipc_and_reports_locked_status` verifies expired status and `local_get_goals` rejection through Tauri mock IPC using a disposable SQLCipher vault. |
| Serialized cross-process login backoff | PASS (automated) | `cargo test --manifest-path frontend/src-tauri/Cargo.toml --lib native_vault::tests::concurrent_login_attempts_in_separate_processes_share_backoff` launches two subprocess test harnesses against a disposable vault. |
| Unix vault/account/metadata/database/auth-lock permissions | PASS (automated) | `native_vault::tests::local_vault_metadata_and_database_use_private_unix_modes` checks app/account dirs `0700` and vault metadata, SQLCipher DB, and auth lock files `0600`. Windows inherited ACLs are not tested. |
| Legacy wrapper migration interrupted before metadata replacement | PASS (automated) | `cargo test --manifest-path frontend/src-tauri/Cargo.toml --lib native_vault::tests::killed_legacy_wrapper_upgrade_keeps_old_metadata_and_unlock_path` kills the child after temp metadata fsync and verifies the old wrapper remains usable. |
| Fedora OS lock/suspend notification delivery | NOT TESTED | D-Bus source compiles; read-only `busctl --system call org.freedesktop.login1 /org/freedesktop/login1 org.freedesktop.login1.Manager GetSession s 2` returned `o "/org/freedesktop/login1/session/_32"`. Actual `Lock`/`PrepareForSleep` delivery and key drop were not triggered. |
| Recovery-key confirmation UX | FAIL / OPEN | Registration currently displays the recovery key but does not require a typed confirmation. |
| Encrypted backup/restore | FAIL / OPEN | No implementation or disposable restore/corruption tests were found. |
| Browser extension live pairing/site enforcement | NOT TESTED | No separate browser profile was launched or paired in this security slice. |

## Commands and results from this checkpoint

- `cargo test --manifest-path frontend/src-tauri/Cargo.toml` — **65 passed, 0 failed, 1 ignored** in the library; binary and doc-test targets passed with zero tests. The ignored test is a live OS keyring test requiring an unlocked disposable desktop keyring. SQLCipher deliberately logs authentication failures during tampered-ciphertext tests.
- `cargo test --manifest-path crates/shinpo-shield/Cargo.toml` — **40 library + 40 binary tests passed**, doc-tests passed.
- `cargo test --manifest-path crates/shinpo-browser-host/Cargo.toml` — **9 tests passed**, binary/doc tests passed.
- `npm test` (from `frontend/`) — **132 passed, 0 failed**.
- `npm run lint` (from `frontend/`) — passed.
- `npm run build` (from `frontend/`) — passed; Vite still reports two existing ineffective dynamic-import warnings.
- Rust formatting and strict all-target Clippy passed for Tauri, Shield and Browser Host; `git diff --check` passed.

## Remaining release blockers

Recovery-key confirmation, encrypted backup/restore, complete capability/CSP review, dependency audit, real Fedora lock/suspend runtime, installed Fedora GUI/browser acceptance, Sentinel protected-process/dry-run evidence, Windows runtime, and signed-updater qualification remain open. Do not describe SHINPO as release-ready.

## Step 2 supplement — reproducible workflows and local package build (2026-11-03)

**Source revision:** `cb505099b4068779e136cc2b92cd1d9760c4bc08` on `codex/final-completion-20261031`; source and CI are local commits, not pushed. The earlier checklist above remains historical evidence; this supplement records the current source qualification.

| Step 2 gate | Status | Evidence |
|---|---|---|
| Complete app source in a clean checkout | PASS (Linux source) | Clean clone `/home/eonx/SHINPO-step2-clean-cb50509`, exact HEAD `cb505099b4068779e136cc2b92cd1d9760c4bc08`, clean at checkout. Recovery snapshot manifest verified with `sha256sum -c` at `/home/eonx/SHINPO-recovery-20261103-vault-security-final`. |
| Cargo/npm lockfiles tracked and used | PASS | Four lockfiles tracked; `npm ci` and Tauri/Shield/Browser Host Cargo commands with `--locked` passed. Hashes are in `SHINPO_UNATTENDED_PROGRESS_20261028.md`. |
| Workflow YAML/action references | PASS (static syntax only) | PyYAML parsed both workflows; 10 CI and 6 release action references each match a full 40-hex SHA. `actionlint` unavailable. Hosted GitHub evaluation NOT TESTED. |
| Frontend/browser validation | PASS (local clean clone) | Frontend 132/132; ESLint and Vite build passed; Browser Companion 25/25; `npm audit --audit-level=high` exited 0 with 12 moderate advisories remaining. |
| Linux Rust checks | PASS (local Fedora clean clone) | Tauri 65 passed/1 ignored; Shield 40 library + 40 binary tests; Browser Host 9 tests; strict Clippy, formatting and Tauri release binary build passed. |
| Linux installer formats | PASS (local build only) | `npm run tauri:build -- --bundles deb,appimage,rpm`; generated .deb/.rpm/AppImage and verified SHA-256 manifest. Debian and RPM package listings include browser host executable, both browser manifests, registration scripts and install guide. Files and hashes are recorded in the engineering ledger and retained under the clean clone's `release-artifacts/linux-x64/`. Not installed or published. |
| Windows hosted compile/installer | NOT TESTED | Workflow targets `windows-2025`, checks `cl.exe`, runs Tauri/Shield/Browser Host gates and has a tag-only NSIS installer job. No Windows runner executed. |
| GitHub Actions hosted run/tag trigger | NOT TESTED | Workflows remain local; do not claim a GitHub CI pass. Owner review/push is required before hosted execution. |
| Signing/release upload | NOT CONFIGURED / NOT RUN | Release workflow has read-only token permissions, no upload/publish action, no signing secrets and no signature claim. |

**Step 2 result: PARTIAL.** Local clean-checkout Linux source and package-build gates pass. Hosted Ubuntu/Windows behavior and the version-tag workflow remain unverified. Overall decision stays **NO-GO**. Do not begin Step 3 until owner review.

## Step 3 supplement — WebView network boundary (2026-11-04)

| Step 3 gate | Status | Evidence |
|---|---|---|
| Production WebView CSP | PASS (source + automated assertion + hosted builds) | `frontend/src-tauri/tauri.conf.json` production `connect-src` is exactly `ipc: http://ipc.localhost`; wildcard sources are rejected by `frontend/src/api/networkBoundary.test.ts`. Ubuntu and Windows hosted desktop CI passed on run `41871138031`. |
| Development CSP | PASS (source + automated policy assertion) | Only explicit Vite HMR socket `ws://localhost:5173` is additionally allowed; release CSP is unchanged by dev-server needs. |
| Local-vault frontend boundary | PASS (automated) | Central `fetchWithoutRedirects` rejects local Tauri-vault requests before `fetch`; STOMP client declines connection for local-vault sessions. Frontend scan guards raw network primitives, client imports and external CSS resources. No real authenticated WebView interaction was run. |
| External fonts/resources | PASS (source + automated assertion) | Google Fonts links removed; Nunito remains locally bundled via `@fontsource/nunito`. |
| Rust EONPAI providers | PARTIAL (mock transport tests) | Ollama is fixed to `127.0.0.1:11434`; cloud provider requires explicit context consent, validated HTTPS, keychain credential, no redirects, no proxy, bounded request/response and timeouts. Provider success/failure/timeout/cancellation tests ran in the full Rust suite; no real provider was configured or contacted. |
| Frontend-to-native provider and authenticated workflow | NOT TESTED | No actual authenticated Tauri WebView chat/action session was exercised in this network observation. |
| Actual ten-minute process-scoped traffic observation | PASS (idle startup only) | Release-mode Tauri process PID 58217, disposable XDG profile `/tmp/shinpo-step3-net.V3CGbP`, 20 `ss -ntup` samples at 30-second intervals from 2026-11-04 22:13:16 to 22:22:46 +05:30; all reported no process-attributed IP sockets. Ports 8080/5432/11434 had no listeners. Capture: `/tmp/shinpo-step3-net.V3CGbP/connections.log`. Unauthenticated startup only; not an authenticated workflow or provider-enabled observation. |
| Linux hosted CI for Step 3 revision | PASS | GitHub Actions run [41871138031](https://github.com/ronartz/SHINPO/actions/runs/41871138031), merge commit `93775d6f22d61072ee30d1525dfc79e0d7117c7f`; Ubuntu desktop job completed success, including frontend tests/lint/build, Tauri tests/strict Clippy/fmt/build, Shield tests/Clippy, and Browser Host tests/Clippy. |
| Windows hosted CI for Step 3 revision | PASS (compile/build only) | Same hosted run and source revision: Windows MSVC desktop job completed success for frontend tests/lint/build, Browser Companion tests, Tauri tests/strict Clippy/fmt/binary build, Shield tests/Clippy and Browser Host tests/Clippy. No Windows installer or runtime test was run. |
| Hosted Rust dependency audit | FAIL / OPEN | Same run: secret-history scan passed; `cargo audit --deny unsound` failed on `glib 0.18.5` `RUSTSEC-2024-0429` and unmaintained `zvariant 5.15.1` `RUSTSEC-2026-0370`; it also reports unmaintained `proc-macro-error 1.0.4` `RUSTSEC-2024-0370`, `zbus_names 4.3.5` `RUSTSEC-2026-0371`, `zvariant_derive 5.15.1` `RUSTSEC-2026-0372`, and yanked `async-executor 1.14.0`. No suppressions or dependency overrides were added. |

**Step 3 status: PARTIAL.** Linux and Windows hosted desktop CI passed on the Step 3 commit; Windows result is compile/build evidence only, not Windows installer/runtime qualification. An unauthenticated idle-start network observation found no process-attributed IP connections. Authenticated native WebView behavior and provider-enabled traffic remain unverified. `style-src 'unsafe-inline'` and a full Tauri command-capability review remain open. The hosted Rust dependency audit failed on the advisories above; no suppression or dependency override was made. Overall release remains **NO-GO**.

## Step 4 supplement — Standalone runtime and legacy cleanup (2026-11-04)

**Source base:** `93775d6f22d61072ee30d1525dfc79e0d7117c7f` on `codex/final-completion-20261031`; Step 4 frontend changes remain uncommitted.

| Step 4 gate | Status | Evidence |
|---|---|---|
| Tauri account/auth cannot fall back to server | PASS (source + tests) | Desktop login/recovery/current-user/lock/password/username/delete select local IPC or explicit local errors. Locked-window regression confirms no `fetch`. |
| Shared HTTP/WebSocket boundary | PASS (source + tests) | API client rejects Tauri before fetch; fetch helper rejects all Tauri; backend/WS URLs empty; STOMP refuses Tauri. Production CSP unchanged. |
| Native standalone screen routing | PARTIAL (source trace) | Goals/tasks, Focus/schedule, local rewards/progress, derived Analytics, onboarding, Guardian, contextual website rules, EONPAI and pairing have Rust routes. No distinct Objective CRUD; Rewards objectives are derived. No end-user GUI route was driven. |
| Server-only controls hidden in desktop | PASS (source + build) | Tauri hides cloud endpoint/connection, REST/STOMP diagnostics, server telemetry/process controls and unsupported app-rule/override controls. Browser/server mode retains those controls. |
| Guardian and browser status honesty | PASS (source + regression) | Native catalog/version displayed; app handling clearly warning-only. Saved extension pairing is limited coverage and remains disconnected until live connection verification. |
| Real Tauri startup | PASS (startup only) | `npm run tauri:dev` with isolated profile `/tmp/shinpo-step4-tauri.ZXif3f`; Rust logged shell initialization. Ports 8080/5432/11434 were closed; only Vite `::1:5173` for dev HMR. No vault created. |
| Real account/core GUI workflow and restart persistence | NOT TESTED | Fedora remote-input permission unavailable; no UI controls were clicked. Exact disposable owner-assisted sequence is in the progress ledger. |
| Frontend checks | PASS | `npm test`: 140 passed/0 failed; lint passed; production build passed (two known ineffective dynamic-import warnings). |
| Rust checks | PASS (source unchanged) | Tauri 65 passed/1 ignored; Shield 80 passed; Browser Host 9 passed. Strict Clippy and formatting passed across all three crates. |
| Hosted CI for Step 4 source | NOT TESTED | Prior Step 3 run `41871138031` passed Ubuntu and Windows compile/build only at base source. Current Step 4 diff has no hosted run yet. |
| Legacy retirement | No deletion | Category A deletion: none proven safe. Spring/PostgreSQL and HTTP/WebSocket source remains for browser mode, migrations, parity tests and old server deployments. No historical migrations removed. |
| Security audit | FAIL / OPEN (preserved) | GLib `RUSTSEC-2024-0429` unsoundness; unmaintained zvariant/proc-macro-error/zbus_names/zvariant_derive; yanked async-executor. No suppressions or forced upgrades. |

**Step 4 result: PARTIAL; release remains NO-GO.** Source changes and local gates pass, but GUI workflows, updated hosted CI, Windows runtime and security audit remain open. Do not claim release readiness or distribute an installer.

### Step 4 hosted CI follow-up — 2026-11-04
- Step 4 code commit `4d7814307b112386950fce72cbf56ffc7f1a4d4f` was pushed only to the existing feature branch. GitHub Actions run [41887081141](https://github.com/ronartz/SHINPO/actions/runs/41887081141), overall **failure**: Ubuntu desktop **success** ([job](https://github.com/ronartz/SHINPO/actions/runs/41887081141/job/126774310334)); Windows MSVC desktop **success** ([job](https://github.com/ronartz/SHINPO/actions/runs/41887081141/job/126774309695)); legacy backend tests **success**; dependency gate **failure**, specifically `Audit Rust dependency lockfiles`.
- Windows result is build/CI evidence only, not installation/runtime. GUI workflows remain unobserved. Overall Step 4 remains **PARTIAL / NO-GO**.

## Step 5 — Real desktop acceptance + Focus UX (2026-11-05)

| Gate | Status | Evidence |
|---|---|---|
| Focus plan visible before start | PASS (source + unit test) | `FocusView` previews focus blocks, configured midpoint break, total work minutes and grace. The plan uses the native even-second split. Continuous Focus explicitly says no midpoint break. One-minute custom duration renders `30 sec`. `node --test src/utils/focusTimer.test.ts`: 15/15 passed. |
| Real Tauri shell startup, isolated profile | PASS (startup only) | PID 18310 and WebKit PID 18581, fresh XDG profile `/tmp/shinpo-step5-tauri.eCyc2T`; shell initialization logged. No owner data accessed. Vite was the only listener (`[::1]:5173`); ports 8080, 5432, 11434 had no listeners. |
| Registration through restart persistence in actual WebView | NOT TESTED | Fedora KDE Wayland remote-input/window access is unavailable in this environment; no form or button was operated and no account/vault was created. Owner said they will test later. Exact manual procedure is in `docs/qa/OWNER_ACTIONS.md`. |
| Frontend checks | PASS | `npm test`: 141 passed / 0 failed, 8 suites; ESLint passed; production build passed with two existing ineffective dynamic-import warnings. |
| Tauri, Shield, Browser Host checks | PASS (automated) | Tauri 65 passed / 0 failed / 1 ignored; Shield 80 passed; Browser Host 9 passed. Strict Clippy and formatting passed for all three crates. |
| Hosted CI at final Step 5 SHA | PARTIAL | Run [42004577384](https://github.com/ronartz/SHINPO/actions/runs/42004577384), SHA `179adcce30bc6913f2b5df19b9ac37f97d6e1b22`: Ubuntu desktop job passed; legacy backend passed; security/dependency job failed. Windows MSVC was still running Tauri Rust tests when checked. Windows runtime/install is not proven by CI compilation. |
| Focus phase behavior in real GUI | NOT TESTED in this slice | Existing Rust tests cover midpoint, grace, return-required, pause/resume and persistence boundaries; no owner-operated session was completed. |
| Release status | NO-GO | Authenticated WebView workflow, actual persistence/restart, real Guardian/EONPAI actions and outstanding RustSec/security gate remain unverified/open. |

**Step 5 result: PARTIAL.** The new Focus preview and local quality gates pass. The real GUI journey is explicitly pending owner interaction; no release claim is made.

## November 6 final release qualification supplement (2026-11-05)

**Latest source:** `d170573052943e40d826764c8896b308f587658e` on `codex/final-completion-20261031`. Only the Tauri Cargo lockfile changed from reviewed `179adcce`; it advances yanked `async-executor` 1.14.0 to 1.14.1. This was pushed to the existing feature branch; no tag or release was created.

### RustSec findings and exact paths

| Finding | Dependency path / impact | Remediation status |
|---|---|---|
| GLib unsound iterator implementation, `RUSTSEC-2024-0429` | `shinpo-desktop → tauri 2.12.3 → gtk 0.18.2 / webkit2gtk 2.0.2 → glib 0.18.5`. SHINPO does not directly call `VariantStrIter`; the GTK/WebKit dependency still ships the affected crate/API in Linux desktop builds. Advisory fix is glib 0.20+, outside the GTK 0.18 dependency family. `glib 0.18.6` is not published. No compatible update; do not override or suppress. | **FAIL / upstream blocker** |
| Unmaintained `proc-macro-error`, `RUSTSEC-2024-0370` | `glib 0.18.5 → glib-macros 0.18.5 → proc-macro-error 1.0.4`; GTK macro compile-time path. | **Open / no compatible replacement identified** |
| Unmaintained `zvariant`, `RUSTSEC-2026-0370`, `zvariant_derive`, `RUSTSEC-2026-0372`, `zbus_names`, `RUSTSEC-2026-0371` | `shinpo-desktop → keyring 4.2.0 → zbus-secret-service-keyring-store 1.0.1 → secret-service/zbus 5.x → zvariant 5.15.1, zvariant_derive 5.15.1, zbus_names 4.3.5`. Fedora Secret Service credential storage uses this chain. These are maintenance advisories; the components are merged into zbus 6, but current keyring/store depend on zbus 5. | **Open upstream migration; unsafe to force major override** |
| Yanked `async-executor 1.14.0` | `keyring → zbus-secret-service-keyring-store → zbus 5.19.0 → async-executor`. | **Fixed:** lockfile now uses 1.14.1. |

`cargo audit --deny unsound --file frontend/src-tauri/Cargo.lock`: exit 1; one denied unsound warning (`glib`) and four unmaintained warnings above. Equivalent audits for `crates/shinpo-shield/Cargo.lock` and `crates/shinpo-browser-host/Cargo.lock` exit 0, scanning 94 and 103 dependencies respectively.

### Fedora package and actual evidence

| Gate | Status | Evidence |
|---|---|---|
| RPM build | PASS (build only) | `npm run tauri:build -- --bundles rpm`; SHA-256 `a91ccb7e6020eca08f225ad936e5794d1fa87ecde98b4045b6bb265a80fd59bf`. RPM contains app, Browser Host, Chromium/Firefox assets and registration scripts. `ldd` reports no missing libraries for app or host. |
| Packaged binary startup | PASS (extracted payload only) | Extracted RPM to `/tmp/shinpo-step6-rpmroot-20261105/rootfs`; ran packaged `usr/bin/shinpo-desktop` for 15s with fresh XDG roots. Process stayed alive until timeout (124), emitted no stderr, and created only WebKit HSTS cache data. Ports 8080/5432/11434 had no listeners. Not an installed RPM or workflow test. |
| Fedora system installation and desktop workflow | NOT TESTED | No sudo/OS permission used; no account/vault created. Owner install/manual acceptance steps and current RPM hash are in `OWNER_ACTIONS.md`. |
| Browser pairing, blocked-site intervention, cancellation policy teardown | NOT TESTED | No live extension load/pair/navigation. Use isolated browser profile only. |
| Windows installer | PASS (internal CI build only) | Run [42022113884](https://github.com/ronartz/SHINPO/actions/runs/42022113884): `SHINPO_1.0.0_x64-setup.exe`, 7,528,162 bytes, SHA-256 `3f1e3129d7baaa9d825a0cca684a46e5b089151c85cdcac4ef8897cb2d480b3d`. Workflow checked Browser Host/extension inputs and Tauri resource mappings. Not uploaded, installed, or runtime-tested. |
| Hosted CI after final workflow fix | PARTIAL | Run [42022113911](https://github.com/ronartz/SHINPO/actions/runs/42022113911): Ubuntu desktop **success**, legacy backend **success**, security/dependency job **failure** at `Audit Rust dependency lockfiles`; Windows MSVC pending at last check. Earlier run `42012884836` passed both desktop compile/build jobs on lock update `d170573`. |

**Decision: NO-GO for private end-to-end use/release.** The unsound GLib dependency gate, missing installed Fedora/user-flow and browser acceptance, and absent Windows install/runtime test remain blockers. Supervised owner-operated QA may use disposable data only; it is not release qualification.

## November 6 acceptance continuation — Windows runner and owner workflow (2026-11-05)

- **Branch:** `codex/final-completion-20261031`, current source `2124469` (`ci: fix NSIS resource report path handling`), following `f47ce8d` (`ci: initialize MSVC for branch installer QA`). Release workflow gained an exact feature-branch trigger for an unsigned internal NSIS QA build; branch runs skip Linux package jobs and do not upload artifacts. Version-tag builds remain as before. Windows path initializes the MSVC environment and SQLCipher OpenSSL like the passing CI workflow, checks prepared Browser Host/extension resource inputs and Tauri mappings, and logs filename, byte size and SHA-256.
- First branch installer run [42018304214](https://github.com/ronartz/SHINPO/actions/runs/42018304214) failed before build because `cl.exe` was not initialized. The corrected internal run [42022113884](https://github.com/ronartz/SHINPO/actions/runs/42022113884) passed and generated `SHINPO_1.0.0_x64-setup.exe` (7,528,162 bytes; SHA-256 `3f1e3129d7baaa9d825a0cca684a46e5b089151c85cdcac4ef8897cb2d480b3d`). Prepared Browser Host/extension files and Tauri source→destination mappings were checked. The installer was not uploaded, installed, or runtime-tested.
- Latest CI run [42022113911](https://github.com/ronartz/SHINPO/actions/runs/42022113911): Ubuntu **success**, legacy backend **success**, dependency security **failure**, Windows MSVC pending at last observation.
- Owner-only Fedora acceptance procedure with isolated XDG paths, extracted RPM command, disposable Chromium profile, extension pairing, and a 12-item PASS/FAIL/NOT TESTED matrix is in `docs/qa/OWNER_ACTIONS.md`. Agent performed no GUI input, no account creation, no extension pairing and no privileged RPM installation. Prior package-payload startup is not installed-app acceptance.

**Interim decision remains NO-GO** until owner-operated Fedora GUI/browser acceptance, Windows installer installation/runtime evidence and resolution of the RustSec policy gate are recorded.
