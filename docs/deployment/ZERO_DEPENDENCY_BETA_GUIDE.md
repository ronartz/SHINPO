# SHINPO — Zero-Dependency Standalone Architecture Guide

**Status:** Authoritative Local-First Desktop Architecture  
**Platforms:** Linux (x86_64) & Windows 10/11 (x64)

---

## 🚀 1. True Zero-Dependency Design

SHINPO is built from the ground up as a **100% self-contained, offline-first personal execution workspace**. 

* **No Remote Servers**: SHINPO runs entirely on your local machine. No Spring Boot, no PostgreSQL daemon, no Docker containers, and no remote cloud hosts are required.
* **Encrypted Local Vault**: All missions, goals, focus logs, and progress metrics are stored on disk inside an **AES-256 SQLCipher** database encrypted with the user's master password.
* **Local EONPAI Reasoning**: AI mission decomposition and strategic planning run deterministically offline with 100% privacy, or optionally via local Ollama (`localhost:11434`).
* **Zero Telemetry**: No browsing URLs, keystrokes, or screen contents ever leave your workstation.

---

## 📦 2. Installation & Artifact Overview

### Windows 10 & 11 (64-bit)
* **Installer Format**: Per-user NSIS installer (`.exe`) packaged as `SHINPO_<version>_windows_x64_setup.exe.zip`.
* **Installation Target**: `%LOCALAPPDATA%\Programs\SHINPO`.
* **Runtime**: Tauri 2 + Microsoft Edge WebView2.
* **Native Companion**: Automatic registry integration (`HKCU\Software\...`) for Chrome, Brave, Edge, and Firefox.

### Linux (x86_64)
* **RPM**: Fedora 40/41, RHEL 9+, Rocky, AlmaLinux (`.rpm`).
* **Debian / Ubuntu**: Ubuntu, Debian, Linux Mint (`.deb`).
* **Universal Executable**: Single-file Linux AppImage (`.AppImage`).
* **Portable Tarball**: Standalone archive (`.tar.gz`) for Arch, NixOS, or systems without root privileges.

---

## 🛠️ 3. Verification & Safety Guarantees

1. **Focus Protection (Guardian)**: Warning-only overlays remind users of active focus commitments. Process termination is disabled by default to prevent accidental data loss.
2. **Accidental Zoom Lock**: Prevents browser-like zooming inside the desktop app via `Ctrl + ScrollWheel` and zoom hotkeys.
3. **Hardware Acceleration**: 60 FPS transitions and buttery smooth UI animations on both Linux and Windows.
