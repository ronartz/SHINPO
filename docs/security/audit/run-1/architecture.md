# Architecture Summary: SHINPO Personal Execution OS

## 1. Product, Principals, Authority, and Protected Resources
SHINPO is a local-first personal execution system and deep focus engine for Linux (x86_64) and Windows (x64). It plans goals, protects attention via browser interventions and application observations, and visualizes verified productivity metrics.

### Principals and Authority:
* **Unauthenticated Workstation User**: Has access to the locked desktop window and the master password/recovery key entry form. Authority is restricted to vault unlocking and account registration.
* **Authenticated Vault Owner**: The user after successful Argon2id passphrase verification. Has full authority over their local goals, focus sessions, tasks, schedules, and custom blocklists.
* **Sandboxed Webview Context**: React 19 UI running inside Tauri's webview. Authority is strictly restricted by Content Security Policy (`connect-src ipc: http://ipc.localhost`) to local Tauri IPC; cannot make arbitrary network requests.
* **Browser Companion Extension**: WebExtension in Chrome, Edge, Brave, or Firefox. Communicates with `shinpo-browser-host` via private OS stdio native messaging. Authority is restricted to reading leased focus policies and requesting single-session exceptions.
* **Local AI Assistant (EONPAI)**: Operates deterministically offline or via local Ollama (`:11434`). Authority is strictly proposal-based: all mutations must be confirmed by the user.

### Protected Resources:
1. **Master Encryption Key & SQLCipher Vault**: Contains user database pages (goals, tasks, focus logs, XP ledger).
2. **One-Time Pairing Challenges & Session Tokens**: High-entropy credentials governing native messaging access.
3. **OS Command Execution & URL Handlers**: Native system shell launcher for external links.
4. **Workstation Process Tree**: Inspected for running distraction applications during active sessions.

## 2. Comparable Software Baseline
Comparable tools include Cold Turkey, Freedom, and Rize. Unlike Cold Turkey (which relies on kernel/driver hooks or closed-source system services to forcibly terminate processes), SHINPO implements consent-verified observation and graceful close requests; force termination only with explicit per-app user consent, along with local SQLCipher database encryption. Unlike cloud tools (Motion, Rize), SHINPO has zero cloud databases, zero telemetry, and operates 100% offline.

## 3. Tech Stack and Execution Limits
* **Frontend**: React 19, TypeScript 5.8, Vite 8.3, Ubuntu typography.
* **Desktop Core**: Tauri 2.0, Rust 1.80+ (2021 edition), SQLCipher 4 (AES-256 page cipher).
* **Browser Host**: Rust stdio native messaging binary (`crates/shinpo-browser-host`).
* **Shield Daemon / Sentinel Core**: Background enforcement and process observation (`crates/shinpo-shield`).
* **WebExtension**: Manifest V3 (Chromium) / Manifest V2/V3 (Firefox).
* **Testing & Build**: Offline `node:test` (255 unit/integration tests) and Cargo test suites (104 tests) execute without network access.

## 4. Entry Surfaces and Lifecycle Paths
1. **Tauri IPC Bridge**: Frontend dispatches commands (`invoke('login')`, `invoke('desktop_open_url')`, `invoke('browser_companion_generate_code')`). Sinks into Rust handlers in `frontend/src-tauri/src/lib.rs` and `native_vault`.
2. **Native Messaging Stdio**: Browser sends 4-byte prefixed JSON requests on `stdin` to `shinpo-browser-host`. Sinks into `run_native_loop()` in `crates/shinpo-browser-host/src/lib.rs`.
3. **External URL Launcher**: `desktop_open_url` receives a URL string and invokes `start`, `xdg-open`, or `open`.
4. **EONPAI AI Ingestion**: Local prompt and structured task proposal generation via `frontend/src-tauri/src/native_vault/eonpai/`.
5. **Guardian Process Scanning**: `sysinfo` queries local process list; compares process names against enrolled distraction catalog.

## 5. Trust Boundaries and Strongest Controls
* **Webview to Native Host Boundary**: Enforced by Tauri IPC parameter serialization, `tauri.conf.json` CSP, and Argon2id vault authorization gates (`require_unlocked_vault!`).
* **Browser to Native Messaging Boundary**: Enforced by native host framing limits (1 MB message cap), 10-minute one-time pairing tokens, and origin matching in browser manifests.
* **Storage Encryption Boundary**: Enforced by SQLCipher AES-256 page encryption and PBKDF2/Argon2id key derivation.
* **Process Execution Boundary**: Enforced by strict URL scheme validation (`http://` and `https://` only) in `desktop_open_url` and disallowing non-browser protocols or shell arguments.
* **AI Mutation Boundary**: Enforced by two-phase proposal and confirmation workflow (`proposeAiAction` &rarr; `confirmAiAction`).

## 6. Repository-Relative Starting Paths
* `frontend/src-tauri/src/lib.rs`: Tauri IPC commands, window setup, and URL opener.
* `frontend/src-tauri/src/native_vault/mod.rs`: Encrypted vault storage, Argon2id auth, and Guardian FSM.
* `frontend/src-tauri/src/native_vault/eonpai/`: AI proposal generation and context binding.
* `crates/shinpo-shield/src/`: Shield daemon, guardian enforcement, and window observation.
* `crates/shinpo-browser-host/src/lib.rs` & `main.rs`: Native host dispatch, config, and stdio framing.
* `crates/shinpo-browser-host/src/framing.rs`: 4-byte buffer allocation and message parsing.
* `crates/shinpo-browser-host/src/registration.rs`: Browser manifest generation and registry writing.
* `browser-extension/src/background-core.js`: WebExtension policy consumption and tab evaluation.

## 7. Prior Coverage & Revalidation Targets
First formal 6-phase audit run (`run-1`). No prior coverage ledger exists. All units are planned fresh.

## 8. Companion Selection Summary
* **DESKTOP-MOBILE-AND-LOCAL-IPC.md**: Covers Tauri IPC command validation, native messaging stdio, and external URL launching.
* **DATA-ISOLATION-AND-LIFECYCLE.md**: Covers SQLCipher encryption, key rewrapping, and vault purging.
* **CLIENT-SIDE.md**: Covers WebExtension origin validation, content script injection, and CSP.
* **AI-AND-LLM.md**: Covers EONPAI proposal confirmation, context redaction, and prompt injection resilience.
* **MEMORY-SAFETY-AND-BINARY.md**: Covers Rust buffer parsing, integer boundaries, and FFI safety.
