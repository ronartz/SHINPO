# SHINPO (進歩) v0.1.0-beta.3 — Cross-Platform Beta & Security Hardening

> **Plan it. Protect it. See the truth.**  
> A local-first, privacy-respecting personal execution OS that turns your goals into a daily plan, defends your focus with consent-based enforcement, and shows you honestly what happened.

Welcome to **SHINPO v0.1.0-beta.3**! This release brings full Windows MSVC and Linux builds, comprehensive security hardening across all IPC and native vault boundaries, and a refined, rock-solid desktop login experience.

---

## 🚀 What's New in v0.1.0-beta.3

### 🛡️ Security Remediation & Hardening (Run-2)
* **Safe Native URL Opener**: Completely eliminated shell and LOLBin invocations (`rundll32`, `cmd.exe`). Replaced with `tauri-plugin-opener` with strict URL parsing that accepts only validated `http` and `https` schemes while rejecting file URIs, control characters, and script injections.
* **Strict Vault-Lock IPC Gates**: Every IPC command accessing user data or local intelligence strictly verifies that the local vault is unlocked before execution. Locked states return an explicit rejection.
* **Zeroize Key Management & Secure File Wipe**: Vault encryption keys are wrapped in `Zeroizing` memory buffers to prevent retention in process memory. Account deletion performs multi-pass zero-overwrite and sync flushes across all SQLCipher database, WAL, and SHM files.
* **Native Messaging Companion IPC Hardening**: Browser Companion IPC now validates extension sender ID and origin, enforces strict message size limits (<1MB) before casting, and dynamically discovers host binaries across Windows `%LOCALAPPDATA%` and Linux AppImage paths.
* **AI Defense & Data Confidentiality**: EONPAI local assistant wraps untrusted inputs with strict delimiters to prevent prompt injection. All LLM contexts are automatically scanned to redact API keys, tokens, and credentials. Ollama requests feature strict 30s timeouts and 1MB size bounds with instant fallback to the local heuristic planner.

### 🎨 Desktop UI & Ergonomics
* **Rock-Solid Flat Login**: Removed mouse-tracking 3D tilt transformations on authentication cards for a stable, distraction-free desktop aesthetic while preserving subtle border illumination and particles.
* **Full Theme Engine**: Seamless support for all built-in themes (Classic Dark, Tokyo Night, Catppuccin Mocha, Cyberpunk, Forest, and Monochrome) across all operating systems.

### 💻 Cross-Platform Parity
* Native packaging for **Windows 10/11 x64** and **Linux x86_64** (Ubuntu/Debian, Fedora/RHEL, and universal AppImage).
* Fully local SQLCipher encryption with zero external cloud dependencies.

---

## 📥 Downloads & Assets

| Asset | Platform / Target | Description |
|---|---|---|
| **`SHINPO_0.1.0-beta.3_windows_x64_setup.exe`** | Windows 10/11 (x64) | Official Windows NSIS installer |
| **`SHINPO_0.1.0-beta.3_amd64.AppImage`** | Linux (Universal) | Standalone executable for any Linux distro |
| **`SHINPO_0.1.0-beta.3_amd64.deb`** | Ubuntu / Debian | Native `.deb` package |
| **`SHINPO-0.1.0-beta.3-1.x86_64.rpm`** | Fedora / RHEL | Native `.rpm` package |
| **`SHINPO_0.1.0-beta.3_linux_x86_64.tar.gz`** | Linux (Portable) | Portable standalone tarball bundle |
| **`shinpo-browser-companion-chromium.zip`** | Chrome / Brave / Edge | Unpacked Browser Companion extension |
| **`shinpo-browser-companion-firefox.zip`** | Mozilla Firefox | Unpacked Browser Companion extension |
| **`SHA256SUMS`** | All Platforms | Cryptographic SHA-256 verification hashes |

---

## ⚡ Quick Start Guide

### Windows Installation
1. Download **`SHINPO_0.1.0-beta.3_windows_x64_setup.exe`**.
2. Run the installer and launch **SHINPO** from your Start Menu.
3. To pair your browser, open PowerShell in the install directory and run:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\scripts\register-browser-companion.ps1
   ```

### Linux Installation
* **AppImage**:
  ```bash
  chmod +x SHINPO_0.1.0-beta.3_amd64.AppImage
  ./SHINPO_0.1.0-beta.3_amd64.AppImage
  ```
* **Fedora / RHEL**:
  ```bash
  sudo dnf install ./SHINPO-0.1.0-beta.3-1.x86_64.rpm
  ```
* **Ubuntu / Debian**:
  ```bash
  sudo apt install ./SHINPO_0.1.0-beta.3_amd64.deb
  ```

---

## 🔐 Checksum Verification

Verify your downloaded binary against the published checksums:
```bash
sha256sum -c SHA256SUMS
```
