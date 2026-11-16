# Known limits

- **Release qualification:** automated unit/E2E checks do not prove actual installed Fedora or Windows workflows. Owner-assisted account, UI, restart, and installer acceptance remain separate evidence.
- **Guardian:** native app observations are consent-gated and warning-only. Automatic application closure is disabled. Windows Guardian is reported unavailable. No claim of foreground-time measurement is made for Fedora Wayland.
- **Browser Companion:** site policy depends on a live extension/native-host connection. Current-branch live pairing and policy teardown must be verified against the exact candidate; older reports are historical evidence only.
- **EONPAI:** deterministic planning works offline; generated model responses require an optional provider. Remote providers receive the request context when enabled. Provider availability is not guaranteed.
- **Backups:** a recovery key does not create a backup. Encrypted export/restore is not qualified. Copy the whole app-data directory only while the app is closed and keep the copy private.
- **Security advisories:** RustSec findings remain open and the strict dependency audit is expected to fail; details and expiry are in `docs/qa/RISK_ACCEPTANCE.md`.
- **Windows:** hosted compilation is not equivalent to installing or running SHINPO on Windows. Platform runtime status must be taken from the release gate, not inferred from a Linux build.
