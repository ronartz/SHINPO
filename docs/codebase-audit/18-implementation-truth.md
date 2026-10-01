# 18 — Implementation Truth Table

| Subsystem / Feature | Current Implementation | Key Source Files | Runtime Path | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Authentication & JWT** | Implemented with BCrypt, 15m access token, 7d refresh token rotation | `AuthService.java`, `JwtTokenService.java`, `SecurityConfig.java` | `/api/auth/*` | IMPLEMENTED |
| **Goals & Missions** | Implemented with Flyway tables, cascade completions, XP progression | `GoalService.java`, `MissionService.java`, `GoalController.java` | `/api/goals/*`, `/api/missions/*` | IMPLEMENTED |
| **Focus Sessions** | Implemented with state transitions (ACTIVE, PAUSED, COMPLETED, CANCELLED) | `FocusSessionService.java`, `FocusSessionController.java` | `/api/focus-sessions/*` | IMPLEMENTED |
| **Sentinel Enforcement** | Implemented with policy locking, sweep, external quarantine ingestion | `SentinelEnforcementService.java`, `SentinelController.java` | `/api/device/sentinel/*` | IMPLEMENTED |
| **Real-Time WebSockets**| Implemented with STOMP over WebSocket, JWT handshake interceptor, live toasts | `WebSocketConfig.java`, `WebSocketEventService.java`, `websocket.ts`, `App.tsx` | `/ws`, `/topic/users/{id}/*` | IMPLEMENTED |
| **EONPAI AI Engine** | Implemented with Ollama local inference, fallback heuristics, context engine, tools | `OllamaAiProvider.java`, `ContextEngine.java`, `AiToolRegistry.java`, `AiService.java` | `/api/ai/*` | IMPLEMENTED |
| **Rust Shield Daemon** | Implemented with offline JSONL spooling, cross-platform interceptors | `crates/shinpo-shield/src/main.rs`, `enforcer.rs`, `spooler.rs` | Local OS Daemon -> REST Sync | IMPLEMENTED |
| **Executive Dashboard** | Implemented with Bento grid, dynamic charts, theme toggling | `App.tsx`, `App.css`, `analytics.ts` | Frontend UI | IMPLEMENTED |
| **Python Shield** | Legacy prototype script | `daemon/shinpo_shield.py` | Local daemon | LEGACY |
| **WFP Kernel Driver** | Pre-configured architecture stubs in Rust Windows platform | `crates/shinpo-shield/src/platform/windows.rs` | Windows WFP | DOCUMENTED ONLY |
