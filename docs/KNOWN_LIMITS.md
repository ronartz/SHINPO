# SHINPO — Known Limits & Beta Characteristics (v0.1.0-beta.1)

This document provides full transparency on known boundaries, architectural design decisions, and beta testing limits for the `v0.1.0-beta.1` private beta release.

---

## 1. Focus Protection (Guardian) is Strictly Warning-Only

- **Behavior:** Focus Guardian actively detects running distraction applications (based on your focus mode settings and customizable blocklists) and displays on-screen interventions/warnings.
- **Safety Boundary:** **SHINPO will never forcefully kill, terminate, or close your applications.** Process termination is intentionally disabled to avoid accidental work or data loss.
- **Intervention:** When a distracting application is brought into focus, SHINPO displays a notification/warning overlay reminding you of your session intention.

---

## 2. Browser Companion Manual Loading

- **Beta Distribution:** The browser companion extensions (`chromium` and `firefox`) are supplied as unpacked extensions within the application bundle. They are not published on the Chrome Web Store or Mozilla Add-ons directory.
- **Loading:** Users must enable "Developer mode" in Chromium/Brave/Chrome and click "Load unpacked", or use `about:debugging` in Firefox.
- **Firefox Session:** Because unsigned extensions cannot be permanently installed in standard release Firefox builds without Developer Edition / Nightly toggles, Firefox users will need to reload the temporary extension upon browser restarts or use Chromium-based browsers for persistent testing.

---

## 3. Secret Storage & OS Keyring

- **Desktop Keyring:** On Linux, secret storage interacts with the D-Bus Secret Service API (`libsecret`). On desktops running without an active Secret Service daemon (such as minimal tiling window managers), SHINPO safely falls back to direct in-session memory handling.
- **Passphrase Entry:** For complete security, unlocking your encrypted SQLCipher database vault always requires entering your master passphrase after cold application launches.

---

## 4. Platform Verification Status

- **Fedora / RHEL Linux x86_64:**
  - **Status:** **SUPPORTED & QUALIFIED (GO).**
  - Tested on Fedora via native RPM build (`.rpm`), package inspection, dynamic linkage verification, zero-plaintext memory/disk inspection, and full end-to-end user journeys.
- **Debian / Ubuntu Linux x86_64:**
  - **Status:** **SUPPORTED & PACKAGED.**
  - Debian `.deb`, AppImage (`.AppImage`), and portable tarball (`.tar.gz`) artifacts are built and published for Ubuntu, Debian, Linux Mint, and Arch systems.
- **Windows x64:**
  - **Status:** **SUPPORTED & QUALIFIED (GO).**
  - Windows 10 & 11 (64-bit) NSIS installer (`.exe.zip`) with per-user installation, automatic Windows Registry Native Messaging integration, and hardware-accelerated WebView2 rendering.
- **macOS:**
  - **Status:** **OUT OF SCOPE.**

---

## 5. EONPAI Assistant Capabilities

- **Offline Mode (Default):** EONPAI functions out of the box using a deterministic, rule-based decomposition algorithm to break down complex goals into actionable checklist items with 100% privacy and zero external connections.
- **External Model Endpoints (Optional):** Users can optionally configure a local Ollama instance (`127.0.0.1:11434`) or external OpenAI-compatible endpoints in Settings → EONPAI. API keys are stored locally in the OS keyring and are never transmitted to SHINPO developers.

---

## 6. Window Geometry & Multi-Monitor Layouts

- The application remembers width and height between sessions (`1400×900` default).
- On some multi-monitor Linux Wayland setups, window repositioning upon restart may default to the primary monitor center rather than retaining the previous secondary display coordinates.

---

## 7. Audio & Notification System

- Focus timer sounds and completion chimes rely on Web Audio API and system audio output. Ensure system volume and desktop notification permissions are active for SHINPO in your desktop environment's Control Center.
