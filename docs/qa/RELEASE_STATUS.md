# SHINPO Canonical Release Status

**Document Version:** 1.4.0<br>
**Updated:** 2026-11-15<br>
**Active Branch:** `fix/systematic-layout-and-composition`<br>
**Tested Code Commit:** `b4df017f3bbe4752dc304b7c5cc35b7acdcc9c29`<br>
**Documentation Commit:** `ca953a1a6fd0c4120c00e24383c7971823501f2a`<br>
**Latest Branch HEAD:** `ca953a1a6fd0c4120c00e24383c7971823501f2a`<br>
**Verification Run Reference:** [GitHub Actions Run #106 (43704004350)](https://github.com/ronartz/SHINPO/actions/runs/43704004350)<br>
**Current Release Target:** `SHINPO v0.1.0-beta.1` (Private Beta)<br>
**Overall Release Verdict:** **NO-GO FOR PRODUCTION / PRIVATE BETA RELEASE**

---

## 1. Executive Summary & Release Verdict

The canonical status of the SHINPO repository candidate on branch `fix/systematic-layout-and-composition` is **NO-GO**.

While core offline features, encrypted SQLCipher storage, Focus lifecycle, 4-theme styling, brand shield assets, Linux Browser Companion integration, and hosted CI builds for both Ubuntu Linux and Windows MSVC have succeeded, mandatory release gates remain unresolved:
1. **Security Gate Fails Closed on Linux GLib Advisory:** `cargo audit --deny unsound` detects `RUSTSEC-2024-0429` in `glib 0.18.5` (transitive via WebKitGTK in Tauri v2). This finding is not suppressed and intentionally blocks the security gate.
2. **Windows Interactive Runtime:** Windows MSVC compiles and passes headless smoke tests (`shinpo-desktop.exe --smoke-test`) in CI, but interactive graphical execution with WebView2 has zero physical runtime test verification.
3. **Clean-VM Package Acceptance & Signed Updater:** Native package manager installs (`rpm`, `deb`) have not been verified on fresh desktop workstations, and Tauri minisign updater delivery has not been validated end-to-end.

> [!IMPORTANT]
> **Historical Precedence Rule:** Historical release documents—such as the November 7, 2026 report (`docs/qa/SHINPO_FINAL_RELEASE_AUDIT_20261107.md`) which recorded a local "GO" on commit `21244694` on branch `fix/release-blockers-20261106`—represent point-in-time historical records. **An older GO report does NOT authorize the release of the current candidate.** The current candidate must be evaluated solely against empirical execution on its own exact commit.

---

## 2. Platform Release Matrix

| Platform | Artifact | Execution Environment | Status | Blockers / Caveats |
| :--- | :--- | :--- | :---: | :--- |
| **Linux (Fedora / Ubuntu)** | RPM, DEB, AppImage | Fedora 44 (local), Ubuntu 24.04 (CI Run #106) | **NO-GO** | Transitive Linux GLib `RUSTSEC-2024-0429` advisory requires upstream Tauri/WebKitGTK binding resolution; clean-VM graphical desktop first-run and uninstall not tested. |
| **Windows (x64 MSVC)** | NSIS Installer, `.exe` | Windows 2025 (GitHub Actions CI Run #106) | **NOT TESTED** | CI verifies MSVC build, OpenSSL linkage, unit tests, and smoke test. **Native Windows runtime, WebView2 integration, and NSIS installer have zero live interactive test verification.** |
| **macOS** | Not targeted for beta | N/A | **UNSUPPORTED** | Target platform is Linux and Windows only for initial beta. |

---

## 3. Mandatory Release Blockers

To transition from **NO-GO** to **GO (Private Beta)**, the following gates must be resolved:

1. **Linux GLib Security Advisory (`RUSTSEC-2024-0429`):**
   - Transitive dependency `glib 0.18.5` (via `gtk 0.18` / WebKitGTK bindings in Tauri v2) triggers a denied unsound advisory in `cargo audit --deny unsound`.
   - Upgrading to `glib 0.20` requires upgrading the entire `gtk-rs` ecosystem, which is blocked by Tauri ecosystem compatibility with `webkit2gtk-rs`.
   - **Status:** Unresolved release blocker. Strictly reported without ignore rules.

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

### CI Job Results vs. Step Breakdown (Run #106 Reference: 43704004350)

GitHub Actions CI (`.github/workflows/ci.yml`) is structured into three discrete jobs:

| CI Job | Environment | Target & Responsibility | Current Status & Conclusion |
| :--- | :--- | :--- | :---: |
| **`desktop-linux`** | Ubuntu 24.04 | 19 discrete steps: Linux system dependencies, Rust 1.99.0 toolchain, `npm ci`, legacy backend verification, production npm audit, full dev npm audit log, `npm test`, `npm run lint`, `npm run build`, browser companion tests, Tauri bundle prep, Tauri Rust tests, strict Clippy, rustfmt, release desktop binary build, isolated native SQLCipher smoke test, Shield tests/Clippy/fmt, Browser Host tests/Clippy/fmt. | **PASS** ✅<br>*(Run 43704004350: Completed successfully in 16m 28s)* |
| **`desktop-windows`** | Windows 2025 | 21 discrete steps: MSVC C++ toolchain check, OpenSSL x64 vcpkg installation and environment linkage, `npm ci`, production npm audit, full dev npm audit log, `npm test`, `npm run lint`, `npm run build`, browser companion tests, Tauri bundle prep, Tauri Rust tests, strict Clippy, rustfmt, release desktop binary build, isolated native SQLCipher smoke test (`shinpo-desktop.exe --smoke-test`), Shield tests/Clippy/fmt, Browser Host tests/Clippy/fmt. | **PASS** ✅<br>*(Run 43704004350: Completed successfully in 18m 27s)* |
| **`security`** | Ubuntu 24.04 | Discrete scanner suite with independent exit code capture, machine-readable JSON artifact collection, and aggregation: Gitleaks history scan, Semgrep SAST scan, verified OSV-Scanner CLI v2.7.1, Cargo Audit across 3 lockfiles, Cargo Deny (bans, licenses, sources) across 3 manifests. | **FAILS CLOSED (INTENTIONAL)** ❌<br>*(Run 43704004350: Completed in 5m 02s. Strict security gate: unsuppressed scanner catches GLib `RUSTSEC-2024-0429` and raw OSV findings)* |

### Discrete Security Scanners Breakdown

| Scanner | Execution Target | Machine-Readable Report | Outcome | Analysis & Findings |
| :--- | :--- | :--- | :---: | :--- |
| **Gitleaks** | Full git history (271 commits) | Integrated Sarif / Action | **PASS** | 0 secrets or sensitive tokens detected across all commits. |
| **Semgrep SAST** | Repository source code | `security-reports/semgrep.sarif` | **PASS** | 0 SAST rule violations across `p/default`, `p/secrets`, `p/security-audit`. Migrated from deprecated `semgrep-action:v1` to official container with SARIF output integrity check. |
| **OSV-Scanner** | All 4 workspace manifests / lockfiles | `security-reports/osv-scanner.json` | **FINDINGS RECORDED** | Pinned v2.7.1 verified against official SHA256SUMS. Runs without exclusions. Finds remaining dev tooling advisories (`extract-zip`, `glob`, `minimatch`, `zod`) and Rust unmaintained crate notices. |
| **Cargo Audit (`shinpo-shield`)** | `crates/shinpo-shield/Cargo.lock` | `security-reports/cargo-audit-shield.json` | **PASS** | 0 vulnerabilities or unsoundness found (94 crate dependencies). |
| **Cargo Audit (`shinpo-browser-host`)** | `crates/shinpo-browser-host/Cargo.lock` | `security-reports/cargo-audit-browser-host.json` | **PASS** | 0 vulnerabilities or unsoundness found (101 crate dependencies). |
| **Cargo Audit (`frontend/src-tauri`)** | `frontend/src-tauri/Cargo.lock` | `security-reports/cargo-audit-frontend-tauri.json` | **FAIL (BLOCKED)** | Denied unsoundness: `RUSTSEC-2024-0429` in `glib 0.18.5` (568 crate dependencies). 4 informational unmaintained notices allowed. Gate strictly fails closed. |
| **Cargo Deny (`shinpo-shield`)** | `crates/shinpo-shield/Cargo.toml` | `security-reports/cargo-deny-shield.json` | **PASS** | Bans ok, licenses ok (reviewed allowlist in `deny.toml`), sources ok. |
| **Cargo Deny (`shinpo-browser-host`)**| `crates/shinpo-browser-host/Cargo.toml` | `security-reports/cargo-deny-browser-host.json` | **PASS** | Bans ok, licenses ok, sources ok. |
| **Cargo Deny (`frontend/src-tauri`)** | `frontend/src-tauri/Cargo.toml` | `security-reports/cargo-deny-frontend-tauri.json` | **PASS** | Bans ok, licenses ok (includes `MPL-2.0` and `sqlcipher-src` exception), sources ok. |

### Verification Area Details

| Verification Area | Hosted CI (GitHub Actions) | Local Host Environment | Notes |
| :--- | :---: | :---: | :--- |
| **Frontend TypeScript Build** | Verified (Ubuntu & Windows MSVC jobs) | Verified (`tsc -b && vite build`) | Zero TypeScript errors. |
| **Frontend Production Audit** | Verified (`npm audit --omit=dev --audit-level=high`) | Verified (0 vulnerabilities) | Production bundle is 100% clean across all jobs. |
| **Frontend Dev Dependency Audit** | Documented in CI job logs | Documented in `qa-security.mjs` | 30 advisories (14 high, 16 moderate, 0 critical). All isolated in offline test runners. |
| **Rust Tauri Core Tests** | Verified (Ubuntu & Windows MSVC jobs) | Verified (85 passed, 0 failed, 1 ignored) | Full encrypted storage & vault integration tests pass. |
| **Rust Shield Daemon Tests** | Verified (Ubuntu & Windows MSVC jobs) | Verified (51 lib, 40 main pass) | Platform interceptor and app discovery tests pass. |
| **Rust Browser Host Tests** | Verified (Ubuntu & Windows MSVC jobs) | Verified (9 passed, 0 failed) | Native messaging host framing & pairing tests pass. |
| **Secret Scanning (Gitleaks)** | Verified in `security` job | Verified (`gitleaks detect -v`) | 0 leaks found across 271 commits. |
| **Semgrep SAST** | Verified in `security` job | Verified in container | Scans rulesets `p/default`, `p/secrets`, `p/security-audit`. |
| **OSV-Scanner** | Verified in `security` job | Verified (`v2.7.1`) | Upgraded to v2.7.1 with SHA256 checksum verification. |
| **SQLCipher Cryptographic Integrity**| Verified (`--smoke-test` on Linux & Windows) | Verified (HMAC tamper rejection pass)| Tampered ciphertext is rejected without plaintext fallback. |
| **Native WebKitGTK User Journey** | Not run in CI (headless) | Verified (`complete-user-journeys`) | Local account, Goals, Tasks, Focus, Rewards, EONPAI pass. |
| **Browser Companion Integration** | Not run in CI | Verified (12/12 acceptance points) | Pairing code handshake, policy push, modal intervention, release pass. |

---

## 5. GLib Rust Advisory Technical Assessment (`RUSTSEC-2024-0429`)

### Exact Dependency Path
```text
glib v0.18.5
├── atk v0.18.2
│   └── gtk v0.18.2
│       ├── muda v0.20.0 -> tauri v2.12.3
│       ├── tao v0.37.1 -> tauri-runtime-wry v2.12.1 -> tauri v2.12.3
│       ├── webkit2gtk v2.0.2 -> wry v0.57.0 -> tauri-runtime-wry v2.12.1
│       └── tauri v2.12.3
```

### Upstream Constraints & Reachability
- **Advisory:** `RUSTSEC-2024-0429` affects `glib::VariantStrIter::impl_get` through variadic pointer mutability.
- **Reachability:** SHINPO native Rust code does not invoke `glib::VariantStrIter` directly.
- **Ecosystem Block:** Upstream patched version is `glib >= 0.20.0`. Upgrading requires migrating all GTK crates (`gtk-rs 0.18` to `0.20`). However, `webkit2gtk-rs` has no `0.20` release and was superseded by `webkit6` (WebKitGTK 4.1/6.0 with `gtk4`), which is incompatible with Tauri 2's GTK3 Linux architecture.
- **Policy Enforcement:** Rather than masking this advisory with an ignore flag, the release gate remains blocked until an upstream-compatible patch exists or formal documented architecture review occurs.

---

## 6. Dependency Supply-Chain Audit & Remediation

- **Production Dependencies:** **Zero (0)** vulnerabilities. Verified via `npm audit --omit=dev --json`. Shipped bundle (`frontend/dist/`) contains only vetted production dependencies (`react`, `@emotion`, `@mui`, `@fontsource/nunito`).
- **Development / Test Harness Tooling:** 30 advisories (14 high, 16 moderate, 0 critical) in offline test runners.
  - **Remediated Dependencies:**
    - `basic-ftp`: Upgraded to `^6.2.6` via package override (remediated 3 vulnerabilities).
    - `deepmerge-ts`: Upgraded to `8.0.2` via `@wdio` bump to `^9.33.1` (remediated 1 high vulnerability).
    - `serialize-javascript`: Upgraded to `^7.1.4` via package override (remediated 1 vulnerability).
    - `minimatch` in ESLint: Remediated to `11.0.8` via `@eslint/config-array 0.23.6` (remediated 2 moderate vulnerabilities).
  - **Remaining Unpatchable Dev Tooling Advisories:**
    - `extract-zip@2.0.1` (`GHSA-7pqw-9j4j-h8q3`, `GHSA-jmr9-qjv8-65gv` - High): Playwright browser downloader. Upstream has no patched version release (`last_affected: 2.0.1`). Not shipped to users.
    - `zod@3.23.8` (`GHSA-mrhx-c7xc-m3w5` - High): Transitive inside `chromium-bidi` test runner. Upgrading to Zod v4 introduces breaking changes for the test harness.
    - `glob` & `minimatch` (`GHSA-3g3m-2fjr-6pw4`, `GHSA-g3hv-75wg-m249` - Moderate): Transitive inside `@wdio/config` and `archiver-utils`. Breaking changes across major version hops.
  - **Visibility:** No broad scanner ignore rules are applied. All findings remain visible in machine-readable JSON reports uploaded as CI artifacts.

---

## 7. Outstanding Acceptance Checklist for Beta Launch

- [ ] **Windows Native Runtime:** Execute `npm run test:e2e` and desktop launch on Windows 11 with WebView2.
- [ ] **Clean-VM Package First-Run:** Install RPM on Fedora 41/42 workstation and DEB on Ubuntu 24.04 desktop; verify application launches from application menu.
- [ ] **Package Removal:** Verify `rpm -e shinpo` and `apt remove shinpo` clean up binaries and host manifests cleanly.
- [ ] **Upstream Tauri GTK/WebKit Patch:** Track upstream resolution for Linux GLib `RUSTSEC-2024-0429`.
- [ ] **Signed Updater Validation:** Perform end-to-end upgrade verification with Tauri updater keys.
