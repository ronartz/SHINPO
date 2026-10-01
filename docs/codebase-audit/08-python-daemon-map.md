# 08 — Python Daemon Map

File: `daemon/shinpo_shield.py` (Accompanied by `daemon/shinpo-shield.service` systemd unit and `daemon/shield_config.json`).

## 1. Implementation Details
- Uses `psutil` and `requests`.
- Polls Spring Boot backend `/api/device/sentinel/status` and `/api/focus-sessions`.
- When an active focus sprint is detected and sentinel mode is STRICT/LENIENT, iterates running processes and matches against blacklist.
- Calls `proc.terminate()` followed by `proc.kill()`.
- Sends POST to `/api/device/sentinel/quarantine` to record enforcement.

## 2. Role in Repository & Overlap with Rust Shield
- **Overlap**: Directly duplicates the responsibilities of `crates/shinpo-shield`.
- **Historical Context**: The Python daemon was the original prototype implementation in early milestones. `crates/shinpo-shield` was built to replace it with zero-runtime-dependency native binary, offline spooling, and cross-platform hooks.
- **Current Status**: Retained as an alternative/legacy script or reference prototype, but Rust Shield is the primary compiled enforcement engine.
