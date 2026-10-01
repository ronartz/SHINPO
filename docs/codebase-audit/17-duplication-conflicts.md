# 17 — Duplication and Conflicts Map

Concrete record of architectural overlaps, duplicated functionality, and discrepancies:

## 1. Process Enforcement Redundancy
- `crates/shinpo-shield` (Rust) and `daemon/shinpo_shield.py` (Python) duplicate the same enforcement daemon behavior. Rust is the active, high-performance, cross-platform implementation. Python is the legacy prototype.
- `TaskManagerService.java` provides ad-hoc process killing from the web backend via JVM `ProcessHandle`, whereas `SentinelEnforcementService.java` enforces policy rules, and `shinpo-shield` enforces OS-level rules locally on the client.

## 2. API Base URL Resolution
- In `frontend/src/api/*.ts`, relative `/api` paths were originally written assuming a local Vite dev proxy. For a desktop distribution communicating with a remote server, centralizing the base URL resolution via `config.ts` prevents endpoint fragmentation.

## 3. JWT Expiration Documentation Discrepancy
- Early design docs stated Access Token validity was 24 hours. The actual implementation in `JwtTokenService.java` enforces a secure 15-minute access token lifespan with 7-day refresh token rotation. The implementation is authoritative.
