# 07 — Rust Shield Complete Map

Crate: `crates/shinpo-shield` (Edition 2021, dependencies: `serde`, `serde_json`, `ureq`, `sysinfo`).

## 1. Modules
- `main.rs`: Daemon entrypoint. Parses CLI arguments (`run`, `status`, `sweep`, `spool`, `--url`, `--token`, `--dry-run`, `--flush`).
- `config.rs`: Loads configuration from JSON files (`shield_config.json`, `/etc/shinpo/shield_config.json`) or CLI flags.
- `client.rs`: REST client wrapper using `ureq`. Calls `/api/device/sentinel/daemon-sync`, `/api/device/sentinel/quarantine`, and `/api/device/sentinel/quarantine/batch`.
- `enforcer.rs`: Scans active OS processes using `sysinfo::System`. Compares names and command lines against blacklist patterns, enforces whitelist precedence, protects JVM internal threads, and triggers platform interceptor.
- `spooler.rs`: Local-first offline JSONL buffer (`daemon/quarantine_spool.jsonl`). Buffers quarantine events when network is down; batch flushes to backend when reconnected.
- `platform/mod.rs`: `PlatformInterceptor` trait defining `terminate_process()`, `notify_user()`, `is_privileged()`, `network_filtering_status()`.
- `platform/linux.rs`: Linux implementation using `nix::sys::signal::kill(SIGTERM/SIGKILL)` for same-UID processes.
- `platform/windows.rs`: Windows implementation using `taskkill /PID <pid> [/F]` and PowerShell Toast Notifications via WinRT.
- `platform/macos.rs`: macOS implementation using POSIX signals and AppleScript notifications.

## 2. Execution Flow
1. `main()` parses CLI options and loads config.
2. Connects to Spring Boot backend `GET /api/device/sentinel/daemon-sync`.
3. Checks `sync.has_active_session`.
4. If session active: scans processes, matches against `sync.blocked_patterns` (overridden by `sync.allowed_patterns`).
5. Calls `interceptor.terminate_process(pid, true)`.
6. Attempts immediate HTTP POST to `/api/device/sentinel/quarantine`.
7. If backend unreachable, writes to `quarantine_spool.jsonl` via `OfflineSpooler`.
8. On next successful sync, flushes entire spool via batch endpoint.
