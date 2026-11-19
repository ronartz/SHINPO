# Windows Installation & Setup Guide — SHINPO Desktop (x64)

**Status:** **SUPPORTED & QUALIFIED (Windows 10 & Windows 11 64-bit)**

SHINPO is packaged for 64-bit Windows systems as a standalone native desktop application powered by Tauri 2, Rust, and Microsoft Edge WebView2, featuring an encrypted local-first AES-256 SQLCipher vault.

---

## 📥 1. Download & Installation

1. Navigate to the official releases page:
   👉 **[SHINPO GitHub Releases](https://github.com/ronartz/SHINPO/releases)**
2. Download the latest Windows package:
   * **`SHINPO_0.1.0-beta.3_windows_x64_setup.exe.zip`** (or newer release)
3. Extract the ZIP file to access `SHINPO_0.1.0-beta.3_windows_x64_setup.exe`.
4. Double-click the installer to begin setup.

### 🛡️ Windows SmartScreen Note
Because SHINPO is a private beta release and does not yet use an enterprise extended validation (EV) certificate:
* If Windows Defender SmartScreen displays **"Windows protected your PC"**:
  1. Click **More info**.
  2. Click **Run anyway**.
* The installer installs SHINPO into your user directory (`%LOCALAPPDATA%\Programs\SHINPO`) and adds shortcuts to your Start Menu and Desktop.

---

## 🌐 2. Browser Companion Setup on Windows

The browser companion works directly with Google Chrome, Microsoft Edge, Brave Browser, and Mozilla Firefox via Windows Native Messaging.

### Step A: Load the Extension
1. Download **`shinpo-browser-companion-chromium.zip`** (or `shinpo-browser-companion-firefox.zip`) from GitHub Releases and extract it.
2. In your browser:
   * **Chrome / Brave / Edge**: Open `chrome://extensions` or `edge://extensions`, turn on **Developer mode** (top-right toggle), click **Load unpacked**, and select the extracted folder.
   * **Firefox**: Open `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on**, and select `manifest.json`.

### Step B: Pair with SHINPO Desktop
1. Open **SHINPO Desktop**, navigate to **Settings → Browser Companion**.
2. Click **Generate Pairing Code**. SHINPO automatically registers the native messaging host manifest in your Windows Registry under `HKCU\Software\Google\Chrome\NativeMessagingHosts`, `HKCU\Software\Microsoft\Edge\NativeMessagingHosts`, `HKCU\Software\BraveSoftware\Brave-Browser\NativeMessagingHosts`, and `HKCU\Software\Mozilla\NativeMessagingHosts`.
3. Copy the 64-character one-time pairing code.
4. Click the SHINPO extension icon in your browser, paste the code into the **One-time pairing code** field, and click **Pair this browser**.
5. The extension indicator will turn green: **Connected & Protected**.

*(Optional)* You can also register or verify manually via PowerShell:
```powershell
powershell -ExecutionPolicy Bypass -File "%LOCALAPPDATA%\Programs\SHINPO\browser-companion\register-browser-companion.ps1"
```

---

## ⚙️ 3. Troubleshooting & Notes
* **Animations**: All interactive animations, button glows, and glassmorphism cards run at 60 FPS on Windows.
* **Display Scaling / High DPI**: The UI adapts dynamically to Windows display scaling (100%, 125%, 150%, 200%) without distortion or scrollbar clipping.
* **Zoom Lock**: Accidental webview zoom via `Ctrl + MouseWheel` or keyboard shortcuts (`Ctrl + + / -`) is prevented so SHINPO feels strictly like a native desktop app.
* **Data Storage**: Your database is encrypted with SQLCipher AES-256 and stored locally in `%LOCALAPPDATA%\com.shinpo.app`.
