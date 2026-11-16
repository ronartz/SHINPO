# SHINPO 0.1.0-beta.1 — Friends Beta Release & Verification Report

**Release Version:** `0.1.0-beta.1`  
**Target Git Tag:** `v0.1.0-beta.1`  
**Release Date:** Tuesday, November 17, 2026  
**Repository:** `ronartz/SHINPO`  
**Candidate Commit SHA:** `02ebfb7`  
**Base Upstream Commit:** `cdb80f653f3176504484fbb5528edf026c065bba` (`main`)  
**GitHub Release URL:** https://github.com/ronartz/SHINPO/releases/tag/v0.1.0-beta.1  

---

## 1. Executive Summary & Release Verdict

| Dimension | Verdict | Evidence / Reference |
| :--- | :--- | :--- |
| **UI Polish & Dead Space Elimination** | **PASS** | 7 user-reported visual defects resolved in commit `9c0de18` and `2fb39df` across 4 canonical themes |
| **Global Ubuntu Typography Migration** | **PASS** | Official Ubuntu font family (300, 400, 500, 700; normal/italic) bundled offline across desktop & companion |
| **Standalone Offline Security & Vault** | **PASS** | Native SQLCipher encrypted vault smoke test passes (`--smoke-test`), zero network leaks |
| **Interactive Controls & Native Steppers** | **PASS** | `ShinpoNumberStepper` component added, spinner arrows styled, sidebar buttons responsive |
| **Browser Companion Packaging** | **PASS** | Chromium MV3 & Firefox MV2/MV3 extensions packaged with native host registration scripts |
| **Linux Distribution Packaging** | **PASS** | RPM (`12.9 MB`) and standalone portable `.tar.gz` (`15.0 MB`) generated and checksummed |
| **Windows x64 NSIS Packaging** | **PASS** | Tauri NSIS bundle configured with WebView2 bootstrapper and companion resources |
| **Security & Policy Exceptions** | **ACCEPTED RISK** | `RUSTSEC-2024-0429` (`glib 0.18.5`) documented and scoped; 0 exploitable findings |
| **Overall Release Status** | **GO (PRE-RELEASE BETA)** | Qualified for distribution to private beta testers |

---

## 2. Release Candidates & Git Lineage

- **Release Branch:** `fix/systematic-layout-and-composition`
- **Release Head Commit:** `04822bd` (`chore(git): ignore local release-artifacts directory`)
- **Key Intermediate Milestones:**
  - `9c0de18`: `fix(ui): eliminate dead spaces, align metrics, and add themed number steppers`
  - `31bf78e`: `style(auth): refine login brand identity with horizontal lockup and Ubuntu typography`
  - `40ac00e`: `style(typography): migrate desktop app and browser companion to official Ubuntu font`
  - `e3fb7d5`: `fix(desktop): resolve sidebar protection button click and add live browser companion indicator`
  - `8b0b874`: `feat(extension): overhaul browser companion popup with premium SHINPO color design`
  - `6192d3e`: `ci(release): enhance release packaging with portable tarball, standardized names, and safe updater fallback`
- **Preflight Backup Branch:** `backup/release-candidate-0.1.0-beta.1-preflight` at `9c0de18`

---

## 3. Product Corrections & UI Defect Resolutions

All seven defects identified from user testing have been resolved and verified across all four canonical themes (**Aurora Dark**, **Aurora Light**, **Classic Dark**, **Classic Light**):

1. **Focus Setup Layout & Session Intention Card:**
   - Converted `.focus-hero-split` to `align-items: stretch` to eliminate large vertical dead gaps.
   - Refactored `.card-session-intention` into `.intention-card-grid` (a balanced 2-column layout dividing intention input and quick presets).
2. **Calendar View Day/Date Alignment & Navigation:**
   - Day columns standardized to `repeat(7, minmax(90px, 1fr))` ensuring strict alignment between day-of-week headers and date cells.
   - Replaced clipping `box-shadow: inset 0 2px` with non-clipping `::before` selection pill indicator.
   - Added hover/active feedback and arrow alignment to prev/next week controls.
3. **Native Numeric Input Stepper Inconsistency:**
   - Added global reset disabling platform-dependent default browser spinner arrows in `index.css`.
   - Built custom `ShinpoNumberStepper` component featuring theme-compliant up/down chevron buttons, accessible ARIA roles, and keyboard navigation (`ArrowUp`/`ArrowDown`).
4. **Rewards & Progress Metrics Alignment:**
   - Converted summary metrics container in `AuroraDashboardView.tsx` into a centered 3-column grid with vertical border dividers and baseline value alignment.
5. **Goals Objective Card Empty Height:**
   - Restructured `.goal-summary-left` with `justify-content: space-between` and pinned action controls (`Plan Tasks with EONPAI`, `Edit`, `Delete`) to card bottom.
6. **Active Focus Right-Hand Void:**
   - Set `.focus-hero-split` to stretch and `.card-session-creator` to fill available grid height.
7. **Classic Light Theme Contrast & Card Balance:**
   - Replaced low-contrast 60% ivory background with high-opacity ivory frosted glass (`rgba(255, 252, 245, 0.94)`).
   - Upgraded borders to defined olive (`rgba(77, 124, 15, 0.22)`) and text to high-contrast charcoal (`#14213D` / `#293951`) meeting WCAG AA (≥ 4.5:1).
8. **Empty Analytics Chart State:**
   - Set minimum height (`240px`) and flex centering on `.analytics-chart-canvas-container.focus-activity-empty` with clear zero-state messaging.

---

## 4. Typography & Offline Asset Verification

- **Primary Typeface:** Official **Ubuntu** font family (Google Fonts reference).
- **Weights & Styles Bundled:**
  - Light (300), Regular (400), Medium (500), Bold (700)
  - Normal and Italic styles
  - Subsets: `latin`, `latin-ext`, `cyrillic`, `cyrillic-ext`, `greek`, `greek-ext`
  - Indian Rupee (`₹`) glyph validated and functional.
- **Locations Bundled:**
  - Desktop frontend: `frontend/public/fonts/ubuntu/` and `frontend/src/assets/fonts/ubuntu/`
  - Browser companion: `browser-extension/src/assets/fonts/ubuntu/`
- **Licence:** Official Ubuntu Font Licence 1.0 (`LICENCE.txt`) bundled in every font directory.
- **Offline Guarantee:** Zero `@import` from Google Fonts or remote CDNs; all `@font-face` rules resolve to local `url()` assets.

---

## 5. Security & Risk Audit

| Scan Tool | Status | Findings / Notes |
| :--- | :--- | :--- |
| **Gitleaks** | **PASS** | 0 secrets or sensitive keys leaked in repository history |
| **Legacy Backend Check** | **PASS** | `scripts/check-no-legacy-backend.sh` passes (false positive on `spring()` mathematical curve resolved) |
| **Cargo Audit (`crates/shinpo-shield`)** | **PASS** | 0 vulnerabilities |
| **Cargo Audit (`crates/shinpo-browser-host`)** | **PASS** | 0 vulnerabilities |
| **Cargo Audit (`frontend/src-tauri`)** | **ACCEPTED RISK** | 0 exploitable vulnerabilities. 1 documented advisory: `RUSTSEC-2024-0429` |
| **Cargo Deny (Bans, Licenses, Sources)** | **PASS** | All dependencies comply with open source policy |
| **Standalone Network Boundaries** | **PASS** | IPC strictly restricted to local schema; zero external outbound requests |

### Security Policy Exception: `RUSTSEC-2024-0429`
- **Crate:** `glib v0.18.5`
- **Advisory ID:** `RUSTSEC-2024-0429`
- **Summary:** Unsoundness in Iterator and DoubleEndedIterator implementations for `glib::VariantStrIter`.
- **Dependency Path:** `tauri v2.12.3` -> `muda 0.16.2` / `wry 0.57.0` / `tao 0.34.4` -> `gtk 0.18.2` / `webkit2gtk 2.0.2` -> `glib 0.18.5`
- **Reachability in SHINPO:** **UNREACHABLE**. SHINPO's native backend communicates solely via Tauri IPC using `serde` JSON commands; `glib::VariantStrIter` is never called.
- **Remediation & Review:** Documented in `deny.toml` and `.github/workflows/ci.yml`. Review date: `2027-02-16`.

---

## 6. Build Artifacts & Checksums

### Linux x86_64 Downloads

| Filename | Format | Size | SHA-256 Checksum |
| :--- | :--- | :--- | :--- |
| `SHINPO-0.1.0-beta.1-1.x86_64.rpm` | RPM Package | 12.9 MB | `84a452db17bba2e32d104cc112868fc3d00adbc813b4f3602eba37352e59c7ec` |
| `SHINPO_0.1.0-beta.1_linux_x86_64.rpm` | Standardized RPM | 12.9 MB | `84a452db17bba2e32d104cc112868fc3d00adbc813b4f3602eba37352e59c7ec` |
| `SHINPO_0.1.0-beta.1_linux_x86_64.tar.gz` | Portable Tarball | 15.0 MB | `68c7ff636a521d048bc3465fc7cbb71b56881dede80be0f72d325f5d897c2948` |
| `SHINPO_0.1.0-beta.1_linux_x86_64.AppImage` | AppImage | *CI Built* | *See GitHub Release SHA256SUMS* |
| `SHINPO_0.1.0-beta.1_linux_x86_64.deb` | Debian Package | *CI Built* | *See GitHub Release SHA256SUMS* |

### Windows x64 Downloads

| Filename | Format | Size | SHA-256 Checksum |
| :--- | :--- | :--- | :--- |
| `SHINPO_0.1.0-beta.1_windows_x64_setup.exe` | NSIS Setup | *CI Built* | *See GitHub Release SHA256SUMS* |

---

## 7. Functional & Clean-Install Verification

- **Native SQLCipher Smoke Test:**
  - Ran `./frontend/src-tauri/target/release/shinpo-desktop --smoke-test`
  - Output: `PASS: disposable SQLCipher account, goal/task/focus completion, 75 XP, reflection, lock/unlock, restart recovery, and encrypted file header`
- **Frontend Test Suite:** 247/247 unit & integration tests passing (`npm test`).
- **Browser Companion Test Suite:** 33/33 tests passing (`npm test`).
- **Companion Registration Script:** Verified registration to `/tmp/test-companion-manifests`:
  - `path`: points to release `shinpo-browser-host`
  - `allowed_origins`: `chrome-extension://ndknhgihhogcfkliohfjcllglpjdgjpj/`
- **RPM Metadata Check:**
  - Inspected with `rpm -qip` and `rpm -qlp`. Valid `/usr/bin/shinpo-desktop` and embedded `/usr/lib/SHINPO/browser-companion/` directories.
- **Portable Tarball Extraction:**
  - Validated standalone binary execution, permissions, companion extensions, and `README.txt`.

---

## 8. Known Limitations & Friends Beta Guidance

1. **Focus Guardian Policy:**
   - Guardian monitoring is strictly warning-only. SHINPO never closes or kills running user applications.
2. **Linux Wayland Environment:**
   - Under Wayland on Linux (Fedora, GNOME/KDE Wayland), active window title observation requires user consent and operates via sampled runtime tracking.
3. **Browser Companion Sideloading:**
   - The companion extensions are development builds. Chrome users must enable "Developer mode" and select "Load unpacked" pointing to `browser-companion/chromium`. Firefox users should load `manifest.json` as a temporary add-on via `about:debugging`.
4. **Auto-Updater Fallback:**
   - In-app automatic updating is enabled when release assets are cryptographically signed. If private keys are omitted, beta updates are downloaded directly from the GitHub Releases page.
5. **Local Data Persistence:**
   - All user data is encrypted with SQLCipher in `~/.local/share/com.shinpo.app/` (Linux) or `%LOCALAPPDATA%\com.shinpo.app\` (Windows). Backing up this directory preserves goals, history, and settings.
