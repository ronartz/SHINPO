# SHINPO v0.1.0-beta.1 — Linux Private Beta

Welcome to the first private beta release of **SHINPO (進歩)** — a high-performance, local-first personal productivity and deep focus engine for Linux.

This release includes the native desktop application for Linux x86_64 and the accompanying **SHINPO Browser Companion** for Chromium and Firefox.

---

## 📥 Downloads & Assets

| Asset | Description | Size | SHA-256 Checksum |
|---|---|---:|---|
| **[`SHINPO-0.1.0-beta.1-1.x86_64.rpm`](SHINPO-0.1.0-beta.1-1.x86_64.rpm)** | Native installer for Fedora 40/41, RHEL 9+, Rocky Linux | 15.7 MiB | `8002e80edaa1efd63b83b61f0e6ea28b86c60974fca98cda6149f2d7e3e154ec` |
| **[`SHINPO-0.1.0-beta.1-linux-x86_64.tar.gz`](SHINPO-0.1.0-beta.1-linux-x86_64.tar.gz)** | Portable standalone bundle for any Linux distribution | 15.5 MiB | `680fe538c93d759a788b19e59329294277b0bb4a8536a679da52af3839453b9c` |
| **[`shinpo-browser-companion-chromium.zip`](shinpo-browser-companion-chromium.zip)** | Unpacked extension for Chrome, Brave, Edge | 1.3 MiB | Included in tarball / bundle |
| **[`shinpo-browser-companion-firefox.zip`](shinpo-browser-companion-firefox.zip)** | Unpacked extension for Mozilla Firefox | 1.3 MiB | Included in tarball / bundle |
| **[`SHA256SUMS`](SHA256SUMS)** | Cryptographic verification manifest | 464 B | — |

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
tar -xzf SHINPO-0.1.0-beta.1-linux-x86_64.tar.gz
cd SHINPO-0.1.0-beta.1-linux-x86_64
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
