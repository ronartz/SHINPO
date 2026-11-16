# SHINPO — Signed GitHub Auto-Updater Implementation Report

**Project:** SHINPO (進歩) — Personal Execution Operating System  
**Repository:** `ronartz/SHINPO`  
**Branch:** `fix/systematic-layout-and-composition`  
**Current Version:** `0.1.0-beta.1`  
**Status:** Complete & Empirically Verified (PASS)  
**Date:** 2026-11-16  

---

## 1. Executive Summary

This engineering effort implements a secure, production-grade in-app update system for SHINPO powered by official Tauri 2 plugins (`tauri-plugin-updater` and `@tauri-apps/plugin-updater`), minisign Ed25519 cryptographic signatures, and GitHub Releases.

SHINPO desktop users can now receive non-intrusive in-app notifications when new releases arrive, inspect release highlights, view live download progress, safely restart the application with active Focus protection, or configure release channels between **Beta** and **Stable** directly from Settings.

All operations strictly uphold SHINPO's local-first architecture: zero sensitive vault leakage, 100% offline persistence, and cryptographic verification of all binaries prior to execution.

---

## 2. Architecture & Design Specifications

### 2.1 Cryptographic Signing Pipeline (Minisign Ed25519)
- **Public Key:** Configured in `frontend/src-tauri/tauri.conf.json`:
  ```text
  dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IEE3Qjg4NkNGODVFRTRBNjQKUldSa1N1NkZ6NGE0cDhMNVcrNWlYR2o0KzVQT1RvbEU4MG9TMy9PeG1PRmNaL20yMDU1bVdGYmsK
  ```
- **Private Key Storage:** Kept strictly outside the repository in GitHub Secrets:
  - `TAURI_SIGNING_PRIVATE_KEY` (Minisign Ed25519 private key)
  - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (Passphrase)
- **Key Safety Guard:** `*.key`, `*.key.pub`, `*.pem`, `*.pfx` added to `.gitignore`. Private keys are never committed or logged.

### 2.2 Dual-Channel Progression
SHINPO provides distinct release channels with live switching in the UI:
1. **Beta Channel (`beta`):** Tracks preview builds, early polish updates, and feature revisions.
   - Primary: `https://ronartz.github.io/SHINPO/updates/beta/latest.json`
   - Fallback: `https://raw.githubusercontent.com/ronartz/SHINPO/main/releases/beta/latest.json`
2. **Stable Channel (`stable`):** Tracks tested, production milestone releases.
   - Primary: `https://ronartz.github.io/SHINPO/updates/stable/latest.json`
   - Fallback: `https://raw.githubusercontent.com/ronartz/SHINPO/main/releases/stable/latest.json`

### 2.3 Platform Support Matrix
- **Linux AppImage:** Full in-app binary replacement supported via `app.env().appimage`.
- **Linux DEB & RPM:** In-app binary replacement is honestly detected as unsupported. The UI presents honest guidance directing users to their system package manager or the official GitHub release download link.
- **Windows NSIS:** Full in-app update bundle (`.nsis.zip`) supported.
- **macOS:** Documented as unsupported for current Linux/Windows milestone.

### 2.4 Focus Session Protection Guardrail
- An active or paused Focus session (`status === 'ACTIVE' || status === 'PAUSED'`) is detected before any app restart.
- Non-forced restarts are immediately intercepted, displaying a safety alert explaining that restarting will interrupt their sprint.
- Users can choose **"Wait & Restart Later"** (keeping the staged update ready for next launch) or **"Restart Anyway"** if they explicitly authorize an immediate restart.

---

## 3. Files Created & Modified

### Backend & Configuration:
1. [Cargo.toml](file:///home/eonx/Projects/SHINPO/frontend/src-tauri/Cargo.toml): Added `tauri-plugin-updater = "2"`.
2. [Cargo.lock](file:///home/eonx/Projects/SHINPO/frontend/src-tauri/Cargo.lock): Resolved `tauri-plugin-updater v2.14.1`.
3. [tauri.conf.json](file:///home/eonx/Projects/SHINPO/frontend/src-tauri/tauri.conf.json): Configured `plugins.updater` with Minisign Ed25519 public key and dual-channel endpoints.
4. [capabilities/default.json](file:///home/eonx/Projects/SHINPO/frontend/src-tauri/capabilities/default.json): Granted `"updater:default"` capability.
5. [lib.rs](file:///home/eonx/Projects/SHINPO/frontend/src-tauri/src/lib.rs): Registered `tauri_plugin_updater::Builder::new().build()`, implemented `local_get_package_info` IPC command, verified safe shutdown sequence in `desktop_restart_app`.
6. [.gitignore](file:///home/eonx/Projects/SHINPO/.gitignore): Ignored `*.key`, `*.key.pub`, `*.pem`, `*.pfx`.

### Frontend Core Services & UI:
7. [updaterTypes.ts](file:///home/eonx/Projects/SHINPO/frontend/src/services/updater/updaterTypes.ts): Type contracts for states, progress, package info, and channels.
8. [updaterService.ts](file:///home/eonx/Projects/SHINPO/frontend/src/services/updater/updaterService.ts): Centralized singleton managing checking, downloading, installing, channel switching, dismissal, and focus protection.
9. [useUpdater.ts](file:///home/eonx/Projects/SHINPO/frontend/src/services/updater/useUpdater.ts): Reactive React hook for subscribing to updater state.
10. [updater/index.ts](file:///home/eonx/Projects/SHINPO/frontend/src/services/updater/index.ts): Export aggregator.
11. [updaterService.test.ts](file:///home/eonx/Projects/SHINPO/frontend/src/services/updater/updaterService.test.ts): Comprehensive Node.js unit tests.
12. [UpdateNotification.tsx](file:///home/eonx/Projects/SHINPO/frontend/src/components/updater/UpdateNotification.tsx): Non-intrusive floating toast/banner with channel pill and actions.
13. [UpdateModal.tsx](file:///home/eonx/Projects/SHINPO/frontend/src/components/updater/UpdateModal.tsx): Centered dialog with version flow, release highlights, progress bar, focus session warning, and restart execution.
14. [components/updater/index.ts](file:///home/eonx/Projects/SHINPO/frontend/src/components/updater/index.ts): UI component exports.
15. [updater.css](file:///home/eonx/Projects/SHINPO/frontend/src/styles/components/updater.css): Complete theme-aware stylesheet supporting Classic Dark, Classic Light, Aurora Dark, Aurora Light, and reduced motion.
16. [desktop.css](file:///home/eonx/Projects/SHINPO/frontend/src/apps/desktop/styles/desktop.css): Imported `updater.css`.
17. [DesktopApp.tsx](file:///home/eonx/Projects/SHINPO/frontend/src/apps/desktop/DesktopApp.tsx): Mounted `UpdateNotification` and `UpdateModal`, wired startup initialization.
18. [SettingsModal.tsx](file:///home/eonx/Projects/SHINPO/frontend/src/components/dialogs/SettingsModal.tsx): Added `"Software Updates"` category with installation specs, channel cards, check button, and status banner.

### Workflows & Release Artifacts:
19. [.github/workflows/release-build.yml](file:///home/eonx/Projects/SHINPO/.github/workflows/release-build.yml): Added signing secrets and updater bundle artifact collection (`.tar.gz`, `.zip`, `.sig`).
20. [releases/beta/latest.json](file:///home/eonx/Projects/SHINPO/releases/beta/latest.json): Beta channel template manifest.
21. [releases/stable/latest.json](file:///home/eonx/Projects/SHINPO/releases/stable/latest.json): Stable channel template manifest.
22. [releases/README.md](file:///home/eonx/Projects/SHINPO/releases/README.md): Architecture, signature instructions, and deployment guide.
23. [verify_signed_updater.mjs](file:///home/eonx/Projects/SHINPO/frontend/scripts/verify_signed_updater.mjs): Playwright verification suite.

---

## 4. Empirical Verification Evidence

### 4.1 Frontend Unit Tests
- **Command:** `npm --prefix frontend test`
- **Result:** `PASS`
- **Output:**
  ```text
  ℹ tests 230
  ℹ suites 16
  ℹ pass 230
  ℹ fail 0
  ℹ duration_ms 2544
  ```

### 4.2 Frontend Typecheck & Production Bundle
- **Command:** `npm --prefix frontend run build` (`tsc -b && vite build`)
- **Result:** `PASS` (0 type errors, bundle compiled in 851ms).

### 4.3 ESLint Cleanliness
- **Command:** `npx eslint frontend/src/components/updater/ frontend/src/services/updater/`
- **Result:** `PASS` (0 errors, 0 warnings).

### 4.4 Rust Backend Tests
- **Command:** `cargo test --locked --manifest-path frontend/src-tauri/Cargo.toml`
- **Result:** `PASS`
- **Output:**
  ```text
  test result: ok. 85 passed; 0 failed; 1 ignored; 0 measured; finished in 87.42s
  ```

### 4.5 Rust Clippy
- **Command:** `cargo clippy --manifest-path frontend/src-tauri/Cargo.toml -- -D warnings`
- **Result:** `PASS` (0 warnings).

### 4.6 Release Gate
- **Command:** `./scripts/qa-release.sh quick`
- **Result:** `PASS` (Decision: PASS, all unit tests and builds succeeded).

### 4.7 Playwright Acceptance Screenshots
12 visual acceptance screenshots captured across all 4 themes in [docs/qa/screenshots/updater/](file:///home/eonx/Projects/SHINPO/docs/qa/screenshots/updater/):
- `01_update_notification_classic-dark.png`
- `01_update_notification_classic-light.png`
- `01_update_notification_aurora-dark.png`
- `01_update_notification_aurora-light.png`
- `02_update_modal_downloading_classic-dark.png`
- `02_update_modal_downloading_aurora-dark.png`
- `03_update_active_focus_guardrail.png`
- `04_settings_software_updates_classic-dark.png`
- `04_settings_software_updates_classic-light.png`
- `04_settings_software_updates_aurora-dark.png`
- `04_settings_software_updates_aurora-light.png`
- `05_update_unsupported_deb_notice.png`

---

## 5. Security & Maintenance Checklist

- [x] Public key safely committed in `tauri.conf.json`.
- [x] Private key strictly kept in `/home/eonx/.tauri/shinpo.key` (external to repo).
- [x] `.gitignore` blocks all private key extensions (`*.key`, `*.pem`, `*.pfx`).
- [x] Capability scoped to `"updater:default"`.
- [x] Focus session protection active during restart attempts.
- [x] Honest degradation for package formats that do not support in-place binary overwrite.
