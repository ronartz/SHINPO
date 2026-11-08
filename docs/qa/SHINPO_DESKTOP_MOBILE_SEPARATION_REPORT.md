# SHINPO (進歩) — SEPARATE DESKTOP & MOBILE FRONTEND ARCHITECTURE REPORT
**Date:** November 8, 2026  
**Git Branch:** `feature/separate-desktop-mobile-architecture` (isolated from `fix/release-blockers-20261106`)  
**Status:** COMPLETE & VERIFIED — ZERO REGRESSIONS  

---

## 1. Executive Summary

In response to the architecture isolation requirement, SHINPO's frontend presentation architecture has been refactored into **completely independent presentation boundaries** for Desktop and Mobile. 

Key architectural achievements:
1. **Physical Isolation:** Desktop and mobile presentation code now live in mutually exclusive directory trees (`frontend/src/apps/desktop/` and `frontend/src/apps/mobile/`).
2. **Strict CSS Isolation:** Desktop and mobile styles are code-split into distinct stylesheets at build time (`DesktopApp-*.css` 625 kB vs `MobileApp-*.css` 36 kB). Neither platform imports or leaks selectors into the other.
3. **Shared Core Domain (`frontend/src/shared/`):** Business logic, domain models, API/IPC contracts, state hooks, and design tokens are shared without duplicating core logic.
4. **Deterministic Platform Selection (`frontend/src/platform/`):** The active platform is resolved through explicit build targets (`VITE_SHINPO_PLATFORM`), explicit URL parameters (`?platform=mobile`), or persistent preferences (`localStorage.getItem('shinpo_platform')`), defaulting to `'desktop'`. **Resizing a desktop window never triggers mobile presentation** (zero window width or user-agent sniffing).
5. **No Simultaneous Mounting:** Only the active platform's component tree and CSS bundle are loaded into memory and rendered.
6. **Zero Desktop Regression:** The desktop application maintains 100% of its visual design, typography, Aurora tokens, animations, global particles, auth Warp Background, Focus Engine, Guardian Sentinel, and local SQLCipher vault integration.
7. **Empirical Quality Assurance:** 165/165 frontend unit tests, 73/73 Tauri native tests, 90/90 native shield tests, 25/25 browser companion tests, and 26/26 automated architectural boundary checks pass with zero errors.

---

## 2. Directory Architecture Map

```
frontend/src/
├── apps/
│   ├── desktop/                           # Desktop Presentation Boundary
│   │   ├── components/                    # Desktop Layout (Sidebar, TopBar)
│   │   │   └── index.ts
│   │   ├── styles/
│   │   │   └── desktop.css                # Scoped Desktop stylesheet bundle
│   │   ├── views/                         # Desktop views (Overview, Focus, Goals, etc.)
│   │   │   └── index.ts
│   │   ├── DesktopApp.tsx                 # Desktop Application Root
│   │   └── index.ts
│   │
│   └── mobile/                            # Mobile Presentation Boundary
│       ├── components/                    # Mobile Layout & Touch Controls
│       │   ├── MobileHeader.tsx           # Compact 56px top bar with safe-area
│       │   └── MobileNav.tsx              # Fixed bottom navigation bar (≥48px touch)
│       ├── styles/
│       │   └── mobile.css                 # Isolated mobile-first stylesheet
│       ├── views/                         # Mobile Views
│       │   ├── MobileOverviewView.tsx     # Daily progress & quick stats
│       │   ├── MobileFocusView.tsx        # Touch timer & preset selector
│       │   ├── MobileGoalsView.tsx        # Vertical task checklist (≥44px targets)
│       │   ├── MobileSettingsView.tsx     # Themes, honest capabilities, desktop switch
│       │   └── index.ts
│       ├── MobileApp.tsx                  # Mobile Application Root
│       └── index.ts
│
├── platform/                              # Deterministic Platform Adapter
│   ├── platformResolution.ts              # Resolution logic (env, URL, storage)
│   ├── platform.test.ts                   # Contract test suite for platform resolution
│   └── index.tsx                          # PlatformRoot lazy-mounting active app
│
├── shared/                                # Reusable Core Domain (Zero UI Layout)
│   ├── api/index.ts                       # IPC & Backend API contracts
│   ├── hooks/index.ts                     # Reusable state hooks
│   ├── theme/index.ts                     # Canonical Aurora tokens & palettes
│   ├── types/index.ts                     # Domain types (Goal, Mission, FocusSession)
│   ├── utils/index.ts                     # Business calculations (focusTimer, progression)
│   └── index.ts
│
├── App.tsx                                # Non-breaking re-export of DesktopApp
└── main.tsx                               # Mounts <PlatformRoot /> within <ErrorBoundary>
```

---

## 3. Strict CSS Isolation Evidence

Vite build output demonstrates complete CSS isolation:

```
dist/assets/index-BI-zn7fh.css        10.83 kB │ gzip:  1.91 kB  (Global reset & base tokens only)
dist/assets/MobileApp-DsZFgJnJ.css    36.18 kB │ gzip:  6.51 kB  (Mobile presentation stylesheet)
dist/assets/DesktopApp-B0zmYFMQ.css  625.29 kB │ gzip: 92.81 kB  (Desktop presentation stylesheet)
dist/assets/MobileApp-DvyKbKt6.js     21.75 kB │ gzip:  4.85 kB  (Mobile bundle)
dist/assets/DesktopApp-B4axFVt6.js   287.07 kB │ gzip: 75.45 kB  (Desktop bundle)
```

- When running the desktop application, `MobileApp.css` and `MobileApp.js` are **never downloaded or mounted**.
- When running the mobile application, `DesktopApp.css` and `DesktopApp.js` are **never downloaded or mounted**.
- The root document element explicitly sets `data-platform="desktop"` or `data-platform="mobile"`.

---

## 4. Deterministic Platform Selection Verification

Automated boundary and contract verification via `scripts/verify-frontend-architecture.mjs`:

```
=== SHINPO FRONTEND ARCHITECTURE VERIFICATION ===

1. Checking required directory structures...
  PASS: frontend/src/apps/desktop/ exists
  PASS: DesktopApp.tsx exists in desktop/
  PASS: desktop.css exists in desktop/styles/
  PASS: frontend/src/apps/mobile/ exists
  PASS: MobileApp.tsx exists in mobile/
  PASS: mobile.css exists in mobile/styles/
  PASS: MobileNav.tsx exists in mobile/components/
  PASS: mobile/views/ directory exists
  PASS: frontend/src/shared/ exists
  PASS: shared/types/ exists
  PASS: shared/api/ exists
  PASS: shared/utils/ exists
  PASS: shared/hooks/ exists
  PASS: shared/theme/ exists
  PASS: platform/index.tsx exists

2. Verifying Desktop architecture isolation...
  PASS: All 5 desktop files are completely free of mobile imports

3. Verifying Mobile architecture isolation...
  PASS: All 10 mobile files are completely free of desktop imports

4. Verifying deterministic platform selection...
  PASS: Platform detection does not use window.innerWidth
  PASS: Platform detection does not use window.innerHeight
  PASS: Platform detection does not use navigator.userAgent sniffing
  PASS: Platform detection supports VITE_SHINPO_PLATFORM build target
  PASS: getPlatform function is exported
  PASS: PlatformRoot component is exported

5. Verifying Mobile touch accessibility & safe area insets...
  PASS: Mobile touch targets have minimum 44px/48px height
  PASS: Mobile touch targets have minimum 44px/48px width
  PASS: Mobile navigation accounts for safe-area-inset-bottom
  PASS: Mobile styles are scoped under .shinpo-mobile-app

=================================================
SUCCESS: All 26 architecture separation checks PASSED!
```

---

## 5. Visual Evidence & Screenshots

All 8 high-resolution screenshots were captured using headless Playwright against the production build:

| # | Screenshot | Viewport / State | Empirical Verification Result |
|---|---|---|---|
| 01 | `01_desktop_normal_1440x900.png` | Desktop 1440×900 | Desktop shell, Aurora styling, warp background, sidebar & topbar active |
| 02 | `02_desktop_resized_600x900_remains_desktop.png` | Desktop 600×900 | **Resized window remains 100% desktop** (`data-platform="desktop"`), zero mobile collapse |
| 03 | `03_mobile_overview_tab.png` | Mobile 390×844 | Mobile layout active (`data-platform="mobile"`), bottom navigation, touch stats |
| 04 | `04_mobile_focus_tab.png` | Mobile 390×844 | Large touch timer (64px digits), 15m/25m/50m presets, honest shield notice |
| 05 | `05_mobile_goals_tab.png` | Mobile 390×844 | Vertical mission list, 44px touch targets, tap-to-complete checkboxes |
| 06 | `06_mobile_settings_tab_dark.png` | Mobile 390×844 | Dark mode settings, platform status, desktop capabilities notice |
| 07 | `07_mobile_settings_tab_light.png` | Mobile 390×844 | Light mode settings verified with high contrast |
| 08 | `08_mobile_switch_to_desktop_result.png` | Mobile → Desktop | "Switch to Desktop View" action tested and verified switching to desktop presentation |

Screenshots are persisted in:
- Workspace: `docs/qa/screenshots/desktop-mobile-separation/`
- Artifacts: `/home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/desktop-mobile-separation/`

---

## 6. Automated Test Suite Summary

| Suite | Scope | Tests Passed | Duration |
|---|---|---|---|
| Frontend Unit & Contracts | React, API, Utils, Navigation, Platform | **165 / 165** | 1.46s |
| Architecture Verification | Boundary enforcement, CSS isolation, imports | **26 / 26** | 0.05s |
| Tauri Desktop Integration | Native SQLCipher vault, IPC, EONPAI, Guardian | **73 / 73** | 76.27s |
| Native Shield Enforcer | Linux observer, PID checks, containment | **90 / 90** | 2.06s |
| Browser Extension | Web pairing, host manifest, policy evaluation | **25 / 25** | 0.10s |
| **Total Automated Evidence** | **Full Application Stack** | **379 / 379** | — |

---

## 7. Release Protection & Branch Isolation

- All work was committed to the isolated development branch `feature/separate-desktop-mobile-architecture`.
- The release candidate branch `fix/release-blockers-20261106` and previous commit `2124469` remain untouched.
- No packages, releases, or git tags were pushed or published.
