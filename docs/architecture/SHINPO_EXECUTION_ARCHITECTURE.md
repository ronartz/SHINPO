# SHINPO Execution & Policy Architecture

**Status:** Authoritative Local-First Desktop Execution Architecture  
**Platforms:** Linux & Windows

---

## 🏛️ 1. Authority and Data Flow

```text
React 19 Desktop UI ── Tauri IPC (Bridge) ── Native Rust Core (Tauri 2)
                                                │
                                                ├── AES-256 SQLCipher Local Vault
                                                │   └── Offline Sessions, Goals & XP
                                                │
                                                └── Policy Engine (Leased Snapshot)
                                                        │
                                                        v (stdio)
                                            shinpo-browser-host (Rust)
                                                        │
                                                        v
                                            Chrome / Edge / Brave / Firefox
                                            WebExtension Companion
```

In SHINPO:
1. **The Native Rust Core & Encrypted SQLCipher Vault** own session identity, phase transitions, Pomodoro timing deadlines, idempotent reward events, and policy revisions locally on the user's computer.
2. **No remote backend, no Spring Boot, and no PostgreSQL server** are required. Everything is 100% self-contained and operates completely offline.
3. The **`shinpo-browser-host`** binary communicates via standard input/output (`stdio`) with browser extensions using OS-native messaging (`com.shinpo.browser_companion`).
4. The extension enforces distraction blocking and presents intervention overlays based on the leased policy snapshot without modifying local timers or calculating XP.

---

## ⏱️ 2. Focus Lifecycle and Synchronization

* Supported lifecycle states:
  * `FOCUS`: Active focus block; designated distraction websites and apps are blocked.
  * `SHORT_BREAK` / `LONG_BREAK`: Timed breaks where approved break websites are permitted.
  * `GRACE`: Safe transition period before returning to focus or completing the block.
  * `PAUSED`: Timer frozen; distraction checks held in place.
  * `COMPLETED`: Session finished; XP and stats awarded transactionally to the local vault ledger.
* Countdown timing uses the native core's monotonic clock (`max(0, deadline - current_time)`), eliminating cumulative JavaScript timer drift when tabs or windows are in the background.

---

## 🛡️ 3. Safety and Enforcement Integrity

* **Warning-Only Guardian**: Focus Guardian alerts and prompts the user when distraction applications or websites are visited during active focus. SHINPO never force-terminates applications, guaranteeing zero user data loss.
* **Local Sandboxing**: Pairing keys are generated on-the-fly and expire in 10 minutes. Only the authorized extension instance on the local device can access the active policy.
* **Zero Telemetry**: No browsing URLs, keystrokes, or screen contents ever leave your workstation.

---

## 📂 4. Source Locations

* **Native Vault & FSM**: [frontend/src-tauri/src/native_vault/](file:///home/eonx/Projects/SHINPO/frontend/src-tauri/src/native_vault/)
* **Browser Host**: [crates/shinpo-browser-host/](file:///home/eonx/Projects/SHINPO/crates/shinpo-browser-host/)
* **Browser Companion Extension**: [browser-extension/](file:///home/eonx/Projects/SHINPO/browser-extension/)
* **Desktop UI & Views**: [frontend/src/](file:///home/eonx/Projects/SHINPO/frontend/src/)
