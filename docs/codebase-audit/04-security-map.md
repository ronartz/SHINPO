# 04 — Security Complete Map

This document maps the end-to-end authentication, authorization, and security architecture.

## 1. Authentication Lifecycle
1. **Registration**: `POST /api/auth/register` -> `AuthService.register()` -> `BCryptPasswordEncoder` -> `User` entity -> auto-seeds starter Goal & Mission -> Generates JWT Access Token (15m) & Refresh Token (7d).
2. **Login**: `POST /api/auth/login` -> `AuthService.login()` -> `userRepository.findByUsername() || findByEmail()` -> `passwordEncoder.matches()` -> JWT Access & Refresh Token.
3. **Filter**: `JwtAuthenticationFilter` intercepts requests on `OncePerRequestFilter` -> resolves `Bearer <token>` -> `jwtTokenService.extractUserId()` -> `CustomUserDetailsService.loadUserById()` -> sets `SecurityContextHolder.getContext().setAuthentication(authentication)`.
4. **User Principal**: `UserPrincipal` implements `UserDetails`, exposes `getId()`, `getUsername()`, `getAuthorities()`.
5. **Controller Injection**: Controllers inject `@AuthenticationPrincipal UserPrincipal principal`.
6. **Token Rotation**: `POST /api/auth/refresh` -> SHA-256 hashed refresh token validated in `refresh_tokens` table -> revokes old token -> generates new TokenPair.
7. **Logout**: `POST /api/auth/logout` -> revokes refresh token in database.

## 2. Authorization & Ownership Enforcements
- **GoalService**: Checks `goal.getUser().getId().equals(userId)` before update/delete.
- **MissionService**: Checks `mission.getGoal().getUser().getId().equals(userId)`.
- **FocusSessionService**: Checks `session.getUser().getId().equals(userId)`.
- **SentinelEnforcementService**: Binds quarantines to `userRepository.findById(userId)`.

## 3. WebSocket Security
- Configured in `WebSocketConfig.java`.
- Handshake endpoint `/ws` permitted in `SecurityConfig.java`.
- ChannelInterceptor intercepts `StompCommand.CONNECT` frames.
- Extracts `Authorization: Bearer <token>` or `token: <token>` from STOMP headers.
- Sets authenticated user principal on STOMP session.
