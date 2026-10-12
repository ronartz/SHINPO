# SHINPO Shield Daemon Architecture

## Authoritative Native Enforcement

As of Slice 6.2, the sole authoritative Focus Enforcement daemon for SHINPO is:
- **Rust Native Shield**: Located at `crates/shinpo-shield`
- **Tauri Embedded Integration**: Located at `frontend/src-tauri`
- **Systemd Unit**: `daemon/shinpo-shield.service` (executes `crates/shinpo-shield/target/release/shinpo-shield run`)

## Retired Python Prototype

The legacy Python prototype script (`shinpo_shield.py`) has been permanently retired and disabled.
It defaulted to unauthenticated `userId=1` and did not participate in JWT rotation, offline spooling, or PID revalidation.
- Archived original prototype: `daemon/legacy/shinpo_shield.py`
- Executable stub: `daemon/shinpo_shield.py` (exits immediately with status code 1)

