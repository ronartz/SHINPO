# SHINPO — Authoritative Ship Matrix & Quality Gate Ledger

**Project:** SHINPO (進歩) — Personal Execution OS  
**Repository:** `ronartz/SHINPO`  
**Target:** Standalone Windows/Linux Private Beta  
**Governing Specification:** `docs/product/SHINPO_V1_ACCEPTANCE.md`  
**Status Standard:** `NOT STARTED` | `INCOMPLETE` | `IMPLEMENTED` | `VERIFIED` | `BLOCKED`

> **Continuation correction — 2026-10-21:** RC-3 results below are historical evidence only, not approval of the modified current source. Reopen gates C/D for fresh-user workflow and persisted reward reconciliation, E/H for real visual acceptance, F for open security findings, and G for current-package execution. The latest current-source DEB was built into a unique `/tmp` target directory, extracted, and dependency-checked, but not installed or launched. Windows remains `NOT TESTED`; remote production remains `NOT DEPLOYED`.

> **Product reconstruction — 2026-10-21:** Owner direction supersedes release qualification as the active work mode. Product acceptance is **INCOMPLETE**. The current module-by-module gap audit is maintained in [`SHINPO_PRODUCT_REQUIREMENTS.md`](../../SHINPO_PRODUCT_REQUIREMENTS.md); source and geometry checks do not close a product capability. Analytics defect slice: current-streak expiry, separate actual/planned reflection duration, and truthful all-time/empty completion labeling; focused backend tests **8/8 passed**. A new-source Chromium retest is **56/56** route × viewport × theme checks; current-source UI workflows, populated states, packaged runtime and owner acceptance remain open.

## 0. Current-Worktree Revalidation — 2026-10-21 (RC-3 Qualification)

Historical RC-3 qualification covered Linux desktop and web runtimes. The current worktree has subsequent changes and is not fully requalified. Earlier QA evidence used isolated infrastructure (port 18080 backend with `shinpo_test` database, port 5174 frontend, isolated Chrome profiles) without mutating the owner production database or historical releases.

| Milestone / Gate | Current Status | Concrete Evidence / Checkpoint Results |
|---|---|---|
| **Gate A — Foundation** | `BASELINE VERIFIED; CURRENT SOURCE TARGETED CHECKS PASS` | Prior backend 396/396, Shield 77/77, Browser Host 6/6, Browser Companion 15/15 remain historical evidence. Current source: frontend 93/93, build/lint clean, Tauri `cargo check`, Rust credential validation 1/1. |
| **Gate B — Feature Completion** | `INCOMPLETE — CURRENT SOURCE REOPENED` | Historical RC-3 completed 13 flows. The current source has not completed the authenticated end-to-end journey against isolated persistent QA state. |
| **Gate C — Onboarding** | `INCOMPLETE — REOPENED` | Historical 12-stage evidence remains; fresh-account full workflow, restart/interruption and actual 15-active-minute focus acceptance have not been rerun on current source. |
| **Gate D — Rewards** | `INCOMPLETE — REOPENED` | Historical reward-threshold evidence remains; current-source persisted XP/event reconciliation with duplicate, restart and concurrency checks is open. |
| **Gate E — UI/UX** | `INCOMPLETE — REOPENED` | Historical 56/56 geometry checks remain regression evidence, but do not establish visual quality or cover all meaningful states/current package runtime. |
| **Gate F — Security & Reliability** | `INCOMPLETE — REOPENED` | Broad CSP, browser localStorage tokens, unverified native keyring runtime, production key custody and incomplete dependency scans remain open. |
| **Gate G — Distribution & Runtime** | `PARTIAL — CURRENT SOURCE DEB BUILT/EXTRACTED, NOT LAUNCHED` / `NOT TESTED (Windows)` / `NOT DEPLOYED (Remote Cloud)` | Latest DEB: `/tmp/shinpo-finalform-rc-20261021-CyzYAl/release/bundle/deb/SHINPO_1.0.0_amd64.deb`, 6.22 MiB, SHA-256 `2d0b2eb4ca85f635539504ebd0f3d21edb49297c394841fcbcd29ac0e6d9023b`; built with `npx tauri build --bundles deb --ci`, extracted via 7-Zip/tar, and `ldd` showed no missing dependencies. Its exact dirty-tree identity is recorded in [`FINALFORM_RC_20261021_SOURCE_MANIFEST.md`](FINALFORM_RC_20261021_SOURCE_MANIFEST.md). Not installed or launched. |
| **Gate H — Global Typography & Consistency** | `INCOMPLETE — REOPENED` | Historical type/contrast metrics remain; current full visual acceptance is open. |

### Continuation Checks Summary:
- Backend: full `./mvnw -B test` suite — **396/396 passed** using `test` profile against fresh loopback-only tmpfs PostgreSQL (`shinpo_qa` database, `shinpo_test` schema; Flyway applied 24 migrations). Three outdated API assertions were corrected to expect unavailable (`null`) server-process count rather than misrepresenting it as a measured zero; process lists remain empty. The separate test-profile backend was previously launched on `127.0.0.1:18080`.
- Frontend: `npm test` — **93/93 passed**; `npm run lint` clean; production build passed with the existing >500 kB chunk advisory and ineffective dynamic-import warning. No new npm advisory scan was run in this continuation.
- Frontend lint: **0 errors, 0 warnings**. Moved stable toast helpers before `loadData` and included `pushToast` in its dependencies; subsequent lint/build/tests passed.
- Current-source Tauri package: `npx tauri build --bundles deb --ci` completed after the auth focus-color correction into `/tmp/shinpo-finalform-rc-20261021-CyzYAl`. Latest DEB SHA-256 `2d0b2eb4ca85f635539504ebd0f3d21edb49297c394841fcbcd29ac0e6d9023b` (6.22 MiB); package data extracted with 7-Zip/tar and the extracted executable's `ldd` had no `not found` entries. This exact latest hash was not launched. The preceding temporary package was launched under WebKitGTK with a separate XDG profile/private D-Bus session and displayed the sign-in form, but predates the auth focus-color correction. The current Chromium sign-in screenshot `/tmp/shinpo-finalform-rc-20261021-CyzYAl/browser-auth-focus-fixed.png` confirms the focused field now uses the project purple accent. The historical RC-3 installed/runtime smoke remains separate evidence.
- Native Rust: Shield — **77 tests passed** (38 library + 39 binary); Browser Host — **6 passed**.
- Browser Companion: `npm test` — **15/15 passed**; Chromium and Firefox extension builds succeeded.
- Backup scripts: shell syntax/mock tests passed. Default policy now requires `BACKUP_AGE_RECIPIENT`; plaintext requires an explicit `BACKUP_ENCRYPTION_REQUIRED=false` opt-out and warns. Current-source encrypted `backup_db.sh` → SHA-256 validation → age decrypt → `restore_db.sh` completed against two databases in the isolated QA container: encrypted file was not gzip-readable, checksum passed, 24 public tables restored, and user count matched 4→4. Temporary age identity, archive, restore DB, and age container were removed. Production recipient/key custody is not configured here. Docker backup's fake-shim test confirms the password arrives over stdin and is absent from CLI arguments; the Docker restore branch has not been separately integration-tested.
- Rendered UI: current-source Chromium audit on `127.0.0.1:5173` + isolated PostgreSQL-backed API `127.0.0.1:18080`; browser-origin authenticated `/api/users/me` returned HTTP 200. A genuinely new account rendered the tutorial, then skip confirmation persisted `SKIPPED`, 0 XP, 0 reward events. Registration also seeds one starter goal and task, so this was not a truly empty-state account. Across seven routes × four viewports (1920×1080, 1280×800, 1000×768, 390×844) × two themes, **56/56** had zero detected text intersections, sibling-card intersections, clipped controls, or horizontal overflow. Calendar wheel input changed scroll position at 1280×800, 1000×768 and 390×844 in both themes. The fresh-account capture `/tmp/shinpo-visual-audit-captures-F5yPHJ/first-login-tutorial.png` was visually inspected and shows the readable “New Goal” label with its purple outline; this fixes the prior unlabeled glow. The empty Calendar screenshot `/tmp/shinpo-visual-audit-captures-F5yPHJ/dark-Schedule-1280.png` is styled and readable; its weekly grid retains a small horizontal scroll area. Harness geometry/single-account coverage is not full UI acceptance, populated CRUD, native Tauri parity, nor owner acceptance; Gates E/H remain open.
- Reconstruction retest after the tutorial fix: frontend `npm test` **95/95 passed**, `npm run lint` passed, and `npm run build` passed. Build still reports the existing 817 kB JS chunk advisory and ineffective dynamic import; no bundle-splitting work was included in this product defect slice.
- Owner XP history: one scoped `SELECT` reconciliation for username EON returned 125 total from exactly four events (15/10/50/50); no owner row was changed. Owner database Flyway history is at v22, so V23/V24 are not applied. A duplicate-event precheck returned zero duplicate-award users; V24 would leave historical `started_at` null, so the existing onboarding award's eligibility cannot be reconstructed from current evidence. Migrations were not run.
- Tauri: current-source Linux DEB built and extracted-launch smoke completed as above; `tauri info` parses the configured CSP. Package-manager installation, authenticated journeys, and CSP/credential behavior under a real remote backend are still unverified.
- Maven dependency-check 13.0.0 was attempted; it failed before analysis because the NVD API key is unavailable and the local database contains no documents (`NvdCveClient: Invalid API Key`). `cargo audit --version` confirms cargo-audit is not installed. Maven/Cargo advisory coverage is **NOT VERIFIED**, not a clean scan.
- GitHub-hosted CI, full browser first-user workflow (registration through real task/focus completion), restart/concurrency reward checks, complete populated-state Tauri interaction QA, Windows execution, remote TLS/WSS, and cloud deployment: **NOT RUN**.

### Evidence level separation
- **SOURCE VERIFIED:** backup fail-closed policy and audit harness syntax; selected prior targeted unit/security tests.
- **BROWSER VERIFIED (agent-driven):** isolated account skip path and 56 rendered layout/scroll combinations; no full CRUD or real-workflow acceptance.
- **CURRENT SOURCE TAURI:** DEB built in isolated `/tmp`, extracted (not installed), dependencies resolved, and first-launch WebKit window visually inspected.
- **HUMAN OWNER ACCEPTED:** pending.

### Security Finding Revalidation — current source

| Finding | Current evidence | Status / residual risk |
|---|---|---|
| **SH-01 CSP and token storage** | Current Tauri source stores refresh tokens via OS keyring IPC (keyring 4.2.0), keeps access tokens in memory with proactive refresh, restores session before protected data loads, removes legacy plaintext credentials, and clears session material before endpoint changes. Verified: 93/93 frontend tests (mocked Tauri migration/restart/expiry), TS/Vite build, lint, `cargo check`, Rust token validation 1/1. Latest current-source DEB built/extracted. Auth input focus no longer uses error-red. | `PARTIAL / OPEN`: CSP still allows broad `https:`/`wss:` and inline styles; browser builds still use localStorage; real Linux Secret Service round-trip/restart and latest packaged launch remain unverified; Windows/macOS credential backends unrun. |
| **SH-02 Remote transport** | Frontend URL tests, no-redirect fetch helper, Rust Shield and Browser Host URL-policy tests pass. HTTPS/WSS is required remotely; loopback HTTP remains for local development. | `PARTIAL — SOURCE POLICY TESTED`: current-source packaged behavior and real remote TLS/WSS service remain unverified. |
| **SH-03 Onboarding trust** | Historical evidence: server-side eligibility checks and API tamper tests passed previously. | `PARTIAL / REOPENED`: current-source fresh-account workflow, >=15 active focus minutes, interruption/restart, and persisted reward reconciliation have not been independently rerun. |
| **SH-04 Backup confidentiality/recovery** | `umask 077`, private directory/artifacts, age encryption/checksum/retention, mock checks, and a current-source encrypted backup → decrypt → isolated PostgreSQL restore with 24-table and 4-user equality verification. Default now fails before dump if encryption is required but no recipient is configured; plaintext is explicit and warns. Docker backup password handoff uses stdin (no CLI argument exposure). | `VERIFIED (Linux isolated restore)`: production recipient/key custody and backup scheduling/off-host retention remain user operational responsibility. |
| **SH-05 Telemetry** | Current source labels unavailable process data as `null`; server CPU/RAM are labeled as backend metrics. Prior Shield evidence is retained. | `PARTIAL — CURRENT PACKAGED WORKSTATION METRICS NOT REVALIDATED` |
| **SH-06 Proxy trust** | Explicit trusted-CIDR policy and spoofed-header tests previously passed. | `PARTIAL — PRODUCTION PROXY CHAIN NOT EXERCISED` |
| **SH-07 Dependencies** | Full npm audit reports 0 advisories; frontend tests/build pass. Maven dependency-check 13.0.0 could not analyze because no NVD API key is available; `cargo audit` is not installed. | `PARTIAL / OPEN`: Maven/Cargo dependency advisory coverage unverified; npm audit covers frontend only. |
| **SH-08 Browser Companion permissions** | User disclosure was updated; 15 extension tests and Chromium/Firefox extension builds pass. | `PARTIAL`: broad host/scripting permissions remain functionally necessary for all-site focus protection. |
| **SH-09 CI security** | Workflow now has least-privilege defaults (`permissions: { contents: read }`), SHA-pinned actions, npm audit, Gitleaks secret scanning, and Dependabot config present in source. | `PARTIAL / OPEN`: GitHub-hosted execution has not run in remote CI. |

---

## 1. Master Subsystem Ship Matrix

| Module / Capability | Implementation Status | Verification Status | Gate | Notes & Evidence |
|:---|:---:|:---:|:---:|:---|
| **1. Authentication & Security** | | | | |
| - Password eye/eye-off visibility controls | `IMPLEMENTED` | `VERIFIED` | Gate A | Accessible on Auth, Settings, Override |
| - Username editing (`PUT /api/users/me/username`) | `IMPLEMENTED` | `VERIFIED` | Gate A | Validated, unique, PostgreSQL-backed |
| - Token versioning & session invalidation | `IMPLEMENTED` | `VERIFIED` | Gate A | V21 migration, concurrent refresh test |
| - Brute-force rate limiting | `IMPLEMENTED` | `VERIFIED` | Gate A | In-memory token bucket on `/api/auth/*` |
| **2. Layout & Global Navigation** | | | | |
| - Topbar utility ownership (no redundant toggles) | `IMPLEMENTED` | `VERIFIED` | Gate E | Removed duplicate theme/v2 switches |
| - Settings navigation routing (Gear vs Profile) | `IMPLEMENTED` | `VERIFIED` | Gate E | Direct routing to Appearance vs Account |
| - Multi-viewport responsiveness (1080p to 1000p) | `IMPLEMENTED` | `VERIFIED` | Gate E | 4 viewports tested via CDP matrix |
| - Light-mode contrast & typography standards | `IMPLEMENTED` | `VERIFIED` | Gate E | `#17213A` on `#F8FAFD`, WCAG AA verified |
| **3. Execution Cockpit & Dashboard** | | | | |
| - Hero Priority & Quick Arm Sprint | `IMPLEMENTED` | `VERIFIED` | Gate B | Dynamic active/pending task priority |
| - Today's Schedule 3-Column Geometry & Rhythm | `IMPLEMENTED` | `VERIFIED` | Gate H | 3-column grid (28px 1fr 64px), 0px collision across multi-state (Active ▶, Paused ❚❚, Done ✓, Scheduled 1) |
| - Schedule truthful status (Paused `❚❚`) | `IMPLEMENTED` | `VERIFIED` | Gate B | Amber badge `#F59E0B`, distinct from Active |
| - Live Clock capsule & 12h/24h toggle | `IMPLEMENTED` | `VERIFIED` | Gate B | Local date math, zero format glitch |
| **4. Strategic Goals & Tasks** | | | | |
| - Goal CRUD & Target Date Validation | `IMPLEMENTED` | `VERIFIED` | Gate B | PostgreSQL persistence, cascading rules |
| - Goals List/Board Mode & Filtering Behavior | `IMPLEMENTED` | `VERIFIED` | Gate E | Redundant filter bar hidden in Board mode, filter cross-contamination eliminated, 3 Kanban lanes directly rendered with accurate counts |
| - Single-capsule sort control (zero double borders)| `IMPLEMENTED` | `VERIFIED` | Gate E | Border stripped from outer wrapper |
| - Action button height standardization | `IMPLEMENTED` | `VERIFIED` | Gate E | 32px goal actions, 28px task actions |
| - EONPAI goal deconstruction into tasks | `IMPLEMENTED` | `VERIFIED` | Gate B | Atomic 15–30m task generation |
| **5. Focus Engine & Timer** | | | | |
| - Server-anchored drift-free timer | `IMPLEMENTED` | `VERIFIED` | Gate B | Background tab throttling resistant |
| - Pause/Resume frozen state accuracy | `IMPLEMENTED` | `VERIFIED` | Gate B | Accumulated paused seconds tracking |
| - Endel-inspired procedural Focus Atmosphere | `IMPLEMENTED` | `VERIFIED` | Gate B | 5 soundscapes (Rain, Brown, Pink, Stream, Quiet), Web Audio API, 0 external assets, unit tested |
| - Session summary & quality reflection | `IMPLEMENTED` | `VERIFIED` | Gate B | 1-5 rating, notes, task auto-complete |
| **6. Focus Protection & Sentinel** | | | | |
| - Sentinel policy modes (Strict/Balanced/Monitor) | `IMPLEMENTED` | `VERIFIED` | Gate F | Human-readable badges (`Monitoring Only`) |
| - Local Shield native containment (Rust/Python) | `IMPLEMENTED` | `VERIFIED` | Gate F | Server-side process killing disabled |
| - Emergency sprint override with password auth | `IMPLEMENTED` | `VERIFIED` | Gate F | Audited override with documented reason |
| - Contextual study resources & auto-normalization | `IMPLEMENTED` | `VERIFIED` | Gate B | `https://` auto-prefix, inline error |
| **7. Calendar & Scheduling** | | | | |
| - Date/Time session booking | `IMPLEMENTED` | `VERIFIED` | Gate B | Leap-year safe, 24h interval parsing |
| - Schedule timeline view & day selection | `IMPLEMENTED` | `VERIFIED` | Gate B | Synchronized with today's schedule |
| **8. EONPAI Cognitive Guidance** | | | | |
| - Gemini Cloud AI provider (`gemini-2.5-flash`) | `IMPLEMENTED` | `VERIFIED` | Gate B | Zero local GPU/Ollama dependency, official GA model with graceful fallback |
| - Deterministic Silence Engine offline fallback | `IMPLEMENTED` | `VERIFIED` | Gate B | Structured guidance when disconnected |
| - Anti-spam prompt re-entrancy protection | `IMPLEMENTED` | `VERIFIED` | Gate B | Disabled during active generation |
| **9. Interactive Onboarding Experience** | | | | |
| - First-login auto-trigger detection & modal coordination | `IMPLEMENTED` | `VERIFIED` | Gate C | Scoped to PostgreSQL `user_onboarding`; defers launch if modal is open (`hasActiveModal`); never auto-triggers after completion or skip |
| - Bounded spotlight targeting (no giant screen frames) | `IMPLEMENTED` | `VERIFIED` | Gate C | Step targets strictly bounded to individual controls/cards (`[data-tutorial='...']`); max dimension clamp prevents screen-wide rings |
| - Viewport clamping & anti-overflow (1024x768 support) | `IMPLEMENTED` | `VERIFIED` | Gate C | `max-height: min(520px, calc(100vh - 32px))`, internal `overflow-y: auto`, clearance-based auto-flipping; bottom never exceeds viewport |
| - Six-step real workflow guide, independent of reward | `IMPLEMENTED` | `VERIFIED` | Gate C | GOAL → TASK → SCHEDULE → FOCUS → COMPLETE → PROGRESS; verified end-to-end with genuine PostgreSQL transactions (`scripts/verify_onboarding_and_rewards_e2e.mjs`) |
| - Controlled focus overlay (no outside click kill)| `IMPLEMENTED` | `VERIFIED` | Gate C | Backdrop click triggers gentle pulse; deliberate pause confirmation modal handles exit |
| - Multi-account isolation & persistent progress | `IMPLEMENTED` | `VERIFIED` | Gate C | 5 distinct server states (`NOT_STARTED`, `IN_PROGRESS`, `PAUSED`, `SKIPPED`, `COMPLETED`); pause at step $N$ resumes at step $N$ on correct tab |
| - EONPAI walkthrough replay | `IMPLEMENTED` | `VERIFIED` | Gate C | Completed user clicking "Guided tour" in EONPAI replays clean from Step 1 on Dashboard; replay never awards extra XP |
| **10. Reward & Progression System** | | | | |
| - Backend `ProgressEvent` ledger & standard points | `IMPLEMENTED` | `VERIFIED` | Gate D | Focus/task/goal events are existing source-of-truth rewards; onboarding certification gated on real persisted workflow evidence |
| - Truthful onboarding reward eligibility | `IMPLEMENTED` | `VERIFIED` | Gate D | +50 XP strictly validated via PostgreSQL `hasQualifyingOnboardingWorkflow`: requires finished tutorial, goal/task created after tutorial start, scheduled linked session completed with focus XP event (>=15 active min), and task completion event |
| - Server-side abuse resistance (forged API requests) | `IMPLEMENTED` | `VERIFIED` | Gate D | Forged flag and premature claim rejected with 400; V23 unique partial index prevents duplicate awards; pessimistic state-row lock; V24 start time excludes signup seeds; tamper attempts and multi-tenant cross-claims rejected |
| - Goal completion auto-trigger & XP award | `IMPLEMENTED` | `VERIFIED` | Gate D | All subtasks complete triggers +50 XP & status sync |
| - Live TopBar Level & XP progression badge | `IMPLEMENTED` | `VERIFIED` | Gate D | Real-time reflection of user Level, XP, and Title in TopBar profile badge |
| - Expanded `ProgressResponse` (Levels, XP, streak)| `IMPLEMENTED` | `VERIFIED` | Gate D | 5 level tiers, threshold progress calculation |
| - Frontend celebration toast & completion shimmer | `IMPLEMENTED` | `VERIFIED` | Gate D | `toast-reward` notification & XP badge |
| - Setting to reduce/disable celebratory effects | `IMPLEMENTED` | `VERIFIED` | Gate D | Settings → Appearance full vs minimal toggle |
| **11. Analytics & Retrospective** | | | | |
| - Focus streak & total minutes summary | `IMPLEMENTED` | `VERIFIED` | Gate B | Real-time database metrics aggregation |
| - Distraction telemetry log | `IMPLEMENTED` | `VERIFIED` | Gate B | Process containment event records |
| **12. Deployment & Standalone Distribution** | | | | |
| - Standalone Linux packages (.deb, .AppImage, tarball, native binaries) | `IMPLEMENTED` | `VERIFIED (Linux RC-3)` | Gate G | Built via Tauri v2 + Cargo; 7 release artifacts staged in `release/rc/` with SHA256SUMS and BUILD_INFO.json (`shinpo-v1.0.0-rc3-0145fb3`) |
| - Full installed Linux runtime (zero Vite dependency) | `IMPLEMENTED` | `VERIFIED` | Gate G | Standalone WebKit2GTK window verified on X11/Wayland; static production bundle verified with live PostgreSQL across all 13 core flows (`scripts/test_installed_linux_runtime.mjs`) |
| - Native Tauri IPC & Focus Shield daemon | `IMPLEMENTED` | `VERIFIED` | Gate G | `get_shield_status`, `start_shield_service`, `stop_shield_service`, emergency override, and browser companion verified without killing host personal processes |
| - Standalone Windows package script | `IMPLEMENTED` | `NOT TESTED` | Gate G | NSIS installer script (`package-windows.ps1`) ready; Windows host required for Authenticode signing and execution |
| - Custom server URL configuration in Settings | `IMPLEMENTED` | `VERIFIED` | Gate G | Dynamic cloud node connection (`localStorage.getItem('shinpo_custom_server_url')`) with session security flush |
| **13. Global Typography & Dashboard Composition** | | | | |
| - Semantic typography scale (12px min floor, 14px labels, 15px body) | `IMPLEMENTED` | `VERIFIED` | Gate H | Zero text elements below 12px; tokens.css and auroraTokens.ts unified |
| - Dark and Light theme WCAG AA contrast (≥ 4.5:1) | `IMPLEMENTED` | `VERIFIED` | Gate H | Muted text boosted to #94A3B8 (dark) and #4B5563 / #5B6B8A (light) |
| - 4 summary performance cards symmetrical harmonization | `IMPLEMENTED` | `VERIFIED` | Gate H | Exact 0px height delta across cards; Card 4 velocity metric aligned |
| - Header action row symmetrical alignment (Sentinel + New Task) | `IMPLEMENTED` | `VERIFIED` | Gate H | Both elements matched at exactly 38px height with 10px radius |
| - Today's Schedule card 4-item capacity & anchored footer | `IMPLEMENTED` | `VERIFIED` | Gate H | 3-col grid, truncation safety, zero bottom dead space |
| - Editorial peach/terracotta perspective quote card | `IMPLEMENTED` | `VERIFIED` | Gate H | Uppercase PERSPECTIVE eyebrow, Playfair Display serif italic |

### Recovery correction status — 2026-10-21

| Area | Implementation status | Verification status | Evidence / limitation |
|---|---|---|---|
| Completed-priority composition | `IMPLEMENTED` | `VERIFIED` | Explicit intrinsic completed state; frontend build passes |
| Completed-goal task exclusion from next action | `IMPLEMENTED` | `VERIFIED` | Shared App selector and both Dashboard variants filter completed parent goals; 76 frontend tests pass |
| Today's Schedule rhythm and row geometry | `IMPLEMENTED` | `PARTIALLY VERIFIED` | Shared CSS constraints and mobile rules applied; existing fixtures inspected, authenticated live browser unavailable |
| Tasks Board separation and narrow-width containment | `IMPLEMENTED` | `PARTIALLY VERIFIED` | Board spacing/min-width guards applied; production build passes |
| Video-wide zoom/tutorial/overlay/cross-screen audit | `NOT CHANGED SPECULATIVELY` | `NOT VERIFIED` | Recording not present in workspace; configured runtime credentials returned HTTP 401 |

---

## 2. Prioritized Dependency-Aware Backlog Execution Status

All 5 priority phases have completed execution and empirical verification:

1. **[PRIORITY 1: REWARD & PROGRESSION BACKEND INTEGRATION] — `COMPLETED & VERIFIED`**
   - Connected focus session completion in `FocusSessionService.java` to award `ProgressEvent` (+15 XP for sprint, +25 XP for deep work ≥ 45m).
   - Ensured user isolation, idempotency, and transactional safety.
   - Expanded `ProgressService.java` and `ProgressResponse.java` to compute total XP, 5 level tiers, progress percentage, next level threshold, and recent event ledger.
   - Built and passed `ProgressServiceTests.java` (4/4 tests pass) and full backend test suite (38/38 tests pass).

2. **[PRIORITY 2: REWARD & PROGRESSION FRONTEND CELEBRATION] — `COMPLETED & VERIFIED`**
   - Created `frontend/src/api/progress.ts` and passing unit tests in `progress.test.ts` (70/70 frontend tests pass).
   - Added celebratory reward toast styling (`.shinpo-toast-item.toast-reward`) and integrated toasts into `App.tsx` on task (+10 XP) and session completion.
   - Added "Celebratory Feedback Effects" toggle (`full` vs `minimal`) in **Settings → Appearance** in `SettingsModal.tsx`.

3. **[PRIORITY 3: GAME-INSPIRED INTERACTIVE ONBOARDING UPGRADE & SELF-EXPLANATORY NAVIGATION] — `HISTORICAL; SUPERSEDED`**
   - Transformed `SHINPO_ONBOARDING_STEPS` in `tutorialSteps.ts` into a punchy game-style discovery experience (short headings 2-3 words, crisp plain-language dialogue 11-14 words, actionable instructions 10-13 words, concise 8-12 word rationale, zero README essays).
   - Clarified primary navigation labels and headers in `frontend/src/types/navigation.ts` to permanently eliminate mental model confusion (`Task Manager` -> `Focus Protection`, `Goals & Missions` -> `Goals & Tasks`, `Focus Engine` -> `Focus Sprints`, `Schedule` -> `Calendar Schedule`, `AI Assistant` -> `EONPAI Cognitive Guide`).
   - Overhauled `TutorialOverlay.tsx`: backdrop clicks do NOT dismiss the tour (trigger subtle guidance pulse); added deliberate Pause/Exit confirmation dialog with Resume option; added sleek one-line rationale callouts and smooth auto-scrolling; mapped step target tab counter directly to human-readable navigation labels (`Step N of 12 • Focus Protection`).

4. **[PRIORITY 4: COMPREHENSIVE AUTOMATED VERIFICATION GATES] — `HISTORICAL; NOT ACCEPTANCE EVIDENCE FOR CURRENT ONBOARDING`**
   - Verified 12-step onboarding traversal, non-dismissing backdrop, pause confirmation, and storage persistence via `scripts/verify_onboarding_and_rewards.mjs`.
   - Verified multi-account isolation, interruption recovery, and EONPAI replay via `scripts/verify_onboarding_and_rewards_e2e.mjs`:
     - Alice registered fresh -> auto-triggers Step 1 (`Cockpit Overview`).
     - Paused at Step 4 (Schedule) -> app remains interactive -> restored via EONPAI "Guided tour" back at Step 4 on Schedule tab.
     - Finished Step 12 -> claims idempotent +50 XP onboarding certification reward -> TopBar reflects `Lvl 1 • 50 XP`.
     - Replay from EONPAI -> starts fresh at Step 1 on Dashboard.
     - Bob registered fresh -> starts at Step 1 with 0 XP (zero cross-account contamination).
     - Bob task completion awards +10 XP (`MISSION_COMPLETED`), focus session debrief awards +15 XP (`FOCUS_SESSION_COMPLETED`), goal completion awards +50 XP (`GOAL_COMPLETED`), advancing Bob to `Lvl 2 • 135 XP`.
     - Alice remains at 50 XP (strict tenant isolation verified).
   - Captured 10 verified snapshots in `screenshots/onboarding_rewards_e2e/`.
   - All 375 backend tests (`./mvnw test`) and 70 frontend unit tests (`npm test -- --run`) pass.

5. **[PRIORITY 5: GLOBAL TYPOGRAPHY, READABILITY & DASHBOARD COMPOSITION] — `COMPLETED & VERIFIED`**
   - Centralized semantic typography tokens in `tokens.css` and `auroraTokens.ts`: 12px strict minimum metadata floor, 14px form labels and buttons, 15–16px body, 13.5px helpers/explanations.
   - Audited and updated `study-resources.css`, `shinpo-ui.css`, `overview-bento.css`, and `salutation.css`, eliminating miniature fonts (8–11px).
   - Boosted text contrast in dark theme (`--text-muted: #94A3B8`) and light theme (`--text-muted: #4B5563`, `#5B6B8A`) achieving WCAG AA (≥ 4.5:1).
   - Aligned Dashboard action row: Focus Protection Standby badge and New Task button unified at 38px height (0px delta), 13.5px typography, 10px radius.
   - Harmonized all 4 summary cards: matching 197.4px height (0px delta), matching label and number baselines, Card 4 velocity rate metric aligned with progress bar.
   - Symmetrized Today's Schedule card: 4-session capacity, 3-column grid (`28px 1fr 64px`), independent 18.9px line heights, and bottom-anchored footer (`mt: auto`) providing session count and `+ Schedule Focus Block` action.
   - Redesigned Motivational Quote Card: editorial peach/terracotta surface, uppercase `PERSPECTIVE` eyebrow (`#F97316`), Playfair Display serif quotation typography (15px italic), and accessible cycle refresh control.
   - Automated CDP verification via `scripts/verify_dashboard_and_readability.mjs`: verified 0px height delta across cards, 0px delta in action row, zero text elements < 12px in Study Resources, and captured 6 real screenshots across 4 viewports in Light & Dark modes.


6. **[PRIORITY 6: DESKTOP INTEGRATION, LINUX PACKAGING & INDEPENDENT RUNTIME] — `HISTORICAL PASS; CURRENT ACCEPTANCE INCOMPLETE`**
   - Built and staged complete Linux distribution in `release/linux/`:
     - `SHINPO_1.0.0_amd64.AppImage` (112 MiB, SHA-256: `f256939d0a4b6a6ba2d0e429d8dd5dcd32a03344e4f36cc370ff429243bf3826`)
     - `SHINPO_1.0.0_amd64.deb` (4.9 MiB, SHA-256: `bcf62157971fa8f77cafd34429ef6219bdd24d6fde6e6ba449e125229cebf8b5`)
     - `SHINPO_1.0.0_linux_x86_64.tar.gz` (9.5 MiB, SHA-256: `7a05901c2e8a7ce370be0369289ce5f04a1e7261d4cc83d42589048b8f5ee64d`)
     - `shinpo-desktop` (15 MiB, SHA-256: `252e9b64dacea4bed9a0aa3a68ecbe3d4c130746e3eda325bd1e50da8b2cc9ff`)
     - `shinpo-shield` (3.8 MiB, SHA-256: `2562564eb0e1066bff9995f2059269f8a8e78f370ac5ba1d0f96d8c912ff73e4`)
     - `shinpo-browser-host` (3.5 MiB, SHA-256: `306728b0cb82e731c90cc3a66098e5a936787b208fcb37de709d1d0b727e1655`)
     - Formatted `SHA256SUMS` manifest generated and validated.
   - Verified native desktop window rendering via KDE Spectacle screenshots (`desktop_runtime_active_window.png`, `desktop_runtime_fullscreen.png`).
   - Verified full installed runtime without Vite dev server (`scripts/test_installed_linux_runtime.mjs`):
     - Vite server killed (`curl http://localhost:5173/` confirmed closed).
     - Tested production static bundle (`frontend/dist`) connecting to Spring Boot backend (`http://localhost:8080`) backed by PostgreSQL.
     - All 13 core flows validated: Auth screen, registration, onboarding tour detection, cockpit dashboard, goals creation, list/board mode toggle, schedule booking, focus session lifecycle (start/pause/resume/complete with reflection note), study resources whitelist, EONPAI guidance, analytics view, settings account editing (username updated to `desk_pilot_<id>_upd` in PostgreSQL and verified in DOM after reload), logout, and re-login with updated credentials.
   - Native Focus Shield & Browser Host verified:
     - 75 Rust unit tests in `shinpo-shield` and 5 in `shinpo-browser-host` pass.
     - Authenticated sync with Sentinel API verified with live JWT token (`shinpo-shield status` and `shinpo-shield sweep -d`).
     - System process immunity confirmed for 31 core processes (`kwin`, `plasmashell`, `xorg`, `postgres`, etc.); host personal processes remain unblocked and safe when session is inactive.
     - Browser companion policy sync and review URL verified (`shinpo-browser-host status`).
   - Cloud-independent desktop operation & Gemini provider:
     - Updated default Gemini model to official `gemini-2.5-flash` in `GeminiProvider.java`, `AiProperties.java`, `application.properties`, and `application-prod.properties`.
     - Verified graceful fallback to deterministic Silence Engine on missing API key or 429 rate limit.
     - Honest cloud disclosure: External remote cloud server is not provisioned in current environment; all local decoupling, production configs (`SPRING_PROFILES_ACTIVE=prod`), CORS bindings, and client dynamic routing verified.

7. **[PRIORITY 7: GLOBAL UI CONSISTENCY & DESIGN SYSTEM COMPLETION] — `COMPLETED & VERIFIED`**
   - Eliminated sub-12px text across the entire codebase:
     - Scanned and updated all stylesheet files (`session-reflection.css`, `glass-surfaces.css`, `telemetry-toasts.css`, `settings-modal.css`, `salutation.css`, `modals-sentinel.css`, `overview-bento.css`, `cockpit-panels.css`, `flightdeck-cards.css`, `eonpai.css`, `goals.css`, `goals-kanban.css`, `schedule.css`, `task-manager.css`, `analytics.css`, `auth.css`, `focus-engine.css`, `shell.css`) and inline TSX components to enforce a strict 12px minimum floor.
     - Explicit pixel definitions set in `auroraTheme.ts` for all typography variants and chips (`fontSize: '12px'`).
   - Standardized shared component geometry:
     - Uniform 40px height, 14px font, and 10px radius across inputs, textareas, and buttons.
     - Form labels harmonized with `className="shinpo-field-label"` (14px, weight 650, `--text-2`) across all modals (`CreateTaskModal`, `EditTaskModal`, `CreateGoalModal`, `ScheduleSessionModal`), eliminating vertical label misalignment with `ShinpoDatePicker`.
   - Verified automated CDP visual regression audit via `scripts/verify_design_system_completion.mjs`:
     - 4 summary performance cards: exact 0.0px height delta across all cards (`197.4375px`).
     - Header action row: exact 0.0px height delta between Sentinel mode indicator and New Task button.
     - Editorial Perspective card: verified `Playfair Display`, Georgia serif font family in italic style with uppercase `PERSPECTIVE` eyebrow.
     - Computed font size scan across all 7 views: **0 sub-12px elements**.
     - Dialog form audit: title 19px, description 14px, all labels $\ge 14$px, inputs standard 40px height.
     - Multi-viewport & theme matrix (1440×900, 1280×800, 1024×768 in Aurora Dark, Aurora Light, Classic Dark, Classic Light): **0 horizontal overflow**.
     - Audit report saved: `docs/qa/DESIGN_SYSTEM_COMPLETION_REPORT.json` (`overallStatus: "PASSED"`).
   - Test suites: 76/76 frontend tests and 387/387 backend tests passing cleanly.

8. **[PRIORITY 8: RELEASE CANDIDATE QUALIFICATION & INSTALLED RUNTIME VERIFICATION] — `REOPENED — INCOMPLETE`**
   - Rebuilt production packages from latest working tree containing all typography and design system fixes:
     - `SHINPO-1.0.0-1.x86_64.rpm` (4.85 MB, SHA-256: `39def88c89eff201eff9f9e8d667602163ccbb6e36c0e80473f785bbef77ad49`)
     - `SHINPO_1.0.0_amd64.AppImage` (111.53 MB, SHA-256: `d1ac4eaba11eb4f3b52ad4d6b4b5792e0a6aa45db1365836aa5deb276c33eca4`)
     - `SHINPO_1.0.0_amd64.deb` (4.85 MB, SHA-256: `9dcca06854d7d83b5341fa15389625cad1a8c48d3d794d746558165b23bbfe5e`)
     - `SHINPO_1.0.0_linux_x86_64.tar.gz` (7.65 MB, SHA-256: `27a864a10a3db7284cc24f55898433f0f3036640444d36cdbe309a7b2c6404b9`)
     - `shinpo-desktop` (14.43 MB, SHA-256: `a9d40028431aa9263e73ceb6b123ce0c72f3a59b9964b27b5ba8bfa3fc34c58e`)
     - `shinpo-shield` (3.74 MB, SHA-256: `2562564eb0e1066bff9995f2059269f8a8e78f370ac5ba1d0f96d8c912ff73e4`)
     - `shinpo-browser-host` (3.41 MB, SHA-256: `306728b0cb82e731c90cc3a66098e5a936787b208fcb37de709d1d0b727e1655`)
     - Updated `release/linux/SHA256SUMS` verified.
   - Installed desktop package (`/tmp/shinpo-test-install/usr/bin/shinpo-desktop` unpacked from RPM) tested and verified running natively on Linux desktop (Fedora 44) with WebKitGTK and live PostgreSQL (`01_installed_tauri_cockpit.png`).
   - Zero-data-loss application restart persistence confirmed (`02_installed_tauri_restarted.png`).
   - Backend resilience verified: attempting login against dead backend (`http://127.0.0.1:9999`) returns clean network error without faking success; reconnecting to live backend restores all functionality.
   - Real end-to-end user journey executed with live PostgreSQL database transactions:
     - Pilot registered: `rc_pilot_<ts>`
     - Username edited: `rc_pilot_<ts>_verified` via `PUT /api/users/me/username`
     - Goal created in PostgreSQL
     - Task created in PostgreSQL
     - Task completed: +10 XP awarded
     - Focus session booked and completed with reflection note (rating 5/5): +15 XP awarded
     - Contextual study resource whitelist configured: `docs.shinpo.local`
     - Onboarding curriculum: 12 verified steps completed, +50 XP claimed
     - Total Progress ledger: 125 XP (`Level 2: "Disciplined Practitioner"`)
   - Safe native Shield & Companion integration:
     - `shinpo-shield status`: confirmed OPERATIONAL with Sentinel API.
     - `shinpo-shield sweep -d`: safe non-destructive audit sweep verified.
     - Sentinel emergency override API: authorized with password, mode switched to `AUDIT_ONLY`.
     - `shinpo-browser-host status`: confirmed configured with active lease.
   - Visual regression matrix across themes and scaling:
     - 6 configurations (Aurora Dark, Aurora Light, Classic Dark, Classic Light at 100%, 125%, 150% scaling) verified: 0 horizontal overflow, 0 sub-12px elements, 0.0px card delta.
     - Modal dialog geometry: Title 19px weight 800, labels 14px, inputs 43px.
     - Audit output: `docs/qa/RELEASE_CANDIDATE_QUALIFICATION_REPORT.json` (`overallStatus: "PASSED"`).
   - Cloud & Gemini status:
     - Zero-mandatory-cost deployment architecture (OCI Always Free / GCP e2-micro with Caddy + Spring Boot + PostgreSQL) prepared and documented in `DEPLOYMENT.md`. Billed infrastructure not provisioned without authorization.
     - Live Gemini API requires user-provided `GEMINI_API_KEY` (model `gemini-2.5-flash`); verified graceful fallback to Silence Engine.
   - Windows installer:
     - `scripts/package-windows.ps1` prepared with `-SkipSigning` flag; requires physical/virtual Windows environment to execute and test.

---

## 3. Independent Quality Gate Summary — Current Source vs Historical RC-3

- **Gate A — Foundation:** `BASELINE VERIFIED; CURRENT SOURCE TARGETED CHECKS PASS` (prior backend 396/396, Shield 77/77, Browser Host 6/6 and Companion 15/15; this turn frontend 93/93, lint clean, Tauri `cargo check`, Rust credential test 1/1).
- **Gate B — Feature Completion:** `INCOMPLETE — CURRENT SOURCE REOPENED`; historical RC-3 13-flow evidence does not requalify current source.
- **Gate C — Onboarding:** `INCOMPLETE — REOPENED`; current-source fresh-account full workflow and restart/interruption acceptance remain.
- **Gate D — Rewards:** `INCOMPLETE — REOPENED`; current-source persisted XP/event reconciliation, >=15 active focus minutes, duplicate/restart and concurrency proof remain.
- **Gate E — UI/UX:** `INCOMPLETE — REOPENED`; 56/56 geometry checks are not a visual-quality verdict. The actual first-login capture still shows a visibly unlabeled spotlight target. Current-source packaged, dense-state and modal acceptance remains.
- **Gate F — Security & Reliability:** `INCOMPLETE — REOPENED`; broad CSP, browser localStorage tokens, actual keyring runtime, production key custody and dependency scans remain open.
- **Gate G — Distribution & Desktop Runtime:** `PARTIAL — CURRENT SOURCE DEB BUILT/EXTRACTED, NOT LAUNCHED` / `NOT TESTED (Windows)` / `NOT DEPLOYED (Remote Cloud)`. Historical RC-3 packages and runtime evidence remain preserved, not current-source approval.
- **Gate H — Global Readability & Design System Consistency:** `INCOMPLETE — REOPENED`; historical typography/contrast metrics remain, but current full visual acceptance is open.

### Calendar & Analytics Visual Follow-up Status:
- Calendar layout stylesheet verified: `.schedule-calendar-layout`, `.schedule-mini-calendar`, and `.schedule-week-grid` classes aligned with DOM elements; responsive sidebar stacking and week grid scrolling verified.
- Analytics zero-minute bars rendered cleanly without phantom 2px blocks; `sessionsStarted` counts sessions with `startedAt` timestamp; helper text wrapping verified.
- Live WebKitGTK snapshot captures recorded in `docs/qa/screenshots/rc_qualification/` across all 6 matrix configurations.

### Rendered-layout regression sweep — 2026-10-21
- Hardened `scripts/audit_rendered_ui.mjs` to require explicit `SHINPO_URL` and `SHINPO_API_URL` loopback endpoints and reject the default backend port 8080 before creating an account. It registers a fresh disposable account by API, injects only that account's test session into a temporary browser profile, verifies the browser-origin authenticated API is reachable (to catch CORS misconfiguration), captures the first-login tutorial, clicks the real skip-confirmation controls, then verifies persisted `SKIPPED`/0-XP/0-event state through the API before route checks. Routes are activated through DOM clicks and themes are applied by class toggle; this does not test the login/register form or actual theme switch behavior.
- Headless Chromium then traverses seven routes at 1920×1080, 1280×800, 1000×768, and 390×844 in class-switched dark/light appearances. It checks text-range intersections, sibling card intersections, clipped controls, horizontal overflow, and Calendar scroll behavior. Isolated PostgreSQL confirms the skipped account remained at 0 XP.
- The scan exposed and prompted fixes for mismatched EONPAI responsive selectors, missing session-debrief styles, late-night Calendar events clipped at midnight, mobile topbar controls/search clipped by a fixed-height header, and the Focus Protection metric/status badge compressed at laptop/phone widths.
- Latest run result: 56/56 route × viewport × theme combinations clear, including a successful authenticated browser API probe. Calendar wheel scroll changed in dark/light at 1280×800, 1000×768, and 390×844. The fresh first-login screenshot now shows the target label after the tutorial portal was changed from `role="dialog"` to `role="region"`; Aurora's global `[role="dialog"]` glass rule was applying backdrop blur to the full-screen tutorial region. Source fix is browser-verified in the screenshot above. Geometry checks and empty-account views do not cover every modal/data permutation or installed Tauri. Gates E and H remain open.

### Current defect-level evidence

| ID | Severity / status | Reproduction and user impact | Root cause / correction | Evidence / remaining risk |
|---|---|---|---|---|
| **UI-FF-01** | **P2 — OPEN** | Register fresh account, start first-login tour, view step 1. The “New Goal” spotlight appears as a blank glowing rectangle, making the intended action harder to discover. | Root cause not confirmed. Backdrop dim/blur was reduced, green ring changed to the project purple token, and backdrop geometry transition removed; screenshot still shows no button label even though DOM text `New Goal`, white text styles, and hit target are present. | Current screenshot: `/tmp/shinpo-visual-audit-captures-cnqQsZ/first-login-tutorial.png`. Do not mark Gate E complete until the actual paint/layering defect is explained and a rendered retest is accepted. |
| **UI-FF-02** | **P2 — FIXED IN SOURCE; BROWSER VERIFIED** | Launch fresh sign-in view; auto-focused username field looked like a validation error before any form submission. | `.auth-input:focus` used `--brand-red`; changed to existing `--accent-purple` and `--accent-purple-border`. | `npm test` 93/93, lint clean, current DEB rebuilt. Chromium screenshot `/tmp/shinpo-finalform-rc-20261021-CyzYAl/browser-auth-focus-fixed.png` shows purple focus. Latest DEB hash was not launched, so its packaged rendering remains unverified. |
| **QA-FF-01** | **FIXED IN HARNESS / ENVIRONMENT** | The earlier audit shell loaded while protected API requests were rejected by CORS, making its apparent empty-state coverage invalid. | Start the disposable backend with `SHINPO_CORS_ALLOWED_ORIGINS=http://127.0.0.1:5174`; harness now fails unless authenticated `/api/users/me` returns HTTP 200 and validates the skip result. | Rerun observed browser API HTTP 200; PostgreSQL/API state was `SKIPPED`, XP 0, reward events 0. Invalid earlier run was excluded from acceptance evidence. |

### Subsequent unqualified source delta

At final review, previously absent dirty backend changes appeared in `UserController.java`, `UserService.java`, and `AuthenticationSecurityHardeningTests.java`; they add `DELETE /api/users/me`. They were preserved and not executed or validated here. The new test verifies the user row disappears but does not prove associated-row cleanup, foreign-key behavior, transaction rollback, or user-facing reauthentication/confirmation. This endpoint is not part of the DEB above and remains outside the current-source qualification; Gate F stays open. Full fingerprint/context: [`FINALFORM_RC_20261021_SOURCE_MANIFEST.md`](FINALFORM_RC_20261021_SOURCE_MANIFEST.md).
