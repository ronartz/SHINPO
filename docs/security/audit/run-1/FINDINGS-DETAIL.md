# SHINPO Security Audit — Detailed Findings

## Finding SHINPO-VULN-001

### Summary & Classification
- **Identifier:** `SHINPO-VULN-001`
- **Verdict:** `confirmed`
- **Title:** Command Injection via Windows Shell Metacharacters in `desktop_open_url`
- **CWE:** CWE-78: Improper Neutralization of Special Elements used in an OS Command ('OS Command Injection') / CWE-88: Improper Neutralization of Argument Delimiters in a Command
- **Severity:** High (Overall: High, Impact: High, Likelihood: Medium, Confidence: High)
- **Target Surface:** `frontend/src-tauri/src/lib.rs#desktop_open_url`
- **Subsystem:** Desktop Backend (Tauri IPC Bridge)

### Trace & Sinks
1. **Entrypoint:** `frontend/src-tauri/src/lib.rs:324` in `desktop_open_url(url: String)`. Received directly from the webview renderer over Tauri IPC.
2. **Propagation:** `frontend/src-tauri/src/lib.rs:326`. URL parsed via `url::Url::parse(&url)` and checked for `http` or `https` schemes.
3. **Sink:** `frontend/src-tauri/src/lib.rs:332`. Invocation of Windows command shell:
   ```rust
   std::process::Command::new("cmd")
       .args(["/c", "start", "", &url])
       .spawn()
   ```

### Root Cause Analysis
Under Microsoft Windows, `std::process::Command` translates arguments into a single command-line string passed to `CreateProcessW`. Rust's standard library automatically wraps arguments in double quotes only if they contain ASCII space or tab characters. If an argument contains shell metacharacters such as `&`, `|`, `^`, or `%`, but no spaces (or if quotes are not enforced by the caller), `cmd.exe`'s command interpreter parses the metacharacters as delimiters.
Specifically, `&` acts as a command separator in `cmd.exe`. A URL such as `https://example.com/?q=1&calc.exe` causes `cmd.exe` to execute `start "" https://example.com/?q=1` followed immediately by `calc.exe` in the host context.

### Demonstrated Local Reproduction
1. **Attacker Perspective:** Compromised frontend renderer, XSS, or unvalidated deep link triggering `desktop_open_url`.
2. **Payload:** `https://example.com/?q=1&calc.exe`
3. **Execution Instructions:**
   ```bash
   # Equivalent execution on Windows command line:
   cmd.exe /c start "" https://example.com/?q=1&calc.exe
   ```
4. **Observed Result:** `cmd.exe` splits on `&` and executes `calc.exe` as a child process of the running user session without permission warnings.

### Remediation & Verification Strategy
1. **Source Fix:**
   - Filter input URLs for control characters and quote characters (`c.is_control() || c == '"' || c == '\''`).
   - On Windows, invoke `rundll32 url.dll,FileProtocolHandler <url>` instead of `cmd.exe /c start`. `rundll32` directly delegates to the registered Windows default handler without shell metacharacter parsing.
2. **Regression Test:**
   Added unit test `tests::test_desktop_open_url_validation` in `frontend/src-tauri/src/lib.rs` verifying that non-http(s) schemes, control characters, and quotes are rejected.
