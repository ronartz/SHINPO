# SHINPO

SHINPO is a local-first desktop productivity application for organizing goals and tasks, planning focus sessions, reviewing progress, and optionally using EONPAI. The desktop client is built with React 19, TypeScript, Tauri v2, Rust, and an encrypted SQLCipher vault.

## Runtime model

The local desktop account path uses Tauri IPC and native Rust persistence. It does not require Spring Boot, PostgreSQL, Docker, or any external server infrastructure. All user data, goals, tasks, focus sessions, telemetry, and settings are stored locally in an encrypted SQLCipher vault.

EONPAI can provide deterministic offline planning. Model-generated responses require a separately configured provider; enabling a remote provider sends the request context to that provider. Guardian application handling is warning-only. Browser website policy is effective only while the Browser Companion is installed, paired, and connected; a saved pairing alone does not prove a live connection.

## Development

Requirements: Node.js/npm, Rust/Cargo, and the platform prerequisites for Tauri v2 and WebKitGTK/WebView2.

```bash
npm ci
npm run tauri:dev
```

Run the isolated native persistence smoke test without opening a window:

```bash
cargo run --locked --manifest-path frontend/src-tauri/Cargo.toml --bin shinpo-desktop -- --smoke-test
```

Run the consolidated local quality gate:

```bash
npm run check:all
```

The gate includes frontend and Rust checks, SQLCipher regressions, a disposable native persistence smoke test, layout E2E contracts, dependency audits, and stale-artifact checks. Known RustSec findings intentionally fail the security gate; see [`docs/qa/RISK_ACCEPTANCE.md`](docs/qa/RISK_ACCEPTANCE.md).

## Repository map

- `frontend/` — React UI, Tauri shell, and native Rust application with embedded SQLCipher vault.
- `crates/shinpo-shield/` — process observation and identity helpers; desktop Guardian remains warning-only.
- `crates/shinpo-browser-host/`, `browser-extension/` — native-messaging host and browser companion.
- `daemon/` — systemd service configuration for native shield daemon.
- `docs/` — architecture, installation, privacy, security, known limits, and QA evidence.

## Qualification status

Automated tests and a headless SQLCipher workflow do not establish real WebView, installer, browser-pairing, or cross-platform runtime acceptance. See [`docs/qa/latest-release-gate.md`](docs/qa/latest-release-gate.md) and [`KNOWN_LIMITS.md`](KNOWN_LIMITS.md) for current evidence and open gates. No release-readiness claim is made here.
