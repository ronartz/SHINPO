# Standalone Desktop Runtime

## Runtime boundary

The local desktop application is a Tauri v2 shell containing a React frontend and native Rust services. The local account path invokes Rust through Tauri IPC and stores account data in an encrypted SQLCipher database under Tauri's per-user application-data directory. Account paths are derived by Tauri; do not assume a fixed path across operating systems or packaging formats.

Spring Boot, PostgreSQL, Docker, and a local HTTP server are not required for the local-vault application flow. The legacy backend remains in the repository for parity and migration work. A local operation must fail visibly if its native IPC operation fails; it must not silently fall back to the legacy HTTP service.

Production WebView connectivity is restricted by the CSP in `frontend/src-tauri/tauri.conf.json` to Tauri IPC origins. Development-server access is configured separately. Optional EONPAI provider requests are made by the native provider service when the user configures a provider; no provider is required for deterministic offline planning.

## Local data and secrets

The encrypted vault and its metadata are stored below the platform-specific Tauri app-data directory. The password and recovery key wrap the database key; the recovery key is not an independent backup. Back up the complete SHINPO application-data directory only while SHINPO is closed, and protect the copy as sensitive data. A transactional export/restore flow is not currently qualified.

Provider credentials use the operating system credential store where supported. Credential-store availability and provider connectivity are runtime-dependent and must be reported as unavailable when they fail.

## Guardian and Browser Companion

- Native Guardian application handling is **warning-only**. It records consented observations; the desktop application does not automatically terminate processes.
- The Linux native capability is observation and warning. Windows Guardian is reported unavailable by the platform capability command.
- Browser Companion site policy requires a supported browser extension, a registered native-messaging host, successful pairing, and an active connection. A local saved pairing is not a live-connection signal.
- Do not infer that apps or websites are blocked from a Focus session being active.

## Useful commands

```bash
npm run tauri:dev
cargo run --locked --manifest-path frontend/src-tauri/Cargo.toml --bin shinpo-desktop -- --smoke-test
npm run check:all
```

The smoke-test command creates and removes its own unique disposable profile under the system temporary directory. It never opens the normal app-data directory.

## Legacy runtime

`backend/`, database migrations, Docker files, and legacy HTTP clients are retained while parity and historical migration requirements are being resolved. Their presence in the source tree does not mean the standalone local-vault desktop path starts or requires them. Do not delete legacy migrations or user data as part of normal desktop startup.
