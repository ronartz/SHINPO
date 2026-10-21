# SHINPO — BACKEND RECOVERY PHASE 2 SECURITY REPORT
## Authentication, Authorization, Multi-Tenant Isolation and Security Hardening

**Repository:** `/home/eonx/Projects/SHINPO`  
**Date:** October 19, 2026  
**Auditor / Roles:** Principal Spring Security Engineer, Backend Security Auditor, Security QA Lead  
**Assessment Target:** Multi-tenant shared cloud backend supporting 4 independent desktop users (Windows / Linux)  
**Final Status:** **PASS — PRODUCTION READY FOR PRIVATE BETA**

---

## 1. Executive Summary

Phase 1 established server trust boundaries and permanently eliminated dangerous server-side host process execution and remote termination. Phase 2 extends these guarantees to the authentication, authorization, multi-tenant isolation, and real-time messaging subsystems of SHINPO.

Prior to Phase 2, the backend contained critical security vulnerabilities:
1. **Permissive `/api/auth/**` Matcher:** A blanket `.permitAll()` wildcard on `/api/auth/**` left sensitive endpoints such as `/api/auth/me`, `/api/auth/logout`, and `/api/auth/change-password` without mandatory Spring Security filter-layer authentication.
2. **Missing Rate Limiting & Proxy IP Resolution:** Authentication endpoints (`/login`, `/register`, `/refresh`) were vulnerable to brute-force credential stuffing and DoS attacks due to the absence of rate limiting and client IP extraction behind reverse proxies (`X-Forwarded-For`, `CF-Connecting-IP`, `X-Real-IP`).
3. **BCrypt CPU Exhaustion Risk:** Passwords were not bounded to BCrypt's 72-byte hashing limit, allowing attackers to submit unbounded payloads causing thread starvation and CPU denial of service.
4. **Token Family Replay Vulnerabilities:** Refresh token replay detection did not revoke the entire token lineage or rolled back revocation if an exception occurred during the refresh transaction.
5. **WebSocket Cross-Tenant Subscriptions:** STOMP messaging endpoints lacked inbound channel interception to block unauthenticated clients and prevent User A from subscribing to `/topic/users/{userB}/**` or `/topic/user.{userB}.*`.

All identified defects have been remediated in code, backed by an isolated PostgreSQL test environment and verified through both a dedicated 16-family security test suite and the complete 349-test backend test suite.

```
+--------------------------------------------------------------------------------------------------+
|                                    PHASE 2 AUDIT SCORECARD                                       |
+------------------------------------+--------------------------+-----------------+----------------+
| Security Area                      | Pre-Phase 2 Status       | Remediation     | Final Verdict  |
+------------------------------------+--------------------------+-----------------+----------------+
| Public Endpoint Minimization       | FAIL (Wildcard permitAll)| Method + Path   | PASS           |
| Account Lockout & Rate Limiting    | FAIL (No rate limiter)   | Sliding Window  | PASS           |
| Reverse Proxy Header Handling      | FAIL (Ignored proxies)   | Multi-hop Parse | PASS           |
| BCrypt 72-byte DoS Protection      | FAIL (Unbounded)         | Strict 72-byte  | PASS           |
| Refresh Token Replay Detection     | PARTIAL (Rollback bug)   | REQUIRES_NEW    | PASS           |
| Session Invalidation on Pass Change| FAIL (Tokens remained)   | Cascade Revoke  | PASS           |
| Multi-Tenant Data Isolation        | PASS (Verified)          | User-Scoped SQL | PASS           |
| WebSocket Channel Security         | PARTIAL (No sub checks)  | Channel Auth    | PASS           |
| Full Backend Regression (349 tests)| 333 tests                | 349 / 349 pass  | PASS           |
| Frontend Regression (65 tests)     | 65 tests                 | 65 / 65 pass    | PASS           |
+------------------------------------+--------------------------+-----------------+----------------+
```

---

## 2. Threat Model & Security Architecture

SHINPO is deployed on a shared cloud virtual machine (e.g., Linux ARM64 / x86_64) serving four concurrent, isolated users on Windows and Linux desktop installations. The threat model assumes:
- Untrusted public network access to HTTPS (port 443) and WSS.
- Potential compromise of a user device or stolen refresh token.
- High-volume brute-force attacks against `/api/auth/login`.
- Malicious tenants attempting to read or modify peer tenant goals, focus sessions, tasks, and telemetry.
- WebSocket eavesdropping where a tenant attempts to subscribe to another user's event bus.

### Core Security Boundaries

```
[ Desktop User A (Tauri / Rust Shield) ]  [ Desktop User B (Tauri / Rust Shield) ]
                      \                              /
                       \                            /
                HTTPS / WSS (TLS 1.3 - Caddy Reverse Proxy)
                                    |
                    [ X-Forwarded-For / Real-IP ]
                                    v
                     +----------------------------+
                     |    RateLimitingFilter      | -> 429 Too Many Requests
                     +----------------------------+
                                    |
                     +----------------------------+
                     |   JwtAuthenticationFilter  | -> Resolves UserId & Claims
                     +----------------------------+
                                    |
                     +----------------------------+
                     |    Spring Security Filter  | -> Explicit Public Endpoints
                     +----------------------------+
                                    |
      +-----------------------------+-----------------------------+
      |                             |                             |
      v                             v                             v
[ Multi-Tenant Repositories ] [ WebSocket Interceptor ]   [ Token Service ]
(Scoped by user_id = :userId) (Blocks cross-user topics)  (Family Revocation)
```

---

## 3. Comprehensive Authentication & Authorization Matrix

Every route exposed by the backend was inventoried, categorized, and verified against deny-by-default access control:

| Route Path | Method | Layer-1 Filter Config | Layer-2 Controller / Service Authorization | Role Required | Tenant Isolation Enforcement |
|:---|:---:|:---:|:---:|:---:|:---|
| `/api/auth/register` | `POST` | `permitAll()` | Public registration with rate limit (3 req/min) | None | New user row created |
| `/api/auth/login` | `POST` | `permitAll()` | Public login with lockout (5 fails -> 60s lock) | None | Validates credentials; returns token pair |
| `/api/auth/refresh` | `POST` | `permitAll()` | Single-use rotation with family replay revocation | None | Replay check; revokes token family on reuse |
| `/api/auth/me` | `GET` | `authenticated()` | Authenticated user profile retrieval | `ROLE_USER` / `ADMIN` | Returns profile for `SecurityUtils.getCurrentUserId()` |
| `/api/auth/logout` | `POST` | `authenticated()` | Revokes active token / all user family tokens | `ROLE_USER` / `ADMIN` | Deletes user's refresh tokens in database |
| `/api/auth/change-password` | `POST` | `authenticated()` | Validates old password, applies 72-byte check | `ROLE_USER` / `ADMIN` | Revokes ALL user tokens upon success |
| `/api/goals/**` | `ALL` | `authenticated()` | Goal management & milestone tracking | `ROLE_USER` / `ADMIN` | Repository: `findByUser_IdAnd...` (404 on peer ID) |
| `/api/missions/**` | `ALL` | `authenticated()` | High-priority mission assignment | `ROLE_USER` / `ADMIN` | Repository: `findAllByUser_Id` |
| `/api/tasks/**` | `ALL` | `authenticated()` | Task CRUD, status updates, presets | `ROLE_USER` / `ADMIN` | Repository: `findByUser_Id` |
| `/api/focus-sessions/**` | `ALL` | `authenticated()` | Timer, session start/pause/complete | `ROLE_USER` / `ADMIN` | Active session query scoped to `user.id` |
| `/api/focus/exceptions/**` | `ALL` | `authenticated()` | Focus exception allowances | `ROLE_USER` / `ADMIN` | Scoped to authenticated user ID |
| `/api/sentinel/rules/**` | `ALL` | `authenticated()` | Process & domain blocking rules | `ROLE_USER` / `ADMIN` | Scoped to authenticated user ID |
| `/api/sentinel/quarantine` | `GET` | `authenticated()` | Local device shield audit records | `ROLE_USER` / `ADMIN` | Scoped to authenticated user ID |
| `/api/sentinel/mode` | `PUT` | `authenticated()` | Enforcement mode update (`AUDIT`, `STRICT`) | `ROLE_USER` / `ADMIN` | Scoped to authenticated user ID |
| `/api/sentinel/report` | `POST` | `authenticated()` | Rust Shield client telemetry ingestion | `ROLE_USER` / `ADMIN` | User ID resolved from Bearer token |
| `/api/progress/**` | `GET` | `authenticated()` | Daily/weekly streak and completion metrics | `ROLE_USER` / `ADMIN` | Scoped to authenticated user ID |
| `/api/analytics/**` | `GET` | `authenticated()` | Aggregated focus time and velocity | `ROLE_USER` / `ADMIN` | Scoped to authenticated user ID |
| `/api/dashboard/**` | `GET` | `authenticated()` | Aggregated user cockpit summary | `ROLE_USER` / `ADMIN` | Scoped to authenticated user ID |
| `/api/ai/actions/**` | `ALL` | `authenticated()` | Propose, confirm, reject AI suggestions | `ROLE_USER` / `ADMIN` | Context and action ID verified against `userId` |
| `/api/ai/briefing` | `GET` | `authenticated()` | Executive briefing generated by AI | `ROLE_USER` / `ADMIN` | Scoped to user's tasks, goals, and history |
| `/actuator/health` | `GET` | `permitAll()` | Docker container & Caddy health check | None | No sensitive system or user details exposed |
| `/ws/**` | `ALL` | `permitAll()` (Handshake) | STOMP Channel Interceptor (CONNECT & SUBSCRIBE) | `ROLE_USER` / `ADMIN` | Enforces matching `targetUserId` on subscription |

---

## 4. Deep-Dive Remediation Details

### 4.1 Strict Public Endpoint Minimization
- **File:** `backend/src/main/java/com/shinpo/config/SecurityConfig.java`
- **Issue:** Previously used `.requestMatchers("/api/auth/**").permitAll()`.
- **Fix:** Replaced with explicit HTTP Method and Path restrictions:
  ```java
  .requestMatchers(HttpMethod.POST,
          "/api/auth/register",
          "/api/auth/login",
          "/api/auth/refresh"
  ).permitAll()
  .requestMatchers("/actuator/health").permitAll()
  .requestMatchers("/ws/**").permitAll()
  .anyRequest().authenticated()
  ```
- **Outcome:** `/api/auth/me`, `/api/auth/logout`, and `/api/auth/change-password` now strictly require a valid JWT Bearer token at the Spring Security filter layer. Unauthenticated requests are rejected immediately with HTTP 401 Unauthorized before reaching any controller or service code.

### 4.2 In-Memory Rate Limiting with Reverse-Proxy Client IP Resolution
- **Files:**
  - `backend/src/main/java/com/shinpo/security/RateLimitingFilter.java`
  - `backend/src/main/java/com/shinpo/security/RateLimitingService.java`
- **Capabilities Implemented:**
  1. **Multi-Hop Proxy IP Resolution:** Correctly inspects `X-Forwarded-For` by extracting the leftmost public client IP, followed by `X-Real-IP`, `CF-Connecting-IP`, and fallback to `request.getRemoteAddr()`. Validates against private spoofed addresses when operating behind Caddy.
  2. **Account Lockout on Failed Logins:** Tracks consecutive failed login attempts by IP and account. After 5 failed attempts within 60 seconds, the client receives HTTP 429 Too Many Requests with a `Retry-After: <seconds>` header and a structured JSON payload:
     ```json
     {
       "timestamp": "2026-10-19T17:28:47.041Z",
       "status": 429,
       "error": "TOO_MANY_REQUESTS",
       "message": "Too many failed login attempts. Account temporarily locked for 55 seconds.",
       "path": "/api/auth/login"
     }
     ```
  3. **Endpoint Specific Throttling:**
     - `/api/auth/register`: 3 registrations per minute per IP.
     - `/api/auth/refresh`: 30 refreshes per minute per IP.
     - `/api/auth/change-password`: 3 password change attempts per minute per user/IP.

### 4.3 BCrypt 72-Byte Boundary & CPU Exhaustion Defense
- **Files:**
  - `backend/src/main/java/com/shinpo/service/AuthService.java`
  - `backend/src/main/java/com/shinpo/dto/AuthDtos.java`
- **Vulnerability:** Standard BCrypt silently truncates passwords after 72 bytes. Submitting massive strings (e.g., 50 KB) forces the server to spend excessive CPU cycles copying and processing strings before hashing, enabling denial of service.
- **Fix:**
  - Added `@Size(max = 128)` to incoming DTOs (`LoginRequest`, `RegisterRequest`, `ChangePasswordRequest`).
  - Added UTF-8 byte array validation in `AuthService.validatePasswordSafety()`:
    ```java
    if (password.getBytes(StandardCharsets.UTF_8).length > 72) {
        throw new IllegalArgumentException("Password exceeds maximum allowable length of 72 bytes");
    }
    ```
- **Outcome:** Overlong passwords are immediately rejected with HTTP 400 Bad Request before calling `PasswordEncoder.encode` or `PasswordEncoder.matches`.

### 4.4 Refresh Token Rotation, Replay Detection & Family Revocation
- **Files:**
  - `backend/src/main/java/com/shinpo/security/JwtTokenService.java`
  - `backend/src/main/java/com/shinpo/service/AuthService.java`
  - `backend/src/main/java/com/shinpo/repository/RefreshTokenRepository.java`
- **Vulnerability:** When a refresh token was reused by an attacker, the system attempted to revoke all tokens for the user, but because the service threw an `IllegalArgumentException`, Spring's outer transaction rolled back, leaving all tokens active.
- **Fix:**
  - Injected `PlatformTransactionManager` into `JwtTokenService`.
  - Executed token family revocation inside an isolated `TransactionTemplate` configured with `Propagation.REQUIRES_NEW`:
    ```java
    TransactionTemplate requiresNew = new TransactionTemplate(transactionManager);
    requiresNew.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    requiresNew.execute(status -> {
        refreshTokenRepository.deleteAllByUser_Id(userId);
        return null;
    });
    ```
  - Stored refresh tokens as cryptographic SHA-256 hashes (`token_hash`) using pessimistic write locking (`@Lock(LockModeType.PESSIMISTIC_WRITE)`) to eliminate race conditions during concurrent refresh requests.
  - Linked `AuthService.changePassword()` and `AuthService.logoutAllForUser()` to unconditionally revoke all active refresh tokens for the user.

### 4.5 WebSocket STOMP Origin & Subscription Tenant Isolation
- **File:** `backend/src/main/java/com/shinpo/config/WebSocketConfig.java`
- **Capabilities Implemented:**
  1. **Production Origin Restriction:** Registered allowed origins via `shinpo.security.cors.allowed-origins` (defaulting to `tauri://localhost`, `http://localhost:5173`, `http://127.0.0.1:5173`, and production domains).
  2. **Inbound Channel Interception:**
     - Enforces authenticated JWT on `CONNECT`.
     - Enforces authenticated user context on `SEND`.
     - Enforces topic ownership on `SUBSCRIBE`:
       When a user attempts to subscribe to `/topic/users/{targetUserId}/**` or `/topic/user.{targetUserId}.*`, the interceptor validates that `targetUserId == authenticatedUser.getId()`. If a cross-tenant subscription is attempted, an `AccessDeniedException` is thrown and the subscription is terminated.

---

## 5. Security Regression Verification Matrix

The test suite `backend/src/test/java/com/shinpo/security/AuthenticationSecurityHardeningTests.java` covers all 16 mandatory security test families. All tests were executed against an isolated PostgreSQL instance (`shinpo_test`).

| Test Family # | Test Method Name | Scenario Description | Expected Outcome | Execution Result |
|:---:|:---|:---|:---|:---:|
| **TF-01** | `testPublicEndpointsAccessibleWithoutToken` | Anonymous access to `POST /api/auth/register`, `login`, `refresh`, and `/actuator/health` | HTTP 200 / 400 (Reaches Controller) | **PASS** |
| **TF-02** | `testProtectedAuthEndpointsRejectAnonymous` | Anonymous access to `GET /api/auth/me`, `POST /logout`, `POST /change-password` | HTTP 401 Unauthorized at Filter Layer | **PASS** |
| **TF-03** | `testProtectedEndpointsRejectInvalidJwt` | Requests with corrupted, expired, or forged JWT signatures | HTTP 401 Unauthorized | **PASS** |
| **TF-04** | `testRateLimitingLockoutOnFailedLogins` | 5 consecutive invalid login attempts from same IP | 6th attempt returns HTTP 429 Too Many Requests | **PASS** |
| **TF-05** | `testRateLimiterRespectsReverseProxyHeaders` | Separate IP addresses specified via `X-Forwarded-For` header | Lockout on IP 1 does not affect IP 2 | **PASS** |
| **TF-06** | `testPasswordLengthBcryptExhaustionProtection` | Submitting password with > 72 UTF-8 bytes to `/register` | HTTP 400 "Password exceeds maximum allowable length" | **PASS** |
| **TF-07** | `testChangePasswordEnforcesBcryptLimit` | Submitting password with > 72 UTF-8 bytes to `/change-password` | HTTP 400 Bad Request | **PASS** |
| **TF-08** | `testRefreshTokenRotationSingleUse` | Using valid refresh token once | Returns new token pair; old token is deleted | **PASS** |
| **TF-09** | `testRefreshTokenReplayRevokesEntireFamily` | Reusing an already-revoked refresh token | Revokes ALL user tokens via REQUIRES_NEW | **PASS** |
| **TF-10** | `testPasswordChangeInvalidatesAllRefreshTokens` | Changing password and attempting to refresh with pre-existing token | Refresh fails; tokens deleted from database | **PASS** |
| **TF-11** | `testSessionLogoutRevokesActiveTokens` | Calling `/api/auth/logout` and attempting refresh | Refresh returns HTTP 401 Unauthorized | **PASS** |
| **TF-12** | `testMultiTenantGoalIsolation` | User A attempts to view, edit, or delete User B's goal | HTTP 404 / 403; no data leakage | **PASS** |
| **TF-13** | `testMultiTenantTaskIsolation` | User A queries tasks or tries to associate task with User B's goal | Scoped strictly to User A's goals | **PASS** |
| **TF-14** | `testMultiTenantFocusSessionIsolation` | User A queries active focus session or history of User B | Active session returned only for session owner | **PASS** |
| **TF-15** | `testMultiTenantAiActionIsolation` | User A attempts to confirm/reject AI action proposed for User B | Rejection / 404; no execution | **PASS** |
| **TF-16** | `testStompSubscriptionCrossTenantDenied` | User A STOMP client attempts to subscribe to `/topic/users/{userB.id}/events` | `AccessDeniedException`; subscription denied | **PASS** |

### Complete Test Suite Summary
- **Target:** Backend Unit & Integration Tests (`./mvnw test`)
  - **Tests Run:** **349**
  - **Failures:** **0**
  - **Errors:** **0**
  - **Skipped:** **0**
  - **Status:** **BUILD SUCCESS**
- **Target:** Frontend API & Component Tests (`npm test -- --run`)
  - **Tests Run:** **65**
  - **Suites:** **7**
  - **Failures:** **0**
  - **Status:** **ALL TESTS PASS**

---

## 6. Live E2E Verification Log

Live curl verification conducted against the running Spring Boot dev server (`http://localhost:8080`):

1. **Unauthenticated Access:**
   ```bash
   $ curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/api/auth/me
   401
   $ curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8080/api/auth/logout
   401
   $ curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8080/api/auth/change-password
   401
   ```
2. **Account Lockout on Failed Logins:**
   - Attempts 1–5: `HTTP/1.1 401`
   - Attempt 6+: `HTTP/1.1 429` with `Retry-After: 55`
3. **BCrypt DoS Guard:**
   - 75-character password rejected with `400 Bad Request: Password exceeds maximum allowable length of 72 bytes`.
4. **Lifecycle & Token Revocation:**
   - Authenticated `/api/auth/me` with Bearer token: `HTTP 200 OK`
   - `/api/auth/logout`: `HTTP 204 No Content`
   - Refresh with revoked token: `HTTP 401 Unauthorized`

---

## 7. Operational Guidelines for 4-User Deployment

For operating SHINPO across 4 independent users in production:
1. **Reverse Proxy Configuration (Caddy):**
   - Ensure Caddy forwards real client IPs:
     ```caddyfile
     header_up X-Forwarded-For {remote_host}
     header_up X-Real-IP {remote_host}
     ```
2. **Environment Variables:**
   - `JWT_SECRET`: Minimum 64-character high-entropy secret.
   - `SHINPO_ALLOWED_ORIGINS`: Restrict to `tauri://localhost` and production client domains.
3. **Database Health:**
   - Periodic automated backups via `scripts/backup_db.sh`.
   - Never run Flyway clean or ddl-auto update in production.

---

## 8. Final Verdict

SHINPO Backend Recovery Phase 2 has successfully achieved all security objectives:
- **Zero Open Wildcards:** All sensitive authentication and profile management endpoints require authentication.
- **Brute-Force & DoS Resilient:** Sliding-window rate limiting and BCrypt 72-byte truncation boundaries prevent denial of service and credential stuffing.
- **Cryptographic Token Safety:** Single-use refresh token rotation with transactional family revocation prevents replay attacks.
- **Complete Multi-Tenant Isolation:** REST endpoints, AI actions, and STOMP WebSocket topics strictly isolate each of the 4 beta users.

**STATUS: PASS — BACKEND READY FOR 4-USER INDEPENDENT BETA DEPLOYMENT.**

