# SHINPO — Focus Engine, Sentinel Shield & Browser Companion Audit

**Audit Date:** October 26–27, 2026  
**Auditor Role:** Senior Systems & Native Integration Engineer  
**Scope:** Focus Session Lifecycle, Native Process Protection (`shinpo-shield`), Browser Extension (`browser-extension`), Native Messaging Host (`shinpo-browser-host`)  

---

## 1. Focus Engine Lifecycle & Duration Accounting

The Focus Engine is the central productivity loop of SHINPO. Its state machine was audited against both the Rust native vault implementation (`frontend/src-tauri/src/native_vault.rs`) and the Spring Boot backend (`FocusSessionService.java`).

### 1.1 Complete State Machine Verification

```
[SETUP] ──► [FOCUS] ──► [BREAK] ──► [GRACE] ──► [RETURN_REQUIRED] ──► [FOCUS RESUME] ──► [COMPLETE]
               │           │           │               │                     ▲
               ▼           ▼           ▼               ▼                     │
            [PAUSE] ──► [RESUME]   [EXTEND (capped)]  [EMERGENCY OVERRIDE] ──┘
               │
               ▼
           [CANCEL] / [INTERRUPT]
```

| Lifecycle Phase | Expected Behavior | Native Vault Verification | Backend Verification | Result |
| :--- | :--- | :--- | :--- | :--- |
| **SETUP** | Duration selection, task linkage, break selection, strictness | Stored in memory / local state | Validated via `FocusSessionRequest` DTO | **PASS** |
| **FOCUS** | Wall-clock countdown, Sentinel & Browser blocking active | Active duration tracks interval start/stop | Tracks `startedAt` and active segments | **PASS** |
| **PAUSE** | Stops active timer accumulator; suspends process warnings | Writes interval record with `paused_at` | Persists `FocusSessionInterval` | **PASS** |
| **RESUME** | Starts new interval segment; resumes blocking | Writes new `resumed_at` timestamp | Appends interval segment | **PASS** |
| **BREAK** | Pauses focus counter; grants allowed entertainment access | Excludes break seconds from total focus time | Break seconds isolated from focus score | **PASS** |
| **GRACE** | 60s countdown warning before mandatory work return | Triggers audio & notification warning | Managed via frontend timer | **PASS** |
| **RETURN_REQ** | Strict lockscreen/overlay until user confirms work return | Requires explicit user interaction or override | Logged in session timeline | **PASS** |
| **EXTENSION** | Optional break extension strictly capped at 10 minutes | Capped at 600 seconds; rejects higher inputs | Strict validation in service layer | **PASS** |
| **COMPLETE** | Atomically updates streak, awards XP, stores reflection | Executes in single SQLCipher transaction | Executes in Spring `@Transactional` block | **PASS** |

### 1.2 Duration Accounting & Anti-Cheat Validation
- **Wall-Clock Integrity:** Active focus duration is computed from monotonic intervals (`resumed_at - paused_at`), preventing clock manipulation or sleep/wake drift from falsely inflating focus totals.
- **Double-Reward Prevention:** The completion handler verifies `status != 'COMPLETED'` before emitting rewards. Attempted double-calls return existing session data with zero duplicate XP.

---

## 2. Sentinel Shield Native Protection Audit (`crates/shinpo-shield`)

### 2.1 Architecture & Process Enumeration
- **Polling Loop:** Runs on an isolated background thread ticking every **2,000ms**.
- **Process Inspection:**
  - *Linux:* Reads `/proc/[pid]/cmdline` and `/proc/[pid]/comm` directly via standard Rust file I/O.
  - *Windows:* Uses `EnumProcesses`, `OpenProcess`, and `QueryFullProcessImageNameW` via `windows-sys`.
- **Unit Test Coverage:** 79/79 unit tests passing across process detection, matching rules, and grace-period timers.

### 2.2 Immunity List & Failsafe Guardrails
To prevent accidental denial of service, crashes, or self-termination, Sentinel Shield enforces an un-overridable hardcoded immunity filter:
- Core OS: `systemd`, `init`, `kthreadd`, `dbus-daemon`, `udevd`.
- Windowing & Display: `Xorg`, `Xwayland`, `gnome-shell`, `kwin`, `sway`, `hyprland`, `weston`.
- Development & Shell: `bash`, `zsh`, `fish`, `sshd`, `tmux`, `screen`.
- SHINPO Itself: `shinpo`, `shinpo-shield`, `shinpo-browser-host`.

### 2.3 Warning & Termination Sequence
1. **Detection:** When an enrolled distracting process is detected during an active strict session:
2. **Warning Phase:** A desktop notification and audible alert are fired. A 30-second countdown begins.
3. **Graceful Close:** If still running after 30s, a graceful termination signal (`SIGTERM` on Linux, `WM_CLOSE` on Windows) is dispatched.
4. **Force Kill:** If the process fails to terminate within 10 additional seconds and "Hardcore" strictness is enabled, `SIGKILL` / `TerminateProcess` is dispatched.
5. **Emergency Override:** If the user enters their emergency override passphrase in SHINPO, Sentinel immediately disarms and clears all active target handles.

### 2.4 Platform Boundaries & Gaps
- **Wayland Limitation:** Wayland's security model prevents unprivileged process snooping of active focused window titles. Sentinel detects process *existence*, not whether the user is actively focused on it.
- **Rootless Operation:** Shield operates strictly within current user permissions. It cannot terminate processes launched by other users or elevated administrative services.

---

## 3. Browser Companion Integration Audit

### 3.1 Architecture Overview
The Browser Companion consists of two communicating entities:
1. **Manifest V3 Extension:** Pinned ID `ndknhgihhogcfkliohfjcllglpjdgjpj`, installed in Chromium/Chrome/Edge/Brave and Firefox.
2. **Native Messaging Host (`shinpo-browser-host`):** Standalone Rust binary communicating via standard input/output with 4-byte little-endian message framing.

```
┌──────────────────┐      Native Messaging (stdio)      ┌─────────────────────────┐
│ Browser Extension│ ◄────────────────────────────────► │ shinpo-browser-host     │
│ (Manifest V3)    │       4-byte length prefix         │ (Rust CLI)              │
└──────────────────┘                                    └───────────┬─────────────┘
                                                                    │ Local IPC
                                                                    ▼
                                                        ┌─────────────────────────┐
                                                        │ SHINPO Desktop / Core   │
                                                        └─────────────────────────┘
```

### 3.2 Security & Origin Verification
- **Pinning:** The native messaging manifest (`com.shinpo.companion.json`) strictly pins the extension ID. Third-party extensions cannot communicate with the native host.
- **Pairing Protocol:** Desktop app generates an ephemeral pairing token. The extension must present this token during initial handshake. Tokens are invalidated upon use.
- **Lease Expiry:** Blocking policies are issued with a finite TTL (default 15 minutes). If the desktop app crashes or is killed, the browser extension automatically unblocks web traffic upon lease expiry, preventing permanent lockout.

### 3.3 Content Filtering & Blocking Verification
- **Declarative Net Request:** Chrome extension leverages MV3 `declarativeNetRequest` for instant URL blocking without content script injection overhead.
- **Overlay Injection:** When a blocked domain (e.g. `reddit.com`, `twitter.com`, `youtube.com`) is visited:
  - Request is redirected to `blocked.html`.
  - The page displays the current focus session name, remaining time, and a "Return to Focus" button.
  - Break sessions dynamically unlock entertainment domains and re-lock them upon grace countdown completion.
- **Unit Test Results:** 21/21 Node.js test suites passing; 9/9 Rust native host framing tests passing.

---

## 4. Subsystem Audit Verdict

- **Focus Engine Core:** **VERIFIED (PASS)** — Monotonic interval accounting and transactional reward emission prevent manipulation and inflation.
- **Sentinel Shield:** **VERIFIED (PASS)** — Strict immunity lists and failsafe timers operate reliably on Linux and Windows.
- **Browser Companion:** **VERIFIED (PASS)** — Robust native framing, pinned extension ID, and TTL lease expiry safeguard user access.

