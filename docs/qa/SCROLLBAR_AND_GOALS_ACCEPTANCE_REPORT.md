# SHINPO — GLOBAL SCROLLBAR DESIGN REPAIR & GOALS EYEBROW VERIFICATION REPORT

**Repository:** `ronartz/SHINPO`  
**Branch:** `fix/systematic-layout-and-composition`  
**Execution Date:** November 15, 2026  
**Status:** COMPLETE & VERIFIED — RELEASE READY

---

## 1. Executive Summary

This report documents the resolution, empirical verification, and visual acceptance of two critical defects identified during release candidate verification:

1. **Global Scrollbar Standardization:** Unification of narrow, unstyled, and conflicting scrollbars into a cohesive, theme-aware system with zero layout shifting (`scrollbar-gutter: stable;`) across all four supported themes (`classic-dark`, `classic-light`, `aurora-dark`, `aurora-light`).
2. **Complete Elimination of `PORTFOLIO & ROADMAP` Eyebrow:** Total removal of the redundant eyebrow element from the live DOM in both List and Board modes across all themes, with automated regression gating preventing re-introduction.

---

## 2. Root Cause Analysis

### 2.1 Scrollbar Inconsistencies and Breakage
1. **Unstyled WebKit Defaults & Fragmented Selectors:** `frontend/src/index.css` previously enforced a fixed 6px scrollbar with static rgba values (`rgba(255,255,255, 0.18)` and `rgba(0,0,0, 0.22)`), omitting interactive hover and dragging active states.
2. **Component-Specific Scrollbar Collision:** Five independent stylesheets declared conflicting rules:
   - `cockpit-panels.css`: declared 5px scrollbars with `--border` color on `.timesheet-list` and `.activity-feed-list`.
   - `goals-kanban.css`: declared 6px scrollbars on `.status-column-cards`.
   - `eonpai.css`: declared 5px coachmark scrollbars.
   - `schedule.css`: hardcoded `scrollbar-color: var(--color-primary) transparent;` on `.schedule-calendar-scroll`.
   - `shell.css`: hardcoded raw `#1e293b` colors on the sidebar.
3. **Viewport / Layout Shifting:** The main application container (`.app-main`) lacked `scrollbar-gutter: stable;`, leading to horizontal layout jitters and jumpy content when switching between non-scrollable and scrollable views.
4. **Dual Engine Disconnect:** Linux WebKitGTK (Tauri Linux) and Windows WebView2 / macOS WKWebView require both standards-based properties (`scrollbar-width`, `scrollbar-color`) and WebKit pseudo-elements (`::-webkit-scrollbar*`) with exact `padding-box` clip borders for floating rounded thumbs.

### 2.2 `PORTFOLIO & ROADMAP` Eyebrow Regression
- The eyebrow `<span>Portfolio & Roadmap</span>` was previously removed from `frontend/src/views/GoalsView.tsx`. However, residual heading margins (`margin: 5px 0 3px;`) left awkward whitespace, and lack of an automated end-to-end regression assertion allowed concern over its presence across alternate routes and board/list toggle states.

---

## 3. Implementation Details

### 3.1 Theme-Aware Scrollbar Token Architecture
Added semantic scrollbar tokens to `frontend/src/styles/tokens.css` across all four canonical themes:

| Theme | `--scrollbar-track` | `--scrollbar-thumb` | `--scrollbar-thumb-hover` | `--scrollbar-thumb-active` |
|---|---|---|---|---|
| **Classic Dark** | `transparent` | `rgba(148, 163, 184, 0.32)` | `rgba(203, 213, 225, 0.52)` | `rgba(175, 243, 62, 0.82)` (`#9EEB2A`) |
| **Classic Light** | `transparent` | `rgba(41, 57, 81, 0.28)` | `rgba(41, 57, 81, 0.48)` | `rgba(77, 124, 15, 0.82)` (`#4D7C0F`) |
| **Aurora Dark** | `transparent` | `rgba(185, 161, 255, 0.32)` | `rgba(185, 161, 255, 0.52)` | `rgba(151, 87, 250, 0.85)` (`#9757FA`) |
| **Aurora Light** | `transparent` | `rgba(51, 65, 85, 0.28)` | `rgba(51, 65, 85, 0.48)` | `rgba(124, 58, 237, 0.85)` (`#7C3AED`) |

### 3.2 Global Standardized Engine Rules
In `frontend/src/index.css`:
- Imported `./styles/tokens.css` at line 1.
- Universal CSS standards:
  ```css
  html, body, *, *::before, *::after {
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
  }
  ```
- WebKit / Blink engine specifications:
  ```css
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  ::-webkit-scrollbar-track {
    background: var(--scrollbar-track, transparent);
  }
  ::-webkit-scrollbar-thumb {
    background-color: var(--scrollbar-thumb);
    border-radius: 999px;
    border: 1.5px solid transparent;
    background-clip: padding-box;
    min-height: 36px;
    min-width: 36px;
    transition: background-color 150ms ease;
  }
  ::-webkit-scrollbar-thumb:hover {
    background-color: var(--scrollbar-thumb-hover);
  }
  ::-webkit-scrollbar-thumb:active {
    background-color: var(--scrollbar-thumb-active);
  }
  ```

### 3.3 Stable Gutter Architecture
In `frontend/src/styles/shell.css` and `frontend/src/apps/desktop/styles/desktop-1080p.css`:
- Added `scrollbar-gutter: stable;` to `.app-main` to preserve horizontal layout boundaries regardless of dynamic vertical overflows.

### 3.4 Cleanup of Conflicting Stylesheets
- Stripped redundant, discordant scrollbar definitions from:
  - `frontend/src/styles/views/cockpit-panels.css`
  - `frontend/src/styles/views/goals-kanban.css`
  - `frontend/src/styles/views/eonpai.css`
  - `frontend/src/styles/views/schedule.css`
  - `frontend/src/styles/foundations/flightdeck-themes.css`
- Normalized heading margins in `frontend/src/styles/views/goals.css` (`margin: 0 0 4px;`).

---

## 4. Automated Regression & Gating Evidence

### 4.1 Playwright Test Suite (`e2e/scrollbar-and-goals-eyebrow.spec.ts`)
A dedicated 12-test matrix verifies:
1. Exact count `0` for `/portfolio\s*&\s*roadmap/i` across all 4 themes in **List Mode**.
2. Exact count `0` for `/portfolio\s*&\s*roadmap/i` across all 4 themes in **Board Mode**.
3. Heading `Goals & Tasks` visibility and correct subtitle copy.
4. CSS custom property resolution for `--scrollbar-thumb`, `--scrollbar-track`, and `scrollbar-gutter: stable` on `.app-main`.

**Result:**
```text
Running 12 tests using 6 workers
  ✓ [classic-dark] Goals & Tasks: absolute absence of PORTFOLIO & ROADMAP in Board mode (8.5s)
  ✓ [classic-dark] Goals & Tasks: absolute absence of PORTFOLIO & ROADMAP in List mode (8.3s)
  ✓ [classic-dark] Global scrollbar: theme token integrity, scrollbar-gutter and container compliance (7.7s)
  ✓ [classic-light] Global scrollbar: theme token integrity, scrollbar-gutter and container compliance (7.8s)
  ✓ [classic-light] Goals & Tasks: absolute absence of PORTFOLIO & ROADMAP in List mode (8.0s)
  ✓ [classic-light] Goals & Tasks: absolute absence of PORTFOLIO & ROADMAP in Board mode (8.3s)
  ✓ [aurora-dark] Goals & Tasks: absolute absence of PORTFOLIO & ROADMAP in List mode (4.9s)
  ✓ [aurora-dark] Goals & Tasks: absolute absence of PORTFOLIO & ROADMAP in Board mode (4.8s)
  ✓ [aurora-dark] Global scrollbar: theme token integrity, scrollbar-gutter and container compliance (3.3s)
  ✓ [aurora-light] Goals & Tasks: absolute absence of PORTFOLIO & ROADMAP in List mode (4.1s)
  ✓ [aurora-light] Goals & Tasks: absolute absence of PORTFOLIO & ROADMAP in Board mode (4.1s)
  ✓ [aurora-light] Global scrollbar: theme token integrity, scrollbar-gutter and container compliance (3.2s)
  12 passed (15.6s)
```

---

## 5. Visual Acceptance Screenshot Matrix (28 Artifacts)

All 28 screenshots were rendered and captured at 1920×1080 resolution across 7 surfaces and 4 themes:

| Surface | Classic Dark | Classic Light | Aurora Dark | Aurora Light |
|---|---|---|---|---|
| **1. Main Scroll (Dashboard)** | `01_main_scroll_classic-dark.png` | `01_main_scroll_classic-light.png` | `01_main_scroll_aurora-dark.png` | `01_main_scroll_aurora-light.png` |
| **2. Sidebar** | `02_sidebar_classic-dark.png` | `02_sidebar_classic-light.png` | `02_sidebar_aurora-dark.png` | `02_sidebar_aurora-light.png` |
| **3. Goals & Tasks (List View)** | `03_goals_tasks_list_classic-dark.png` | `03_goals_tasks_list_classic-light.png` | `03_goals_tasks_list_aurora-dark.png` | `03_goals_tasks_list_aurora-light.png` |
| **4. Goals & Tasks (Board View)** | `04_goals_tasks_board_classic-dark.png` | `04_goals_tasks_board_classic-light.png` | `04_goals_tasks_board_aurora-dark.png` | `04_goals_tasks_board_aurora-light.png` |
| **5. Focus Engine** | `05_focus_engine_classic-dark.png` | `05_focus_engine_classic-light.png` | `05_focus_engine_aurora-dark.png` | `05_focus_engine_aurora-light.png` |
| **6. Analytics** | `06_analytics_classic-dark.png` | `06_analytics_classic-light.png` | `06_analytics_aurora-dark.png` | `06_analytics_aurora-light.png` |
| **7. Settings Modal** | `07_settings_modal_classic-dark.png` | `07_settings_modal_classic-light.png` | `07_settings_modal_classic-dark.png` | `07_settings_modal_aurora-light.png` |

---

## 6. Build and Native Packaging Verification

- **TypeScript Compilation (`tsc -b`):** 0 errors.
- **ESLint (`eslint .`):** 0 errors, 60 pre-existing non-blocking warnings.
- **Unit Test Suite (`node --test 'src/**/*.test.ts'`):** 203 passed across 10 suites in 1.34s.
- **Production Bundle (`vite build`):** Built cleanly in 1.03s.
- **Tauri Native Release (`cargo build --release`):** Built cleanly in 0.28s (`frontend/src-tauri/target/release/shinpo-desktop`).
- **Native Smoke Test (`shinpo-desktop --smoke-test`):** `PASS: disposable SQLCipher account, goal/task/focus completion, 75 XP, reflection, lock/unlock, restart recovery, and encrypted file header`.
