# SHINPO (進歩) — Desktop Packaging & Distribution Guide

SHINPO is a local-first, standalone desktop application built with React 19, Tauri v2, Rust, and an encrypted SQLCipher vault. It requires no central cloud server, no external database (such as PostgreSQL), and no Docker containers.

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                       SHINPO Desktop                        │
│                                                             │
│   ┌─────────────────────┐         ┌─────────────────────┐   │
│   │   React 19 / Vite   │ ◄═════► │  Tauri v2 Rust Core │   │
│   │   Desktop Frontend  │  (IPC)  │  Commands & Vault   │   │
│   └─────────────────────┘         └──────────┬──────────┘   │
│                                              │              │
│                                              ▼              │
│                                    ┌───────────────────┐    │
│                                    │ SQLCipher Vault   │    │
│                                    │ (256-bit AES-GCM) │    │
│                                    └───────────────────┘    │
│                                                             │
│   ┌─────────────────────┐         ┌─────────────────────┐   │
│   │  Browser Companion  │ ◄═════► │  shinpo-browser-host│   │
│   │  Chrome / Firefox   │ (Native │  (Native Messaging) │   │
│   │  Extension          │   Host) └─────────────────────┘   │
│   └─────────────────────┘                                   │
└─────────────────────────────────────────────────────────────┘
```

### Local Isolation Guarantees
1. **Zero Cloud Dependencies**: All goals, tasks, missions, focus records, reflections, and settings persist purely on-device in the local SQLCipher vault.
2. **Offline-First Resilience**: Full application functionality operates without internet access. EONPAI local planners operate completely offline.
3. **No Unsolicited Network Egress**: The application does not phone home, report telemetry to external servers, or open inbound ports.

---

## 2. Linux Packaging (RPM, DEB, AppImage)

### Prerequisites
- Node.js 22+
- Rust 1.80+ (Tauri v2 toolchain)
- WebKitGTK 4.1 development libraries:
  ```bash
  # Fedora
  sudo dnf install webkit2gtk4.1-devel openssl-devel libappindicator-gtk3-devel librsvg2-devel
  # Ubuntu / Debian
  sudo apt install libwebkit2gtk-4.1-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
  ```

### Build Command
```bash
npm --prefix frontend run build
npm --prefix frontend run tauri build
```

Bundles are output to:
- `frontend/src-tauri/target/release/bundle/rpm/` (Fedora / RHEL)
- `frontend/src-tauri/target/release/bundle/deb/` (Debian / Ubuntu)
- `frontend/src-tauri/target/release/bundle/appimage/` (Universal Linux)

---

## 3. Windows Packaging (NSIS / MSI)

### Prerequisites
- Node.js 22+
- Rust toolchain (MSVC)
- WebView2 Runtime (pre-installed on Windows 10/11)

### Build Command
```powershell
npm --prefix frontend run build
npm --prefix frontend run tauri build
```

---

## 4. Quality Gate Verification

Before publishing or verifying any release artifact, run the automated quality gate:

```bash
# Run complete test suite and verification gates
scripts/qa-check-all.sh

# Run headless native persistence smoke test
cargo run --locked --manifest-path frontend/src-tauri/Cargo.toml --bin shinpo-desktop -- --smoke-test
```
