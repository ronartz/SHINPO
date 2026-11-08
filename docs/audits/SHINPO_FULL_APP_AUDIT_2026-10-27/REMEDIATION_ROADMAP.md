# SHINPO — Phased Remediation Roadmap

**Audit Date:** October 26–27, 2026  
**Auditor Role:** Principal Software Architect & Release Coordinator  
**Objective:** Systematic resolution plan to advance SHINPO from CONDITIONAL NO-GO to Production GA.  

---

## 1. Overview of Remediation Phases

```
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 1: Release Gate Blockers (Quality, Test & Security Hardening)   │
│ Estimated Effort: 1 Working Day                                        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 2: Standalone Desktop AI Parity (Offline Vault Schema)           │
│ Estimated Effort: 2-3 Working Days                                     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 3: Frontend Refinement & Bundle Optimization                     │
│ Estimated Effort: 2 Working Days                                       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 4: Multi-Platform CI/CD & Windows Qualification                 │
│ Estimated Effort: 2 Working Days                                       │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Phase 1: Release Gate Blockers (Immediate Execution)

### Target Defects:
- **DEF-002:** Fix 3 failing backend unit tests in `AiArchitectureTests.java` and `SilenceEngineTests.java`.
- **DEF-003:** Rename `useLocalFocusServices` in `frontend/src/api/contextualFocus.ts` to `resolveLocalFocusServices` to eliminate 17 ESLint errors.
- **DEF-004:** Extract `Date.now()` outside `setCelebration` state updater in `frontend/src/App.tsx:2387`.
- **DEF-005:** Harden Tauri CSP in `tauri.conf.json` by removing unencrypted `http://localhost:8080` from production bundle.

### Verification Protocol:
1. `npx eslint . --max-warnings=0` must exit with code 0.
2. `npx tsc --noEmit` must exit with code 0.
3. `./mvnw test` must pass 421/421 tests with 0 failures and 0 errors.

---

## 3. Phase 2: Standalone Desktop AI Parity

### Target Defects:
- **DEF-001:** Port EONPAI conversation history and action proposals to native desktop storage.

### Implementation Steps:
1. **Schema Migration:** In `frontend/src-tauri/src/native_vault.rs`, add migration version 2 creating:
   - `conversations (id TEXT PRIMARY KEY, title TEXT, created_at INTEGER, updated_at INTEGER)`
   - `messages (id TEXT PRIMARY KEY, conversation_id TEXT, role TEXT, content TEXT, created_at INTEGER)`
   - `ai_suggestions (id TEXT PRIMARY KEY, task_id TEXT, suggestion TEXT, accepted INTEGER, created_at INTEGER)`
2. **Native IPC Handlers:** Implement Tauri commands in `src-tauri/src/lib.rs`:
   - `vault_get_conversations`
   - `vault_save_message`
   - `vault_invoke_ollama` (routes directly to `http://localhost:11434` without Spring Boot intermediary).
3. **Frontend Adapter Switch:** In `frontend/src/api/ai.ts`, dynamically detect Tauri runtime and route directly to local IPC.

### Verification Protocol:
- Launch standalone desktop app with Spring Boot stopped (`./scripts/shinpo-runtime.sh stop`).
- Create and persist an EONPAI chat session; verify message records persist across application restarts in local SQLCipher.

---

## 4. Phase 3: Frontend Refinement & Bundle Optimization

### Target Defects:
- **DEF-007:** Darken `--color-text-muted` in light theme to `#64748B` to achieve WCAG AA contrast (≥ 4.5:1).
- **DEF-008:** Consolidate `app-shell-refinement.css` directly into view stylesheets; prune dead legacy CSS classes.
- **DEF-009:** Split routes in `frontend/src/App.tsx` using `React.lazy()` for `ScheduleView`, `EonpaiView`, and `SettingsModal`.

### Verification Protocol:
- Verify compiled CSS bundle drops from 563 kB to < 250 kB.
- Verify compiled JS initial chunk drops below 250 kB.
- Conduct visual regression check across all 7 views in light and dark themes.

---

## 5. Phase 4: Multi-Platform CI/CD & Windows Qualification

### Target Defects:
- **DEF-006:** Validate Windows 10/11 build and live process monitoring.

### Implementation Steps:
1. Setup GitHub Actions workflow `.github/workflows/windows-build.yml` targeting `windows-latest`.
2. Compile Tauri application using MSVC toolchain: `cargo tauri build --target x86_64-pc-windows-msvc`.
3. Run `crates/shinpo-shield` unit tests and integration tests on Windows VM.
4. Verify NSIS installer generation and clean installation/uninstallation.

### Verification Protocol:
- Successful compilation and automated test execution on Windows runner.
- Process termination and grace-period warning verified on a Windows test runner.

---

## 6. Exit Criteria for Production Sign-Off (GA Checklist)

- [ ] All 10 defects from `MASTER_DEFECT_REGISTER.md` closed.
- [ ] 0 compiler warnings, 0 linter errors across TypeScript, Rust, and Java.
- [ ] 100% test pass rate across 662+ automated tests.
- [ ] Offline standalone operation verified with zero external processes.
- [ ] Windows installer signed and verified alongside Linux packages.

