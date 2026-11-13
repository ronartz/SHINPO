# SHINPO Canonical Release Status

**Document Version:** 1.0.0  
**Updated:** 2026-11-13  
**Active Branch:** `fix/systematic-layout-and-composition`  
**Current Release Target:** `SHINPO v0.1.0-beta.1` (Private Beta)  
**Overall Release Verdict:** **NO-GO FOR PRODUCTION / PRIVATE BETA RELEASE**

---

## 1. Executive Summary & Release Verdict

The canonical status of the SHINPO repository candidate on branch `fix/systematic-layout-and-composition` is **NO-GO**.

While core offline features, encrypted SQLCipher storage, Focus lifecycle, 4-theme styling, brand shield assets, and the Linux Browser Companion integration have been empirically verified, mandatory cross-platform, security advisory, and packaging gates remain incomplete.

> [!IMPORTANT]
> **Historical Precedence Rule:** Historical release documents—such as the November 7, 2026 report (`docs/qa/SHINPO_FINAL_RELEASE_AUDIT_20261107.md`) which recorded a local "GO" on commit `21244694` on branch `fix/release-blockers-20261106`—represent point-in-time historical records. **An older GO report does NOT authorize the release of the current candidate.** The current candidate must be evaluated solely against empirical execution on its own exact commit.

---

## 2. Platform Release Matrix

| Platform | Artifact | Execution Environment | Status | Blockers / Caveats |
| :--- | :--- | :--- | :---: | :--- |
| **Linux (Fedora / Ubuntu)** | RPM, DEB, AppImage | Fedora 44 (local), Ubuntu 24.04 (CI / container) | **NO-GO** | Transitive Linux GLib `RUSTSEC-2024-0429` advisory requires owner risk signoff; clean-VM GUI desktop first-run and uninstall not tested. |
| **Windows (x64 MSVC)** | NSIS Installer, `.exe` | Windows 2025 (GitHub Actions CI) | **NOT TESTED** | CI verifies MSVC build, OpenSSL linkage, and unit tests. **Native Windows runtime, WebView2 integration, and NSIS installer have zero live test verification.** |
| **macOS** | Not targeted for beta | N/A | **UNSUPPORTED** | Target platform is Linux and Windows only for initial beta. |

---

## 3. Mandatory Release Blockers

To transition from **NO-GO** to **GO (Private Beta)**, the following gates must be resolved:

1. **Linux GLib Security Advisory (`RUSTSEC-2024-0429`):**
   - Transitive dependency `glib 0.18.5` (via `gtk 0.18` / WebKitGTK bindings) triggers a denied advisory in `cargo audit`.
   - Remediating to GLib 0.20 requires upgrading the GTK binding stack which is currently blocked by ecosystem compatibility.
   - **Resolution Required:** Formal owner risk evaluation and explicit documented risk acceptance in `RISK_ACCEPTANCE.md`.

2. **Windows Native Runtime Acceptance:**
   - The Linux build host cannot execute Windows PE binaries or drive Windows WebView2 automation.
   - **Resolution Required:** Execute the native test journey on physical Windows 10/11 hardware or an interactive Windows VM with WebView2 installed.

3. **Signed Automatic Updater Delivery:**
   - Tauri updater configuration is present, but an old-to-new version upgrade using cryptographic signatures (`minisign` / Tauri v2 pubkey) has not been tested in a live environment.
   - **Resolution Required:** Test an end-to-end upgrade from a test build to a signed target version.

4. **Clean-VM GUI First-Run & Uninstallation:**
   - Package manager installation (`dnf install`, `apt-get install`) succeeded in headless containers, but desktop-entry launch, tray icon presentation, and package uninstallation have not been tested on a fresh graphical desktop VM.

---

## 4. Hosted CI vs. Local Qualification

| Verification Area | Hosted CI (GitHub Actions) | Local Host Environment | Notes |
| :--- | :---: | :---: | :--- |
| **Frontend TypeScript Build** | Verified (Ubuntu & Windows MSVC) | Verified (`tsc -b && vite build`) | Fixed Playwright TS2339 narrowing (`core-ui-repairs.spec.ts`). |
| **Frontend Production Audit** | Verified (`npm audit --omit=dev`) | Verified (0 vulnerabilities) | Production bundle is 100% clean. |
| **Frontend Dev Dependency Audit** | Documented in CI logs | Documented in `qa-security.mjs` | 39 advisories in dev/test tooling (`@wdio`, `puppeteer`, `eslint`). |
| **Rust Tauri Core Tests** | Verified (Ubuntu & Windows MSVC) | Verified (85 passed, 0 failed) | Full encrypted storage & vault integration tests pass. |
| **Rust Shield Daemon Tests** | Verified (Ubuntu) | Verified (51 lib, 40 main pass) | Platform interceptor and app discovery tests pass. |
| **SQLCipher Cryptographic Integrity**| Not run in CI | Verified (HMAC tamper rejection pass)| Tampered ciphertext is rejected without plaintext fallback. |
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

## 6. Dependency Supply-Chain Audit

- **Production Dependencies:** **Zero (0)** vulnerabilities. Verified via `npm audit --omit=dev --json`.
- **Development / Test Harness Tooling:** 39 advisories (18 moderate, 21 high) exist in offline test runners (`@wdio/*`, `backstopjs`, `puppeteer`, `mocha`, `eslint`).
  - *Technical Justification:* None of these packages or their subdependencies are packaged into the application bundles or shipped to users. The production application bundle consists strictly of the Vite build in `frontend/dist/` (which contains only audited production assets).
  - *Transparency:* Advisories are documented in CI logs and `scripts/qa-security.mjs` rather than being hidden.

---

## 7. Outstanding Acceptance Checklist for Beta Launch

- [ ] **Windows Native Runtime:** Execute `npm run test:e2e` and desktop launch on Windows 11 with WebView2.
- [ ] **Clean-VM Package First-Run:** Install RPM on Fedora 41/42 workstation and DEB on Ubuntu 24.04 desktop; verify application launches from application menu.
- [ ] **Package Removal:** Verify `rpm -e shinpo` and `apt remove shinpo` clean up binaries and host manifests cleanly.
- [ ] **GLib Security Signoff:** Formally document risk acceptance for transitive Linux GLib `RUSTSEC-2024-0429`.
- [ ] **Signed Updater Validation:** Perform end-to-end upgrade verification with Tauri updater keys.
