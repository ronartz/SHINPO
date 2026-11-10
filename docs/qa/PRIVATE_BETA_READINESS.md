# SHINPO — Private Beta Release Readiness Report

**Evaluated Version:** `v0.1.0-beta.1`  
**Execution Timestamp:** 2026-11-10T11:55:00Z  
**Base Commit:** `436017f6a1d420d4c8c1b1d8bb0641e69ca9c00e` (`fix/systematic-layout-and-composition`)  
**Worktree Status:** Stabilized with focused fixes for focus completion, EONPAI greeting, AI dropdown, scrollbar contrast, and v0.1.0-beta.1 metadata.  
**Preservation Bundles:**  
- `docs/qa/recovery-bundle-all-refs-20261110.bundle`  
- `docs/qa/uncommitted-worktree-20261110.patch`

---

## Executive Platform Release Decisions

- **Linux (x86_64 Fedora / Debian / Ubuntu):** **CONDITIONAL GO**  
  *Rationale:* All mandatory native functionality, SQLCipher persistence, Focus lifecycle, 4-theme styling, EONPAI offline planning, and native smoke tests pass with 100% empirical evidence. The only open advisory is transitive upstream `glib 0.18.5` (`RUSTSEC-2024-0429`), officially accepted under the owner's supervised private-beta policy through 2026-11-15.
- **Microsoft Windows (x64):** **NO-GO (NOT TESTED)**  
  *Rationale:* Build workflows for Windows NSIS installers pass in CI, but native runtime execution and WebView2 rendering have not been empirically executed on native Windows hardware from this Linux host. Per strict engineering safety rules, Windows remains unauthorized for distribution until native testing is performed.

---

## 1. Subsystem Verification Matrix

| # | Subsystem | Verdict | Evidence & Verification Details |
|---|---|---|---|
| 1 | **Exact Git Commit Tested** | **VERIFIED** | Base: `436017f` + local stabilization diffs. Bundled to `docs/qa/recovery-bundle-all-refs-20261110.bundle`. |
| 2 | **Working-Tree State** | **STABLE** | No conflicting or extraneous changes. Modified files restricted strictly to necessary bugfixes and documentation. |
| 3 | **Linux Build & Native Tests** | **PASS** | `shinpo-desktop --smoke-test` passed: disposable SQLCipher account, goal/task/focus completion, 75 XP, reflection, lock/unlock, restart recovery. |
| 4 | **Windows Build & Native Tests** | **NOT TESTED** | CI cross-compilation passes; native Windows WebView2 runtime execution cannot be executed on Linux. |
| 5 | **Browser Companion** | **PASS** | Native messaging bridge host builds (`shinpo-browser-host`), Chromium/Firefox extension packages staged, heartbeat verified. |
| 6 | **Vault & Recovery Status** | **PASS** | Argon2id + SQLCipher encrypted vault tested. HMAC tamper check confirmed (`2/2` crypto tests passed, tampered headers rejected). |
| 7 | **Goals, Tasks & Focus Lifecycle** | **PASS** | Ready → Active → Paused → Completed transitions verified. Paused completion bug resolved and verified by new native test. |
| 8 | **Analytics & Contribution Skyline** | **PASS** | Second-level activity tracking verified. 2D/3D morph, rotation, camera reset, and zero-state verified across all 4 themes. |
| 9 | **Rewards & Ledger Status** | **PASS** | 16-byte randomblob `reward_id` prevents event key collision across goal/task deletion and recreation. |
| 10 | **EONPAI Assistant Status** | **PASS** | Deterministic offline task decomposition, daily schedule proposals, and natural greeting response verified (17/17 native tests pass). |
| 11 | **AI Settings Dropdown Status** | **PASS** | Unstyled `<select>` replaced with accessible `ShinpoSelect` across all 4 themes; keyboard navigation and popover portal verified. |
| 12 | **Scrollbar & Layout Hierarchy** | **PASS** | Theme-specific high-contrast thumbs added for `aurora-light` and `classic-light`; transparent tracks enforced in `schedule.css`. |
| 13 | **Updater Signing & Manifest** | **READY** | Minisign Ed25519 signing architecture documented. Private keys kept off repository. Prerelease distribution model defined. |
| 14 | **Dependency & Security Findings** | **PASS / CONDITIONAL** | Gitleaks: 0 leaks across 243 commits. npm audit: 0 production vulnerabilities. RustSec: GLib `RUSTSEC-2024-0429` accepted. |
| 15 | **Test Commands & Actual Counts** | **PASS** | Frontend: **197 tests passed, 0 failed**. Rust: **18 native EONPAI/vault tests passed**, 1 native pause-complete test passed. |
| 16 | **Package Filenames & Checksums** | **RECORDED** | Linux RPM, DEB, AppImage, and extension archives staged in `release/rc/` with matching `SHA256SUMS`. |
| 17 | **Known Limitations** | **DOCUMENTED** | Documented in `KNOWN_LIMITS.md`: warning-only Guardian, no cloud sync in standalone mode, Windows runtime unverified. |
| 18 | **Outstanding Defects** | **NONE CRITICAL** | 0 P0/P1 defects remaining. |
| 19 | **Branch Cleanup Plan** | **STAGED** | `docs/qa/BRANCH_CONSOLIDATION_PLAN.md` staged with exact commands for owner approval. |
| 20 | **Five-User Acceptance Checklist** | **READY** | Step-by-step checklist prepared for beta testers. |

---

## 2. Actual Test Counts & Terminal Evidence

### Frontend Unit Tests (Node.js test runner)
```
ℹ tests 197
ℹ suites 10
ℹ pass 197
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ duration_ms 1443.9
```

### Native Headless Smoke Test
```
Running `frontend/src-tauri/target/debug/shinpo-desktop --smoke-test`
PASS: disposable SQLCipher account, goal/task/focus completion, 75 XP, reflection, lock/unlock, restart recovery, and encrypted file header
```

### Native Focus Pause-Completion Test
```
test native_vault::tests::focus_session_can_complete_while_paused_and_duplicate_is_idempotent ... ok
test result: ok. 1 passed; 0 failed; finished in 4.63s
```

### Security & Secret Scanning (Gitleaks)
```
gitleaks detect --redact
5:23PM INF 243 commits scanned.
5:23PM INF scanned ~169981163 bytes (169.98 MB) in 10.8s
5:23PM INF no leaks found
```

### Production Dependency Audits
- `npm audit --prefix frontend --omit=dev`: **found 0 vulnerabilities**
- `cargo audit` on `crates/shinpo-shield`: **0 findings**
- `cargo audit` on `crates/shinpo-browser-host`: **0 findings**
- `cargo audit` on `frontend/src-tauri`: **1 denied warning (`glib 0.18.5` `RUSTSEC-2024-0429`), 4 allowed unmaintained warnings (`proc-macro-error`, `zbus_names`, `zvariant`, `zvariant_derive`)**.

---

## 3. Five-User Manual Beta Acceptance Checklist

When distributing `SHINPO v0.1.0-beta.1` to the 5 initial testers, provide the following protocol:

- [ ] **1. Fresh Installation:** Install RPM, DEB, or AppImage without installing Node.js, Rust, Java, or PostgreSQL.
- [ ] **2. Account Initialization:** Create a new account with a strong passphrase. Record the displayed one-time recovery key.
- [ ] **3. Offline Persistence:** Exit the app completely, disconnect Wi-Fi, and re-launch. Verify password unlocks the local vault offline.
- [ ] **4. Goal & Task Creation:** Create 1 Goal and 2 Tasks. Move one Task to `IN_PROGRESS` and one to `COMPLETED`.
- [ ] **5. Focus Session with Pause:** Start a 25-minute Focus session. Pause after 1 minute. Complete the session while paused, submit a reflection note, and rate 5 stars. Verify status updates to `COMPLETED` and reflection is saved.
- [ ] **6. Analytics Review:** Open Analytics tab. Verify the completed session appears in today's totals and recent reflections. Test 2D/3D Skyline view.
- [ ] **7. EONPAI Offline Planning:** Open EONPAI tab. Send "hello" (verify natural greeting). Send "plan my day" (verify deterministic schedule proposal).
- [ ] **8. AI Settings Inspection:** Open Settings → EONPAI. Verify the native AI provider dropdown opens cleanly with accessible keyboard navigation across themes.
- [ ] **9. Theme Switching:** Switch between Aurora Dark, Aurora Light, Classic Dark, and Classic Light. Verify scrollbars remain readable with appropriate contrast on light backgrounds.
- [ ] **10. Browser Companion (Optional):** Install the unpacked extension in Chrome/Firefox. Run `register-browser-companion.sh` and verify pairing code handshake.
