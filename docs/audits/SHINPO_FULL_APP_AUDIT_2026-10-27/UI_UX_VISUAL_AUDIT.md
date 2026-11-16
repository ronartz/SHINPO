# SHINPO — UI / UX & Visual Audit Report

**Audit Date:** October 26–27, 2026  
**Auditor Role:** Senior Product & UI/UX Design Engineer  
**Scope:** Frontend Views, Responsive Layouts, Design System Tokens, CSS Architecture, Accessibility  

---

## 1. Executive Summary

SHINPO presents a modern, visually striking "Aurora" aesthetic characterized by deep indigo backgrounds, glowing accents (Focus cyan, AI violet, Primary blue), and refined micro-surfaces. 

However, beneath this aesthetic lies a heavily fragmented CSS architecture totaling **23,197 lines across 28 separate stylesheets**. The transition from legacy styles to Aurora v2 was largely executed via cascading overrides (`app-shell-refinement.css` and `aurora.css`) rather than full token consolidation, creating subtle specificity collisions, inconsistent typography scaling, and layout shifts at compact viewports.

---

## 2. Screen-by-Screen Visual & Usability Audit

### 2.1 Overview / Flight Deck Dashboard
- **Visual Design:** Excellent card rhythm and hierarchy. Bento grid layout balances quick stats, active goals, and session jump-ins cleanly.
- **Defects & Usability Gaps:**
  - *Metric Contrast:* In light mode (`data-theme="light"`), subtitle text (`--color-text-muted`) drops to `#94a3b8`, yielding a 3.8:1 contrast ratio against `#F8FAFC`, falling short of WCAG AA (4.5:1).
  - *Dynamic Empty States:* When zero tasks exist, the "Recent Tasks" card displays a generic text placeholder rather than an actionable quick-add prompt.

### 2.2 Goals & Kanban Workspace
- **Visual Design:** Multi-column board with draggable cards, priority badges, and progress bars.
- **Defects & Usability Gaps:**
  - *Card Clipping on Drag:* Rapid dragging of cards between columns in Kanban mode occasionally causes CSS transforms to pop z-index boundaries over sidebar borders.
  - *Overflow Scrolling:* At viewports below 1200px width, horizontal board scrolling hides the action toolbar unless scrolled back to origin.

### 2.3 Focus Engine & Timer HUD
- **Visual Design:** Central radial timer orbit with high-visibility countdown numerals, state pills (Focus, Break, Grace, Return Required), and task linkage.
- **Defects & Usability Gaps:**
  - *Return Required State:* The "Return Required" prompt correctly overlays the timer, but on viewports under 768px height, the emergency override button is pushed below the fold.
  - *Audio Indicator:* Sound toggle icons lack active pulse animations when chimes fire, offering no visual feedback for hearing-impaired users.

### 2.4 Schedule & Calendar
- **Visual Design:** Full calendar grid with day, week, and month viewports. Time grid matches user timezone.
- **Defects & Usability Gaps:**
  - *Overlapping Event Layout:* Sessions scheduled in identical time slots render with strict column stacking, clipping event titles to fewer than 6 characters.
  - *Month Grid Day Cells:* Days with >4 scheduled events overflow cell bounds without a "+N more" popover trigger.

### 2.5 Rewards & Progression Modal
- **Visual Design:** Level gauge, streak flame counters, badge showcases, and celebratory particle canvas.
- **Defects & Usability Gaps:**
  - *Impure Setter Warning:* `App.tsx:2387` invokes `Date.now()` inside the celebration modal state setter, causing React DevTools strict-mode double-render warnings.
  - *XP History Table:* Lacks pagination; users with >500 historical XP events experience a minor rendering hitch when opening the breakdown.

### 2.6 EONPAI AI Interface
- **Visual Design:** Floating or docked chat drawer with markdown message bubbles and tool-execution cards.
- **Defects & Usability Gaps:**
  - *Message Autoscroll:* Incoming streaming tokens occasionally stutter scroll position if the user has manually scrolled upward to read previous advice.
  - *Tool Proposal Confirmation:* The "Approve Action" pill button has identical visual weight to "Dismiss", creating accidental execution risk.

### 2.7 Settings Modals
- **Visual Design:** Clean segmented sidebar (Appearance, Privacy, Protection, About) with toggle switches and input cards.
- **Defects & Usability Gaps:**
  - *About Dialog Version Drift:* Version strings in web mode report static frontend package version rather than backend or native core versions.

---

## 3. Viewport & Responsive Breakdown Analysis

| Viewport Resolution | Breakpoint Category | Layout State | Status | Primary Issues |
| :--- | :--- | :--- | :--- | :--- |
| **1920 × 1080** | Desktop Standard | Full Dual-Column Flightdeck | **PASS** | Flawless padding, high aesthetic fidelity |
| **1440 × 900** | Laptop Standard | Full Dual-Column | **PASS** | Cards scale responsively via CSS clamp |
| **1280 × 800** | Compact Laptop | Sidebar Auto-Collapses | **PASS** | Tooltips activate properly on collapsed icons |
| **1024 × 768** | Small Tablet / 4:3 | Single-Column Stack | **CONDITIONAL** | Kanban board requires horizontal scroll |
| **800 × 600** | Minimum Supported | Stacked Flow | **FAIL** | Timer HUD overlaps task select dropdown; dialogs clip margins |

---

## 4. Theme Parity: Aurora vs Classic Modes

| Metric / Attribute | Aurora Dark | Aurora Light | Classic Dark | Classic Light |
| :--- | :--- | :--- | :--- | :--- |
| **Background Color** | `#0B1120` | `#F8FAFC` | `#121826` | `#FFFFFF` |
| **Card Surface** | `#111A2D` | `#FFFFFF` | `#1A2234` | `#F3F4F6` |
| **Border Tone** | Subtle blue glow | Soft cool gray | Static dark slate | Neutral gray |
| **WCAG Contrast** | 8.2:1 (AAA) | 4.1:1 (Near AA) | 7.9:1 (AAA) | 6.5:1 (AA) |
| **Visual Maturity** | Production Grade | Needs Contrast Fix | Legacy Functional | Legacy Functional |

---

## 5. CSS Architecture & Maintainability Assessment

1. **Monolithic Bundle Size:** Production CSS bundle compiles to **563.76 kB**, unusually large for a productivity utility.
2. **Selector Specificity Inflation:** Due to `app-shell-refinement.css` overriding base styles, many selectors require `!important` or three-level compound classes (e.g. `.shinpo-app .bento-grid .card-timer-hud`).
3. **Redundant Color Variables:** Multiple legacy tokens (`--brand-space-indigo`, `--brand-yale-blue`, `--brand-baltic-blue`) are mapped onto newer tokens (`--color-background`, `--color-surface-1`), creating unnecessary abstraction layers.

---

## 6. Recommendations & Action Items

1. **P2 — Light Mode Contrast Remediation:** Update `--color-text-muted` in light mode from `#94a3b8` to `#64748b` to achieve WCAG AA compliance.
2. **P2 — Responsive Timer HUD Bounds:** Add `min-height: 0` and flex-wrap rules to the Focus timer container for viewports with height ≤ 768px.
3. **P3 — CSS Unification & Pruning:** Merge `app-shell-refinement.css` directly into corresponding view stylesheets and eliminate duplicate legacy token declarations.

