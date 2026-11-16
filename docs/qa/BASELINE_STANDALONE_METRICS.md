# SHINPO Standalone Desktop Pre-Removal Baseline Metrics

**Date:** 2026-11-09  
**Branch:** `chore/remove-legacy-backend`  
**Baseline Git Commit SHA:** `acb40c0ab74b5e2bb5618c148526d3c69ae2a17c`

---

## 1. Automated Test Suite Baseline Counts

| Test Suite | Command | Tests Run | Passed | Failed | Skipped / Ignored |
|---|---|---|---|---|---|
| Browser Companion | `npm --prefix browser-extension test` | 32 | 32 | 0 | 0 |
| Frontend Unit Tests | `npm --prefix frontend test` | 193 | 193 | 0 | 0 |
| Tauri Native Rust (`frontend/src-tauri`) | `cargo test --locked --manifest-path frontend/src-tauri/Cargo.toml --lib -- --test-threads=1` | 85 | 84 | 0 | 1 (OS Keyring integration) |
| Shinpo Shield Rust (`crates/shinpo-shield`) | `cargo test --locked --manifest-path crates/shinpo-shield/Cargo.toml` | 90 | 90 | 0 | 0 |
| Browser Host Rust (`crates/shinpo-browser-host`) | `cargo test --locked --manifest-path crates/shinpo-browser-host/Cargo.toml` | 9 | 9 | 0 | 0 |
| **Total Standalone Desktop Tests** | | **409** | **408** | **0** | **1** |
| *Legacy Spring Boot Backend* | `cd backend && ./mvnw test` | 421 | 107 | 314 (Postgres unavailable) | 0 |

---

## 2. Frontend Production Bundle Sizes (`dist/`)

*Built via `npm --prefix frontend run build` (`tsc -b && vite build`)*

### CSS Assets
- `dist/assets/DesktopApp-BRoPh0PN.css`: 677.38 kB (gzip: 101.76 kB)
- `dist/assets/MobileApp-D-w26iBY.css`: 36.77 kB (gzip: 6.67 kB)
- `dist/assets/index-Bv37EG6W.css`: 10.86 kB (gzip: 1.91 kB)
- **Total CSS:** 725.01 kB (gzip: 110.34 kB)

### JavaScript Assets
- `dist/assets/DesktopApp-Bq46s10Q.js`: 325.49 kB (gzip: 84.27 kB)
- `dist/assets/index-D9kDmDBQ.js`: 226.65 kB (gzip: 70.58 kB)
- `dist/assets/ThemedAuroraDashboardView-35Heoymn.js`: 190.71 kB (gzip: 57.37 kB)
- `dist/assets/EonpaiView-DkkvbAkB.js`: 43.29 kB (gzip: 10.66 kB)
- `dist/assets/TaskManagerView-XK1qZqDj.js`: 30.24 kB (gzip: 7.86 kB)
- `dist/assets/GoalsView-ia7Qq89X.js`: 27.15 kB (gzip: 5.88 kB)
- `dist/assets/OverviewView-mJPKVaUJ.js`: 24.74 kB (gzip: 5.85 kB)
- `dist/assets/focus-BxILqVqQ.js`: 23.42 kB (gzip: 7.29 kB)
- `dist/assets/FocusView-mBYaDjgs.js`: 23.15 kB (gzip: 6.91 kB)
- `dist/assets/MobileApp-CzTZU88s.js`: 21.74 kB (gzip: 4.84 kB)
- `dist/assets/ScheduleView-2TeRTmSL.js`: 18.76 kB (gzip: 4.94 kB)
- `dist/assets/AnalyticsView-DKLEd8Ou.js`: 17.87 kB (gzip: 5.00 kB)
- `dist/assets/RewardsView-CVNUjphH.js`: 17.75 kB (gzip: 5.19 kB)
- `dist/assets/auth-DFftnAyv.js`: 9.77 kB (gzip: 3.01 kB)
- Other chunks: 26.50 kB (gzip: 9.38 kB)
- **Total JS:** 996.88 kB (gzip: 276.88 kB)

### HTML & Fonts
- `dist/index.html`: 0.57 kB (gzip: 0.34 kB)
- Bundled Nunito font binaries (`.woff`, `.woff2`): ~660 kB

---

## 3. Package & Directory Footprint Before Removal

- `backend/`: 730 files, 16 MB disk space (contains Maven wrapper, Java source, Flyway migrations, Dockerfile, pom.xml)
- `compose.yaml`: 2,134 bytes
- `compose.prod.yaml`: 3,894 bytes
- `caddy/`: 4 kB (Caddyfile 1,363 bytes)
- Root Docker / compose configurations: 4 files
- Frontend dependencies in `package.json`: contains `@stomp/stompjs` (7.3.0)

---

## 4. Headless Smoke Test & Canary Port Isolation

- Command: `cargo run --locked --manifest-path frontend/src-tauri/Cargo.toml --bin shinpo-desktop -- --smoke-test`
- Output: `PASS: disposable SQLCipher account, goal/task/focus completion, 75 XP, reflection, lock/unlock, restart recovery, and encrypted file header`
- Canary Listeners: Non-blocking TCP sockets on `127.0.0.1:8080`, `127.0.0.1:5432`, `127.0.0.1:11434`
- Canary Hits Detected:
  - Port `8080` (Spring Boot HTTP): **0**
  - Port `5432` (PostgreSQL): **0**
  - Port `11434` (Ollama default port): **0**
- Result: **VERIFIED ZERO NETWORK LEAKAGE**. The standalone desktop runtime operates entirely in-process using local encrypted SQLCipher storage.

---

## 5. Visual Acceptance Screenshots Baseline

Existing reviewed screen baselines in repository:
- Auth / Sign-in: `screenshots/installed_runtime/01_desktop_auth_screen.png`, `screenshots/inventory/01_auth_revealed.png`
- Dashboard / Cockpit: `screenshots/installed_runtime/02_desktop_cockpit_dashboard.png`, `screenshots/inventory/02_dashboard_aurora.png`, `screenshots/visual_matrix/dashboard_*`
- Goals & Tasks: `screenshots/installed_runtime/03_desktop_goals_board_mode.png`, `screenshots/installed_runtime/04_desktop_goals_list_mode.png`, `screenshots/inventory/06_goals_view.png`
- Schedule / Calendar: `screenshots/installed_runtime/05_desktop_schedule_view.png`, `screenshots/visual_matrix/schedule_*`
- Focus: `screenshots/installed_runtime/06_desktop_focus_view.png`, `screenshots/inventory/07_focus_engine.png`
- Focus Protection / Sentinel: `screenshots/installed_runtime/07_desktop_focus_protection.png`, `screenshots/visual_matrix/settings_light_protection_*`
- EONPAI: `screenshots/installed_runtime/08_desktop_eonpai_view.png`, `screenshots/inventory/09_eonpai_ai.png`
- Analytics: `screenshots/installed_runtime/09_desktop_analytics_view.png`
- Settings (Appearance & Account): `screenshots/inventory/03_settings_appearance.png`, `screenshots/inventory/04_settings_account.png`, `screenshots/visual_matrix/settings_*`
- Onboarding & Rewards: `screenshots/onboarding_rewards/`, `screenshots/onboarding_rewards_e2e/`
