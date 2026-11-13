# SHINPO Canonical Release Status

**Document Version:** 1.1.0<br>
**Updated:** 2026-11-13<br>
**Active Branch:** `fix/systematic-layout-and-composition`<br>
**Candidate Remote HEAD:** `316e1b49d99c142319fc484ee715f37c2d0a9f4f`<br>
**Current Release Target:** `SHINPO v0.1.0-beta.1` (Private Beta)<br>
**Overall Release Verdict:** **NO-GO FOR PRODUCTION / PRIVATE BETA RELEASE**

---

## 1. Executive Summary & Release Verdict

The canonical status of the SHINPO repository candidate on branch `fix/systematic-layout-and-composition` (remote commit `316e1b49d99c142319fc484ee715f37c2d0a9f4f`) is **NO-GO**.

While core offline features, encrypted SQLCipher storage, Focus lifecycle, 4-theme styling, brand shield assets, Linux Browser Companion integration, and hosted CI builds for both Ubuntu Linux and Windows MSVC have succeeded, mandatory release gates (security advisory resolution / formal signoff, Windows live interactive runtime verification, and clean-VM package acceptance) remain unresolved.

> [!IMPORTANT]
> **Historical Precedence Rule:** Historical release documents—such as the November 7, 2026 report (`docs/qa/SHINPO_FINAL_RELEASE_AUDIT_20261107.md`) which recorded a local "GO" on commit `21244694` on branch `fix/release-blockers-20261106`—represent point-in-time historical records. **An older GO report does NOT authorize the release of the current candidate.** The current candidate must be evaluated solely against empirical execution on its own exact commit.

---

## 2. Platform Release Matrix

| Platform | Artifact | Execution Environment | Status | Blockers / Caveats |
| :--- | :--- | :--- | :---: | :--- |
| **Linux (Fedora / Ubuntu)** | RPM, DEB, AppImage | Fedora 44 (local), Ubuntu 24.04 (CI / container) | **NO-GO** | Transitive Linux GLib `RUSTSEC-2024-0429` advisory requires owner risk signoff; clean-VM graphical desktop first-run and uninstall not tested. |
| **Windows (x64 MSVC)** | NSIS Installer, `.exe` | Windows 2025 (GitHub Actions CI Run #101) | **NOT TESTED** | CI verifies MSVC build, OpenSSL linkage, unit tests, and smoke test. **Native Windows runtime, WebView2 integration, and NSIS installer have zero live interactive test verification.** |
| **macOS** | Not targeted for beta | N/A | **UNSUPPORTED** | Target platform is Linux and Windows only for initial beta. |

---

## 3. Mandatory Release Blockers

To transition from **NO-GO** to **GO (Private Beta)**, the following gates must be resolved:

1. **Linux GLib Security Advisory (`RUSTSEC-2024-0429`):**
   - Transitive dependency `glib 0.18.5` (via `gtk 0.18` / WebKitGTK bindings) triggers a denied advisory in `cargo audit --deny unsound`.
   - Remediating to GLib 0.20 requires upgrading the GTK binding stack which is currently blocked by ecosystem compatibility.
   - **Resolution Required:** Formal owner risk evaluation and explicit documented risk acceptance in `RISK_ACCEPTANCE.md`.

2. **Windows Native Runtime Acceptance:**
   - The Linux build host cannot execute Windows PE binaries or drive Windows WebView2 automation.
   - While the headless smoke test (`shinpo-desktop.exe --smoke-test`) passed in Windows CI, live graphical execution with WebView2 has not been tested.
   - **Resolution Required:** Execute the native test journey on physical Windows 10/11 hardware or an interactive Windows VM with WebView2 installed.

3. **Signed Automatic Updater Delivery:**
   - Tauri updater configuration is present, but an old-to-new version upgrade using cryptographic signatures (`minisign` / Tauri v2 pubkey) has not been tested in a live environment.
   - **Resolution Required:** Test an end-to-end upgrade from a test build to a signed target version.

4. **Clean-VM GUI First-Run & Uninstallation:**
   - Package manager installation (`dnf install`, `apt-get install`) succeeded in headless containers, but desktop-entry launch, tray icon presentation, and package uninstallation have not been tested on a fresh graphical desktop VM.

---

## 4. Hosted CI vs. Local Qualification

### CI Job Results vs. Step Breakdown (Run #101 Reference: 43446628914)

GitHub Actions CI (`.github/workflows/ci.yml`) is structured into three discrete jobs:

| CI Job | Environment | Target & Responsibility | Current Status & Conclusion |
| :--- | :--- | :--- | :---: |
| **`desktop-linux`** | Ubuntu 24.04 | 19 discrete steps: Linux system dependencies, Rust 1.99.0 toolchain, `npm ci`, legacy backend verification, production npm audit, full dev npm audit log, `npm test`, `npm run lint`, `npm run build`, browser companion tests, Tauri bundle prep, Tauri Rust tests, strict Clippy, rustfmt, release desktop binary build, isolated native SQLCipher smoke test, Shield tests/Clippy/fmt, Browser Host tests/Clippy/fmt. | **PASS**<br>*(Run 43446628914: Completed successfully)* |
| **`desktop-windows`** | Windows 2025 | 18 discrete steps: MSVC C++ toolchain check, OpenSSL x64 vcpkg installation and environment linkage, `npm ci`, production npm audit, full dev npm audit log, `npm test`, `npm run lint`, `npm run build`, browser companion tests, Tauri bundle prep, Tauri Rust tests, strict Clippy, rustfmt, release desktop binary build, isolated native SQLCipher smoke test (`shinpo-desktop.exe --smoke-test`), Shield tests/Clippy/fmt, Browser Host tests/Clippy/fmt. | **PASS**<br>*(Run 43446628914: Completed successfully)* |
| **`security`** | Ubuntu 24.04 | Discrete scanner suite with independent exit code capture, machine-readable JSON artifact collection, and aggregation: Gitleaks history scan, Semgrep SAST scan, verified OSV-Scanner CLI v2.7.1, Cargo Audit across 3 lockfiles, Cargo Deny (bans, licenses, sources) across 3 manifests. | **FAIL / NO-GO**<br>*(Strict security gate: fails on transitive GLib `RUSTSEC-2024-0429` and remaining dev tooling advisories)* |

### Discrete Security Scanners Breakdown

| Scanner | Execution Target | Machine-Readable Report | Outcome | Analysis & Findings |
| :--- | :--- | :--- | :---: | :--- |
| **Gitleaks** | Full git history (269 commits) | Integrated Sarif / Action | **PASS** | 0 secrets or sensitive tokens detected across all commits. |
| **Semgrep SAST** | Repository source code | `security-reports/semgrep.sarif` | **PASS** | 0 SAST rule violations across `p/default`, `p/secrets`, `p/security-audit`. |
| **OSV-Scanner** | All 4 workspace manifests / lockfiles | `security-reports/osv-scanner.json` | **FINDINGS RECORDED** | Pinned v2.7.1 verified against official SHA256SUMS. Finds remaining npm dev tooling advisories (`extract-zip`, `glob`, `minimatch`, `zod`) and Rust unmaintained crate notices. 7 advisories remediated. |
| **Cargo Audit (`shinpo-shield`)** | `crates/shinpo-shield/Cargo.lock` | `security-reports/cargo-audit-shield.json` | **PASS** | 0 vulnerabilities or unsoundness found (94 crate dependencies). |
| **Cargo Audit (`shinpo-browser-host`)** | `crates/shinpo-browser-host/Cargo.lock` | `security-reports/cargo-audit-browser-host.json` | **PASS** | 0 vulnerabilities or unsoundness found (101 crate dependencies). |
| **Cargo Audit (`frontend/src-tauri`)** | `frontend/src-tauri/Cargo.lock` | `security-reports/cargo-audit-frontend-tauri.json` | **FAIL** | Denied unsoundness: `RUSTSEC-2024-0429` in `glib 0.18.5` (568 crate dependencies). 4 informational unmaintained notices allowed. |
| **Cargo Deny (`shinpo-shield`)** | `crates/shinpo-shield/Cargo.toml` | `security-reports/cargo-deny-shield.json` | **PASS** | Bans ok, licenses ok (reviewed allowlist in `deny.toml`), sources ok. |
| **Cargo Deny (`shinpo-browser-host`)**| `crates/shinpo-browser-host/Cargo.toml` | `security-reports/cargo-deny-browser-host.json` | **PASS** | Bans ok, licenses ok, sources ok. |
| **Cargo Deny (`frontend/src-tauri`)** | `frontend/src-tauri/Cargo.toml` | `security-reports/cargo-deny-frontend-tauri.json` | **PASS** | Bans ok, licenses ok (includes `MPL-2.0` and `sqlcipher-src` exception), sources ok. |

### Verification Area Details

| Verification Area | Hosted CI (GitHub Actions) | Local Host Environment | Notes |
| :--- | :---: | :---: | :--- |
| **Frontend TypeScript Build** | Verified (Ubuntu & Windows MSVC jobs) | Verified (`tsc -b && vite build`) | Fixed Playwright TS2339 narrowing (`core-ui-repairs.spec.ts`). |
| **Frontend Production Audit** | Verified (`npm audit --omit=dev --audit-level=high`) | Verified (0 vulnerabilities) | Production bundle is 100% clean across all jobs. |
| **Frontend Dev Dependency Audit** | Documented in CI job logs | Documented in `qa-security.mjs` | Reduced from 39 to 33 advisories (14 high, 19 moderate, 0 critical). |
| **Rust Tauri Core Tests** | Verified (Ubuntu & Windows MSVC jobs) | Verified (85 passed, 0 failed, 1 ignored) | Full encrypted storage & vault integration tests pass. |
| **Rust Shield Daemon Tests** | Verified (Ubuntu & Windows MSVC jobs) | Verified (51 lib, 40 main pass) | Platform interceptor and app discovery tests pass. |
| **Rust Browser Host Tests** | Verified (Ubuntu & Windows MSVC jobs) | Verified (9 passed, 0 failed) | Native messaging host framing & pairing tests pass. |
| **Secret Scanning (Gitleaks)** | Verified in `security` job | Verified (`gitleaks detect -v`) | 0 leaks found across 269 commits. |
| **Semgrep SAST** | Verified in `security` job | Verified in container | Scans rulesets `p/default`, `p/secrets`, `p/security-audit`. |
| **OSV-Scanner** | Verified in `security` job | Verified (`v2.7.1`) | Upgraded to v2.7.1 with SHA256 checksum verification. |
| **SQLCipher Cryptographic Integrity**| Verified (`--smoke-test` on Linux & Windows) | Verified (HMAC tamper rejection pass)| Tampered ciphertext is rejected without plaintext fallback. |
| **Native WebKitGTK User Journey** | Not run in CI (headless) | Verified (`complete-user-journeys`) | Local account, Goals, Tasks, Focus, Rewards, EONPAI pass. |
| **Browser Companion Integration** | Not run in CI | Verified (12/12 acceptance points) | Pairing code handshake, policy push, modal intervention, release pass. |

---

## 5. System Truthfulness & Capability Reporting

### Guardian Process Enforcement
- **Linux:** Verified graceful-close implementation using Linux `pidfd_open` and `pidfd_send_signal` with process start-time, PID reuse, and executable identity verification. Advertises `TERMINATE` for eligible applications.
- **Windows & macOS:** Safe process identity verification and pidfd-equivalent handles are not implemented. System truthfully reports `MONITOR_ONLY` with an explanatory message.
- **Protected Applications:** Protected system processes (`systemd`, `explorer.exe`, `dbus`, etc.) and unresolvable executables strictly report `UNSUPPORTED`.

### Network Filtering
- `network_filtering_supported()` returns **`false`** across all platforms.
- Status strings explicitly state: *"Kernel network filtering is not implemented; active network interception is unavailable"*.
- Placeholder GUIDs (e.g. WFP sublayer GUIDs) and kernel API mentions have been removed from capability claims.

---

## 6. Dependency Supply-Chain Audit & Remediation

- **Production Dependencies:** **Zero (0)** vulnerabilities. Verified via `npm audit --omit=dev --json`.
- **Development / Test Harness Tooling:** Reduced from 39 to 33 advisories (14 high, 19 moderate, 0 critical) in offline test runners.
  - **Remediated Dependencies:**
    - `basic-ftp`: Upgraded to `^6.2.6` via package override (remediated 3 vulnerabilities).
    - `deepmerge-ts`: Upgraded to `8.0.2` via `@wdio` bump to `^9.33.1` (remediated 1 high vulnerability).
    - `serialize-javascript`: Upgraded to `^7.1.4` via package override (remediated 1 vulnerability).
  - **Remaining Unpatchable Dev Advisories:**
    - `extract-zip@2.0.1`: Upstream has no release > 2.0.1. ReDoS / symlink traversal in offline browser unpacker.
    - `zod@3.23.8`: Transitive dependency of `chromium-bidi` in puppeteer runner. Upgrading to zod v4 introduces breaking changes for the test runner.
    - `glob` & `minimatch`: Transitive dev dependencies across `eslint`, `wdio`, `mocha`, `rimraf`. No backward-compatible drop-in across major versions.
  - *Technical Justification:* None of these development packages or their transitive dependencies are included in the application bundle or shipped to users. The production application bundle consists strictly of the Vite build in `frontend/dist/` (which contains only audited production assets).
  - *Transparency:* All advisories are preserved in machine-readable JSON reports and uploaded as CI artifacts rather than being suppressed.

---

## 7. Outstanding Acceptance Checklist for Beta Launch

- [ ] **Windows Native Runtime:** Execute `npm run test:e2e` and desktop launch on Windows 11 with WebView2.
- [ ] **Clean-VM Package First-Run:** Install RPM on Fedora 41/42 workstation and DEB on Ubuntu 24.04 desktop; verify application launches from application menu.
- [ ] **Package Removal:** Verify `rpm -e shinpo` and `apt remove shinpo` clean up binaries and host manifests cleanly.
- [ ] **GLib Security Signoff:** Formally document risk acceptance for transitive Linux GLib `RUSTSEC-2024-0429`.
- [ ] **Signed Updater Validation:** Perform end-to-end upgrade verification with Tauri updater keys.
