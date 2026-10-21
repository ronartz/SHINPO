# SHINPO (進歩) — Private Beta User Onboarding Guide

Welcome to the **SHINPO Private Beta**!

SHINPO is a personal focus engineering cockpit designed to protect your attention during high-intensity cognitive work. It combines a local desktop app with an operating-system-level protection daemon (**SHINPO Shield**) and a **Browser Companion** to prevent digital distractions and keep your attention locked to your goals.

This guide will walk you through installing and configuring SHINPO on your Windows or Linux PC.

---

## 1. System Requirements

- **Operating System**:
  - **Linux**: Ubuntu 20.04+, Debian 11+, Fedora 38+, Arch Linux, or compatible (x86_64)
  - **Windows**: Windows 10 or Windows 11 (64-bit)
- **Supported Browsers**: Google Chrome, Brave, Microsoft Edge, Chromium, or Mozilla Firefox
- **Network**: Internet connection for initial account registration and cloud sync. (SHINPO is fully offline-resilient once synced).

---

## 2. Step 1: Install the SHINPO Desktop Application

### Option A: Linux (Ubuntu / Debian / Mint)
Download the `shinpo_1.0.0_amd64.deb` package:

```bash
sudo dpkg -i shinpo_1.0.0_amd64.deb
```
Or if using the standalone **AppImage**:
```bash
chmod +x shinpo_1.0.0_amd64.AppImage
./shinpo_1.0.0_amd64.AppImage
```

### Option B: Windows
1. Download the `shinpo_1.0.0_x64-setup.exe` installer.
2. Double-click the installer and follow the on-screen prompts.
3. Launch **SHINPO** from your Start Menu or Desktop shortcut.

---

## 3. Step 2: Configure Server URL & Register Your Account

When you launch SHINPO for the first time, you will see the authentication screen:

```
┌────────────────────────────────────────────────────────┐
│                      進歩 SHINPO                       │
│           Focus Engineering & Workstation Cockpit      │
├────────────────────────────────────────────────────────┤
│ [ Username                                           ] │
│ [ Password                                           ] │
│                                                        │
│ [             Sign In / Register                     ] │
│                                                        │
│ ▼ 🌐 Server: https://shinpo.yourdomain.com             │
│   ┌──────────────────────────────────────────────────┐ │
│   │ https://shinpo.yourdomain.com              [Save]│ │
│   └──────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

1. Click on **🌐 Server: ...** at the bottom of the card to reveal the server configuration field.
2. Enter the cloud backend address provided by your administrator (e.g., `https://shinpo.yourdomain.com`).
3. Click **Save Server URL**.
4. Switch to the **Register** tab:
   - Choose a unique **Username**
   - Enter your **Email address**
   - Create a strong **Password**
5. Click **Create Account**. You will be logged in immediately.

---

## 4. Step 3: Set Up the Browser Companion

The **SHINPO Browser Companion** enables contextual URL interception, YouTube distraction mitigation, and tab enforcement during active sprints.

### 1. Load the Browser Extension
1. Open your browser's extension manager:
   - Chrome / Brave / Edge: Navigate to `chrome://extensions`
   - Firefox: Navigate to `about:debugging#/runtime/this-firefox`
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked** and select the `extension/` folder inside your SHINPO directory.
4. Note your extension's ID (e.g., `abcdefghijklmnopqrstuvwxyz123456`).

### 2. Register Native Host Connection
To allow the extension to communicate with your local desktop Shield daemon, run the automated registration script:

- **On Linux**:
  ```bash
  bash scripts/register-browser-companion.sh
  ```
  *(This automatically registers the native messaging manifest for Chrome, Brave, Edge, Chromium, and Firefox in your home directory).*

- **On Windows**:
  1. Open PowerShell as Administrator.
  2. Navigate to the SHINPO directory and run:
     ```powershell
     .\scripts\register-browser-companion.ps1
     ```

Once registered, the SHINPO icon in your browser toolbar will show a **Green Dot**, indicating a verified native host connection.

---

## 5. Step 4: Running Your First Protected Focus Sprint

1. In the SHINPO Cockpit, navigate to **Missions** or **Today's Schedule**.
2. Click **+ New Goal** to set a milestone (e.g. *"Complete Project Proposal"*).
3. Create a Mission with an estimated duration (e.g. *25 minutes*).
4. Click **Start Focus Session**:
   - The status bar at the top displays `SHIELD ACTIVE [STRICT]`.
   - Your local **SHINPO Shield** monitors workstation background processes.
   - If a blacklisted distraction (e.g., Discord, Steam, or social media sites) is opened during your sprint, Shield safely intervenes, logs a quarantine event, and displays a calm refocus prompt.
5. When finished, click **Complete Session**:
   - Rate your session quality (1 to 5 stars).
   - Enter an optional reflection note.
   - Your metrics are securely synchronized to your personal cloud profile.

---

## 6. Step 5: Offline Resilience & Disconnected Behavior

SHINPO is engineered so you are never locked out or unprotected if your network connection drops:

- **Local Shield Enforcement**: The protection daemon runs locally on your PC. It does not depend on cloud server uptime during an active sprint.
- **Offline Event Spooler**: If your internet drops, quarantine and telemetry events are saved to an encrypted local spool on your disk.
- **Automatic Sync**: As soon as internet connectivity returns, SHINPO silently synchronizes all spooled data to your cloud account.
- **Developer Workstation Independent**: The cloud backend runs 24/7 on dedicated cloud infrastructure; the developer's laptop does not need to be turned on.

---

## 7. Troubleshooting & FAQ

### Q: I see "Network Error" when trying to sign in.
- Click **🌐 Server: ...** on the login card.
- Ensure the server URL starts with `https://` (not `http://`) and does not end with a trailing slash `/`.
- Verify you can reach the server's health page in your web browser: `https://shinpo.yourdomain.com/actuator/health`.

### Q: Does SHINPO send my browsing history or open files to the server?
- **No.** Process inspection and URL checking happen **100% locally on your machine** via the open-source Rust Shield and Browser Companion. Only summary counts of blocked distractions during focus sprints are transmitted to your account.

### Q: Where are local logs located?
- **Linux**: `~/.local/share/shinpo/` or terminal console output.
- **Windows**: `%LOCALAPPDATA%\shinpo\`

### Q: How do I request a temporary emergency exception?
- If you legitimately need to access a restricted tool during a focus sprint, click **Request Exception** in the Focus Protection panel. You will be granted a 3-minute grace period before enforcement resumes.

