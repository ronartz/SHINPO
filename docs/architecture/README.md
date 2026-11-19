# SHINPO (進歩) — System Architecture

**Authoritative Architecture Documentation**  
**Version:** `0.1.0-beta.3`  
**Platforms:** Linux (x86_64) & Windows 10/11 (x64)

---

## 🏛️ 1. Architecture Overview

SHINPO is an intentional, high-performance, **100% local-first personal execution workspace and deep focus engine**. It operates without any mandatory cloud services, external databases, or remote tracking. All user data, credentials, and progression metrics are stored locally inside an encrypted SQLCipher vault on the user's disk.

```
+-----------------------------------------------------------------------------------+
|                                 USER WORKSPACE                                    |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  |                  SHINPO Desktop UI (React 19 + TypeScript)                 |  |
|  |  - Bento Dashboard       - Task & Goal Engine      - Pomodoro Timer         |  |
|  |  - Interactive Steppers  - Focus Protection Graph  - EONPAI Assistant UI    |  |
|  +-----------------------------------------------------------------------------+  |
|                                        |                                          |
|                                Tauri 2 IPC (IPC Bridge)                           |
|                                        v                                          |
|  +-----------------------------------------------------------------------------+  |
|  |                   SHINPO Native Core (Rust / Tauri 2)                       |  |
|  |  - Native Vault Manager (Argon2id + AES-256-GCM / SQLCipher)                |  |
|  |  - Process Observation & Guardian Policy Engine                             |  |
|  |  - Local Timing Snapshot & Focus Phase FSM                                  |  |
|  |  - EONPAI Deterministic Decomposition & Local Ollama IPC                    |  |
|  +-----------------------------------------------------------------------------+  |
|                         |                               |                         |
|             Local Disk Encryption               Native Messaging (stdio)          |
|                         v                               v                         |
|         +-------------------------------+  +-----------------------------------+  |
|         | Encrypted SQLCipher Database  |  |    shinpo-browser-host (Rust)     |  |
|         | - AES-256 Page Cipher         |  +-----------------------------------+  |
|         | - PBKDF2 / Argon2id Salted    |                   |                     |
|         | - 100% Offline Disk Storage   |             WebExtension                |
|         +-------------------------------+                   v                     |
|                                            +-----------------------------------+  |
|                                            |     SHINPO Browser Companion      |  |
|                                            |  - Chrome, Brave, Edge (MV3)      |  |
|                                            |  - Mozilla Firefox (MV2/MV3)      |  |
|                                            +-----------------------------------+  |
+-----------------------------------------------------------------------------------+
```

---

## ⚡ 2. Core Technology Stack

| Tier | Technology | Purpose | Location in Codebase |
|---|---|---|---|
| **Desktop Shell** | Tauri 2.0 (Rust) | Native window management, secure system bridge, system tray, notifications | `frontend/src-tauri/` |
| **Frontend Framework** | React 19 | Declarative UI, state management, reactive components | `frontend/src/` |
| **Language** | TypeScript 5.8+ | End-to-end type safety, strict compiler options | `frontend/src/` |
| **Bundler & Tooling** | Vite 8+ | Hot module replacement, tree shaking, asset pipeline | `frontend/vite.config.ts` |
| **Styling & Design** | CSS3 Variables & Tokens | Aurora Dark/Light & Classic Dark/Light themes, Bento grid | `frontend/src/styles/` |
| **Encrypted Database** | SQLCipher (AES-256) | Zero-plaintext local database for goals, tasks, sessions, and XP | `frontend/src-tauri/src/native_vault/` |
| **Key Derivation** | Argon2id + NFKC normalization | Memory-hard master password hashing and database key derivation | `frontend/src-tauri/src/native_vault/` |
| **Browser Host** | Rust (`crates/shinpo-browser-host`) | Stdio-based Native Messaging Host connecting browsers to desktop | `crates/shinpo-browser-host/` |
| **Browser Extension** | Manifest V3 / WebExtensions | Focus policy enforcement, distraction site intervention | `browser-extension/` |
| **AI Assistant** | EONPAI (Rust Engine) | Deterministic local decomposition; optional local Ollama (`:11434`) | `frontend/src-tauri/src/native_vault/eonpai/` |

---

## 🔒 3. Local-First Security & Vault Model

1. **Zero Cloud Requirement**:
   - There is no remote backend server, no Spring Boot, no PostgreSQL server, and no cloud account required to use SHINPO.
   - All persistence occurs locally within the user's OS application data directory (`~/.local/share/com.shinpo.app` on Linux, `%LOCALAPPDATA%\com.shinpo.app` on Windows).

2. **Full Disk Encryption (AES-256 SQLCipher)**:
   - Every database page is individually encrypted with AES-256-CBC.
   - Memory inspection and binary strings analysis prove 0 plaintext strings on disk.
   - Brute-force resistance via progressive Argon2id unlock backoff delays.

3. **Secure Browser Companion Connection**:
   - WebExtensions communicate via private OS Native Messaging (`com.shinpo.browser_companion`).
   - One-time pairing tokens (32-character high-entropy hex) expire after 10 minutes.
   - Once paired, a revocable, rotating session token ensures only authorized local extensions receive the active focus policy.

4. **Focus Guardian**:
   - Guardian checks for running distractions only during active focus blocks.
   - Strictly warning-only: SHINPO never force-kills user processes to prevent accidental data loss.

---

## 📦 4. Packaging & Distribution Architecture

* **Linux (x86_64)**:
  * Native Fedora/RHEL `.rpm` via `cargo-generate-rpm`
  * Standalone Portable `.tar.gz` (runs without root or package installation)
  * Debian `.deb` and universal `.AppImage`
* **Windows (x64)**:
  * Per-user NSIS Installer (`.exe.zip`) targeting Windows 10 and Windows 11
  * Automatic Windows Registry Native Messaging registration under `HKCU\Software\...`
  * Hardware-accelerated WebView2 rendering with accidental zoom locks.
