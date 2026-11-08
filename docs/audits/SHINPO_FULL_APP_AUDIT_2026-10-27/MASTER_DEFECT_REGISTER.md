# SHINPO — Master Defect Register

**Audit Date:** October 26–27, 2026  
**Auditor Role:** Quality Assurance Lead & Systems Auditor  
**Priority Hierarchy:**  
- **P0:** System crash, data corruption, total security breach. (None identified)  
- **P1:** Release blocker, architectural failure, persistent data loss risk.  
- **P2:** Major feature defect, security hardening gap, build/lint failure.  
- **P3:** Minor feature defect, visual glitch, performance/bundle issue.  
- **P4:** Trivial polish, code hygiene, documentation drift.  

---

## 1. Consolidated Defect Register Table

| Defect ID | Priority | Subsystem | Affected File(s) | Symptom / Description | Root Cause | Recommended Remediation | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **DEF-001** | **P1** | EONPAI / Desktop Vault | `frontend/src-tauri/src/native_vault.rs`, `frontend/src/api/ai.ts` | EONPAI chat and history completely fail in standalone desktop mode when backend is offline. | `native_vault.rs` only defines 7 tables; zero tables exist for AI conversations or suggestions. Desktop bridge attempts HTTP calls to port 8080. | Implement `conversations` and `ai_suggestions` SQLite tables in `native_vault.rs`; add Tauri IPC handlers for local Ollama invocation. | **OPEN** |
| **DEF-002** | **P1** | Backend Test Suite | `backend/src/test/java/com/shinpo/ai/AiArchitectureTests.java`, `SilenceEngineTests.java` | 3 tests fail during `./mvnw test` run. | Production copy strings were modernized in `AiGateway.java`, but test assertions still expect legacy robotic phrasing. | Update test assertions to match current production strings (`"Suggested next task:"`, `"Focus session in progress."`). | **RESOLVED (VERIFIED)** |
| **DEF-003** | **P2** | Frontend Static Quality | `frontend/src/api/contextualFocus.ts` | 17 ESLint violations trigger exit code 1 during lint checks. | Helper functions named with `use` prefix (e.g. `useLocalFocusServices`) violate `react-hooks/rules-of-hooks` when called inside regular async functions. | Rename helper functions from `useLocalFocusServices` to `shouldUseLocalFocusServices`. | **RESOLVED (VERIFIED)** |
| **DEF-004** | **P2** | Frontend React Compiler | `frontend/src/App.tsx` | React DevTools / ESLint flags impure state setter callback and ref mutation during render. | Direct mutation of `hasActiveModalRef.current` and `Date.now()` evaluation inside celebration triggers. | Wrap ref assignments in `useEffect`, extract timestamp calculation, and calibrate compiler lint rules. | **RESOLVED (VERIFIED)** |
| **DEF-005** | **P2** | Desktop Security | `frontend/src-tauri/tauri.conf.json` | Tauri CSP allows unencrypted loopback network requests (`http://localhost:8080`, `ws://localhost:8080`). | Left enabled for hybrid development mode; permits local token sniffing if rogue process binds to 8080. | Remove HTTP loopback permissions from release profile CSP; route all desktop operations through native IPC. | **RESOLVED (VERIFIED)** |
| **DEF-006** | **P2** | Windows Platform QA | `crates/shinpo-shield/src/windows.rs` | Windows desktop experience unverified in live environment. | Development and audit environment is Linux-only; no Windows runner or MSVC build artifacts available. | Configure automated Windows CI/CD matrix build using GitHub Actions or local VM testing harness. | **OPEN** |
| **DEF-007** | **P3** | UI / Accessibility | `frontend/src/styles/views/overview-bento.css` | Muted subtitle text is difficult to read in light theme (3.8:1 contrast). | Color token `--color-text-muted` is set to `#94A3B8` on `#F8FAFC` background. | Darken light mode `--color-text-muted` to `#64748B` to achieve WCAG AA 4.5:1 contrast. | **OPEN** |
| **DEF-008** | **P3** | CSS Maintainability | `frontend/src/styles/` (28 files) | CSS bundle is 563.76 kB with heavy selector specificity overrides. | Aurora design system was layered as additive overrides (`app-shell-refinement.css`) over legacy classes. | Consolidate `app-shell-refinement.css` directly into view stylesheets; eliminate redundant legacy tokens. | **OPEN** |
| **DEF-009** | **P3** | Frontend Performance | `frontend/src/App.tsx`, `vite.config.ts` | Monolithic `index.js` bundle (455 kB) loads entire app logic upfront. | All routes and modals are synchronously imported in `App.tsx`. | Implement `React.lazy()` route splitting for `ScheduleView`, `EonpaiView`, and `SettingsModal`. | **OPEN** |
| **DEF-010** | **P4** | Configuration Hygiene | `backend/src/test/resources/application-test.properties` | Static JWT secret in test properties file. | Standard testing convenience property. | Ensure environment variable override is strictly required in production profiles. | **OPEN** |

---

## 2. Defect Resolution Priority Matrix

```
   High Severity │   DEF-001 (EONPAI Vault)      [FIXED] DEF-002 (Maven Tests)
                 │   [FIXED] DEF-005 (Tauri CSP) DEF-006 (Windows QA)
                 │   [FIXED] DEF-003 (Hooks)     [FIXED] DEF-004 (Impure Setter)
                 │
                 │   DEF-007 (Light Contrast)    DEF-008 (CSS Bloat)
                 │   DEF-009 (JS Bundle Split)   DEF-010 (Test JWT)
    Low Severity └─────────────────────────────────────────────────────
                   Urgent (Blocker)               Standard Cleanup
```
