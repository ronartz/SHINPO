# Security policy

SHINPO is not claimed to be unhackable or completely secure. The local desktop vault uses SQLCipher with a password/recovery-wrapped data key. The React frontend is treated as untrusted at native IPC boundaries, and the production Tauri WebView uses a restrictive content security policy.

## Reporting

Report suspected vulnerabilities privately to the repository owner through the repository's configured private security contact. Do not include real vaults, passwords, recovery keys, API keys, browser profiles, or personal task data in a report. Use a disposable profile to reproduce issues.

## Current limitations

The strict Rust dependency audit currently reports unresolved upstream advisories; see `docs/qa/RISK_ACCEPTANCE.md`. Guardian app intervention is warning-only. Windows runtime qualification, signed updater verification, and encrypted backup/restore are not established by source tests alone. Consult `KNOWN_LIMITS.md` and the current QA release gate before relying on these capabilities.
