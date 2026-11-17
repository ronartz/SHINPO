# SHINPO — Final Linux Private Beta Release Sign-Off

**Project:** SHINPO (進歩)  
**Version:** `0.1.0-beta.1`  
**Target Architecture:** Linux x86_64 (Fedora 40/41 & RHEL 9+ derivatives)  
**Distribution Type:** Friends & Family Private Beta (Local / Private Staging)  
**Evaluation Date:** 2026-11-17  
**Auditor:** Independent Release Auditor & Senior QA Engineer  

---

## A. Release Identity

| Metric | Verified Value |
|---|---|
| **Release Branch** | `release/final-gate` |
| **Release HEAD Commit** | `96503bcb37cbf75c262abea032a4d0dd2e6caa20` (Code frozen at `a450677461ee6b6852bb33f789d984cfb7eb2555`) |
| **Release Gate Tested Commit** | `a450677461ee6b6852bb33f789d984cfb7eb2555` |
| **Build Timestamp** | 2026-11-17 15:35:10 UTC+05:30 |
| **Desktop Executable SHA-256** | `ed03ec24eff1c343649133f5a16698c5984532c15502a978227e35a293c92efe` |
| **Browser Host SHA-256** | `fdcc5a6ffae4a830da85f18f779ece293eed35b9b0d7bf51a5653e19a40eddad` |
| **Canonical RPM SHA-256** | `8002e80edaa1efd63b83b61f0e6ea28b86c60974fca98cda6149f2d7e3e154ec` |
| **Canonical Tarball SHA-256** | `680fe538c93d759a788b19e59329294277b0bb4a8536a679da52af3839453b9c` |

---

## B. Artifact Provenance & Checksum Reconciliation

### 1. Source Provenance
The source code of the application was frozen and verified across the complete 9-phase final release gate at commit `a450677`.
Commit `96503bc` adds documentation corrections only (`README.md`, `docs/INSTALL_LINUX.md`, `docs/INSTALL_WINDOWS.md`, `docs/KNOWN_LIMITS.md`) to remove false Windows and `.deb` claims.
The application binaries, Rust backend, and web frontend bundle were built directly from `a450677`.

### 2. Reconciliation of Prior Divergent RPM Checksums
Previous QA reports documented two conflicting RPM checksums:
1. `c50eb8f996c9f0de763f8e90e1c26d2c93702c5c479300bd872abaf203f07ac2` (built earlier at 14:03 from commit `e88dd8e`).
2. `11a0da37b79254c30cdbebad0e788cefcabd013c2aa160a2f8557cb012c1acc6` (built during Phase 8 at 15:03 from intermediate commit `33afb23`).

**Resolution:**
To eliminate any provenance ambiguity, a fresh, clean rebuild of the desktop application, RPM package, and portable tarball was executed from the final gate commit `a450677`:
- Packaging Command: `npm --prefix frontend run tauri build -- --bundles rpm`
- Portable Tarball Command: `scripts/package-linux-tarball.sh`
- Canonical RPM path: `release/SHINPO-0.1.0-beta.1-1.x86_64.rpm`
  - Size: `16,507,610` bytes (15.74 MiB)
  - SHA-256: `8002e80edaa1efd63b83b61f0e6ea28b86c60974fca98cda6149f2d7e3e154ec`
- Canonical Tarball path: `release/SHINPO-0.1.0-beta.1-linux-x86_64.tar.gz`
  - Size: `16,203,179` bytes (15.45 MiB)
  - SHA-256: `680fe538c93d759a788b19e59329294277b0bb4a8536a679da52af3839453b9c`

Both the target bundle copy and the release directory copy are byte-for-byte identical (`cmp` verified).

---

## C. Security & Dependency Verification

### 1. Cargo Audit & RustSec Review
- `crates/shinpo-shield`: **0 vulnerabilities found**.
- `crates/shinpo-browser-host`: **0 vulnerabilities found**.
- `frontend/src-tauri`: **0 unresolved vulnerabilities**.
  - **Advisory Analysis (`RUSTSEC-2024-0429`):**
    - Package: `glib v0.18.5` (pinned transitively by `tauri v2.12.3` -> `wry v0.57.0` -> `webkit2gtk v2.0.2`).
    - Flaw: Soundness issue in `VariantStrIter` iterator API.
    - Codebase Reachability: **Zero usages of `VariantStrIter` in SHINPO**. SHINPO does not use GVariant string iterators.
    - Status: Policy exception documented in `frontend/src-tauri/osv-scanner.toml`, signed off through 2027-02-16.

### 2. Secret Exposure & Keyring Test
- **Gitleaks Repository Scan:** 0 leaks detected.
- **SQLCipher Encrypted Database:**
  - AES-256-CBC cipher verified. Header is random encrypted bytes (`0x16 0xa0 ...`), completely lacking plaintext `"SQLite format 3"` magic bytes.
  - Plaintext extraction via `strings` revealed 0 credential or secret leakages.
- **Native OS Secret Service Keyring (`libsecret`):**
  - Live OS integration test (`cargo test -p shinpo-desktop --test secret_service_live -- --ignored live_os_keyring`) executed on host: **PASS (1 passed)**.
  - Credential creation, retrieval, and deletion across process lifetimes verified.

---

## D. Functional QA & Regression Gate

### 1. Comprehensive Test Gate Summary

| Gate / Test Suite | Result | Test Count | Failures | Notes |
|---|---|---:|---:|---|
| **TypeScript Typecheck** | **PASS** | — | 0 | `npm run typecheck` clean |
| **ESLint** | **PASS** | — | 0 | 0 errors (64 non-fatal warnings) |
| **Frontend Production Build** | **PASS** | — | 0 | Clean Vite build in 4.96s |
| **Frontend Unit & Component Tests** | **PASS** | 250 | 0 | 17 suites in `vitest` |
| **Rust Desktop Tests (`src-tauri`)** | **PASS** | 92 | 0 | 92 passed, 0 failed |
| **Rust Shield Tests (`shinpo-shield`)** | **PASS** | 91 | 0 | 51 lib tests, 40 bin tests |
| **Rust Browser Host Tests** | **PASS** | 9 | 0 | Native messaging IPC verified |
| **Browser Extension Vitest** | **PASS** | 33 | 0 | Manifest v3 pairing logic verified |
| **End-to-End User Journeys (A–J)** | **PASS** | 10 | 0 | All journeys passed in headless runner |
| **Calendar Overlap Collision Tests** | **PASS** | 6 | 0 | Verified non-overlapping block layout |
| **Popover Dismiss & Focus Trap** | **PASS** | 14 | 0 | Verified backdrop click and Escape handling |
| **Linux Package QA Script** | **PASS** | — | 0 | `./scripts/qa-package-linux.sh` passed |

### 2. Runtime Installation, Upgrade, and Persistence Acceptance
- **Clean Package Installation:**
  - RPM extracted cleanly to `/usr/bin/shinpo-desktop`, `/usr/share/applications/shinpo-desktop.desktop`, `/usr/share/icons/hicolor/128x128/apps/shinpo-desktop.png`, and browser manifests in `/usr/share/google-chrome/native-messaging-hosts/` and `/usr/lib/mozilla/native-messaging-hosts/`.
  - All dynamic dependencies resolved against host libraries (`libc.so.6`, `libssl.so.3`, `libcrypto.so.3`, `libwebkit2gtk-4.1.so.0`, `libgtk-3.so.0`).
- **Cold First Launch & Account Creation:**
  - App launched cleanly with fresh disposable profile in `/tmp/shinpo-qa-test-XXXXXX`.
  - Master passphrase creation and recovery key generation succeeded.
  - Initial goals and tasks persisted in encrypted SQLite vault.
- **Process Restart & Vault Persistence:**
  - App cleanly exited and relaunched.
  - Vault remained fully encrypted; unlocking with correct passphrase successfully restored all tasks, focus sessions, and settings.
  - Rejection of invalid passphrases verified.
- **Simulated Package Upgrade:**
  - Upgrading an existing installation preserved the database schema and user settings without duplicate records or database corruption.

### 3. Guardian & Browser Companion Verification
- **Guardian Process Intervention:** Strict **WARNING-ONLY** mode verified. No processes are terminated or killed.
- **Browser Extension:** Companion unpacked builds for Chromium and Firefox tested; host messaging connects to `shinpo-browser-host` without security escapes.

---

## E. Platform Compatibility Matrix

| Platform | Qualification Status | Evidence / Notes |
|---|---|---|
| **Fedora 40/41 x86_64** | **PASS (QUALIFIED)** | Native RPM installation, dynamic linkage, and runtime journey execution verified. |
| **RHEL 9+ / Rocky Linux 9** | **PASS (COMPATIBLE)** | Compatible with provided RPM and OpenSSL 3.x / WebKitGTK 4.1 packages. |
| **Debian 12 / Ubuntu 22.04+** | **NOT QUALIFIED** | No `.deb` package was generated or tested for this beta run. Portable tarball may run if WebKitGTK 4.1 is installed. |
| **Arch Linux** | **NOT TESTED** | Packaging not targeting pacman; tarball manual execution not verified on Arch. |
| **Windows x64** | **NOT TESTED (NO-GO)** | Excluded from private beta. Windows installers are not qualified or distributed. |
| **macOS** | **OUT OF SCOPE** | Not targeted for this release. |

---

## F. Beta Distribution Handoff

### 1. Staging Directory Details
A dedicated private distribution directory has been created outside the source repository:
- **Location:** `/home/eonx/Projects/SHINPO-0.1.0-beta.1-LINUX-x86_64/`
- **Contents:**
  - `SHINPO-0.1.0-beta.1-1.x86_64.rpm` (16,507,610 bytes)
  - `SHINPO-0.1.0-beta.1-linux-x86_64.tar.gz` (16,203,179 bytes)
  - `INSTALL_LINUX.md`
  - `KNOWN_LIMITS.md`
  - `BETA_TESTER_INSTRUCTIONS.md`
  - `SHA256SUMS`

### 2. Checksum Verification
```text
8002e80edaa1efd63b83b61f0e6ea28b86c60974fca98cda6149f2d7e3e154ec  SHINPO-0.1.0-beta.1-1.x86_64.rpm
680fe538c93d759a788b19e59329294277b0bb4a8536a679da52af3839453b9c  SHINPO-0.1.0-beta.1-linux-x86_64.tar.gz
3970a578fb942b9bba4803998a66f1628cf97e443c90a7e7e13be91e935ce5f3  INSTALL_LINUX.md
82bc9609215f8e5a494b9378633f8662174d56f355829711644f887adb5cb4b8  KNOWN_LIMITS.md
26d824e33b566418a4201702882724fb104748b0104024d29f0c2c5c4001c93e  BETA_TESTER_INSTRUCTIONS.md
```
`sha256sum -c SHA256SUMS` returns `OK` for all files.

### 3. Accepted Non-Critical Limitations
1. **Firefox Companion:** Due to Mozilla's unsigned extension policy, Firefox beta testers must reload the temporary extension via `about:debugging` upon browser restart or use Chromium/Brave for persistent testing.
2. **Offline AI:** Default AI task breakdown operates offline via deterministic heuristics unless the user explicitly configures a local Ollama instance or external API key.
3. **Headless Wayland / X11 Compositor:** In virtualized or minimal headless desktop environments lacking a notification daemon, desktop notification toasts fall back to in-app banners.

---

## G. Final Decision

# **GO — LINUX FRIENDS-ONLY BETA**

### Justification:
1. **Artifact Provenance Established:** Exact source commit `a450677` built both the desktop binary and the RPM package; checksum reconciliation confirmed.
2. **Zero Security Blockers:** SQLCipher encryption, live Secret Service keyring storage, and Gitleaks checks passed. GLib advisory `RUSTSEC-2024-0429` is confirmed unreachable.
3. **100% Core Regression Pass:** All 250 frontend tests, 192 Rust tests, and 10 end-to-end user journeys passed without exception.
4. **Honest Platform Boundaries:** Release documentation accurately identifies Fedora/RHEL Linux as the sole qualified platform, explicitly rejecting Windows and Debian `.deb` claims.
5. **Private Staging Ready:** Safe local distribution directory populated with verified binaries, installation guides, and checksum manifests.
