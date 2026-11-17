# SHINPO — Windows Installation Guide (Beta 0.1.0-beta.1)

This guide walks you through installing and testing the **SHINPO (進歩)** desktop app on Windows 10/11 x64.

---

## System Requirements

- **OS:** Windows 10 (64-bit, version 1903+) or Windows 11
- **Architecture:** x64
- **Runtime Component:** Microsoft Edge WebView2 Evergreen Runtime (pre-installed on almost all Windows 10/11 machines; installer will prompt if missing).

---

## 1. Installing the Desktop Application

1. Download the Windows installer (`SHINPO_0.1.0-beta.1_x64-setup.exe`) from the GitHub release page or distribution link.
2. Double-click the installer to launch setup.

### Handling Windows SmartScreen Warnings

Because this is a pre-release beta build without an expensive EV code signing certificate:
1. Windows Defender SmartScreen may display a blue dialog stating:
   *"Windows protected your PC — Microsoft Defender SmartScreen prevented an unrecognized app from starting."*
2. Click **More info**.
3. Click **Run anyway**.
4. Complete the standard setup wizard. By default, SHINPO installs into your user local application directory (`%LOCALAPPDATA%\Programs\SHINPO`), requiring no administrator privileges.

---

## 2. First Launch & Setup Walkthrough

1. **Launch SHINPO:** Open SHINPO from your Start Menu or desktop shortcut.
2. **Account Creation:**
   - Create your local username and master passphrase.
   - **Important:** Your data is encrypted locally with SQLCipher (256-bit AES + Argon2id). Because SHINPO does not connect to any central account server, passwords cannot be recovered remotely.
3. **Save Your Recovery Key:**
   - Record the displayed recovery key in a safe place.
4. **Choose Visual Theme:**
   - Select Classic Dark or Aurora Dark depending on your preference.

---

## 3. Browser Companion Setup (Optional)

The Windows installer includes the native messaging companion host:

1. **Register the Native Host:**
   - Open PowerShell or Command Prompt.
   - Navigate to the companion folder:
     ```powershell
     cd "$env:LOCALAPPDATA\Programs\SHINPO\browser-companion"
     .\register-browser-companion.ps1 -Target All
     ```
   - This writes the required registry entries under `HKCU\Software\Google\Chrome\NativeMessagingHosts` and `Mozilla\NativeMessagingHosts`.

2. **Load the Extension:**
   - In Google Chrome, Edge, or Brave, go to `chrome://extensions/` or `edge://extensions/`.
   - Enable **Developer mode**.
   - Click **Load unpacked** and select:
     `%LOCALAPPDATA%\Programs\SHINPO\browser-companion\chromium`

3. **Pairing:**
   - Open SHINPO Desktop → Settings → Browser Companion → Generate Pairing Code.
   - Click the extension icon in your browser toolbar, enter the code, and confirm.

---

## 4. Windows-Specific Known Behaviors & Notes

1. **Credential Manager Integration:**
   - Windows Credential Manager is utilized for session convenience. If disabled or locked by group policy, the app falls back to in-memory passphrase caching during your active session.
2. **Focus Assist & Notifications:**
   - If Windows Focus Assist (Do Not Disturb) is enabled, desktop session completion notifications may be queued in the Action Center. To receive live alerts, allow SHINPO in Windows Notification Settings.
3. **Beta Feedback:**
   - As this is a Friends & Family beta, please report any UI scaling quirks on multi-monitor or high-DPI setups directly to the repository maintainer.
