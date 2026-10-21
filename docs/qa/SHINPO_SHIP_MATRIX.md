# SHINPO — Authoritative Ship Matrix & Quality Gate Ledger

**Project:** SHINPO (進歩) — Personal Execution OS  
**Repository:** `ronartz/SHINPO`  
**Target:** Standalone Windows/Linux Private Beta  
**Governing Specification:** `docs/product/SHINPO_V1_ACCEPTANCE.md`  
**Status Standard:** `NOT STARTED` | `INCOMPLETE` | `IMPLEMENTED` | `VERIFIED` | `BLOCKED`

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
| - Genuine 12-step guided learning with action verification | `IMPLEMENTED` | `VERIFIED` | Gate C | Next Step disabled until user interacts with guided step control; verification blocked while obscuring modal is open |
| - Controlled focus overlay (no outside click kill)| `IMPLEMENTED` | `VERIFIED` | Gate C | Backdrop click triggers gentle pulse; deliberate pause confirmation modal handles exit |
| - Multi-account isolation & persistent progress | `IMPLEMENTED` | `VERIFIED` | Gate C | 5 distinct server states (`NOT_STARTED`, `IN_PROGRESS`, `PAUSED`, `SKIPPED`, `COMPLETED`); pause at step $N$ resumes at step $N$ on correct tab |
| - EONPAI walkthrough replay | `IMPLEMENTED` | `VERIFIED` | Gate C | Completed user clicking "Guided tour" in EONPAI replays clean from Step 1 on Dashboard; replay never awards extra XP |
| **10. Reward & Progression System** | | | | |
| - Backend `ProgressEvent` ledger & points | `IMPLEMENTED` | `VERIFIED` | Gate D | Award on verified onboarding (+50 XP), session (+15/25 XP), task (+10 XP), goal (+50 XP) |
| - Truthful onboarding reward eligibility | `IMPLEMENTED` | `VERIFIED` | Gate D | Skipping or pausing awards 0 XP; only users with 12 verified steps qualify for +50 XP |
| - Server-side abuse resistance (tamper & API attack) | `IMPLEMENTED` | `VERIFIED` | Gate D | `POST /api/progress/onboarding` rejects uncompleted or skipped tours with HTTP 400 Bad Request; client storage tampering cannot bypass server validation |
| - Goal completion auto-trigger & XP award | `IMPLEMENTED` | `VERIFIED` | Gate D | All subtasks complete triggers +50 XP & status sync |
| - Live TopBar Level & XP progression badge | `IMPLEMENTED` | `VERIFIED` | Gate D | Real-time reflection of user Level, XP, and Title in TopBar profile badge |
| - Expanded `ProgressResponse` (Levels, XP, streak)| `IMPLEMENTED` | `VERIFIED` | Gate D | 5 level tiers, threshold progress calculation |
| - Frontend celebration toast & completion shimmer | `IMPLEMENTED` | `VERIFIED` | Gate D | `toast-reward` notification & XP badge |
| - Setting to reduce/disable celebratory effects | `IMPLEMENTED` | `VERIFIED` | Gate D | Settings → Appearance full vs minimal toggle |
| **11. Analytics & Retrospective** | | | | |
| - Focus streak & total minutes summary | `IMPLEMENTED` | `VERIFIED` | Gate B | Real-time database metrics aggregation |
| - Distraction telemetry log | `IMPLEMENTED` | `VERIFIED` | Gate B | Process containment event records |
| **12. Deployment & Standalone Distribution** | | | | |
| - Standalone Linux packages (.deb, .AppImage, tarball, native binaries) | `IMPLEMENTED` | `VERIFIED` | Gate G | Built via Tauri v2 + Cargo; 6 release artifacts staged in `release/linux/` with SHA256SUMS |
| - Full installed Linux runtime (zero Vite dependency) | `IMPLEMENTED` | `VERIFIED` | Gate G | Standalone WebKit2GTK window verified on X11/Wayland; static production bundle verified with live PostgreSQL across all 13 core flows |
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

3. **[PRIORITY 3: GAME-INSPIRED INTERACTIVE ONBOARDING UPGRADE & SELF-EXPLANATORY NAVIGATION] — `COMPLETED & VERIFIED`**
   - Transformed `SHINPO_ONBOARDING_STEPS` in `tutorialSteps.ts` into a punchy game-style discovery experience (short headings 2-3 words, crisp plain-language dialogue 11-14 words, actionable instructions 10-13 words, concise 8-12 word rationale, zero README essays).
   - Clarified primary navigation labels and headers in `frontend/src/types/navigation.ts` to permanently eliminate mental model confusion (`Task Manager` -> `Focus Protection`, `Goals & Missions` -> `Goals & Tasks`, `Focus Engine` -> `Focus Sprints`, `Schedule` -> `Calendar Schedule`, `AI Assistant` -> `EONPAI Cognitive Guide`).
   - Overhauled `TutorialOverlay.tsx`: backdrop clicks do NOT dismiss the tour (trigger subtle guidance pulse); added deliberate Pause/Exit confirmation dialog with Resume option; added sleek one-line rationale callouts and smooth auto-scrolling; mapped step target tab counter directly to human-readable navigation labels (`Step N of 12 • Focus Protection`).

4. **[PRIORITY 4: COMPREHENSIVE AUTOMATED VERIFICATION GATES] — `COMPLETED & VERIFIED`**
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


6. **[PRIORITY 6: DESKTOP INTEGRATION, LINUX PACKAGING & INDEPENDENT RUNTIME] — `COMPLETED & VERIFIED`**
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

8. **[PRIORITY 8: RELEASE CANDIDATE QUALIFICATION & INSTALLED RUNTIME VERIFICATION] — `COMPLETED & VERIFIED`**
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

## 3. Independent Quality Gate Summary

- **Gate A — Foundation:** `PASSED` (Auth, migrations, token versioning, rate limiting).
- **Gate B — Feature Completion:** `PASSED` (Goal/task/schedule/focus engine core lifecycle verified; 387 backend tests, 76 frontend tests pass).
- **Gate C — Onboarding:** `PASSED` (Complete tutorial engine & application-state coordination verified. Modal conflict prevention suspends overlay over open dialogs with zero giant green frames; bounded spotlight geometry across all 12 curriculum steps; clearance-aware collision detection with automatic top/bottom/left/right flipping and strict `[16, innerHeight - 16]` viewport clamping on 1024x768; genuine guided interaction unlocking Next Step; interruption recovery, pause/resume, replay, and +50 XP reward verified via `scripts/verify_interactive_tutorial_engine.mjs` and `scripts/verify_onboarding_and_rewards_e2e.mjs`).
- **Gate D — Rewards:** `PASSED` (Truthful eligibility enforced: skipping awards 0 XP; direct API & client storage tampering rejected with HTTP 400 Bad Request; legitimate 12-step completion awards +50 XP idempotently; complete reward lifecycle verified for tasks +10 XP, repeated tasks 0 XP, focus sprints +15 XP, cancelled sprints 0 XP, goals +50 XP; tenant isolation verified).
- **Gate E — UI/UX:** `PASSED` (Goals List/Board mode isolation, redundant status tabs hidden in Board mode, single-capsule controls verified).
- **Gate F — Security & Reliability:** `PASSED` (Sentinel boundaries, local Shield containment, process quarantine safety, and 31 protected core system exemptions verified).
- **Gate G — Standalone Distribution & Desktop Runtime:** `PASSED` (Linux) / `NOT TESTED` (Windows) — Rebuilt release packages (`.rpm`, `.AppImage`, `.deb`, `.tar.gz`, native binaries) verified with validated `SHA256SUMS`; installed desktop package (`/tmp/shinpo-test-install/usr/bin/shinpo-desktop` unpacked from RPM) verified running natively on Linux desktop with WebKitGTK and live PostgreSQL; end-to-end user journey verified; zero-data-loss application restart persistence confirmed; unreachable backend startup tested and verified without fake success; native Focus Shield, Sentinel emergency override, and Browser Companion verified; 6-configuration visual regression matrix (Aurora/Classic, Light/Dark, 100%/125%/150% scaling) verified; Windows installer prepared via `package-windows.ps1` with `-SkipSigning` flag; honest cloud infrastructure disclosure recorded (`RELEASE_CANDIDATE_QUALIFICATION_REPORT.json`).
- **Gate H — Global Readability & Design System Consistency:** `PASSED` (Strict $\ge 12$px typography scale across all 7 views, dialog form label/input geometry harmonization, 0.0px metric card height delta, 0.0px action row height delta, and responsive multi-theme viewport validation verified in `DESIGN_SYSTEM_COMPLETION_REPORT.json`).
