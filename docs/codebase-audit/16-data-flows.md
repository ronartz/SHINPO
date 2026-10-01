# 16 — Core Data Flows

Concrete step-by-step tracing of primary system data flows:

### Flow 1: Focus Sprint Start to Distraction Quarantine
1. User clicks "Start Sprint" in React UI (`App.tsx`).
2. `focusSessions.ts:startFocusSession(id)` invokes `POST /api/focus-sessions/{id}/start`.
3. `FocusSessionController.java:startSession()` validates user and calls `FocusSessionService.java:startSession()`.
4. `FocusSessionService` updates entity status to `ACTIVE`, persists in PostgreSQL, and invokes `webSocketEventService.broadcastFocusSession(userId, session)`.
5. Rust Shield daemon (`main.rs:handle_run()`) polls `GET /api/device/sentinel/daemon-sync` via `client.rs`.
6. Shield detects `sync.has_active_session == true` and enters lockdown mode.
7. `enforcer.rs` scans processes with `sysinfo::System`. Matches process `discord` against `blocked_patterns`.
8. Invokes `platform/windows.rs:terminate_process(pid, true)` via `taskkill /F /PID <pid>`.
9. Shield reports quarantine via `POST /api/device/sentinel/quarantine` (or spools offline in `quarantine_spool.jsonl`).
10. `SentinelController.java:recordQuarantine()` calls `SentinelEnforcementService.java:recordExternalQuarantine()`.
11. `SentinelEnforcementService` writes record to `sentinel_quarantine_records` table and calls `webSocketEventService.broadcastQuarantine()`.
12. `WebSocketEventService` sends event to `/topic/users/{userId}/sentinel/quarantine`.
13. Frontend STOMP client (`websocket.ts`) receives event, triggers callback in `App.tsx`.
14. Floating toast alert slides onto screen: *"Distraction Intercepted: discord (PID 14210)"* and increments telemetry counter.
