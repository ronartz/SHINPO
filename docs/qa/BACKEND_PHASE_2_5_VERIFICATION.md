# SHINPO — Backend Phase 2.5 Security Verification Report
## Independent Authentication Security Verification, Invalidation Enforcement & Remaining Risk Closure

**Date:** 2026-10-19  
**Reviewer Role:** Independent Principal Backend Security Auditor & Spring Security Lead  
**Repository Working Tree:** `/home/eonx/Projects/SHINPO`  
**Verdict:** **PHASE 2.5 VERIFIED — READY FOR DEVICE SECURITY**

---

## 1. Executive Summary

Phase 2 implemented initial rate limiting, password safety guards, and tenant-scoped CRUD repositories. However, an independent audit of the local working tree identified four critical architectural vulnerabilities that left the authentication system exposed:

1. **Spoofable Reverse-Proxy Trust:** Clients directly connecting to the backend could forge `X-Forwarded-For`, `X-Real-IP`, or `CF-Connecting-IP` headers to rotate apparent client IPs, bypassing IP-based rate limiting entirely and allowing distributed brute-force attacks. Furthermore, no account-level lockout existed, allowing distributed password spraying across multiple IPs.
2. **Indefinite Access-Token Validity (Revocation Blindspot):** Issued JWT access tokens remained unconditionally valid until expiry (60 minutes). A compromised token or session remained usable even after password change, account deactivation, logout, or refresh-token replay detection.
3. **Rollback Vulnerability in Replay Revocation:** Refresh token rotation family revocation ran inside the caller's transaction context. If an outer transaction rolled back or an unhandled exception occurred, token family revocation was rolled back, allowing attackers to continue exploiting leaked tokens.
4. **WebSocket STOMP Channel Destination Permissiveness:** STOMP subscription and send handlers allowed arbitrary destinations without strict deny-by-default validation.

In Phase 2.5, all four vulnerabilities were remediated in the live codebase, accompanied by regression suites:
- Reverse-proxy header evaluation now requires trusted proxy socket origins (loopback or private container network CIDRs). Direct clients forging proxy headers are stripped down to their physical socket remote address.
- Account-level lockout was added to `RateLimitingService` and integrated into `AuthService.login()`, mitigating distributed credential spraying across rotating IP pools.
- Bound memory limits (`enforceCapacity` capped at 5,000 entries) and background bucket cleanup were instituted in `RateLimitingService`.
- Database schema migration `V21__add_token_version_to_users.sql` added `token_version` to the `users` table.
- JWT access tokens now carry an authoritative `tokenVersion` claim and unique `jti`. `JwtAuthenticationFilter` and `WebSocketConfig` enforce instant invalidation on version mismatch across all 5 user lifecycles (password change, user deactivation, logout-all, refresh replay detection, and single-session logout via `jti` blacklist).
- Refresh token family revocation now executes in isolated `REQUIRES_NEW` transactions, ensuring revoking compromised token families persists even if the outer transaction rolls back.
- WebSocket STOMP inbound interceptor enforces strict deny-by-default for unknown send and subscription destinations.
- **Verification Result:** 361 of 361 backend tests pass (including 12 comprehensive independent security tests in `Phase25IndependentSecurityVerificationTests`) and 65 of 65 frontend tests pass.

---

## 2. Independent Verification Findings

| ID | Category | Initial Finding / Risk | Phase 2.5 Remediation | Status |
|---|---|---|---|---|
| **SEC-25-01** | Rate Limiting | Clients could forge `X-Forwarded-For` or `CF-Connecting-IP` headers to evade rate limits on direct connections. | Added `isTrustedProxy(directIp)`. Forwarded headers are strictly ignored unless direct socket address is loopback (`127.0.0.1`, `::1`) or private container bridge (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`). | **RESOLVED & VERIFIED** |
| **SEC-25-02** | Distributed Spraying | Attackers rotating IPs could spray passwords without hitting per-IP rate limits. | Implemented account-based failed attempt tracker (`recordFailedLoginForAccount`, `isAccountLockedOut`). Accounts lock out for 15 minutes after 5 failed attempts across any IP pool. | **RESOLVED & VERIFIED** |
| **SEC-25-03** | Memory Exhaustion | An attacker generating random spoofed IPs could exhaust heap memory in `RateLimitingService`. | Implemented `enforceCapacity(map)` capping IP tracking maps at 5,000 entries, evicting expired entries and LRU keys when under memory pressure. | **RESOLVED & VERIFIED** |
| **SEC-25-04** | Access-Token Revocation | Access tokens remained active for up to 60 minutes after logout, password change, account disablement, or refresh token replay. | Implemented database column `token_version`, embedded `tokenVersion` in JWT claims, added in-memory `jti` blacklist, and enforced strict version checks in `JwtAuthenticationFilter` and `WebSocketConfig`. | **RESOLVED & VERIFIED** |
| **SEC-25-05** | Replay Revocation Rollback | Token family revocation on replay could be rolled back if an outer transaction encountered an error or rollback. | Executed `revokeFamily` and `incrementTokenVersion` inside an isolated `REQUIRES_NEW` transaction template. Revocation commits independently of surrounding failures. | **RESOLVED & VERIFIED** |
| **SEC-25-06** | STOMP Authorization | WebSocket inbound channel allowed arbitrary or unscoped destinations to be subscribed to without denial. | Enforced deny-by-default in `WebSocketConfig.authorizeSubscribe()` and `authorizeSend()`. Only validated `/topic/users/{id}/**`, `/topic/user.{id}.*`, `/user/**`, and `/app/**` routes are permitted. | **RESOLVED & VERIFIED** |
| **SEC-25-07** | Cross-Tenant Mutation | Multi-tenant isolation required validation across goal deletion and AI action execution endpoints. | Verified endpoints throw `404 Not Found` or `403 Forbidden` and do not alter underlying database state when cross-user IDs are submitted. | **RESOLVED & VERIFIED** |

---

## 3. Reverse-Proxy Trust & Rate-Limiting Assessment

### Direct vs. Proxied Connection Architecture
When SHINPO runs in production behind Caddy, clients communicate with Caddy over HTTPS/WSS, and Caddy proxies traffic to Spring Boot on `127.0.0.1:8080`.
- In this topology, Caddy sets `X-Forwarded-For` and `X-Real-IP`. Because the direct socket connection arrives from `127.0.0.1`, Spring Boot recognizes Caddy as a trusted proxy and parses the leftmost client IP.
- If an attacker bypasses Caddy or directly reaches the Spring Boot container/port, `request.getRemoteAddr()` will reflect the attacker's public IP (e.g. `203.0.113.195`). `isTrustedProxy("203.0.113.195")` evaluates to `false`, causing all spoofed `X-Forwarded-For` or `CF-Connecting-IP` headers to be discarded.

### Account Lockout vs. Source IP Limits
- **Source IP Limits:** 5 failed logins within 15 minutes triggers a 429 response for that source IP.
- **Account Lockout:** 5 failed logins against a single username or email triggers an account lockout for 15 minutes (`Retry-After: 900`), returning HTTP 429 Too Many Requests regardless of whether requests arrive from 1 IP or 50 rotating proxies.
- Successful login resets the account failure counter immediately.

### Concurrency & Memory Safeguards
- State is managed via thread-safe `ConcurrentHashMap` with atomic operations (`compute`, `putIfAbsent`).
- Cleanup runs automatically during each check to evict expired attempts, and capacity enforcement drops the oldest entries if the map exceeds 5,000 active entries.
- **Multi-Node Caveat:** As documented in the architecture specification, `RateLimitingService` operates in-memory per backend container instance. When scaling beyond a single backend node, rate limiting must be fronted by a Redis-backed token bucket or handled at the reverse-proxy layer (e.g., Caddy rate-limit module or Cloudflare).

---

## 4. Access-Token Lifecycle & Invalidation Assessment

### Token Invalidation Architecture
To achieve instant revocation without querying an external cache on every static resource:
1. `User` entity has column `token_version BIGINT NOT NULL DEFAULT 1`.
2. Every generated JWT access token embeds:
   - `tokenVersion`: the user's `tokenVersion` at the moment of issuance.
   - `jti`: unique UUID v4 identifier.
3. On every request, `JwtAuthenticationFilter`:
   - Checks `jwtTokenService.isTokenBlacklisted(token)` (for single-session explicit logout).
   - Loads the user's current record from DB/cache.
   - Rejects the request with HTTP 401 Unauthorized if `tokenVersion == null || !tokenVersion.equals(principal.getTokenVersion())`.
   - Rejects the request if `!user.isActive()`.

### Verification Across 5 User Lifecycles
All five lifecycles were independently verified in `Phase25IndependentSecurityVerificationTests`:
1. **Password Change:** Calling `authService.changePassword()` increments `user.tokenVersion`, invalidating all existing access tokens across all devices immediately.
2. **Account Deactivation:** Setting `user.setActive(false)` causes `JwtAuthenticationFilter` to immediately reject the token with 401 Unauthorized.
3. **Single-Device Logout:** Calling `POST /api/auth/logout` extracts the current access token's `jti` and registers it in `JwtTokenService`'s revocation blacklist until token expiration.
4. **All-Devices Logout:** Calling `authService.logoutAllForUser()` increments `token_version` in the database and revokes all active refresh tokens in `refresh_tokens`.
5. **Refresh Token Replay:** When a revoked refresh token is replayed, the token family is revoked and `user.tokenVersion` is incremented, immediately terminating all active sessions for the compromised user. Unrelated users are completely unaffected.

---

## 5. Refresh-Token Concurrency & Replay-Handling Assessment

### Concurrency & Pessimistic Locking
- Refresh token rotation in `JwtTokenService.rotateRefreshToken()` utilizes Spring `@Transactional` semantics.
- Rapid concurrent refresh attempts with the same token are serialized or rejected safely:
  - The first valid request rotates the token, marks the previous token as revoked, and generates a new pair.
  - Subsequent concurrent or replay attempts encounter `token.isRevoked() == true`, triggering replay detection.

### Isolated Transaction Execution for Replay Revocation
- Previously, replay revocation executed in the ambient transaction. If the caller's transaction was marked rollback-only or threw an exception, the database write revoking the token family would roll back.
- Remediated implementation uses `requiresNewTransactionTemplate.executeWithoutResult(...)`:
```java
Runnable revokeTask = () -> {
    refreshTokenRepository.revokeFamily(familyId);
    if (userRepository != null && userId != null) {
        userRepository.incrementTokenVersion(userId);
    }
};
requiresNewTransactionTemplate.executeWithoutResult(status -> revokeTask.run());
```
- Verified via `testTokenReplayRevocationCommittedDespiteOuterRollback`: even when the transaction rolls back, all tokens in the family remain permanently revoked in PostgreSQL.

---

## 6. Multi-Tenant Authorization & STOMP Destination Security

### WebSocket / STOMP Channel Interceptor
`WebSocketConfig` configures a `ChannelInterceptor` on the client inbound channel:
- **CONNECT:** Extracts Bearer token, validates cryptographic signature, checks blacklist, validates `tokenVersion` matches the active user, and sets authenticated `UserPrincipal`.
- **SEND:** Denies sending to destinations outside `/app/**`. Denies unauthenticated sends.
- **SUBSCRIBE (Deny-by-Default):**
  - Rejects null, blank, or malformed destinations.
  - Rejects legacy global topics (`/topic/focus-sessions`, `/topic/system-status`, `/topic/quarantine`).
  - Allows only user-scoped topics where `{userId}` matches the authenticated user:
    - `/topic/users/{id}/**`
    - `/topic/user.{id}.*`
    - `/user/**`
  - Rejects cross-tenant subscriptions with `AccessDeniedException`.

### REST Data Layer Multi-Tenancy
Independent tests verified cross-tenant isolation on data mutations:
- Alice attempting to delete Bob's goal: `DELETE /api/goals/{bobGoalId}` returns `404 Not Found`. Bob's goal is preserved intact.
- Alice attempting to confirm Bob's AI action: `POST /api/ai/actions/{bobActionId}/confirm` returns `403 Forbidden`. Bob's action status remains `PENDING`.

---

## 7. Logging, Output & Credential Hygiene

A systematic audit of application logging and test outputs was conducted:
- `RateLimitingService`: Logs IP addresses and sanitized account usernames. Never prints passwords, tokens, or hashes.
- `JwtAuthenticationFilter`: Logs user ID and version numbers on mismatch. Never logs raw JWT strings or claims payloads.
- `AuthService`: Employs BCrypt hashing with minimum 10 rounds; passwords longer than 72 bytes are safely rejected with HTTP 400 before passing into the BCrypt buffer.
- `Phase25IndependentSecurityVerificationTests`: Test assertions verify status codes and entity state without outputting authentication bearer tokens or credentials to `stdout` or surefire XML reports.

---

## 8. Code Changes Summary

| File | Change Description |
|---|---|
| `backend/src/main/resources/db/migration/V21__add_token_version_to_users.sql` | Added `token_version BIGINT NOT NULL DEFAULT 1` to `users` table. |
| `backend/src/main/java/com/shinpo/entity/User.java` | Added `tokenVersion` field, getter, setter, and constructors. |
| `backend/src/main/java/com/shinpo/security/UserPrincipal.java` | Added `tokenVersion` to `UserPrincipal` and `create(User user)`. |
| `backend/src/main/java/com/shinpo/repository/UserRepository.java` | Added `@Modifying @Query incrementTokenVersion(Long userId)`. |
| `backend/src/main/java/com/shinpo/security/JwtTokenService.java` | Added `tokenVersion` claim and `jti` to access tokens; added token blacklist; wrapped replay family revocation in `REQUIRES_NEW` transaction template. |
| `backend/src/main/java/com/shinpo/security/JwtAuthenticationFilter.java` | Rejects requests with blacklisted tokens or mismatched `tokenVersion`. |
| `backend/src/main/java/com/shinpo/security/RateLimitingService.java` | Added `isTrustedProxy()`, account-based lockout (`recordFailedLoginForAccount`), and `enforceCapacity()`. |
| `backend/src/main/java/com/shinpo/service/AuthService.java` | Injected `RateLimitingService`, integrated account lockout into `login()`, added `@Autowired` to constructor, and incremented `user.tokenVersion` in `changePassword()`. |
| `backend/src/main/java/com/shinpo/controller/AuthController.java` | Injected `JwtTokenService` to blacklist access tokens on `POST /api/auth/logout`. |
| `backend/src/main/java/com/shinpo/config/WebSocketConfig.java` | Enforced deny-by-default on STOMP SUBSCRIBE and SEND commands, and checked `tokenVersion` and blacklist on CONNECT. |
| `backend/src/test/java/com/shinpo/security/Phase25IndependentSecurityVerificationTests.java` | Created 12 targeted verification tests covering proxy trust, account lockout, access token invalidation across all 5 lifecycles, replay rollback isolation, and multi-tenant security. |

---

## 9. Test Execution Evidence & Commands

### 1. Independent Security Verification Suite
```bash
cd /home/eonx/Projects/SHINPO/backend
./mvnw test -Dtest=Phase25IndependentSecurityVerificationTests
```
**Output:**
```
[INFO] Running com.shinpo.security.Phase25IndependentSecurityVerificationTests
[INFO] Tests run: 12, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 12.63 s
[INFO] BUILD SUCCESS
```

### 2. Full Backend Regression Suite
```bash
cd /home/eonx/Projects/SHINPO/backend
./mvnw test
```
**Output:**
```
[INFO] Tests run: 361, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
[INFO] Total time: 01:04 min
```

### 3. Frontend Contract Regression Suite
```bash
cd /home/eonx/Projects/SHINPO/frontend
npm test -- --run
```
**Output:**
```
ℹ tests 65
ℹ suites 7
ℹ pass 65
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 616.425755
```

---

## 10. Residual Risks & Next Steps

1. **Multi-Node In-Memory Limiter:**  
   The current rate limiter and single-device access-token blacklist reside in JVM heap memory. For multi-node cloud deployments behind a round-robin load balancer, a Redis-backed or database-backed cache should replace the in-memory maps, or rate limiting should be delegated to Caddy / API gateway. For the immediate target of 4 independent users on a single shared cloud instance, the in-memory architecture is fully robust and performant.
2. **Device Security Phase Readiness:**  
   With the shared backend boundary hardened against proxy spoofing, credential stuffing, stale access token replay, and cross-tenant leakage, the backend is now ready for local client device authentication, local Rust Shield registration, and companion pairing in Phase 3.

---

## 11. Final Verdict

# **PHASE 2.5 VERIFIED — READY FOR DEVICE SECURITY**

All Phase 2.5 independent security requirements, invalidation lifecycles, rate-limiting boundaries, and regression suites have been implemented, tested, and validated with zero failures across 361 backend tests and 65 frontend tests.

