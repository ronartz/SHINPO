# SHINPO — Final Release Readiness (2026-10-28)

PROJECT: SHINPO  
SOURCE FINGERPRINT: `67d528cbc66b4a57f4aa96be388880c045325597a25181a6c9d4bf1497de57e4` (composite of HEAD, tracked diff, and untracked content; excludes this report)  
OVERALL STATUS: **NO-GO — not release qualified**  
FEDORA PERSONAL: **CONDITIONAL GO** (experimental owner-only use of local Goals/Tasks; do not rely on Focus continuity or protection)  
FEDORA PRIVATE BETA: **NO-GO**  
WINDOWS + LINUX PRIVATE BETA: **NO-GO**  
PUBLIC PRODUCTION: **NO-GO**  
P0 COUNT: **0 confirmed**  
P1 COUNT: **11**  
P2 COUNT: **3**  
P3 COUNT: **0**  
TESTS PASSED / FAILED / SKIPPED: **717 / 0 / 0** in the completed suites (131 frontend + 25 browser companion + 51 desktop Rust + 80 shield Rust + 9 browser host + 421 backend)  
SECURITY FINDINGS: **1 unresolved RustSec unsoundness advisory; required local-auth controls incomplete; no confirmed exploitable remote vulnerability in this scan**  
ACTUAL RUNTIME TESTING: **No current-source packaged Tauri GUI, authenticated native journey, or connected browser run in this scan. Windows not tested.**  
OCTOBER 31 FEASIBILITY: **Very unlikely for the required full standalone Windows/Linux release; insufficient evidence for a statistical probability.**  
EARLIEST DEFENSIBLE RELEASE WINDOW: **Owner-only Fedora trial: Nov 3–10, 2026; Fedora private beta: Nov 17–Dec 8; Windows/Linux private beta: Dec 1–22; public: no earlier than Jan–Feb 2027, conditional on closing the gates below. These are low-confidence engineering ranges, not promises.**  
REQUIRED OWNER ACTIONS: **Manually complete Fedora native acceptance after the Focus defects are fixed; provide a Windows runtime environment; decide whether the published 60-minute Focus contract or current “60 minutes total across two blocks” UI is authoritative. No permission to bypass OS input controls is implied.**

## 1. Scope and source freeze

- Repository: `/home/eonx/Projects/SHINPO`
- Branch: `codex/aurora-token-consolidation`
- HEAD: `cdb80f653f3176504484fbb5528edf026c065bba`
- Tracked diff: 147 modified tracked files; no staged changes. `git diff --binary` SHA-256: `7d0d2d2ac80944fc9830ce02914a0498ea462ab8fde934f213b87d0c5b367ec0` (+10,686/−6,588 lines). The additional files are the Shield diagnostics and formatting repairs recorded below.
- Untracked changes: 395 files / 59,087,917 bytes, excluding this report; content fingerprint: `a974bcc5bd928663ff739bf9a67026f4934c08bb4f1c70a81a1b0752619e4615`. Git status compresses these into directory entries, so the raw status count is not the file count.
- Composite fingerprint is `SHA-256("HEAD=<hash>\nTRACKED_DIFF=<hash>\nUNTRACKED_EXCLUDING_REPORT=<hash>")`. Test/build output under ignored `dist`/`target` directories is not included.
- Recovery snapshot `/home/eonx/SHINPO-recovery-20261028` exists and its listed files pass `sha256sum -c SHA256SUMS`. It is **not an exact snapshot of the current dirty tree**: its recorded status differs; its tracked patch is 2,674,220 bytes versus the current 2,794,578-byte patch. Do not rely on it as the sole recovery copy for today’s state.
- Linux artifact: `frontend/src-tauri/target/release/bundle/deb/SHINPO_1.0.0_amd64.deb`, 8,062,842 bytes, timestamp 2026-10-28 15:43 +0530, SHA-256 `6d899b053244c35b709499978bfbbe13e380116f90a94e3e90b44f586708d931`. This audit subsequently changed eight Shield Rust source files during targeted formatting and lint repair, all newer than the artifact, so the `.deb` is **not the current source build**. It was not installed or launched. AppImage and RPM outputs under `target/release/bundle` are dated Oct 26. No Windows installer was found in those bundle outputs.
- The active GitHub workflow config includes a Rust audit job. This working tree is heavily modified and uncommitted; it is not a tagged, reproducible release source. No signing or publication was performed.

## 2. Subsystem verification matrix

`Source` means code exists; `unit` means automated local tests; neither implies a working packaged workflow. “Runtime” below means an actual current-source desktop/browser run, not a Rust test fixture.

| Subsystem | Source / automated evidence | Integration / runtime status | Finding |
|---|---|---|---|
| Local registration, login, unlock, recovery, logout | Rust local-vault commands and frontend local-auth routing exist; encrypted-vault tests cover wrong password, recovery, reopen, and tampering. | **Implemented + unit-tested; packaged UI not verified.** Recovery key display is one-time UI text; user confirmation workflow was not established. | Password policy does not meet the specified normalization, length ceiling, breached-password, failed-attempt backoff, or automatic-lock requirements. |
| SQLCipher storage and migrations | Bundled SQLCipher is required (`PRAGMA cipher_version`); Argon2id uses 64 MiB, t=3, p=1; a random data key is wrapped with XChaCha20-Poly1305; v1–v3 migrations are transactional. Tests cover preservation of legacy records, rollback/retry, future schema rejection, wrong key, tampered ciphertext, and no plaintext fallback. | **Strong source/unit evidence; no installed-vault migration run.** | Encrypted local store is a real implementation. Backup/restore and upgrade recovery of an installed user vault remain unverified. |
| Goals, tasks, completion | Local Rust CRUD and progress-event handling are registered through Tauri; task/goal event writes are transactional and use stable idempotency keys. | **Implemented; local unit coverage; no current GUI journey.** | No end-to-end account-isolation test in packaged UI. |
| Kanban and task ordering | Shared React task manager and local task API exist. | **Source present; current native drag/reorder persistence not runtime-verified.** | Full task workflow is not accepted by source presence alone. |
| Calendar and scheduling | Local `calendar_sessions` persistence, date filtering and schedule UI exist. | **Implemented in source; native calendar view, scroll behavior and restart persistence not rechecked here.** | The local calendar is focus-session scheduling, not evidence of every product-planned reminder/recurrence feature. |
| Focus timer and persistence | Rust stores phases, deadlines, revisions and active seconds; 17 Tauri tests cover transitions, pause/resume, vault reopen and XP idempotency. | **Lifecycle unit-tested; native runtime not tested.** | Confirmed stale-checkpoint issue for non-Pomodoro Focus (DEF-01); 60-minute contract mismatch (DEF-03). |
| Break, Grace, Return Required | Local Rust transitions and policy snapshot fields exist; boundaries are accelerated in tests. Current test config for 60 minutes expects first break after 30 minutes. | **Unit-tested only; no real-time or connected browser acceptance.** | UI says 60 minutes total over two 30-minute blocks, while V2 acceptance specifies 60 minutes Focus before the break. |
| Session completion, reflection, history | Local schema and completion IPC support reflection and completion metadata. Completion event logic has tests. | **Source/unit evidence; not exercised through the packaged app.** | Full reflection/restart flow remains unverified. |
| XP, rewards, milestones, streaks | Local XP ledger has unique event keys and completion tests; frontend derives progress/achievements; analytics reads persisted local focus/task records. | **Core event logic unit-tested; full reward UI and streak acceptance not run.** | Required late-return XP penalty is explicitly deferred and absent in native local code. |
| Analytics and reporting | Local analytics adapter derives values from actual local focus sessions and tasks; backend also has period endpoints and tests. | **Unit/backend-tested; no authenticated UI runtime.** | No fabricated analytics source was found in the inspected local path; visual/current-window acceptance remains unverified. |
| Sentinel | Rust daemon and UI exist; Shield has 79 passing tests. The Tauri start command defaults to HTTP `http://localhost:8080`. The enforcer passes `enrollment_identity_verified=false`, so the current desktop integration remains warning-only. | **Unit-tested; no native process test. Offline standalone integration is absent.** | Safe from unverified termination by design, but this does not meet the requested active local enforcement feature. No process-close success may be claimed. |
| Browser Companion | Manifest V3 source, native host pairing/token revocation, local policy publisher, host lease and phase-aware extension logic exist. Extension 22 tests and host 9 tests pass. | **Unit-tested only. Not installed/paired; no real website navigation.** | Local host policy can expire after 60 seconds for non-Pomodoro Focus because only active Pomodoro UI refreshes session state every 2.5 seconds (DEF-02). |
| Contextual Focus / learning resources | Local resource CRUD and browser-policy construction exist. | **Source/unit evidence; actual site-rule enforcement not tested.** | Permitted break-resource behavior is not accepted without connected-browser proof. |
| EONPAI conversations, providers, planning, actions | `frontend/src/api/ai.ts` routes to `/api/ai/*` through the backend base URL. No local conversation table or local model/provider command exists in `native_vault.rs`/Tauri IPC. | **Backend path testable; standalone offline path absent. No live AI provider run.** | Core AI screen/actions require a reachable backend; no-AI fallback or local Ollama integration is not implemented in the inspected path. |
| Settings/preferences | Theme, view and other UI settings exist. | **Partial source evidence; complete offline persistence and native behavior unverified.** | Do not equate UI controls with locally persisted functionality. |
| Onboarding | React tour and backend onboarding service exist; local reward command exists. | **Unit/source evidence; fresh local-account six-step completion not runtime-tested.** | First-run behavior and reward persistence remain unverified on the packaged app. |
| Notifications | Toasts/UI exist; WebSocket event stream is backend-oriented. | **Local action feedback exists; standalone live/server events are unavailable.** | Backend-dependent notifications degrade offline. |
| Account isolation | Vault commands require an unlocked `VaultManager`; database operations are behind the vault access helper and paths reject traversal/symlink cases in tests. | **Path/security unit tests; no multiple-account packaged UI test.** | One unlocked local vault is exercised by current tests; cross-account UI isolation is not runtime-verified. |
| Backup, delete-all, upgrade recovery | SQL schema migrations are present; destructive Goal/Task deletes exist. No verified encrypted local-vault backup/restore journey was found. | **Not verified.** | Data portability, secure deletion semantics, and restore after reinstall remain open. |

### Product-contract conflict

The requested local-first desktop architecture says no developer-hosted service may be required. `docs/product/SHINPO_PRODUCT_SPEC_V2.md` still calls the backend authoritative for phases, policy revisions, reward ledger and penalty idempotency. The latest owner directive controls this scan’s target, but the repository’s specs and backlog still encode mixed server/local authority. A release implementation must have one authority contract; otherwise clients can disagree about Focus time and XP.

## 3. Security findings

### Confirmed or release-gating

1. **Local credential controls incomplete — High release risk.** `frontend/src-tauri/src/native_vault.rs:2272` accepts 12–1024 bytes (not the specified 12–128 normalized characters); no NFKC normalization, breached-password check, persisted exponential failure delay, or idle/sleep/screen-lock auto-lock was located in the native auth path. Wrong-password rejection is tested; **a lockout/backoff is not**. A local attacker able to repeatedly access the account-unlock surface can perform repeated Argon2id guesses. Add the specified controls and negative tests before private distribution.
2. **Recovery confirmation and backup coverage — unresolved.** Recovery key is shown once via an alert in `frontend/src/App.tsx` (around line 1173), but the user-confirmation step and encrypted local-vault backup/restore workflow were not demonstrated. Losing the password and recovery key, or corrupting the only vault copy, can make local data unavailable. Do not claim resilient recovery.
3. **RUSTSEC-2024-0429 in the locked native dependency graph.** `cargo tree --locked -i glib@0.18.5` shows `glib 0.18.5 → gtk 0.18.2 → Tauri 2.12.3 / Wry 0.57.0 / WebKitGTK 2.0.2` and related GTK crates. RustSec classifies this as `INFO Unsound`, affecting `VariantStrIter` iterator methods in glib >=0.15,<0.20; incorrect mutable out-pointer handling can produce undefined behavior or null-pointer crashes. SHINPO has no direct source call to `VariantStrIter` found in the reviewed tree, but transitive runtime exposure was not proven absent. No compatible lockfile-only fix was established; do not call it harmless or resolved. CI runs `cargo audit --deny unsound` against the Tauri lockfile, so this advisory is a release gate until fixed upstream or explicitly risk-accepted through the owner’s security process. [RustSec advisory](https://rustsec.org/advisories/RUSTSEC-2024-0429.html)

### Controls that have useful evidence, with limits

- SQLCipher is bundled and plaintext fallback is rejected in tests. Argon2id and XChaCha20-Poly1305 are used for wrapping; derived/data-key buffers use zeroizing types. Tests use disposable encrypted vaults. This is **source and test evidence**, not proof that an installed user database, OS ACLs, backups or a Windows vault are secure.
- Tauri release CSP has `script-src 'self'`, `object-src 'none'`, no `unsafe-eval`, and release devtools disabled. `style-src 'unsafe-inline'` remains; `connect-src` permits generic HTTPS/WSS. Main-window plugin capabilities list no plugin permissions. Rust custom IPC commands are still exposed to the bundled frontend and rely on request validation and vault checks.
- Shield currently fails closed for termination: `crates/shinpo-shield/src/enforcer.rs:340` passes `false` for verified enrollment identity. This is the safe behavior; it means destructive Sentinel enforcement is **not available**. No force-kill acceptance is claimed.
- Host pairing/token revocation and input validation have unit coverage. Native host/browser communication has not been exercised in a real browser. No claim of browser isolation or operational policy enforcement is warranted.
- OWASP TCASVS is a useful framework for desktop-client security verification; this source-and-test review is not a completed TCASVS assessment. [OWASP TCASVS](https://owasp.org/projects/thick-client-application-security-verification-standard)

## 4. Test and build evidence

All test databases were disposable. The backend database was a temporary PostgreSQL 16 container bound only to `127.0.0.1:15434`, database `shinpo_test`; it was stopped after the run. No personal PostgreSQL accepted the initial test connection: the first Maven invocation used its default `localhost:5432` and failed because nothing was listening there. The full suite was rerun with the explicit disposable endpoint and passed. The test log was `/tmp/shinpo-backend-full-test-20261028.log`; schema reached Flyway V29 and the V29 analytics index was present.

| Check | Command | Result |
|---|---|---|
| Frontend lint | `cd frontend && npm run lint` | Pass; exit 0. |
| Frontend tests | `cd frontend && npm test` | **122 passed, 0 failed, 0 skipped.** |
| TypeScript + production frontend build | `cd frontend && npm run build` | Pass; `tsc -b` and Vite build succeeded. Vite reported two ineffective dynamic-import warnings (`focusSessions.ts`, `goalsAndMissions.ts`). |
| Frontend dependency audit | `cd frontend && npm audit --audit-level=low` | Pass; 0 vulnerabilities. |
| Extension tests | `cd browser-extension && npm test` | **22 passed, 0 failed.** Unit tests only. |
| Extension dependency audit | `cd browser-extension && npm audit --audit-level=low` | **Not run successfully:** npm exits `ENOLOCK`; no lockfile exists. No lockfile was created during this scan. |
| Tauri Rust unit tests | `cargo test --locked --manifest-path frontend/src-tauri/Cargo.toml` | **17 passed, 0 failed.** Includes tamper/wrong-key, migration rollback, future schema, Focus phases and idempotent rewards. |
| Browser host Rust tests | `cargo test --locked --manifest-path crates/shinpo-browser-host/Cargo.toml` | **9 passed, 0 failed.** |
| Shield Rust tests | `cargo test --locked --manifest-path crates/shinpo-shield/Cargo.toml` | **79 passed, 0 failed** (39 library + 40 binary). Tests confirm unverified identity does not request termination. |
| Backend full Maven suite | Explicit disposable `POSTGRES_HOST=127.0.0.1 POSTGRES_PORT=15434 POSTGRES_USER=shinpo POSTGRES_PASSWORD=shinpo_audit_only POSTGRES_DB=shinpo_test mvn test` | **421 passed, 0 failed, 0 skipped** on rerun. This validates the retained Spring backend, not standalone desktop behavior. |
| Rust formatting | `cargo fmt --check --manifest-path …` for Tauri, host, Shield | **Pass** for Tauri, host, and Shield after formatting the Shield crate. |
| Strict Clippy | `cargo clippy --locked --manifest-path … --all-targets -- -D warnings` for Tauri, host, Shield | **Pass** for all three. Shield fix added `Default`, standard range checks and `is_multiple_of`; moved the binary test module below `handle_run` after Clippy exposed `items_after_test_module`. |
| Tauri config syntax | Python JSON parse of `frontend/src-tauri/tauri.conf.json` | Pass (syntax only; not an installed runtime or full policy audit). |
| Current-source Tauri installer | Existing local `.deb` | File/hash recorded above; not installed/launched. `dpkg-deb` was unavailable, so package metadata/install verification was not performed. |
| `cargo audit` | `cargo-audit` availability check | Binary unavailable in this environment. CI config installs 0.22.2 and runs `--deny unsound`; the locked glib finding remains unresolved. |

Aggregate passing test count is 670. It excludes lint/build/audit checks and does not establish native, browser, Windows, visual, performance, or complete user-journey acceptance.

## 5. Prioritized release-blocking defect register

Effort ranges are engineering estimates, not commitments; they assume no new architecture rewrite and exclude waiting for owner/platform access.

### P1 — release blockers (11)

**DEF-01 — Non-Pomodoro Focus can be interrupted at an old checkpoint.**  
Source: `frontend/src-tauri/src/native_vault.rs:21,1080–1219`; `frontend/src/App.tsx:1807–1848`. The vault treats a checkpoint older than 15 seconds as an interruption and pauses at its last saved time. Active Pomodoro sessions are read every 2.5 seconds; ordinary active Focus sessions have only a React display ticker and no native checkpoint refresh. Reproduction: start a non-Pomodoro local Focus, leave it running more than 15 seconds, then reload/navigate into a code path that reads the local session; reconciliation can pause it and omit time since the checkpoint. The stale-checkpoint unit test confirms fail-safe pause behavior, not normal-session continuity. **Impact:** lost/underreported Focus time and broken restart semantics. Fix durable heartbeat/checkpointing or a continuity model that does not mistake a healthy session for suspend. **Effort:** 1–3 days best case; 3–5 realistic. Verify normal and Pomodoro sessions, lock/reopen, sleep, clock change and app restart.

**DEF-02 — Local Browser policy lease expires for ordinary Focus.**  
Source: `crates/shinpo-browser-host/src/config.rs:~110–120`; `crates/shinpo-browser-host/src/lib.rs:235–265`; `crates/shinpo-browser-host/src/policy.rs:~25–100`; `browser-extension/src/background-core.js:60–110,360–375`; `browser-extension/src/lib/policy-engine.js:236–248`; `frontend/src/App.tsx:1834–1848`. Desktop snapshots receive a 60-second host lease. In local/no-backend mode the host only loads that cache and does not renew it. The frontend republishes by calling `local_get_focus_sessions`; its periodic 2.5-second call is gated on `pomodoroEnabled`. For ordinary Focus, the extension’s 30-second sync eventually receives an **INACTIVE** policy after lease expiry; `synchronizePolicy` replaces its active state and calls `releaseInterventionTabs`. The extension's degraded-cache path applies when the host request errors after expiry, not when the local host successfully returns an inactive policy. **Impact:** active Focus website intervention and synchronized phase state are lost after the lease expires. **Effort:** 1–2 days best; 2–4 realistic. Verify >60 seconds, phase transitions, disconnect, host/browser restart and tab behavior in a real browser.

**DEF-03 — Native 60-minute phase timing does not match the release acceptance sentence.**  
Source: `frontend/src-tauri/src/native_vault.rs:991–996,1080–1200`; `frontend/src/views/FocusView.tsx:355–364`; test `native_vault.rs:~2880–2950`; contract `docs/product/SHINPO_PRODUCT_SPEC_V2.md:20–27`. The native start deadline for a Pomodoro session is half of `duration_minutes`; the current test creates duration 60 and expects BREAK at 30 minutes. The UI explicitly labels 60 as total work in two blocks. The accepted workflow says **60 minutes Focus → 15-minute break → 10-minute grace**. These are different product semantics. **Impact:** the mandatory acceptance timing is not met as written. **Effort:** 0.5–1 day to align contract/UI/native math; 1–2 realistic including backend parity and tests. Verify all boundary times against the chosen contract.

**DEF-04 — Selecting a Focus preset disables Pomodoro.**  
Source: `frontend/src/views/FocusView.tsx:~410–430`, especially line 427 calling `setPomodoroEnabled(false)`. Reproduction: enable Pomodoro, select a Focus plan/preset, then inspect the checkbox/session configuration; the selection turns it off. **Impact:** user can unknowingly create a continuous session with no break lifecycle. **Effort:** 0.5 day best; 1 day realistic. Add UI/component regression covering preset selection and native request payload.

**DEF-05 — EONPAI is not standalone/offline.**  
Source: `frontend/src/api/ai.ts:~135–200` and all API methods in that module; no local conversation/provider IPC or conversation table found in `frontend/src-tauri/src/native_vault.rs`/`lib.rs`. Reproduction: run a Tauri local-vault account with Spring Boot stopped and invoke chat/planning/provider status; requests still target `/api/ai/*`. **Impact:** EONPAI conversations, planning and actions cannot operate in the required no-server mode. **Effort:** 4–8 days best for an honest no-AI/Ollama path; 1–3 weeks realistic for persistence, provider configuration, action validation and tests. User must choose/configure a local Ollama model or provider key; no provider key should be silently assumed.

**DEF-06 — Sentinel is server-dependent and deliberately warning-only.**  
Source: `frontend/src-tauri/src/lib.rs:138–225` (default URL `http://localhost:8080`, HTTP sync loop); `crates/shinpo-shield/src/enforcer.rs:340` (identity-verification argument is false); `docs/backlog/SHINPO_MASTER_BACKLOG.md:12`. Reproduction: launch local vault without Spring Boot; Shield sync cannot connect. With service present, source still suppresses termination absent verified enrollment identity. **Impact:** offline users do not get integrated process policy/enforcement; current behavior is safely limited. Do not “fix” by enabling termination. **Effort:** 3–7 days best; 2–4 weeks realistic including native local policy, consent/enrollment identity, audit and manual process tests.

**DEF-07 — Required late-break XP penalty is absent.**  
Source: `docs/backlog/SHINPO_MASTER_BACKLOG.md:11`; local `progress_events` logic in `native_vault.rs:~1790–1810` has idempotent award insertion but no penalty debit flow. Product spec requires one penalty at cutoff, capped per day and available balance. Reproduction: execute local phase transitions through Return Required and inspect progress ledger; no penalty event is written. **Impact:** required reward contract is incomplete. **Effort:** 2–4 days best; 4–7 realistic after continuity evidence and ledger semantics are settled.

**DEF-08 — Required local-auth and data-recovery controls are incomplete.**  
Source: `native_vault.rs:2272–2280`; no native NFKC/HIBP/backoff/auto-lock path found; no verified local encrypted backup/restore. **Impact:** falls short of the stated hardening requirements; repeated offline guessing and lost/corrupt vault recovery are not adequately addressed. **Effort:** 3–6 days best; 1–2 weeks realistic including OS sleep/lock integration, backup/restore atomicity and abuse tests.

**DEF-09 — Security audit gate is unresolved.**  
Source: locked `glib 0.18.5` graph above; `.github/workflows/ci.yml:127–133` runs `cargo audit --deny unsound`. `cargo-audit` was unavailable locally, so this run did not reproduce the CI command; the vulnerable locked version and advisory are verified. **Impact:** security CI is not shown green and has a known unsound dependency. **Effort:** unknown pending compatible upstream GTK/Tauri stack; do not force an incompatible GTK version or suppress the advisory. Verify on a current CI runner after the disposition.

**DEF-10 — Required platform/runtime acceptance is missing.**  
Evidence: current `.deb` not installed/launched; no authenticated native journey; browser extension not installed/paired; no current live website restriction test; Windows runtime not executed and no Windows installer in current bundle output. Fedora GUI input permission remains user-controlled. **Impact:** no reliable claim for Fedora installation, restart/unlock, Chrome-family/Firefox behavior, Windows WebView2, native messaging registration, or cross-platform protection. **Effort:** 2–4 days best for Fedora/manual browser run after fixes; 1–2 weeks realistic for Windows build + actual runtime and all eight browser/OS combinations if each is supported.

**DEF-11 — Current changes are not a releaseable frozen source and the recovery copy is stale.**  
Evidence: 147 tracked files changed, 395 untracked files, no commit/tag; existing recovery checksums pass but status/patch do not match current. `.deb` has no embedded source fingerprint or CI attestation and predates the Shield lint repair. **Impact:** reviewers/installers cannot prove exactly which source was distributed, and the existing recovery archive omits some current state. **Effort:** 0.5–1 day best; 1–3 days realistic for reviewed freeze, fresh verified recovery snapshot and reproducible CI artifact/hash; excludes fixes above.

### Resolved during follow-up — DEF-12

Shield’s initial six Clippy errors and the subsequent `items_after_test_module` error were fixed without suppressions. `cargo fmt --check` now passes for the crate.

### P2 — important (3)

**DEF-13 — Extension dependency audit is unavailable.** `npm audit` fails with `ENOLOCK` because `browser-extension` has no npm lockfile. This is a supply-chain reproducibility gap, not evidence of a known vulnerable package. Estimate 0.5–1 day to establish and review a lockfile and audit it.

**DEF-14 — Visual and interaction acceptance is not current-source evidence.** This scan did not render the current application in Fedora/WebKitGTK, capture Dashboard/EONPAI/Calendar/Rewards screenshots, or test responsive boundaries. Historical screenshots/tests cannot establish that the heavily modified working tree looks correct. **Impact:** visual regressions and accessibility issues may remain. Estimate 1–3 days of review/fixes after native GUI access; unknown if further defects appear.

**DEF-15 — Backend/local authority and offline notifications remain split.** V2 documentation still makes server phase/reward state authoritative while native code contains a second local implementation; STOMP/live events require the backend. This is distinct from the specific Focus defects above and can produce stale or absent notifications. Resolve the authority contract and test the selected architecture. Estimate 2–5 days depending on scope.

## 6. Platform acceptance

| Platform / target | Status | Evidence and remaining gate |
|---|---|---|
| Fedora Linux Tauri | **IMPLEMENTED UNVERIFIED** | `.deb` exists with hash; it was not installed/launched during this scan. GUI automation permission is not bypassed. Must manually create disposable account, complete Goals→Task→Schedule→Focus→reflection→restart→unlock and inspect error handling. |
| Fedora local encrypted vault | **UNIT VERIFIED; NATIVE UI UNVERIFIED** | Disposable encrypted Rust tests and migration preservation passed. No user vault was opened or modified. |
| Chrome/Chromium/Edge on Linux | **IMPLEMENTED UNVERIFIED** | Extension and host unit tests pass; no isolated profile pairing or website navigation. Must test installation, host manifest registration, phase policy, expiry and browser restart. |
| Firefox on Linux | **IMPLEMENTED UNVERIFIED** | Firefox manifest and host registration source/test exist; no runtime. |
| Windows Tauri / WebView2 | **NOT TESTED** | No runtime available; no installer in inspected current bundle output. Linux compilation is not Windows evidence. Test inherited vault ACLs, WebView2, installer, auth, restart and Focus. |
| Chrome/Chromium/Edge/Firefox on Windows | **NOT TESTED** | No Windows native-host registry or browser runtime evidence. |

**Smallest owner-assisted Fedora check after fixes:** use a disposable OS profile and test vault; install a newly source-attested `.deb`; create local account, goal/task and scheduled session; run the exact accepted 60→15→10 timing (accelerated for phase boundaries, then a genuine short live interaction); verify a blocked domain and explicit break-only domain in a disposable browser profile; close/reopen app and browser, unlock, compare persisted phase/revision/XP; confirm Shield reports warning-only/unavailable rather than claiming a process was closed. Do not use personal browser profiles or vaults. Windows requires an actual Windows machine/VM and the analogous test; no Fedora permission or WebView2 behavior should be inferred.

## 7. Release forecast and critical path

### Can SHINPO be distributed on October 31?

**Not with the required complete standalone Windows/Linux scope.** As of Oct 28, the required behavior has at least eleven P1 blockers, a known security-audit gate, no completed native/browser acceptance, and no Windows runtime. Several items require architecture and manual platform verification rather than a quick build fix. An Oct 31 owner-only experimental Fedora build is possible only if clearly labeled unsupported and used without relying on Focus continuity, Sentinel enforcement, Browser Companion enforcement, EONPAI, or sole-copy data safety. That is not the requested full-feature release. A numerical probability would be false precision; engineering assessment for the full scope is **very unlikely**.

### Conditional windows (low confidence)

- **Fedora personal trial:** Nov 3–10, 2026, after fixing checkpoint/policy behavior and completing manual create/use/restart/unlock against the packaged app. Limited single-owner trial only.
- **Fedora private beta:** Nov 17–Dec 8, only after standalone EONPAI behavior is honestly scoped, local protection semantics are fixed, auth/recovery controls are addressed, and the integrated Linux browser journey passes.
- **Windows + Linux private beta:** Dec 1–22, conditional on Windows build/installer, Windows vault ACL/runtime, native messaging registration, and real browser acceptance on every claimed supported browser/OS pairing.
- **Public production:** no earlier than Jan–Feb 2027, conditional on security disposition, reproducible signed releases, update/rollback, privacy/recovery flows, public support/install docs, and store review where applicable.

These are ranges based on remaining effort and required human/platform access; they shift if any manual run discovers additional faults. The public date is especially uncertain because current sources do not establish a remote production service or store approval, and this audit did not qualify those systems.

### Critical path

1. Resolve contract: one 60-minute phase versus 60 total Focus minutes across two blocks; fix preset behavior to match.
2. Fix durable local Focus continuity and keep browser policy alive/phase-correct without a server; test pause, lock, restart, suspend and lease expiration.
3. Implement and prove exactly-once penalty semantics only after continuity evidence is trustworthy; retain warning-only Sentinel until enrollment identity is verified.
4. Close local-auth, auto-lock, backup/restore and data-recovery requirements; disposition the glib advisory without suppressing it.
5. Complete local EONPAI/no-AI/provider behavior and offline settings/notifications within the agreed standalone scope.
6. Build from a reviewed frozen source revision; generate hashes/attestation and installers in CI; perform actual Fedora and Windows install/runtime tests, then the eight browser/OS acceptance combinations.

## 8. Final answer

**Can SHINPO be distributed on October 31, 2026?** Not as the promised complete standalone Windows/Linux product. A restricted, unsupported Fedora personal experiment may be possible, but it would not meet private-beta or release acceptance.

**What prevents a reliable release today?** Focus checkpoints can falsely interrupt ordinary sessions; browser policy leases can expire in local non-Pomodoro Focus; the 60-minute timing contract differs from native behavior; selecting presets disables Pomodoro; EONPAI and Sentinel still depend on Spring Boot for core paths; the late-return XP penalty and required auth/recovery safeguards are incomplete; the locked Tauri dependency graph contains an unresolved unsoundness advisory; and packaged native/browser/Windows runtime acceptance has not occurred. The current dirty source and stale recovery copy also prevent a dependable release freeze.

**Follow-up diagnostic repair (2026-10-28):** strict Clippy and Rust formatting now pass for Tauri, host and Shield. Frontend lint/build, all three `cargo check` commands, backend `./mvnw -q -DskipTests compile`, and extension JS syntax checks pass. No test suites were run for this follow-up. The old `.deb` predates these source changes and must be rebuilt before any runtime check.

No personal database or browser profile was changed. The isolated PostgreSQL test service was stopped after testing. No commit, push, deployment, or release was made.
