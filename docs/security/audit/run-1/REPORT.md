# SHINPO Security Audit Report (Run 1)

## Executive Summary & Scope

- **Target System:** SHINPO (進歩) — Personal Execution OS
- **Source Reference:** `5d53af574a30be9d26c9962f14c24306df8ce127`
- **Audit Profile:** Standard 6-Phase Formal Audit
- **Execution Boundary:** Source-and-local only. No external networks, no live remote services, zero destructive payloads.
- **Coverage Summary:**
  - Audited Units: 5
  - Covered Units: 4
  - Candidate Units (Findings): 1
  - Blocked / Deferred Units: 0
  - Unresolved Leads: 0

### Security Posture Summary

SHINPO demonstrates exceptional foundational security architecture across its primary sensitive surfaces:
1. **At-Rest Vault Encryption:** The SQLCipher storage model in `native_vault.rs` properly enforces Argon2id key derivation, bounds password work factors, performs dummy work on non-existent accounts to eliminate timing side-channels, and verifies zero plaintext leakage on disk.
2. **Native Messaging IPC:** The `shinpo-browser-host` companion strictly caps incoming stdio frames to 1MB, validates 4-byte LE framing, generates cryptographically random 32-byte pairing challenges, expires challenges after 10 minutes, and performs constant-time token verification via `subtle::ct_eq`.
3. **AI Planning Guardrails:** EONPAI strictly implements two-phase action proposals where model actions propose data revisions without mutating the database, requiring explicit user confirmation before any transaction is committed.
4. **Focus Guardian Containment:** The shield daemon strictly respects consent-based enforcement, checks protected process immunity, and never escalates graceful exit requests to force without verified user consent.

One **High** severity command argument injection vulnerability was confirmed on Microsoft Windows in `desktop_open_url` and has been completely remediated and regression-tested.

---

## Confirmed Findings

| ID | Title | Severity | Likelihood | Impact | Affected Boundary | Observed Result |
|---|---|---|---|---|---|---|
| `SHINPO-VULN-001` | Command Injection via Windows Shell Metacharacters in `desktop_open_url` | **High** | Medium | High | Tauri IPC Command Boundary | Shell metacharacters (`&`, `\|`) escape `cmd.exe` argument parsing to execute host commands in user context |

### Finding `SHINPO-VULN-001` Details

- **Location:** `frontend/src-tauri/src/lib.rs:324-337`
- **Root Cause:** On Windows, `desktop_open_url` spawned `cmd.exe` via `std::process::Command::new("cmd").args(["/c", "start", "", &url])`. Because Rust's standard library on Windows only automatically adds enclosing quotes to arguments containing whitespace, unquoted URLs with shell metacharacters such as `&` or `|` allowed command chaining in `cmd.exe`.
- **Lower-Trust Principal:** Renderer webview or external URL trigger.
- **Preconditions:** Host running Microsoft Windows.
- **Remediation Applied:** 
  1. Strict input validation rejecting URLs containing control characters (`\n`, `\r`, `\0`) or shell quotes (`"`, `'`).
  2. Replaced `cmd.exe /c start` invocation on Windows with direct execution of `rundll32 url.dll,FileProtocolHandler <url>`, bypassing shell command interpretation entirely.
  3. Added unit regression test `test_desktop_open_url_validation` in `frontend/src-tauri/src/lib.rs`.

---

## Needs Validation

No items currently require external or live-deployment validation. All audited hypotheses were resolved decisively with source and local unit verification.

---

## Coverage Ledger Summary

| Subsystem | Surface | Boundary | Attack Class | Status | Verified Invariant |
|---|---|---|---|---|---|
| Desktop Backend | Desktop IPC URL Handler | Tauri IPC Command Boundary | Command Injection | `covered` | External URLs must never escape to shell execution (remediated with tauri-plugin-opener) |
| Browser Host | Browser Native Messaging | Stdio Framing Boundary | Protocol Framing Bypass | `covered` | Stdio buffer bounds capped at 1MB; malformed framing rejected |
| Native Vault | SQLCipher Storage | Argon2id KDF Boundary | Cryptographic Key Storage | `covered` | Zero plaintext on disk; Argon2id KDF enforced |
| AI Assistant | EONPAI Ingestion | Two-Phase Confirmation | Model Action Abuse | `covered` | AI proposals cannot mutate state without explicit user confirmation |
| Shield Daemon | Focus Guardian Enforcer | Process Identity Boundary | Unauthorized Termination | `covered` | System/unconsented processes cannot be terminated |
