# 09 — Sentinel & Enforcement Architecture Map

SHINPO features four distinct enforcement layers spanning backend, OS daemon, and frontend UI.

## 1. Enforcement Matrix Comparison

| Feature | Java Task Manager | Java Sentinel | Rust Shield | Python Shield |
| :--- | :--- | :--- | :--- | :--- |
| **Location** | `TaskManagerService.java` | `SentinelEnforcementService.java` | `crates/shinpo-shield` | `daemon/shinpo_shield.py` |
| **Discovery** | `ProcessHandle.allProcesses()` | `ProcessHandle.allProcesses()` | `sysinfo::System` | `psutil.process_iter()` |
| **Termination** | `handle.destroy() / destroyForcibly()` | `handle.destroyForcibly()` | Native `taskkill / kill(SIGKILL)` | `proc.kill()` |
| **Policy Source**| Ad-hoc PID request | DB `sentinel_policy_rules` | Sync from DB + Local Fallback | Sync from DB + Local JSON |
| **Enforcement Mode** | Unrestricted (manual) | OFF, AUDIT, LENIENT, STRICT | STRICT / Dynamic from backend | STRICT / Dynamic from backend |
| **Emergency Override** | N/A | Supported (`isPolicyLocked=false`) | Respects backend lock state | Respects backend lock state |
| **Offline Buffering** | None | In-memory DB | `quarantine_spool.jsonl` | None |
| **WebSocket Broadcast** | None | Emits `SentinelQuarantineEvent` | Broadcasted via backend ingest | Broadcasted via backend ingest |
