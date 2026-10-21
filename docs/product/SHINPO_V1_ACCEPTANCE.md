# SHINPO — Master Product Acceptance Specification (v1.0)

**Project:** SHINPO (進歩) — Personal Execution OS  
**Repository:** `ronartz/SHINPO`  
**Target:** Standalone Windows/Linux Private Beta for Owner and Friends  
**Budget Constraint:** ₹0 mandatory subscriptions or developer-hosted infrastructure  
**Core Purpose:** An intelligent personal execution system that makes planning, focusing, completing work, and building consistency intuitive, peaceful, and rewarding.

---

## 1. System Architecture & Responsibilities

SHINPO is structured into four distinct execution layers with strict separation of concerns:

```
┌────────────────────────────────────────────────────────┐
│               SHINPO Client Shell                       │
│  - Tauri v2 (Rust Native Desktop Container)            │
│  - Chromium / Gecko Web Presentation (React 19 / TS)   │
│  - Nunito + Aurora / Classic Design Systems            │
└──────────────────────────┬─────────────────────────────┘
                           │ Authenticated REST + WS (JWT)
┌──────────────────────────▼─────────────────────────────┐
│             Spring Boot 3.3.4 Backend                  │
│  - Stateless Security & Tenant Isolation               │
│  - Concurrency Locks & Token Rotation                  │
│  - Contextual Focus & Sentinel Daemon Gateway          │
│  - Gemini Cloud AI Provider + Deterministic Silence    │
└──────────────────────────┬─────────────────────────────┘
                           │ Liquibase / Flyway Transactions
┌──────────────────────────▼─────────────────────────────┐
│              Managed PostgreSQL (16+)                  │
│  - Tenant-Isolated User Schema                         │
│  - Relational Integrity (Goals, Tasks, Sessions)       │
│  - Progress & Reward Ledger (Idempotent Events)        │
└────────────────────────────────────────────────────────┘
```

### Layer Responsibilities:
1. **Desktop Native (Rust / Tauri v2):**
   - Window lifecycle, system tray minimization, local native IPC.
   - Local distraction enforcement interface (Shield client). Host process killing on remote cloud servers is strictly prohibited.
2. **Frontend Presentation (React 19, TypeScript, Vite):**
   - Interactive execution cockpit (Aurora Bento & Classic layouts).
   - Zero-unhandled-rejections API client with automatic token refresh.
   - Interactive game-inspired onboarding engine with controlled focus overlays.
   - Tasteful celebratory reward feedback and progress visualizations.
   - Dual-theme (Nunito Dark / Light) with strict WCAG AA contrast.
3. **Backend Service (Spring Boot 3, Java 21):**
   - Stateless JWT authentication with database-backed token versioning.
   - Process containment policy validation and contextual URL whitelisting.
   - Gemini Cloud AI integration with deterministic offline fallback.
   - Event-driven WebSocket telemetry (STOMP `/ws`).
4. **Persistence (PostgreSQL):**
   - ACID-compliant relational storage with cascading safety.
   - Idempotent `progress_events` ledger for user progression.

---

## 2. Core Functional Modules & User Journeys

The application executes a continuous, unbroken execution loop:  
**GOAL → OBJECTIVE → TASK → SCHEDULE → FOCUS → PROTECTION → EXECUTION → RESULT → PROGRESS → ANALYTICS → ADAPTATION → NEXT ACTION**

### 2.1 Authentication & Profile Identity
- **Sign In / Registration:**
  - Accessible eye/eye-off toggle controls on all password fields.
  - Inputs masked by default (`type="password"`).
  - Toggling visibility never clears inputs, alters validation, or submits forms.
- **Account & Security Settings:**
  - Authenticated username editing via `PUT /api/users/me/username`.
  - Enforces length (3-50 chars), allowed regex (`^[a-zA-Z0-9_.-]+$`), and uniqueness (HTTP 409 Conflict).
  - Persists changes in PostgreSQL and updates profile badges, topbar, and greetings in real time.
  - Change Password form with 3 independent visibility toggles.
  - Secure Session Sign Out purges local tokens and invalidates backend refresh tokens.

### 2.2 Execution Cockpit & Dashboard
- **TopBar Utility Ownership:**
  - Pure utility role: Search, Notifications, Refresh/Sync, Settings, Profile Badge, Sign Out.
  - Redundant independent theme and layout toggles removed; appearance canonically governed in **Settings → Appearance**.
- **Hero Priority Card:**
  - Highlights currently active sprint or the single highest-priority pending task.
  - Quick-start action arms a focus sprint immediately.
- **Today's Schedule Sidecar:**
  - 3-column CSS Grid geometry (`28px 1fr 64px`) with rigid overflow containment (`text-overflow: ellipsis`).
  - Supports Empty State, Single Entry, Multi-Entry, and Extreme-Length titles (150+ chars) without horizontal blowout.
  - Truthful status reporting: Paused sprints render `'Paused'` with amber badge (`#F59E0B`) and `❚❚` icon.
- **Live Clock Capsule:**
  - Persistent dashboard clock with smooth 12-hour (AM/PM) and 24-hour toggle on click.

### 2.3 Strategic Goals & Mission Decomposition
- **Goal Management:**
  - Create, view, update, and delete strategic goals with target dates.
  - Single-capsule sort control (zero nested borders, single design-system chevron).
  - Harmonized action button heights (32px goal actions, 28px task actions).
- **EONPAI Deconstruction:**
  - Decomposes high-level goals into atomic, 15-to-45 minute executable tasks with estimated durations.
  - Deterministic decomposition templates when offline or without API keys.

### 2.4 Focus Engine & Timer Controls
- **Timer Execution:**
  - Standard duration presets (15m, 25m, 45m, 60m, Custom 5–480m).
  - Precision countdown using server-anchored timestamps (`startedAt`, `accumulatedPausedSeconds`).
  - Resilient to background-tab throttling without cumulative drift.
  - Freeze countdown cleanly during `PAUSED` state.
- **Session Reflection & Debrief:**
  - Post-session reflection modal: 1–5 star rating, accomplishment summary, and reflection notes.
  - Optional auto-completion of linked mission/task.
  - Optional EONPAI AI debrief analysis.

### 2.5 Focus Protection, Sentinel & Study Resources
- **Sentinel Policy Enforcement:**
  - Three distinct modes: `STRICT` (active termination), `BALANCED` (15s grace prompt), `MONITORED` (audit logging only).
  - Human-readable labels across UI (no raw `AUDIT_ONLY` enums).
  - Emergency sprint override requiring account password and documented reason.
- **Contextual Study Resources:**
  - URL whitelist management allowing authorized learning resources during active sprints.
  - Auto-normalizes bare domains (e.g. `docs.spring.io` → `https://docs.spring.io`).
  - Scope-aware permissions (`DOMAIN_ONLY`, `EXACT_URL`).
  - Inline error feedback preventing silent submission failures.

### 2.6 Calendar & Scheduling
- **Session Booking:**
  - Schedule focus sprints for specific future dates and times.
  - Validates date math, leap years, and 24-hour intervals.
  - Syncs directly into Today's Schedule on the dashboard.

### 2.7 EONPAI Cognitive Guidance
- **AI Engine Decoupling:**
  - Primary provider: Google Gemini (`gemini-3.6-flash`) via secure API key.
  - Zero requirement for local GPU or local Ollama daemons.
  - Deterministic Silence Engine fallback provides structured advice when disconnected.
  - Prompt anti-spam re-entrancy guards prevent double-submission during generation.

### 2.8 Analytics & Retrospectives
- **Performance Intelligence:**
  - Daily/weekly focus time metrics, completion rates, and streak counters.
  - Chronological activity log and distraction telemetry.

---

## 3. Interactive First-Time User Experience (Game-Inspired Onboarding)

### 3.1 First-Login Workflow
1. **Detection:** Checks persistent user flag `shinpo_onboarding_completed`. If uncompleted, triggers the onboarding journey.
2. **Welcome Salutation:** Warm, non-intrusive modal introducing SHINPO's core execution philosophy and EONPAI as the intelligent co-pilot.
3. **Controlled Focus Overlay:**
   - 4-quadrant backdrop mask dims unrelated interface elements.
   - Pulsing accent spotlight ring frames the active interactive target.
   - **Crucial Rule:** Clicking outside the spotlight does NOT silently terminate the tour. It preserves state and prompts confirmation if exit is requested.
   - Floating coachmark box positioned intelligently (top/bottom/left/right) with viewport bounds clamping.
   - Smooth automatic scrolling ensures targets are centered.

### 3.2 12-Step Guided Learning Journey
1. **Welcome & Philosophy:** High-level dashboard overview and executive orientation.
2. **Create Strategic Goal:** Guides user to create their first real goal (`+ New Goal`).
3. **Deconstruct into Tasks:** Demonstrates breaking goals into 15–30m executable units.
4. **Schedule Activity:** Guides booking a session on the calendar timeline.
5. **Dashboard Priorities:** Explains Today's Schedule sidecar and priority queue.
6. **Focus Engine Cockpit:** Explains presets (25m/45m) and start actions.
7. **Session Countdown Controls:** Explains Pause, Resume, and early completion.
8. **Focus Protection & Sentinel:** Details process containment and safety boundaries.
9. **Contextual Study Resources:** Demonstrates adding permitted research URLs.
10. **Session Reflection & Debrief:** Walks through rating quality and logging accomplishments.
11. **Progression & Rewards:** Highlights XP gains, streak tracking, and level advancement.
12. **EONPAI & Settings:** Introduces on-demand cognitive prompts and appearance preferences.

### 3.3 Safety & Accessibility Rules
- **No Junk Data:** Tutorial tasks and goals are marked or user-customized; no permanent ghost records created.
- **Safe Exit & Escape:** `Esc` key or close button opens deliberate Pause/Exit dialog (`Pause Tour`, `Skip Tour`, `Resume`).
- **Keyboard Navigation:** Full keyboard accessibility (Tab, Enter, Escape, Arrow keys).
- **Reduced Motion:** Fully conforms to `prefers-reduced-motion` without aggressive pulsing.
- **Offline Reliability:** 100% functional through local deterministic lesson definitions if AI or network is unavailable.

---

## 4. Reward & Progression System

### 4.1 Motivational Philosophy
Rewards must feel earned, professional, and respectful. SHINPO avoids juvenile badges or manipulative dark patterns, celebrating genuine personal deep work.

### 4.2 Verified Event Triggers & Point Structure
| Action | Event Type | Earned Progress / XP | Conditions |
|:---|:---|:---:|:---|
| **Complete Task** | `MISSION_COMPLETED` | **+10 XP** | Genuine task completion via API |
| **Complete Focus Session (15–44m)** | `FOCUS_SESSION_COMPLETED` | **+15 XP** | Standard focus sprint logged |
| **Complete Deep Focus Session (45m+)** | `FOCUS_SESSION_COMPLETED` | **+25 XP** | Extended deep work logged |
| **Complete Strategic Goal** | `GOAL_COMPLETED` | **+50 XP** | All linked tasks completed |
| **Consistency Streak Milestone** | `STREAK_MILESTONE` | **+25 XP** | 3-day, 7-day, 14-day, 30-day continuous streaks |

### 4.3 Backend Idempotency & Tenant Safety
- All progress events are saved in `progress_events` referencing `user_id`.
- Protected against duplicate requests: session completion only awards progress once upon transition from `ACTIVE`/`PAUSED` to `COMPLETED`.
- User isolation enforced at database query level (`WHERE p.user.id = :userId`).

### 4.4 Presentation & Settings Controls
- Refined, elegant completion shimmer/toast acknowledging progress (+15 XP).
- Visual progress bar and Level badge (e.g., Level 1 "Focus Initiate" → Level 5 "Master of Flow").
- Option in **Settings → Appearance** to reduce or disable celebratory visual effects for users preferring pure minimalism.

---

## 5. UI/UX & Design System Standards

- **Typography & Scale:**
  - Semantic Scale: Display (28px), Title (22px), Heading (18px), Subheading (16px), Body (15px), Form Labels & Buttons (14px), Explanations & Helpers (13.5px), Captions & Subtitles (13px), Minor Metadata & Timestamps (12px).
  - Absolute Floor: Strict 12px floor for all readable metadata; zero text rendered at miniature sizes (< 12px).
  - Primary Font: Nunito loaded locally and via Google Fonts with system fallback.
  - Perspective Quotes: Playfair Display serif italic with Georgia/serif fallbacks.
- **Light Theme Contrast (WCAG AA Compliant):**
  - Background: `#F7F6F3` / `#FFFFFF`.
  - Primary Text: `#18191B` (Contrast ratio > 12:1 against white).
  - Secondary Text: `#484C56` (Contrast ratio > 7:1 against white).
  - Supporting Muted Text: `#4B5563` (Contrast ratio > 4.8:1 against canvas, > 7:1 on white cards).
  - Selected States: `#7932E6` / `#2B58E6` with restrained background tint.
- **Dark Theme Contrast (WCAG AA Compliant):**
  - Background: `#121316` / `#18191E` / `#1D1E24`.
  - Primary Text: `#F5F7FF`.
  - Secondary Text: `#94A3B8`.
  - Supporting Muted Text: `#94A3B8` (Boosted from #64748B to achieve > 5.4:1 contrast).
- **Dashboard Composition & Symmetrical Geometry:**
  - Summary Cards (4 Cards): Uniform height (`height: 100%`, `minHeight: 168px`), identical padding (`20px 22px`), matching header baselines, 32px values, and matching 13.5px subtitles. Card 4 integrates a velocity rate label and progress bar while matching height with 0px delta.
  - Action Row: Focus Protection Standby badge and New Task button aligned with identical 38px height, 13.5px typography, vertical centering, and 10px border radius.
  - Today's Schedule Card: Symmetrical 3-column grid (`28px 1fr 64px`), 4-item capacity, independent line heights (`18.9px`), text truncation safety, and bottom-anchored footer (`mt: auto`) providing session count and quick `+ Schedule Focus Block` trigger.
  - Motivational Sidebar Quote Card: Editorial peach/terracotta palette, `PERSPECTIVE` uppercase eyebrow (`#F97316` / `#D9532F`), Playfair Display serif quotation typography (15px italic), and accessible cycle refresh control.
- **Component Geometry:**
  - Inputs & Selects: 40px standard height, 10px border-radius, 14px typography.
  - Buttons: 34px small, 40px medium (14px font), 48px large (15.5px font).
  - Modals: 520px maximum width, centered, backdrop blur.
  - Responsive Viewports Supported: 1920×1080, 1440×900, 1280×800, 1000×768.

---

## 6. Concrete Quality Gates & Release Verification

1. **Gate A — Foundation:** Backend tests pass (`./mvnw test`), migrations apply cleanly, JWT rotation and token versioning pass.
2. **Gate B — Feature Completion:** Full lifecycle (Goal → Task → Schedule → Focus → Protection → Debrief) verified with live persistence.
3. **Gate C — Onboarding:** `PASSED` — Application-state coordinator with modal conflict prevention (`hasActiveModal` suspends overlay over open dialogs with zero conflicting spotlights); strictly bounded spotlight targeting on discrete controls/cards (`[data-tutorial='...']`); dynamic collision engine with auto-flipping (top/bottom/left/right) and strict viewport clamping (`max-height: min(520px, calc(100vh - 32px))`, `overflow-y: auto`, `bottom <= window.innerHeight`) verified on 1024x768 desktop viewports; genuine 12-step guided walkthrough requiring action verification before unlocking `Next Step →`; non-blocking dismiss, deliberate pause modal with Resume/Exit/Skip, exact-step resumption, PostgreSQL `user_onboarding` tracking 5 states (`NOT_STARTED`, `IN_PROGRESS`, `PAUSED`, `SKIPPED`, `COMPLETED`), and zero-leakage EONPAI replay verified.
4. **Gate D — Rewards:** `PASSED` — Truthful reward eligibility enforced; skipping tour awards 0 XP; direct API & storage tampering rejected with HTTP 400 Bad Request; legitimate 12-step onboarding awards +50 XP idempotently; complete reward lifecycle verified (task completion +10 XP, repeated tasks 0 XP, focus sprints +15 XP, cancelled sprints 0 XP, goal auto-completion +50 XP); tenant isolation verified in PostgreSQL progress ledger with celebratory UI toasts and TopBar badges.
5. **Gate E — UI/UX:** `PASSED` — Goals List/Board mode isolation, redundant status tabs hidden in Board mode, 3 symmetrical Kanban columns with accurate counts verified.
6. **Gate F — Security & Reliability:** `PASSED` — Remote server process execution disabled; safe local native Shield enforcement; system process immunity confirmed for 31 core processes (`kwin`, `plasmashell`, `xorg`, `postgres`, etc.); 75 Rust unit tests in `shinpo-shield` and 5 in `shinpo-browser-host` pass.
7. **Gate G — Standalone Distribution & Desktop Runtime:** `PASSED` (Linux) / `NOT TESTED` (Windows) — Rebuilt release packages (`SHINPO-1.0.0-1.x86_64.rpm`, `SHINPO_1.0.0_amd64.AppImage`, `SHINPO_1.0.0_amd64.deb`, `SHINPO_1.0.0_linux_x86_64.tar.gz`, native binaries) verified with validated `SHA256SUMS`; installed desktop package (`/tmp/shinpo-test-install/usr/bin/shinpo-desktop` unpacked from RPM) verified running natively on Linux desktop with WebKitGTK and live PostgreSQL; end-to-end user journey verified (registration, username editing via `PUT /api/users/me/username`, goals, tasks, focus sprint debrief with reflection note, contextual study resources, truthful 12-step onboarding, and +50 XP reward claim advancing user to Level 2); zero-data-loss application restart persistence confirmed (`01_installed_tauri_cockpit.png` and `02_installed_tauri_restarted.png`); unreachable backend startup tested and verified to report clean network errors without fake success; native Focus Shield (`shinpo-shield status` OPERATIONAL, `sweep -d` safe dry-run), Sentinel emergency override (switched to `AUDIT_ONLY`), and Browser Companion (`shinpo-browser-host status`) verified; 6-configuration visual regression matrix (Aurora/Classic, Light/Dark, 100%/125%/150% scaling) verified with 0 horizontal overflow and 0 sub-12px elements; Windows installer prepared via `package-windows.ps1` with `-SkipSigning` flag, awaiting physical Windows environment; external cloud hosting requires user authorization and infrastructure provisioning before deployment (`RELEASE_CANDIDATE_QUALIFICATION_REPORT.json`).
8. **Gate H — Global Readability & Design System Consistency:** `PASSED` — Strict $\ge 12$px typography floor verified across all accessible views (0 sub-12px elements across Dashboard, Goals, Schedule, Focus, Task, Analytics, EONPAI); standard dialog inputs (40px height, 14px font, 10px radius) and form labels (`shinpo-field-label` $\ge 14$px); Today's Schedule 3-column collision-free layout (`28px 1fr 64px`); 0.0px metric card height delta; 0.0px action row height delta; editorial serif italic Perspective quotation card; 0 horizontal overflow across multi-viewport (1440×900, 1280×800, 1024×768) and multi-theme (Aurora Dark/Light, Classic Dark/Light) matrix verified in `docs/qa/DESIGN_SYSTEM_COMPLETION_REPORT.json`.

## 7. Recovery correction log — 2026-10-21

The requested video was not present in the workspace, so this pass used the written recovery brief, existing rendered screenshots, source inspection, and the repository verification suite. The following corrections were made:

| View / state | Defect | Root cause | Fix | Evidence | Status |
|---|---|---|---|---|---|
| Dashboard priority, completed state | Completed-goal task could be selected as the next action | Global next-action selection only filtered mission status | Exclude missions belonging to completed goals in both dashboard variants and the shared App selector | Frontend build + 76 unit tests | FIXED |
| Dashboard priority, all tasks complete | Empty state depended on stretched grid composition | Priority card did not distinguish completed-priority layout state | Added explicit completed-priority state styling with intrinsic sizing | Frontend build | FIXED |
| Today's Schedule | Header and first row had insufficient visual separation | Card used a generic 12px flex gap | Schedule card now uses a deliberate 16px rhythm while retaining the shared row grid | Existing schedule visual fixtures + CSS inspection | FIXED |
| Today's Schedule / Tasks Board | Narrow layouts could crowd text, badges, and footer actions | Flexible tracks and footer controls lacked minimum-width/wrap constraints | Added constrained grid tracks, footer wrapping, mobile spacing, and board min-width guards | Lint/build + `git diff --check` | FIXED |
| Full recording, zoom levels, tutorial, overlays, cross-screen data | Cannot independently reproduce from this workspace | Recording and authenticated runtime evidence unavailable | No speculative changes made | Existing QA scripts/screenshots only | NOT VERIFIED |

The recovery changes preserve live task/session data and do not introduce fixtures or hardcoded metrics.

