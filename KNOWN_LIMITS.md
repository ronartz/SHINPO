# Known limits

- **Release qualification:** automated unit/E2E checks do not prove actual installed Fedora or Windows workflows. Owner-assisted account, UI, restart, and installer acceptance remain separate evidence.
- **Guardian:** native app observations are consent-gated and warning-only. Automatic application closure is disabled by design to avoid user data loss.
- **Browser Companion:** site policy depends on a live extension/native-host connection. Pairing is local and private via OS native messaging.
- **EONPAI:** deterministic planning works offline; generated model responses can use an optional local Ollama or OpenAI-compatible endpoint.
- **Backups:** a recovery key is for vault passphrase recovery. To backup, copy the application data directory while SHINPO is closed.
- **Security advisories:** RustSec findings remain open and the strict dependency audit is expected to fail; details and expiry are in `docs/qa/RISK_ACCEPTANCE.md`.
- **Windows:** Windows 10/11 x64 NSIS installers, automatic registry native messaging, and hardware-accelerated animations are fully supported in current releases.
