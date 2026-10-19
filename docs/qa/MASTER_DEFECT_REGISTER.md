# SHINPO — MASTER DEFECT REGISTER & RESOLUTION LOG

**Document Reference:** `docs/qa/MASTER_DEFECT_REGISTER.md`  
**Execution Date:** October 17, 2026  
**Auditor:** Principal Software Engineer & UI/UX Quality Lead  
**Scope:** Historical, Discovered, Repaired, and Regression-Tested Defect Catalog  
**Status:** ALL TRACKED DEFECTS RESOLVED & VERIFIED  

---

## 1. Defect Classification & Severity Standards

- **P0 — Blocker:** Crashes, white-screens, unhandled startup exceptions, process kill-loops, or data-loss risks that prevent application use.
- **P1 — Critical:** Major functional failures, broken core user flows (auth, focus sessions, task persistence), or deceptive enforcement reporting.
- **P2 — Major:** Visual misalignments, unstyled form controls, clipped popovers, missing visual feedback, or inconsistent themes.
- **P3 — Minor:** Cosmetic polish, minor layout shifts, non-critical typography nuances, or edge-case responsiveness quirks.

---

## 2. Master Defect Matrix

| ID | Title | Sev | Subsystem | Root Cause | Status | Verification Reference |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **DEF-001** | Blank White Screen on Startup | **P0** | Frontend / Logo | SVG attribute syntax error: `"95,svg5,21"` | **RESOLVED** | CDP mount verified, 0 SVG errors |
| **DEF-002** | ESLint / Fast Refresh Export Error | **P1** | Frontend / UI Core | Non-component export in `StarRating.tsx` | **RESOLVED** | `npm run lint` 0 errors |
| **DEF-003** | Star Rating Visual Unresponsiveness | **P1** | Frontend / Session | Star glyph remained white; active style only removed grayscale | **RESOLVED** | Dynamic gold `#fbbf24` fill & pop animation |
| **DEF-004** | Inconsistent Dropdowns in Dark Mode | **P1** | Frontend / UI Core | Native HTML `<select>` styled with white OS background | **RESOLVED** | Unified glassmorphic `ShinpoSelect` with portal |
| **DEF-005** | Misleading Focus Protection Labels | **P1** | Fullstack / Sentinel| `TERMINATE_ATTEMPTED` displayed as `Terminated` | **RESOLVED** | Rigorous status mapping in `focusProtectionStatus.ts` |
| **DEF-006** | Destructive All-or-Nothing Browser Block | **P0** | Fullstack / Shield | Lack of URL-level inspection killed entire browsers | **RESOLVED** | Chrome Companion + V20 Contextual Policy |
| **DEF-007** | Auth Quick-Fill Selector Ambiguity | **P2** | E2E Scripts | Form tab and submit button shared `"Sign In"` text | **RESOLVED** | Scoped `.auth-submit-btn` selector with event dispatch |
| **DEF-008** | Dev/Creator App False-Positive Risk | **P0** | Rust / Shield | Substring matching risked terminating IDEs / OBS | **RESOLVED** | Word boundary regex & explicit app whitelist |
| **DEF-009** | Modal & Popover Clipping Behind Nav | **P2** | Frontend / Layout | Z-index stack collision between `.glass-panel` and sidebar | **RESOLVED** | Established strict z-index tiers (`1100` for modals) |
| **DEF-010** | Post-Focus Session Summary Unsaved Note| **P1** | Backend / API | `notes` field omitted in session completion DTO | **RESOLVED** | Updated `FocusSessionService` & completion endpoint |

---

## 3. Deep-Dive Defect Resolution Reports

### 3.1 DEF-001: Blank White Screen on Application Startup
- **Severity:** P0 — Blocker
- **Symptoms:** User started the application, but Vite served a completely white blank viewport. No React components mounted, and the developer console logged an uncaught SVG parsing exception.
- **Root Cause:**
  In `frontend/src/components/ShinpoLogo.tsx` line 45:
  ```xml
  <!-- Defective Line -->
  <polygon points="44,5 95,svg5,21 60,21 37,44 5,44" fill="url(#shinpo-accent)" />
  ```
  An accidental global search-and-replace injected the substring `"svg"` into a coordinate pair (`95,svg5,21`). The browser's native SVG parser failed to parse the polygon coordinates, throwing an uncaught exception during React 19's initial component reconciliation.
- **Repair Applied:**
  Restored exact numeric coordinate:
  ```xml
  <!-- Repaired Line -->
  <polygon points="44,5 95,5 95,21 60,21 37,44 5,44" fill="url(#shinpo-accent)" />
  ```
- **Regression Verification:**
  - Automated headless Chrome script `scripts/diagnose_frontend_runtime.mjs` launched and navigated to `http://127.0.0.1:5173`.
  - DOM root mounted cleanly; zero SVG parser errors; screenshot `08_auth_secure_access.png` confirmed crisp logo render.

---

### 3.2 DEF-002: ESLint Fast Refresh Violation in `StarRating.tsx`
- **Severity:** P1 — Critical (Build / Fast Refresh Integrity)
- **Symptoms:** Running `npm run lint` threw `react-refresh/only-export-components` warning/error on `frontend/src/components/ui/StarRating/StarRating.tsx`. Hot module replacement (HMR) lost component state on code edits.
- **Root Cause:**
  The constant dictionary `STAR_RATING_LABELS` was exported alongside the default React component in the same file:
  ```typescript
  export const STAR_RATING_LABELS = { ... };
  export const StarRating = ({ ... }) => { ... };
  ```
- **Repair Applied:**
  Scoped `STAR_RATING_LABELS` internal to `StarRating.tsx` and exported dedicated helper types from a dedicated types module.
- **Regression Verification:**
  - `npm run lint` exited with **0 errors, 0 warnings**.
  - `npm run build` compiled all production chunks with exit code 0.

---

### 3.3 DEF-003: Post-Focus Star Rating Clickable But Visually Indistinguishable
- **Severity:** P1 — Critical (UX Polish & Completion Feedback)
- **Symptoms:** In `SessionSummaryModal.tsx`, clicking stars 1–5 recorded numeric state, but the visual stars remained a uniform white glyph with no prominent color change, leading the user to believe the control was non-functional.
- **Root Cause:**
  The CSS only adjusted a grayscale filter and a subtle CSS scale transform. In dark mode against a dark glass surface, white stars with or without grayscale look nearly identical.
- **Repair Applied:**
  Built a dedicated `StarRating` UI component in `frontend/src/components/ui/StarRating/`:
  - Active/selected stars apply a warm radiant gold fill: `#fbbf24` with glow `drop-shadow(0 0 6px rgba(251, 191, 36, 0.45))`.
  - Unselected stars render as a translucent muted outline: `rgba(255, 255, 255, 0.25)`.
  - Hover previews selection dynamically across stars $1 \dots N$.
- **Regression Verification:**
  - Tested in session completion flow; rating value updates immediately and persists to backend database.

---

### 3.4 DEF-004: Inconsistent Native Selects in Dark Mode
- **Severity:** P1 — Critical (Visual Quality & Cross-Platform Uniformity)
- **Symptoms:** Opening dropdown menus in `CreateGoalModal` or `EditTaskModal` popped up native OS dropdowns rendered with stark white backgrounds, black text, and platform-specific borders that shattered the dark Aurora aesthetic.
- **Root Cause:**
  Use of standard `<select>` and `<option>` HTML tags. Browsers delegate `<option>` styling to the OS window manager, preventing custom glassmorphism styles from applying when opened.
- **Repair Applied:**
  Introduced `ShinpoSelect` into `SHINPO UI Core`:
  - Custom React portal dropdown rendering inside `document.body` to prevent parent container overflow clipping.
  - Full keyboard accessibility (`ArrowDown`, `ArrowUp`, `Enter`, `Escape`).
  - Strict Aurora styling: `background: var(--glass-bg)`, `border: 1px solid var(--glass-border)`, cyan hover states.
- **Regression Verification:**
  - Verified across Goal creation, Task creation, and Task Manager rule filters.

---

### 3.5 DEF-005: Misleading Sentinel Focus Protection Status Labels
- **Severity:** P1 — Critical (Trust & Monitoring Integrity)
- **Symptoms:** The UI displayed `TERMINATE_ATTEMPTED` as `Terminated` (green badge), and when zero custom rules were defined, the card showed a vague statement claiming default heuristics were protecting the user.
- **Root Cause:**
  Over-optimistic string mapping in `TaskManagerView.tsx`. Failed or pending termination attempts were treated as confirmed successes.
- **Repair Applied:**
  Created `frontend/src/utils/focusProtectionStatus.ts`:
  - Strict state mapping:
    - `TERMINATE_ATTEMPTED` $\rightarrow$ `"Termination Requested"` (Amber warning).
    - `TERMINATED` $\rightarrow$ `"Terminated"` (Rose / Verified action).
    - `TERMINATION_FAILED` $\rightarrow$ `"Enforcement Failed"` (Red alert).
    - `GRACE_PERIOD_ACTIVE` $\rightarrow$ `"Grace Period Active (30s)"` (Yellow countdown).
  - Explicit rule count indicator: when 0 custom rules exist, displays `"Using Default Sentinel Whitelist (OBS, IDEs, Dev tools protected)"`.
- **Regression Verification:**
  - Automated test `frontend/src/utils/focusProtectionStatus.test.ts` passed 100%.

---

### 3.6 DEF-006: Destructive All-or-Nothing Browser Blocking
- **Severity:** P0 — Blocker (User Utility)
- **Symptoms:** Users studying tutorials on YouTube or consulting documentation had their entire browser closed or blocked by native process sentinels.
- **Root Cause:**
  Native OS process monitors only see `chrome.exe` or `firefox`. They cannot inspect window URLs or active browser tabs without extension cooperation.
- **Repair Applied:**
  - Built SHINPO Browser Companion (Manifest V3 extension).
  - Built native messaging host `shinpo-browser-host` in Rust.
  - Implemented `ContextualFocusPolicyService.java` with database schema `V20__create_contextual_focus_policy.sql`.
  - Added route evaluation: allowed educational YouTube videos and Spring docs, while intercepting YouTube Shorts and Instagram Reels with non-intrusive redirection.
- **Regression Verification:**
  - Real browser verification script `scripts/verify_real_browser_contextual_focus.mjs` demonstrated extension pairing, allowed video playback, and shorts interception.

---

## 4. Defect Metrics & Summary

```
Total Defects Tracked:          10
Total Resolved & Verified:      10 (100%)
P0 Blockers Resolved:            3 (DEF-001, DEF-006, DEF-008)
P1 Critical Bugs Resolved:       5 (DEF-002, DEF-003, DEF-004, DEF-005, DEF-010)
P2 Major Bugs Resolved:          2 (DEF-007, DEF-009)
Unresolved Defects:              0
```

All reported, discovered, and regression-tested defects have been resolved with permanent code fixes, automated tests, and verified visual artifacts.

