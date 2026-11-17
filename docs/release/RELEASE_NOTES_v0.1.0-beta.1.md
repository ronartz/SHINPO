# SHINPO v0.1.0-beta.1 — Linux Private Beta

Welcome to the first private beta release of **SHINPO (進歩)** — a high-performance, local-first personal productivity and deep focus engine for Linux.

This release includes the native desktop application for Linux x86_64 and the accompanying **SHINPO Browser Companion** for Chromium and Firefox.

---

## 📥 Downloads & Assets

| Asset | Description | Size | SHA-256 Checksum |
|---|---|---:|---|
| **[`SHINPO-0.1.0-beta.1-1.x86_64.rpm`](https://github.com/ronartz/SHINPO/releases/download/v0.1.0-beta.1/SHINPO-0.1.0-beta.1-1.x86_64.rpm)** | Native installer for Fedora 40/41, RHEL 9+, Rocky Linux | 15.7 MiB | `ed6ed20a39915c8894afc25886e217359a30965fd30317927c78e0693fa56933` |
| **[`SHINPO_0.1.0-beta.1_linux_x86_64.tar.gz`](https://github.com/ronartz/SHINPO/releases/download/v0.1.0-beta.1/SHINPO_0.1.0-beta.1_linux_x86_64.tar.gz)** | Portable standalone bundle for any Linux distribution | 15.5 MiB | `285dd494c006e43ddb71f2c47c76133c7214d09528159714c08a4f82f9d4a87d` |
| **[`SHINPO_0.1.0-beta.1_amd64.AppImage`](https://github.com/ronartz/SHINPO/releases/download/v0.1.0-beta.1/SHINPO_0.1.0-beta.1_amd64.AppImage)** | Universal single-file Linux executable | 88.5 MiB | `91d53c40747d1e826b6be28ce66c5c609e663feb072aca843c6c5dac4648a96e` |
| **[`SHINPO_0.1.0-beta.1_amd64.deb`](https://github.com/ronartz/SHINPO/releases/download/v0.1.0-beta.1/SHINPO_0.1.0-beta.1_amd64.deb)** | Native Debian / Ubuntu package | 15.6 MiB | `f0aae249d185f19000ce0030d17dd49a5d3affac4f5a840d58c974b1fb8feedb` |
| **[`shinpo-browser-companion-chromium.zip`](https://github.com/ronartz/SHINPO/releases/download/v0.1.0-beta.1/shinpo-browser-companion-chromium.zip)** | Unpacked extension for Chrome, Brave, Edge | 1.3 MiB | Included in tarball / bundle |
| **[`shinpo-browser-companion-firefox.zip`](https://github.com/ronartz/SHINPO/releases/download/v0.1.0-beta.1/shinpo-browser-companion-firefox.zip)** | Unpacked extension for Mozilla Firefox | 1.3 MiB | Included in tarball / bundle |
| **[`SHA256SUMS`](https://github.com/ronartz/SHINPO/releases/download/v0.1.0-beta.1/SHA256SUMS)** | Cryptographic verification manifest | 1.1 KiB | — |

---

## 🚀 Installation Guide

### Option 1: Fedora, RHEL & RPM-Based Linux (Recommended)
Download the `.rpm` file and install using `dnf`:
```bash
sudo dnf install ./SHINPO-0.1.0-beta.1-1.x86_64.rpm
```
Once installed, launch **SHINPO** from your desktop application launcher or run:
```bash
shinpo-desktop
```

### Option 2: Portable Tarball (Ubuntu, Debian, Arch, or No-Root)
Download and extract the portable `.tar.gz` archive:
```bash
tar -xzf SHINPO_0.1.0-beta.1_linux_x86_64.tar.gz
cd SHINPO_0.1.0-beta.1_linux_x86_64
./shinpo-desktop
```
*(Ensure your system has `webkit2gtk-4.1` and `openssl` installed)*

---

## 🌐 Browser Companion Setup

The browser companion syncs with SHINPO to detect distracting browser tabs during focus sessions.

1. **Register the Native Bridge:**  
   Inside the extracted tarball or application directory, run:
   ```bash
   ./register-browser-companion.sh
   ```
   *(This connects your browser to the local `shinpo-browser-host` via standard native messaging).*

2. **Load into Chromium / Brave / Google Chrome:**
   - Open `chrome://extensions` (or `brave://extensions`).
   - Toggle **Developer mode** ON (top-right corner).
   - Click **Load unpacked** and select the `chromium` folder.

3. **Load into Mozilla Firefox:**
   - Open `about:debugging#/runtime/this-firefox`.
   - Click **Load Temporary Add-on...**
   - Select the `manifest.json` file inside the `firefox` folder.

---

## 🧭 How to Use SHINPO

### 1. First Launch & Encrypted Vault Setup
- When you first open SHINPO, you will be prompted to set a **Master Passphrase**.
- This encrypts your local database with **AES-256 (SQLCipher)**.
- **Save your Master Passphrase and Recovery Key!** Your data is 100% private and stored locally on your machine; there are no cloud accounts or recovery backdoors.

### 2. Deep Focus Engine & Guardian Mode
- Start a focus session for 25, 45, or 60 minutes.
- **Safety Boundary:** SHINPO's Guardian operates in **WARNING-ONLY** mode. It will **never** terminate or kill your open applications or browser tabs. If a distracting window is brought to the foreground, a gentle reminder overlay appears.

### 3. EONPAI AI Assistant
- **Offline by Default:** EONPAI automatically decomposes complex tasks into structured subtasks using a local rule engine with zero external network requests.
- **Local Ollama Integration (Optional):** If you run Ollama locally (`127.0.0.1:11434`), go to **Settings → EONPAI** to connect your local models.
- **External API Keys (Optional):** You can also connect OpenAI-compatible endpoints; API keys are stored safely in your desktop OS keyring.

---

## 🛡️ Verifying Package Integrity

You can verify the downloaded files using the SHA-256 manifest:
```bash
sha256sum -c SHA256SUMS
```
Output should display `OK` for all files.

---

## 💬 Feedback & Bug Reports
As this is a private beta:
- Report any issues, desktop quirks, or UX feedback on our [GitHub Issues](https://github.com/ronartz/SHINPO/issues).
- Please specify your Linux distribution and desktop environment (e.g., Fedora 41 GNOME Wayland).
