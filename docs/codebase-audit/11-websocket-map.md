# 11 — WebSocket Complete Map

Built on Spring Boot STOMP Message Broker and React `@stomp/stompjs` client.

## 1. Backend Configuration (`backend/src/main/java/com/shinpo/config/WebSocketConfig.java`)
- Handshake endpoint: `/ws` (native WebSocket and SockJS fallback).
- Destination prefixes: `/topic` (broadcasting) and `/queue` (user point-to-point).
- Authentication: `ChannelInterceptor` extracts JWT from `CONNECT` headers (`Authorization` or `token`).

## 2. Broadcast Service (`backend/src/main/java/com/shinpo/service/WebSocketEventService.java`)
| Destination Topic | Event DTO | Trigger / Producer |
| :--- | :--- | :--- |
| `/topic/users/{userId}/sentinel/quarantine` | `SentinelQuarantineEvent` | Distraction process killed by Sentinel or reported by Shield |
| `/topic/users/{userId}/sentinel/status` | `SentinelStatusEvent` | Enforcement mode changed, policy gate locked/unlocked |
| `/topic/users/{userId}/focus-session` | `FocusSessionEvent` | Sprint started, paused, resumed, completed, cancelled |

## 3. Frontend Client (`frontend/src/api/websocket.ts` & `App.tsx`)
- Subscribes upon user login with JWT auth.
- Updates live alerts notification drawer.
- Triggers glowing floating toast alerts.
- Synchronizes sprint countdown timer across multiple open tabs.
