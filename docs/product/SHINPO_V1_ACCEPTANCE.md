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

## 3. Interactive First-Time User Experience

### 3.1 First-Login Workflow
1. **Detection:** Uses authenticated `user_onboarding` state; local storage may resume presentation but is not authoritative.
2. **Welcome Salutation:** Warm, non-intrusive modal introducing SHINPO's core execution philosophy and EONPAI as the intelligent co-pilot.
3. **Controlled Focus Overlay:**
   - 4-quadrant backdrop mask dims unrelated interface elements.
   - Pulsing accent spotlight ring frames the active interactive target.
   - **Crucial Rule:** Clicking outside the spotlight does NOT silently terminate the tour. It preserves state and prompts confirmation if exit is requested.
   - Floating coachmark box positioned intelligently (top/bottom/left/right) with viewport bounds clamping.
   - Smooth automatic scrolling ensures targets are centered.

### 3.2 Six-Step Guided Learning Journey
1. **Goal:** Choose or create an outcome.
2. **Task:** Add an actionable task linked to the goal.
3. **Schedule:** Reserve calendar time for the linked task.
4. **Focus:** Start and control the scheduled focus session.
5. **Complete:** Complete the task and reflect on the session.
6. **Progress:** Review the results in Analytics and progression.

The guide teaches the real workflow; it contains no simulated verification actions. Users may finish, pause, skip, or replay without completing a focus session. Tutorial completion is separate from reward eligibility.

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
| **Complete Focus Session (15–44m)** | `FOCUS_SESSION_COMPLETED` | **+15 XP** | At least 15 active minutes; paused time excluded and rewardable time capped at the planned duration |
| **Complete Deep Focus Session (45m+)** | `FOCUS_SESSION_COMPLETED` | **+25 XP** | At least 45 active minutes; paused time excluded and rewardable time capped at the planned duration |
| **Complete Strategic Goal** | `GOAL_COMPLETED` | **+50 XP** | All linked tasks completed |
| **Consistency Streak Milestone** | `STREAK_MILESTONE` | **+25 XP** | 3-day, 7-day, 14-day, 30-day continuous streaks |
| **Onboarding workflow completion** | `ONBOARDING_COMPLETED` | **+50 XP once** | Tutorial finished; server records show a goal and linked task created after the server-recorded tutorial start, plus a scheduled linked focus session completed with the normal focus XP event (>=15 active minutes) and persisted task completion with its normal task event. Registration-seeded goals/tasks do not qualify. Skip alone earns 0 XP. |

The onboarding award is not issued for tutorial clicks, reported booleans, local storage, or tutorial completion alone. A finished user may earn it later after meeting the workflow criteria. Existing historical ledger entries are retained; a partial unique index enforces at most one onboarding award per user.

### 4.3 Backend Idempotency & Tenant Safety
- All progress events are saved in `progress_events` referencing `user_id`.
- Protected against duplicate requests: session completion only awards progress once upon transition from `ACTIVE`/`PAUSED` to `COMPLETED`; early completion under 15 active minutes earns 0 XP, and an extended session cannot earn beyond its planned duration tier.
- User isolation enforced at database query level (`WHERE p.user.id = :userId`).

### 4.4 Presentation & Settings Controls
- Refined, elegant completion shimmer/toast acknowledging progress (+15 XP).
- Visual progress bar and Level badge (e.g., Level 1 "Focus Initiate" → Level 5 "Master of Flow").
- Option in **Settings → Appearance** to reduce or disable celebratory visual effects for users preferring pure minimalism.
- **Operation Momentum Universal Rewards & Progression Layer:**
  - Centralized feedback coordinator (`progressionEngine.ts`) wired to real backend completions (tasks, focus sprints, goals, level tiers, onboarding).
  - Duolingo-inspired celebration modal (`CelebrationModal.tsx`) with animated XP burst, tier announcement, and contextual next-action prompts ("Arm Next Sprint", "Debrief with EONPAI", "View Progression").
  - Visual-only celebration feedback: zero network assets, with reduced-motion and user preference safeguards.
  - Daily Execution Flow card (`DailyObjectivesCard.tsx`): 3 daily targets (1 task, 1 sprint >=15m, 25m deep work) computed directly from real-time database state.
  - Healthy consistency streak tracking with quiet mode preference in Settings (`shinpo_streak_display`).
  - Comprehensive progression profile dialog (`AchievementsModal.tsx`): accessible via TopBar Level Badge, displaying tier progress, daily objectives, 8 milestone achievements, and recent XP ledger.
  - Microinteractions: checkmark pop animation (`shinpoCheckPop`), active button feedback (100–180ms), and full reduced-motion safeguards (`prefers-reduced-motion: reduce`).

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

## 6. Concrete Quality Gates & Release Verification (current worktree revalidation)

The RC-2 package evidence recorded in earlier sections is historical and predates the current security-remediation source changes. Current QA writes used a separate ephemeral PostgreSQL container and isolated browser account. The owner `shinpo` database was queried read-only only for the requested EON reward reconciliation; no live rows or schema were changed. Statuses below override earlier RC-2 `PASSED` labels for this current candidate.

1. **Gate A — Foundation:** `INCOMPLETE — REOPENED` — Current full backend suite passed 396/396 tests in fresh tmpfs PostgreSQL after 24 migrations; frontend passed 91/91, lint has 0 warnings, and the production build passed. Platform/dependency/release qualification remains incomplete.
2. **Gate B — Feature Completion:** `INCOMPLETE — REOPENED` — A current-source agent-driven browser sweep rendered seven routes, but CRUD, focus completion, cross-screen persistence and failure-state workflows were not exercised.
3. **Gate C — Onboarding:** `INCOMPLETE — REOPENED (2026-10-21)` — In an isolated PostgreSQL/container run, a fresh disposable account showed the six-step overlay; the skip confirmation was clicked and persisted as `SKIPPED` with 0 XP. Registration was API-driven, not a full first-time UI journey; the guide's real goal/task/schedule/focus/complete flow, restart/resume/replay, mobile/Aurora/Classic acceptance and installed-Tauri interaction remain unverified. A selected first-login screenshot prompted a palette-preserving reduction to backdrop dim/blur, but visual acceptance remains open.
4. **Gate D — Rewards:** `INCOMPLETE — REOPENED (2026-10-21)` — Targeted `RewardLifecycleTests` and `OnboardingRewardBoundaryTests` pass; V23/V24 applied only in isolated QA. A read-only owner-ledger check reconciled EON's 125 XP to one focus (+15), task (+10), goal (+50), and onboarding (+50) event, with no duplicate onboarding awards in the owner database. That database is at migration 22 and lacks `started_at`; the historical onboarding award's eligibility therefore cannot be independently re-proven. No historical reward was modified. Fresh workflow, concurrency and restart acceptance remain pending.
5. **Gate E — UI/UX:** `INCOMPLETE — REOPENED` — Agent-driven Chromium sweep covered 56 route/viewport/class-switched-theme combinations and found no measured collisions, clipped controls, horizontal overflow, or calendar-scroll failure; selected dark/light screenshots were inspected. Navigation and theme were programmatically changed, content-rich states and meaningful CRUD interactions were not tested, and human-owner acceptance remains pending.
6. **Gate F — Security & Reliability:** `INCOMPLETE — REOPENED` — Backup encryption now fails closed unless an age recipient is provided; an age 1.2.1 encrypted backup/checksum/decrypt/restore succeeded in isolated PostgreSQL (24 tables, 4 users). Production key custody/off-host retention and Docker restore-path integration remain open; the Docker backup path now streams the password over stdin rather than command-line arguments. CSP scope, script-readable localStorage tokens, unrun CI scans and deployment-specific proxy configuration also remain open.
7. **Gate G — Standalone Distribution & Desktop Runtime:** `INCOMPLETE — CURRENT SOURCE DEB BUILT / EXTRACTED SMOKE ONLY` / `NOT TESTED (Windows)` / `NOT DEPLOYED (Cloud)`
   - Built current-source Linux DEB in isolated `/tmp` (SHA-256 `fc75b3018f869c52b09d082c51df8cecb07b6c27eb02d616e27d8214ee1b5932`), extracted without system installation, and launched the packaged binary under WebKitGTK at 1400×900. First-launch sign-in screenshot inspected; no authenticated workflow or package-manager installation was tested. RC-2 artifacts in `release/rc/` remain preserved and are not identified as this candidate.
   - Unreachable backend startup tested and verified to report clean network errors without fake success.
   - Native Focus Shield (`shinpo-shield status` OPERATIONAL, `sweep -d` safe dry-run), Sentinel emergency override (switched to `AUDIT_ONLY`), and Browser Companion (`shinpo-browser-host status`) verified.
   - Windows installer prepared via `package-windows.ps1` with `-SkipSigning` flag; Windows remains `NOT TESTED` until actual Windows execution succeeds.
   - Remote cloud hosting requires user authorization and infrastructure provisioning before deployment (`DEPLOYMENT.md`); no remote backend or persistent remote PostgreSQL has been deployed or tested.
8. **Gate H — Global Readability & Design System Consistency:** `INCOMPLETE — REOPENED` — Sampled empty-state screens were legible at tested widths; the targeted first-login overlay was too dim/blurred in the captured render and received a restrained correction. Content-rich states, every screen/state, responsive scaling beyond tested browser widths, and human acceptance remain open.

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
