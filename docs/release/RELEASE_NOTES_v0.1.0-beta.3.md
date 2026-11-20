# 🌌 SHINPO (進歩) v0.1.0-beta.3

> [!TIP]
> **Local-First Continuity:** Existing beta users can install the updated package below directly over their previous installation. All personal objectives, tasks, encrypted vaults, focus telemetry, and local AI configurations remain 100% intact, private, and offline.

---

## ✨ What's New in v0.1.0-beta.3

### 🛡️ Zero-Trust IPC & Security Hardening (Run-2)
* **Safe Native URL Opener:** Completely eliminated shell and LOLBin invocations (`rundll32`, `cmd.exe`). Replaced with `tauri-plugin-opener` with strict URL parsing that accepts only validated `http` and `https` schemes while rejecting file schemes, control characters, and script injections.
* **Strict Vault-Lock IPC Gates:** Every IPC command accessing user data, task graphs, or local intelligence strictly enforces vault-unlocked status as its first operation. Any locked-state access returns an immediate, explicit `VaultLocked` rejection.
* **Zeroize In-Memory Key Lifecycle & DoD-Grade Wipe:** Database encryption keys are wrapped in `Zeroizing` memory buffers to prevent secret leakage in process dumps. Account deletion performs multi-pass zero-overwrite and disk synchronization across all SQLCipher database, WAL, and SHM files.
* **Hardened Browser Companion IPC:** Browser extension native messaging now validates extension sender ID and origin, enforces strict message size bounds (<1MB) before casting, and dynamically discovers host binaries across Windows `%LOCALAPPDATA%` and Linux AppImage directories.
* **AI Defense & Data Confidentiality:** EONPAI local assistant wraps untrusted inputs in literal data delimiters to prevent prompt injection. All LLM contexts are automatically scanned to redact API keys, tokens, and credentials. Local Ollama requests feature strict 30s timeouts and 1MB size bounds with instant fallback to the offline heuristic planner.

### 🎨 Distraction-Free Modern Ergonomics & Ambient Design
* **Rock-Solid Flat Desktop Login:** Removed mouse-tracking 3D tilt transformations on authentication cards for a stable, distraction-free desktop aesthetic while preserving subtle border illumination and interactive ambient particles.
* **Multi-Theme Palette Engine:** Seamless native rendering for all built-in themes: **Classic Dark**, **Tokyo Night**, **Catppuccin Mocha**, **Cyberpunk**, **Forest**, and **Monochrome**.

### ⚡ Cross-Platform Execution Engine & Windows / Linux Critical Hardening
* **Linux Launch Panic Fix:** Fixed Tauri single-instance Serde map deserialization error that prevented the native RPM / AppImage from launching on Linux distros (Fedora / Ubuntu).
* **Safe Native Study Resource Links:** Configured approved study resource links to open cleanly in the user's default browser via `openExternalLink` without relying on insecure or blocked raw HTML targets, and added automatic scheme normalization so URLs without `https://` are validated seamlessly.
* **Zero CMD Windows on Startup:** Replaced shell-based `reg.exe` native messaging registration with direct Windows registry manipulation via the Rust `winreg` crate and added `CREATE_NO_WINDOW` flags across all background process invocations. Completely eliminates error `0xc0000142` and flashing command prompt windows.
* **Embedded WebView2 Bootstrapper:** Configured NSIS installer with embedded bootstrapper mode and bundled Visual C++ runtimes to guarantee instant, clean launches on fresh Windows systems without runtime dependency errors.
* **Minimize to System Tray on Close:** Closing SHINPO via the window close button (`X`) now hides the window to the system tray (with full context menu and single-click restore) rather than terminating the process, maintaining background Focus sessions and Guardian monitoring seamlessly.
* **Rapid Process Watcher & Strict Mode App Termination:** Implemented rapid 750ms process observation and direct `taskkill /F` enforcement on Windows. In Strict mode during active Focus blocks, launching blocked distracting applications (such as Discord or Overwolf) triggers immediate termination without command prompt popups.
* **Task Manager CPU Usage Normalization:** Corrected in-app process telemetry to normalize per-process CPU usage by system core count, matching Windows Task Manager metrics and eliminating inflated 100% core readings.
* **Interactive Focus Protection Mode Selection:** Enabled direct in-place mode selection (**Light**, **Standard**, **Strict**) right inside the Focus Protection view with instant persistence to the local encrypted vault.
* **Ultra-Fast Browser Companion Heartbeat:** Tightened heartbeat failure detection to two consecutive pings (~6 seconds), immediately marking the extension disconnected, turning the badge grey, and failing open when SHINPO shuts down.
* **Universal Linux Packaging:** Standalone universal AppImage executable, native Debian package (`.deb`), native Fedora/RHEL package (`.rpm`), and portable no-root `.tar.gz` bundle.
* **100% Offline SQLCipher Encryption:** High-performance AES-256 local storage without external cloud dependencies or third-party telemetry.

---

## 📦 Download Matrix

| Platform / Environment | Architecture | File Name | Recommended For |
| :--- | :--- | :--- | :--- |
| 🪟 **Windows** | **64-bit (`x86_64`)** | `SHINPO_0.1.0-beta.3_windows_x64_setup.exe` | **Windows 10 & 11 (Official Installer)** |
| 🐧 **Linux (Universal)** | **64-bit (`x86_64`)** | `SHINPO_0.1.0-beta.3_amd64.AppImage` | **All Linux distributions (Single Executable)** |
| 🐧 **Linux (DEB)** | **64-bit (`x86_64`)** | `SHINPO_0.1.0-beta.3_amd64.deb` | Ubuntu 22.04/24.04, Debian 12+, Linux Mint |
| 🐧 **Linux (RPM)** | **64-bit (`x86_64`)** | `SHINPO-0.1.0-beta.3-1.x86_64.rpm` | Fedora 40/41, RHEL 9+, Rocky Linux |
| 🐧 **Linux (Portable)** | **64-bit (`x86_64`)** | `SHINPO_0.1.0-beta.3_linux_x86_64.tar.gz` | Portable standalone bundle (No root required) |
| 🌐 **Browser Companion** | **Chromium / Chrome** | `shinpo-browser-companion-chromium.zip` | Google Chrome, Brave, Microsoft Edge, Opera |
| 🦊 **Browser Companion** | **Firefox / Gecko** | `shinpo-browser-companion-firefox.zip` | Mozilla Firefox, LibreWolf, Floorp |

---

## 🛡️ App Identity & Verification

* **Application Identifier:** `com.shinpo.app`
* **Version:** `0.1.0-beta.3`
* **Desktop Binary:** `shinpo-desktop`
* **Cryptographic Checksum Verification:**
  ```bash
  sha256sum -c SHA256SUMS
  ```
