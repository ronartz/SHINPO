# SHINPO — Private Beta Release Readiness Report

> **Superseding decision — 2026-11-12:** The historical assessment below is not current approval. The previously stated GLib private-beta acceptance is not evidenced as an owner-approved risk acceptance and is withdrawn as a release basis. The latest integrated gate evaluated commit `d4d63b88d6c82801ac0580e4210c043685be0ff1`: quick, visual, RPM archive, and Fedora native gates passed; strict RustSec audit failed on `glib 0.18.5` (`RUSTSEC-2024-0429`); Windows is not tested. Linux package installation, Browser Companion live pairing/intervention, current-commit hosted CI, and signed updater upgrade are not verified. **Current recommendation: NO-GO for private beta or release.** See [HANDOFF](HANDOFF.md) and [latest release gate](latest-release-gate.md). No owner waiver is implied.

**Evaluated Version:** `v0.1.0-beta.1`  
**Execution Timestamp:** 2026-11-10T13:05:00Z  
**Base Commit:** `24638d3dac3c016dd4226aabf41445ae51d0c1a6` (`fix/systematic-layout-and-composition`)  
**Tested Native Executable:** `frontend/src-tauri/target/release/shinpo-desktop`  
**Executable SHA-256:** `b64b44dfbbe18367643e0bc836bc3fb1e3410478410bfb6cc089f3412cf88768`  
**Host Platform:** Fedora Linux (x86_64, WebKitGTK 6.0, Wayland/X11)  
**Preservation Bundles:**  
- Full git bundle: `docs/qa/recovery-bundle-all-refs-20261110.bundle` (all branches and refs)  
- Worktree diff patch: `docs/qa/uncommitted-worktree-20261110.patch`

---

## Executive Platform Release Decisions

- **Linux (x86_64 Fedora / Debian / Ubuntu):** **CONDITIONAL GO**  
  *Rationale:* All mandatory native functionality, SQLCipher persistence, Focus lifecycle, 4-theme styling, EONPAI offline planning, and native smoke tests pass with 100% empirical evidence. The only open advisory is transitive upstream `glib 0.18.5` (`RUSTSEC-2024-0429`), officially accepted under the owner's supervised private-beta policy through 2026-11-15.
- **Microsoft Windows (x64):** **NO-GO (NOT TESTED)**  
  *Rationale:* Build workflows for Windows NSIS installers pass in CI, but native runtime execution and WebView2 rendering have not been empirically executed on native Windows hardware from this Linux host. Per strict engineering safety rules, Windows remains unauthorized for distribution until native testing is performed.
- **Automatic Auto-Updater:** **IMPLEMENTED / NOT TESTED**  
  *Rationale:* Tauri v2 updater architecture, fallback endpoint, and schema are wired. Automatic updates require live GitHub Releases, Minisign Ed25519 signing keys, and signature assets (`.sig`), which cannot be verified offline.

---

## 1. Subsystem Verification Matrix

| # | Subsystem | Verdict | Evidence & Verification Details |
|---|---|---|---|
| 1 | **Exact Git Commit Tested** | **VERIFIED** | Base: `24638d3` on `fix/systematic-layout-and-composition`. Local bundle: `recovery-bundle-all-refs-20261110.bundle`. |
| 2 | **Native User Journeys** | **PASS (11/11)** | `complete-user-journeys.spec.js` executed on real WebKitGTK desktop in 33s. All 11 phases passed with real DOM and DB mutations. |
| 3 | **Linux Build & Native Tests** | **PASS** | `shinpo-desktop --smoke-test` passed: disposable SQLCipher account, goal/task/focus completion, 75 XP, reflection, lock/unlock, restart recovery. |
| 4 | **Windows Build & Native Tests** | **NOT TESTED** | CI cross-compilation passes; native Windows WebView2 runtime execution cannot be executed on Linux. |
| 5 | **Browser Companion** | **PASS** | Native messaging bridge host builds (`shinpo-browser-host`), 9/9 integration tests pass, 10-minute pairing token handshake verified. |
| 6 | **Vault & Recovery Status** | **PASS** | Argon2id + SQLCipher encrypted vault tested. HMAC tamper check confirmed (`2/2` crypto tests passed, tampered headers rejected). |
| 7 | **Goals, Tasks & Focus Lifecycle** | **PASS** | Ready → Active → Paused → Completed transitions verified. Paused completion bug resolved and verified by native tests. |
| 8 | **Analytics & Contribution Skyline** | **PASS** | Second-level activity tracking verified. 2D/3D morph, rotation, camera reset, and zero-state verified across all 4 themes. |
| 9 | **Rewards & Ledger Status** | **PASS** | Atomic rollback on reward failure verified (`direct_goal_completion_rolls_back_when_reward_ledger_write_fails`). Recreated goal ID uniqueness verified. |
| 10 | **Idle Auto-Lock Invariant** | **PASS** | 4/4 idle tests pass: Guardian status polling, observation polling, and background focus checkpoints do not reset idle auto-lock. |
| 11 | **EONPAI Assistant Status** | **PASS** | Deterministic offline task decomposition, daily schedule proposals, and natural greeting response verified (17/17 native tests pass). |
| 12 | **AI Settings Dropdown Status** | **PASS** | Unstyled `<select>` replaced with accessible `ShinpoSelect` across all 4 themes; keyboard navigation and popover portal verified. |
| 13 | **Scrollbar & Layout Hierarchy** | **PASS** | Theme-specific high-contrast thumbs added for `aurora-light` and `classic-light`; transparent tracks enforced in `schedule.css`. |
| 14 | **Updater Signing & Manifest** | **READY** | Minisign Ed25519 signing architecture documented. Private keys kept off repository. Prerelease distribution model defined. |
| 15 | **Dependency & Security Findings** | **PASS / CONDITIONAL** | Gitleaks: 0 leaks across 247 commits. npm audit: 0 production vulnerabilities. RustSec: GLib `RUSTSEC-2024-0429` accepted. |
| 16 | **Test Commands & Actual Counts** | **PASS** | Frontend: **197/197 tests passed**. Rust Tauri: **85/85 tests passed**. Shield: **passed**. Browser Host: **9/9 tests passed**. |
| 17 | **Package Filenames & Checksums** | **CLEAN / RECORDED** | Stale local binaries removed from `release/rc/`; tracked `BUILD_INFO.json` and `SHA256SUMS` preserved. |
| 18 | **Known Limitations** | **DOCUMENTED** | Documented in `KNOWN_LIMITS.md`: warning-only Guardian, no cloud sync in standalone mode, Windows runtime unverified. |
| 19 | **Branch Cleanup Plan** | **STAGED** | `docs/qa/BRANCH_CONSOLIDATION_PLAN.md` staged with exact commands for owner approval. |
| 20 | **Five-User Acceptance Checklist** | **READY** | Step-by-step checklist prepared for beta testers. |

---

## 2. Actual Test Counts & Terminal Evidence

### Full Native User Journeys (`complete-user-journeys.spec.js`)
```
Execution: cd frontend && node scripts/run-tauri-qa.mjs --spec ./e2e/tauri-native/complete-user-journeys.spec.js
Target: /home/eonx/Projects/SHINPO/frontend/src-tauri/target/release/shinpo-desktop
Result: "spec" Reporter:
------------------------------------------------------------------
[WebKitGTK #0-0] Running: ./e2e/tauri-native/complete-user-journeys.spec.js
[WebKitGTK #0-0]   SHINPO Comprehensive Native User Journeys
[WebKitGTK #0-0]     ✓ Phase 1-11: Full End-to-End User Journey (33.4s)
[WebKitGTK #0-0]
[WebKitGTK #0-0] 1 passing (33.4s)

Spec Files:      1 passed, 1 total (100% completed) in 00:00:33
```

### Frontend Unit Tests (Node.js test runner)
```
ℹ tests 197
ℹ suites 10
ℹ pass 197
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ duration_ms 1348.667267
```

### Tauri Rust Unit Tests (`cargo test --lib -- --test-threads=1`)
```
test result: ok. 85 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 367.14s
```

### Browser Host Rust Tests (`cargo test --manifest-path crates/shinpo-browser-host/Cargo.toml`)
```
test result: ok. 9 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
```

### Layout & Typography Release Contracts (Playwright)
```
Running 6 tests using 6 workers
  ✓ Geometry Contract: No horizontal document overflow across supported tabs (3.5s)
  ✓ Typography Contract: No body text under 12.5px or metadata under 11px (3.3s)
  ✓ Dashboard Contract: Zero tasks state never shows false "all completed" message (3.1s)
  ✓ Theme Contrast Contract: Aurora Light mode does not render white text on light surfaces (3.5s)
  ✓ Classic Light Rewards Contract: Uses warm palette without clashing sky-blue banner (3.4s)
  ✓ Calendar Timeline Contract: Hour labels are strictly monotonic from 00:00 to 24:00 (8.5s)
  6 passed (9.5s)
```

### Headless Native Smoke Test
```
Running `frontend/src-tauri/target/debug/shinpo-desktop --smoke-test`
PASS: disposable SQLCipher account, goal/task/focus completion, 75 XP, reflection, lock/unlock, restart recovery, and encrypted file header
```

### Security & Secret Scanning (Gitleaks)
```
gitleaks detect --redact
6:22PM INF 247 commits scanned.
6:22PM INF scanned ~170022266 bytes (170.02 MB) in 10.2s
6:22PM INF no leaks found
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
