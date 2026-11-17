# SHINPO — Technical Debt & Architectural Assessment

Post-Phase 1 Architecture Health Assessment (`$zoom-out`) for `v0.1.0-beta.1`.

## Triage Summary

| Item ID | Category | Description | Status | Target Milestone |
|---------|----------|-------------|--------|------------------|
| ARCH-B1 | Blocker | Legacy proxy config in `frontend/vite.config.ts` targeting `localhost:8080` | RESOLVED (TDD) | v0.1.0-beta.1 |
| ARCH-B2 | Blocker | Circular dependency: `api/eventNormalizer.ts` <-> `api/websocket.ts` | RESOLVED (TDD) | v0.1.0-beta.1 |
| ARCH-B3 | Blocker | Forbidden legacy terms (`postgresql`, `spring`) in source files | RESOLVED (TDD) | v0.1.0-beta.1 |
| ARCH-D1 | Debt | Monolithic SQLCipher vault module in `frontend/src-tauri/src/native_vault.rs` (>3,000 LOC) | DOCUMENTED | v0.2.0 |
| ARCH-D2 | Debt | Redundant web HTTP fallback shims in frontend API layer | DOCUMENTED | v0.2.0 |
| ARCH-D3 | Debt | Native messaging host buffer framing in `crates/shinpo-browser-host` | DOCUMENTED | v0.2.0 |
| ARCH-D4 | Debt | Ineffective dynamic import splitting for `focusSessions.ts` and `goalsAndMissions.ts` | DOCUMENTED | v0.2.0 |
| ARCH-D5 | Debt | Wayland distraction detection active window inspection limitation | DOCUMENTED | v0.2.0 |

---

## Detailed Debt Register

### ARCH-D1: Decomposition of `native_vault.rs`
- **Current State:** `frontend/src-tauri/src/native_vault.rs` houses database initialization, migration runners, Argon2id key derivation, and IPC handlers for Auth, Goals, Tasks, Focus Sessions, Analytics, Progression, and System Settings in a single source file.
- **Risk:** High cognitive load and risk of merge conflicts during multi-developer feature iteration.
- **Remediation Plan:** Break into domain sub-modules:
  - `src-tauri/src/vault/schema.rs`
  - `src-tauri/src/vault/crypto.rs`
  - `src-tauri/src/vault/auth.rs`
  - `src-tauri/src/vault/focus.rs`
  - `src-tauri/src/vault/goals.rs`
  - `src-tauri/src/vault/analytics.rs`
  - `src-tauri/src/vault/progression.rs`

### ARCH-D2: Legacy Web HTTP Fallback Shims
- **Current State:** Frontend API files (`auth.ts`, `focusSessions.ts`, etc.) contain branches checking `isTauriEnvironment()`. When false, they fall back to `fetchWithoutRedirects` or throw "standalone desktop app" errors.
- **Risk:** Unnecessary code bulk in web bundle and legacy test fixtures.
- **Remediation Plan:** Strip all legacy HTTP fetch paths completely and make the frontend exclusively consume the Tauri IPC bridge.

### ARCH-D3: Native Messaging Framing Modernization
- **Current State:** `crates/shinpo-browser-host` reads native messaging packets synchronously from stdin.
- **Risk:** Blocking stdin on Windows/Linux browser communication edge cases.
- **Remediation Plan:** Migrate to Tokio asynchronous I/O with length-delimited codec framing.

### ARCH-D4: Vite Dynamic Import Chunking
- **Current State:** `src/api/focusSessions.ts` and `src/api/goalsAndMissions.ts` are dynamically imported in some views but statically imported in `DesktopApp.tsx`, triggering Vite chunk optimization notices.
- **Remediation Plan:** Align top-level view imports or isolate static contracts into type-only files.

### ARCH-D5: Wayland Process Title Inspection
- **Current State:** On modern Linux Wayland compositors, active window title queries via X11 atoms are unavailable or require compositor-specific DBus protocols.
- **Remediation Plan:** Provide native portal integration (`xdg-desktop-portal`) and pipewire focus tracking for Wayland environments.
