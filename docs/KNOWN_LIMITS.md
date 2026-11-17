# SHINPO — Known Limits & Beta Characteristics (v0.1.0-beta.1)

This document provides full transparency on known boundaries, architectural design decisions, and beta testing limits for the `v0.1.0-beta.1` release.

---

## 1. Focus Protection (Guardian) is Strictly Warning-Only

- **Behavior:** Focus Guardian actively detects running distraction applications (based on your focus mode settings and customizable blocklists) and displays on-screen interventions/warnings.
- **Limit:** **SHINPO will never forcefully kill, terminate, or close your applications.** Process termination is intentionally disabled to avoid accidental work or data loss.
- **Intervention:** When a distracting application is brought into focus, SHINPO displays a notification/warning overlay reminding you of your session intention.

---

## 2. Browser Companion Manual Loading

- **Beta Distribution:** The browser companion extensions (`chromium` and `firefox`) are supplied as unpacked extensions within the application bundle. They are not yet published to the Chrome Web Store or Mozilla Add-ons directory.
- **Loading:** Users must enable "Developer mode" in Chrome/Brave/Edge and click "Load unpacked", or use `about:debugging` in Firefox.
- **Firefox Session:** Because unsigned extensions cannot be permanently installed in standard release Firefox builds without Developer Edition / Nightly toggles, Firefox users will need to reload the extension upon browser restarts or use Chromium-based browsers for persistent testing.

---

## 3. Secret Storage & OS Keyring

- **Desktop Keyring:** On Linux, secret storage interacts with the D-Bus Secret Service API (`libsecret`). On desktops running without a running Secret Service daemon (such as minimal tiling window managers), SHINPO safely falls back to direct in-session memory handling.
- **Passphrase Entry:** For complete security, unlocking your encrypted SQLCipher database vault always requires entering your master passphrase after cold application launches.

---

## 4. Platform Verification Status

- **Linux x86_64:**
  - **Status:** **EMPIRICALLY VERIFIED & RELEASE QUALIFIED.**
  - Tested on Fedora/RHEL via native RPM build, package inspection, dynamic linkage verification, zero-plaintext memory/disk inspection, and full end-to-end user journeys.
- **Windows x64:**
  - **Status:** **CI-TESTED & CONDITIONAL GO.**
  - Compiled and built via automated GitHub Actions CI. Requires first-launch empirical feedback from beta testers running native Windows hardware. Unsigned binary SmartScreen bypass is required.

---

## 5. EONPAI Assistant Capabilities

- **Offline Mode:** When running without external AI endpoints configured, EONPAI functions using a deterministic, rule-based decomposition algorithm to break down complex goals into actionable checklist items.
- **External Model Endpoints:** Users can optionally configure external OpenAI-compatible or local Ollama endpoints in Settings → EONPAI. API keys are stored locally and are never transmitted to SHINPO developers.

---

## 6. Window Geometry & Multi-Monitor Layouts

- The application remembers width and height between sessions (`1400×900` default).
- On some multi-monitor Linux Wayland setups, window repositioning upon restart may default to the primary monitor center rather than retaining the previous secondary display coordinates.

---

## 7. Audio & Notification System

- Focus timer sounds and completion chimes rely on Web Audio API and system audio output. Ensure system volume and desktop notification permissions are active for SHINPO in your desktop environment's Control Center.
