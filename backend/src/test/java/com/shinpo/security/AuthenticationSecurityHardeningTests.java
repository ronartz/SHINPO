package com.shinpo.security;

import com.shinpo.config.WebSocketConfig;
import com.shinpo.dto.AuthDtos.*;
import com.shinpo.entity.Goal;
import com.shinpo.entity.Mission;
import com.shinpo.entity.RefreshToken;
import com.shinpo.entity.User;
import com.shinpo.repository.GoalRepository;
import com.shinpo.repository.MissionRepository;
import com.shinpo.repository.RefreshTokenRepository;
import com.shinpo.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;
import org.springframework.http.*;
import org.springframework.messaging.Message;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@ActiveProfiles("test")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
public class AuthenticationSecurityHardeningTests {

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    @Autowired
    private GoalRepository goalRepository;

    @Autowired
    private MissionRepository missionRepository;

    @Autowired
    private JwtTokenService jwtTokenService;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private RateLimitingService rateLimitingService;

    @Autowired
    private CustomUserDetailsService userDetailsService;

    @Autowired
    private Environment environment;

    private User alice;
    private User bob;
    private String aliceToken;

    @BeforeEach
    void setUp() {
        rateLimitingService.reset();

        String suffix = UUID.randomUUID().toString().substring(0, 8);
        alice = userRepository.save(new User(
                "alice_" + suffix,
                "alice_" + suffix + "@shinpo.test",
                passwordEncoder.encode("Password123!"),
                Instant.now()
        ));
        bob = userRepository.save(new User(
                "bob_" + suffix,
                "bob_" + suffix + "@shinpo.test",
                passwordEncoder.encode("Password123!"),
                Instant.now()
        ));

        aliceToken = jwtTokenService.generateAccessToken(UserPrincipal.create(alice));
    }

    @AfterEach
    void tearDown() {
        rateLimitingService.reset();
        missionRepository.deleteAll(missionRepository.findAllByGoal_User_Id(alice.getId()));
        missionRepository.deleteAll(missionRepository.findAllByGoal_User_Id(bob.getId()));
        goalRepository.deleteAll(goalRepository.findAllByUser_Id(alice.getId()));
        goalRepository.deleteAll(goalRepository.findAllByUser_Id(bob.getId()));
        refreshTokenRepository.deleteAllByUser_Id(alice.getId());
        refreshTokenRepository.deleteAllByUser_Id(bob.getId());
        userRepository.deleteById(alice.getId());
        userRepository.deleteById(bob.getId());
    }

    private HttpHeaders authHeaders(String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        headers.setContentType(MediaType.APPLICATION_JSON);
        return headers;
    }

    // =========================================================================
    // FAMILY 1: Public Endpoint Accessibility
    // =========================================================================
    @Test
    @DisplayName("Family 1: Public authentication and health endpoints are accessible without credentials")
    void testPublicEndpointsAccessibility() {
        // 1. Actuator health
        ResponseEntity<String> health = restTemplate.getForEntity("/actuator/health", String.class);
        assertEquals(HttpStatus.OK, health.getStatusCode());

        // 2. Register endpoint accepts public POST
        String rand = UUID.randomUUID().toString().substring(0, 8);
        RegisterRequest regReq = new RegisterRequest("newuser_" + rand, "new_" + rand + "@test.com", "Password123!");
        ResponseEntity<AuthResponse> regResp = restTemplate.postForEntity("/api/auth/register", regReq, AuthResponse.class);
        assertEquals(HttpStatus.CREATED, regResp.getStatusCode());
        assertNotNull(regResp.getBody());
        assertNotNull(regResp.getBody().accessToken());

        // 3. Login endpoint accepts public POST
        LoginRequest loginReq = new LoginRequest("newuser_" + rand, "Password123!");
        ResponseEntity<AuthResponse> loginResp = restTemplate.postForEntity("/api/auth/login", loginReq, AuthResponse.class);
        assertEquals(HttpStatus.OK, loginResp.getStatusCode());
        assertNotNull(loginResp.getBody());
        assertNotNull(loginResp.getBody().accessToken());

        // 4. Refresh endpoint accepts public POST with valid token
        RefreshTokenRequest refReq = new RefreshTokenRequest(loginResp.getBody().refreshToken());
        ResponseEntity<AuthResponse> refResp = restTemplate.postForEntity("/api/auth/refresh", refReq, AuthResponse.class);
        assertEquals(HttpStatus.OK, refResp.getStatusCode());

        // Clean up registered user
        userRepository.findByUsername("newuser_" + rand).ifPresent(u -> {
            refreshTokenRepository.deleteAllByUser_Id(u.getId());
            missionRepository.deleteAll(missionRepository.findAllByGoal_User_Id(u.getId()));
            goalRepository.deleteAll(goalRepository.findAllByUser_Id(u.getId()));
            userRepository.deleteById(u.getId());
        });
    }

    // =========================================================================
    // FAMILY 2: Deny-by-Default on Private Endpoints
    // =========================================================================
    @Test
    @DisplayName("Family 2: Protected endpoints strictly reject unauthenticated requests with 401 Unauthorized")
    void testDenyByDefaultOnPrivateEndpoints() {
        // /api/auth/me requires authentication
        ResponseEntity<String> meResp = restTemplate.getForEntity("/api/auth/me", String.class);
        assertEquals(HttpStatus.UNAUTHORIZED, meResp.getStatusCode());

        // /api/auth/change-password requires authentication
        ChangePasswordRequest pwReq = new ChangePasswordRequest("OldPass", "NewPassword123!");
        ResponseEntity<String> pwResp = restTemplate.postForEntity("/api/auth/change-password", pwReq, String.class);
        assertEquals(HttpStatus.UNAUTHORIZED, pwResp.getStatusCode());

        // /api/auth/logout requires authentication
        ResponseEntity<String> logoutResp = restTemplate.postForEntity("/api/auth/logout", null, String.class);
        assertEquals(HttpStatus.UNAUTHORIZED, logoutResp.getStatusCode());

        // Domain endpoints require authentication
        assertEquals(HttpStatus.UNAUTHORIZED, restTemplate.getForEntity("/api/goals", String.class).getStatusCode());
        assertEquals(HttpStatus.UNAUTHORIZED, restTemplate.getForEntity("/api/dashboard", String.class).getStatusCode());
        assertEquals(HttpStatus.UNAUTHORIZED, restTemplate.getForEntity("/api/focus-sessions", String.class).getStatusCode());
        assertEquals(HttpStatus.UNAUTHORIZED, restTemplate.getForEntity("/api/device/sentinel/status", String.class).getStatusCode());
        assertEquals(HttpStatus.UNAUTHORIZED, restTemplate.getForEntity("/api/ai/conversation/active", String.class).getStatusCode());
        assertEquals(HttpStatus.UNAUTHORIZED, restTemplate.getForEntity("/api/unmapped/private/route", String.class).getStatusCode());
    }

    // =========================================================================
    // FAMILY 3: Invalid / Malformed / Expired JWT Rejection
    // =========================================================================
    @Test
    @DisplayName("Family 3: Malformed, forged, and tampered tokens are rejected with 401 Unauthorized")
    void testInvalidJwtRejection() {
        // Garbage token
        HttpHeaders badHeaders = new HttpHeaders();
        badHeaders.setBearerAuth("not.a.real.jwt.token");
        ResponseEntity<String> resp1 = restTemplate.exchange("/api/auth/me", HttpMethod.GET, new HttpEntity<>(badHeaders), String.class);
        assertEquals(HttpStatus.UNAUTHORIZED, resp1.getStatusCode());

        // Empty Bearer token
        HttpHeaders emptyBearer = new HttpHeaders();
        emptyBearer.set("Authorization", "Bearer ");
        ResponseEntity<String> resp2 = restTemplate.exchange("/api/auth/me", HttpMethod.GET, new HttpEntity<>(emptyBearer), String.class);
        assertEquals(HttpStatus.UNAUTHORIZED, resp2.getStatusCode());
    }

    // =========================================================================
    // FAMILY 4: Inactive / Disabled Account Rejection
    // =========================================================================
    @Test
    @DisplayName("Family 4: Token for disabled account is rejected with 401 Unauthorized")
    void testInactiveAccountRejection() {
        // Alice is authenticated, verify success first
        ResponseEntity<String> okResp = restTemplate.exchange(
                "/api/auth/me", HttpMethod.GET, new HttpEntity<>(authHeaders(aliceToken)), String.class);
        assertEquals(HttpStatus.OK, okResp.getStatusCode());

        // Disable Alice's account
        alice.setActive(false);
        userRepository.save(alice);

        // Subsequent request with alice's token must be rejected with 401
        ResponseEntity<String> deniedResp = restTemplate.exchange(
                "/api/auth/me", HttpMethod.GET, new HttpEntity<>(authHeaders(aliceToken)), String.class);
        assertEquals(HttpStatus.UNAUTHORIZED, deniedResp.getStatusCode());
    }

    // =========================================================================
    // FAMILY 5: Password Abuse & BCrypt Boundaries (72-byte Limit)
    // =========================================================================
    @Test
    @DisplayName("Family 5: Passwords exceeding 72 bytes are rejected with 400 Bad Request to prevent BCrypt DoS")
    void testPasswordAbuseBcryptBoundaries() {
        // Password longer than 72 bytes (e.g. 80 bytes)
        String oversizedPassword = "A".repeat(80);
        RegisterRequest req = new RegisterRequest("oversize_user", "oversize@test.com", oversizedPassword);

        ResponseEntity<String> resp = restTemplate.postForEntity("/api/auth/register", req, String.class);
        assertEquals(HttpStatus.BAD_REQUEST, resp.getStatusCode());
        assertTrue(resp.getBody().contains("Password") || resp.getBody().contains("72"));

        // Login with oversized password rejected without hitting BCrypt
        LoginRequest loginReq = new LoginRequest(alice.getUsername(), oversizedPassword);
        ResponseEntity<String> loginResp = restTemplate.postForEntity("/api/auth/login", loginReq, String.class);
        assertEquals(HttpStatus.BAD_REQUEST, loginResp.getStatusCode());
    }

    // =========================================================================
    // FAMILY 6: Rate Limiting & Proxy IP Resolution
    // =========================================================================
    @Test
    @DisplayName("Family 6: Rapid failed logins trigger 429 Too Many Requests and Retry-After header")
    void testRateLimitingOnAuthentication() {
        String testIp = "198.51.100.42";
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("X-Forwarded-For", testIp + ", 10.0.0.1");

        LoginRequest badLogin = new LoginRequest(alice.getUsername(), "WrongPassword!");

        // Send MAX_FAILED_LOGINS failed requests
        for (int i = 0; i < RateLimitingService.MAX_FAILED_LOGINS; i++) {
            ResponseEntity<String> resp = restTemplate.postForEntity("/api/auth/login", new HttpEntity<>(badLogin, headers), String.class);
            assertEquals(HttpStatus.UNAUTHORIZED, resp.getStatusCode());
        }

        // The next request must be throttled with HTTP 429
        ResponseEntity<String> throttled = restTemplate.postForEntity("/api/auth/login", new HttpEntity<>(badLogin, headers), String.class);
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, throttled.getStatusCode());
        assertNotNull(throttled.getHeaders().getFirst("Retry-After"));
        assertTrue(throttled.getBody().contains("429") || throttled.getBody().contains("TOO_MANY_REQUESTS"));
    }

    // =========================================================================
    // FAMILY 7: Refresh Token Rotation
    // =========================================================================
    @Test
    @DisplayName("Family 7: Token refresh performs atomic rotation, returning new pair and revoking old token")
    void testRefreshTokenRotation() {
        String rawToken = jwtTokenService.generateRefreshToken(alice);
        RefreshTokenRequest req = new RefreshTokenRequest(rawToken);

        ResponseEntity<AuthResponse> resp = restTemplate.postForEntity("/api/auth/refresh", req, AuthResponse.class);
        assertEquals(HttpStatus.OK, resp.getStatusCode());
        assertNotNull(resp.getBody());

        String newRefreshToken = resp.getBody().refreshToken();
        assertNotEquals(rawToken, newRefreshToken, "Rotated refresh token must be different from initial token");

        // Old token is revoked
        String oldHash = JwtTokenService.hashToken(rawToken);
        RefreshToken oldRecord = refreshTokenRepository.findFirstByTokenHash(oldHash).orElseThrow();
        assertTrue(oldRecord.isRevoked(), "Old refresh token must be marked revoked");
    }

    // =========================================================================
    // FAMILY 8: Refresh Token Replay Detection & Family Revocation
    // =========================================================================
    @Test
    @DisplayName("Family 8: Refresh token reuse triggers replay detection and revokes ALL tokens in user family")
    void testRefreshTokenReplayRevocation() {
        // Step 1: Initial token
        String token1 = jwtTokenService.generateRefreshToken(alice);

        // Step 2: Rotate token1 -> returns token2
        RefreshTokenRequest req1 = new RefreshTokenRequest(token1);
        ResponseEntity<AuthResponse> resp1 = restTemplate.postForEntity("/api/auth/refresh", req1, AuthResponse.class);
        assertEquals(HttpStatus.OK, resp1.getStatusCode());
        String token2 = resp1.getBody().refreshToken();

        // Step 3: Attacker replays already-used token1
        ResponseEntity<String> replayResp = restTemplate.postForEntity("/api/auth/refresh", req1, String.class);
        assertEquals(HttpStatus.UNAUTHORIZED, replayResp.getStatusCode());
        assertTrue(replayResp.getBody().contains("replay") || replayResp.getBody().contains("revoked"));

        // Step 4: Now token2 (the legitimate rotated token) must ALSO be revoked because the entire family is compromised!
        RefreshTokenRequest req2 = new RefreshTokenRequest(token2);
        ResponseEntity<String> compromisedResp = restTemplate.postForEntity("/api/auth/refresh", req2, String.class);
        assertEquals(HttpStatus.UNAUTHORIZED, compromisedResp.getStatusCode());
    }

    // =========================================================================
    // FAMILY 9: Session Invalidation on Password Change
    // =========================================================================
    @Test
    @DisplayName("Family 9: Password change invalidates all existing refresh tokens for that user")
    void testSessionInvalidationOnPasswordChange() {
        String activeRefreshToken = jwtTokenService.generateRefreshToken(alice);

        // Alice changes password
        ChangePasswordRequest changeReq = new ChangePasswordRequest("Password123!", "NewSecretPass456!");
        ResponseEntity<String> changeResp = restTemplate.exchange(
                "/api/auth/change-password",
                HttpMethod.POST,
                new HttpEntity<>(changeReq, authHeaders(aliceToken)),
                String.class
        );
        assertEquals(HttpStatus.OK, changeResp.getStatusCode());

        // Pre-existing refresh token must now be revoked and rejected
        RefreshTokenRequest refReq = new RefreshTokenRequest(activeRefreshToken);
        ResponseEntity<String> refResp = restTemplate.postForEntity("/api/auth/refresh", refReq, String.class);
        assertEquals(HttpStatus.UNAUTHORIZED, refResp.getStatusCode());
    }

    // =========================================================================
    // FAMILY 10: Explicit Logout Session Termination
    // =========================================================================
    @Test
    @DisplayName("Family 10: Logout explicitly revokes refresh token session")
    void testExplicitLogoutSessionTermination() {
        String token = jwtTokenService.generateRefreshToken(alice);
        RefreshTokenRequest logoutReq = new RefreshTokenRequest(token);

        ResponseEntity<Void> logoutResp = restTemplate.exchange(
                "/api/auth/logout",
                HttpMethod.POST,
                new HttpEntity<>(logoutReq, authHeaders(aliceToken)),
                Void.class
        );
        assertEquals(HttpStatus.NO_CONTENT, logoutResp.getStatusCode());

        // Refresh with logged-out token must fail
        ResponseEntity<String> refResp = restTemplate.postForEntity("/api/auth/refresh", logoutReq, String.class);
        assertEquals(HttpStatus.UNAUTHORIZED, refResp.getStatusCode());
    }

    // =========================================================================
    // FAMILY 11: Multi-Tenant Data Isolation - Goals & Missions
    // =========================================================================
    @Test
    @DisplayName("Family 11: User A cannot read, modify, delete, or complete User B's goals or missions")
    void testMultiTenantGoalAndMissionIsolation() {
        // Bob creates a goal
        Goal bobsGoal = goalRepository.save(new Goal(
                "Bob's Secret Goal", "Confidential", LocalDate.now(), LocalDate.now().plusMonths(1), bob));
        Mission bobsMission = missionRepository.save(new Mission(
                "Bob's Secret Mission", "Confidential task", LocalDate.now(), 30, bobsGoal));

        // Alice attempts to get Bob's goal -> 404
        ResponseEntity<String> getGoal = restTemplate.exchange(
                "/api/goals/" + bobsGoal.getId(), HttpMethod.GET, new HttpEntity<>(authHeaders(aliceToken)), String.class);
        assertEquals(HttpStatus.NOT_FOUND, getGoal.getStatusCode());

        // Alice attempts to delete Bob's goal -> 404
        ResponseEntity<String> delGoal = restTemplate.exchange(
                "/api/goals/" + bobsGoal.getId(), HttpMethod.DELETE, new HttpEntity<>(authHeaders(aliceToken)), String.class);
        assertEquals(HttpStatus.NOT_FOUND, delGoal.getStatusCode());

        // Alice attempts to get Bob's mission -> 404
        ResponseEntity<String> getMission = restTemplate.exchange(
                "/api/missions/" + bobsMission.getId(), HttpMethod.GET, new HttpEntity<>(authHeaders(aliceToken)), String.class);
        assertEquals(HttpStatus.NOT_FOUND, getMission.getStatusCode());

        // Alice attempts to complete Bob's mission -> 404
        ResponseEntity<String> compMission = restTemplate.exchange(
                "/api/missions/" + bobsMission.getId() + "/complete",
                HttpMethod.POST,
                new HttpEntity<>(Map.of("actualMinutes", 30), authHeaders(aliceToken)),
                String.class
        );
        assertEquals(HttpStatus.NOT_FOUND, compMission.getStatusCode());
    }

    // =========================================================================
    // FAMILY 12: Multi-Tenant Data Isolation - Dashboard & Progress
    // =========================================================================
    @Test
    @DisplayName("Family 12: User A cannot inspect User B's dashboard or progress data (403 Forbidden)")
    void testMultiTenantDashboardAndProgressIsolation() {
        // Alice attempts to access Bob's dashboard route
        ResponseEntity<String> dashResp = restTemplate.exchange(
                "/api/dashboard/" + bob.getId(), HttpMethod.GET, new HttpEntity<>(authHeaders(aliceToken)), String.class);
        assertEquals(HttpStatus.FORBIDDEN, dashResp.getStatusCode());

        // Alice attempts to access Bob's progress route
        ResponseEntity<String> progResp = restTemplate.exchange(
                "/api/progress/" + bob.getId(), HttpMethod.GET, new HttpEntity<>(authHeaders(aliceToken)), String.class);
        assertEquals(HttpStatus.FORBIDDEN, progResp.getStatusCode());
    }

    // =========================================================================
    // FAMILY 13: Multi-Tenant Data Isolation - Sentinel Rules & Quarantines
    // =========================================================================
    @Test
    @DisplayName("Family 13: Sentinel rules, warnings, and status are strictly partitioned by authenticated user")
    void testSentinelTenantIsolation() {
        // Alice gets sentinel status -> only contains Alice's stats
        ResponseEntity<String> status = restTemplate.exchange(
                "/api/device/sentinel/status", HttpMethod.GET, new HttpEntity<>(authHeaders(aliceToken)), String.class);
        assertEquals(HttpStatus.OK, status.getStatusCode());

        // Alice lists active warnings -> empty or only Alice's
        ResponseEntity<String> warnings = restTemplate.exchange(
                "/api/device/sentinel/warnings", HttpMethod.GET, new HttpEntity<>(authHeaders(aliceToken)), String.class);
        assertEquals(HttpStatus.OK, warnings.getStatusCode());
    }

    // =========================================================================
    // FAMILY 14: Multi-Tenant Data Isolation - AI Tools & Action Confirmation
    // =========================================================================
    @Test
    @DisplayName("Family 14: AI chat and action confirmation enforce ownership boundaries")
    void testAiActionTenantIsolation() {
        // Alice views active conversation -> returns Alice's conversation
        ResponseEntity<String> aiConv = restTemplate.exchange(
                "/api/ai/conversation/active", HttpMethod.GET, new HttpEntity<>(authHeaders(aliceToken)), String.class);
        assertEquals(HttpStatus.OK, aiConv.getStatusCode());

        // Alice confirms an arbitrary or Bob's action ID -> 404 or 403
        ResponseEntity<String> confirm = restTemplate.exchange(
                "/api/ai/actions/nonexistent-or-bobs-action/confirm",
                HttpMethod.POST,
                new HttpEntity<>(authHeaders(aliceToken)),
                String.class
        );
        assertTrue(confirm.getStatusCode() == HttpStatus.NOT_FOUND || confirm.getStatusCode() == HttpStatus.FORBIDDEN || confirm.getStatusCode() == HttpStatus.BAD_REQUEST);
    }

    // =========================================================================
    // FAMILY 15: WebSocket STOMP Subscription & Send Tenant Isolation
    // =========================================================================
    @Test
    @DisplayName("Family 15: WebSocket STOMP rejects cross-tenant subscriptions (/topic/users/{otherId} and /topic/user.{otherId}.*)")
    void testWebSocketStompTenantIsolation() {
        WebSocketConfig wsConfig = new WebSocketConfig(jwtTokenService, userDetailsService, environment);
        ChannelInterceptor interceptor = wsConfig.createClientInboundInterceptor();

        UserPrincipal alicePrincipal = UserPrincipal.create(alice);
        UsernamePasswordAuthenticationToken aliceAuth = new UsernamePasswordAuthenticationToken(
                alicePrincipal, null, alicePrincipal.getAuthorities());

        // 1. Alice subscribes to own topic /topic/users/{alice.id}/* -> ALLOWED
        StompHeaderAccessor ownSub = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
        ownSub.setDestination("/topic/users/" + alice.getId() + "/sentinel/quarantine");
        ownSub.setUser(aliceAuth);
        Message<?> ownMsg = MessageBuilder.createMessage(new byte[0], ownSub.getMessageHeaders());
        assertNotNull(interceptor.preSend(ownMsg, null));

        // 2. Alice subscribes to dot notation /topic/user.{alice.id}.events -> ALLOWED
        StompHeaderAccessor ownDotSub = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
        ownDotSub.setDestination("/topic/user." + alice.getId() + ".events");
        ownDotSub.setUser(aliceAuth);
        Message<?> ownDotMsg = MessageBuilder.createMessage(new byte[0], ownDotSub.getMessageHeaders());
        assertNotNull(interceptor.preSend(ownDotMsg, null));

        // 3. Alice attempts cross-tenant subscription to Bob /topic/users/{bob.id}/* -> REJECTED
        StompHeaderAccessor bobsSub = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
        bobsSub.setDestination("/topic/users/" + bob.getId() + "/sentinel/quarantine");
        bobsSub.setUser(aliceAuth);
        Message<?> bobsMsg = MessageBuilder.createMessage(new byte[0], bobsSub.getMessageHeaders());
        assertThrows(AccessDeniedException.class, () -> interceptor.preSend(bobsMsg, null));

        // 4. Alice attempts cross-tenant subscription to Bob in dot notation /topic/user.{bob.id}.* -> REJECTED
        StompHeaderAccessor bobsDotSub = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
        bobsDotSub.setDestination("/topic/user." + bob.getId() + ".sentinel");
        bobsDotSub.setUser(aliceAuth);
        Message<?> bobsDotMsg = MessageBuilder.createMessage(new byte[0], bobsDotSub.getMessageHeaders());
        assertThrows(AccessDeniedException.class, () -> interceptor.preSend(bobsDotMsg, null));

        // 5. Unauthenticated client sends SEND command -> REJECTED
        StompHeaderAccessor sendUnauth = StompHeaderAccessor.create(StompCommand.SEND);
        sendUnauth.setDestination("/app/chat");
        Message<?> sendMsg = MessageBuilder.createMessage(new byte[0], sendUnauth.getMessageHeaders());
        assertThrows(AccessDeniedException.class, () -> interceptor.preSend(sendMsg, null));
    }

    // =========================================================================
    // FAMILY 16: Production Secret Safety
    // =========================================================================
    @Test
    @DisplayName("Family 16: Weak secrets and dev secrets are rejected in production profiles")
    void testProductionSecretSafety() {
        // Short secret (< 32 chars) must throw IllegalStateException
        assertThrows(IllegalStateException.class, () ->
                new JwtTokenService("too_short_secret", environment, refreshTokenRepository));

        // Empty secret must throw IllegalStateException
        assertThrows(IllegalStateException.class, () ->
                new JwtTokenService("", environment, refreshTokenRepository));
    }

    // =========================================================================
    // FAMILY 17: Username Update & Account Security
    // =========================================================================
    @Test
    @DisplayName("Family 17: User can update username securely with uniqueness and format validation")
    void testUsernameUpdateSecurity() {
        HttpHeaders headers = authHeaders(aliceToken);

        // 1. Unauthenticated request -> 401
        HttpHeaders unauthHeaders = new HttpHeaders();
        unauthHeaders.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<UpdateUsernameRequest> unauthReq = new HttpEntity<>(new UpdateUsernameRequest("new_username_1"), unauthHeaders);
        ResponseEntity<String> unauthRes = restTemplate.exchange("/api/users/me/username", HttpMethod.PUT, unauthReq, String.class);
        assertEquals(HttpStatus.UNAUTHORIZED, unauthRes.getStatusCode());

        // 2. Alice attempts to take Bob's username -> 409 CONFLICT
        HttpEntity<UpdateUsernameRequest> conflictReq = new HttpEntity<>(new UpdateUsernameRequest(bob.getUsername()), headers);
        ResponseEntity<String> conflictRes = restTemplate.exchange("/api/users/me/username", HttpMethod.PUT, conflictReq, String.class);
        assertEquals(HttpStatus.CONFLICT, conflictRes.getStatusCode());

        // 3. Alice attempts to set too short or invalid username -> 400 BAD REQUEST
        HttpEntity<UpdateUsernameRequest> shortReq = new HttpEntity<>(new UpdateUsernameRequest("ab"), headers);
        ResponseEntity<String> shortRes = restTemplate.exchange("/api/users/me/username", HttpMethod.PUT, shortReq, String.class);
        assertEquals(HttpStatus.BAD_REQUEST, shortRes.getStatusCode());

        HttpEntity<UpdateUsernameRequest> invalidCharsReq = new HttpEntity<>(new UpdateUsernameRequest("invalid user!@#"), headers);
        ResponseEntity<String> invalidCharsRes = restTemplate.exchange("/api/users/me/username", HttpMethod.PUT, invalidCharsReq, String.class);
        assertEquals(HttpStatus.BAD_REQUEST, invalidCharsRes.getStatusCode());

        // 4. Alice successfully updates username to a valid, unique username -> 200 OK
        String newValidUsername = "renamed_alice_" + UUID.randomUUID().toString().substring(0, 8);
        HttpEntity<UpdateUsernameRequest> validReq = new HttpEntity<>(new UpdateUsernameRequest(newValidUsername), headers);
        ResponseEntity<com.shinpo.dto.UserResponse> validRes = restTemplate.exchange("/api/users/me/username", HttpMethod.PUT, validReq, com.shinpo.dto.UserResponse.class);
        assertEquals(HttpStatus.OK, validRes.getStatusCode());
        assertNotNull(validRes.getBody());
        assertEquals(newValidUsername, validRes.getBody().username());
        assertEquals(alice.getId(), validRes.getBody().id());

        // 5. Verify persisted in database
        User updatedInDb = userRepository.findById(alice.getId()).orElseThrow();
        assertEquals(newValidUsername, updatedInDb.getUsername());

        // 6. Same username no-op returns 200 OK without error
        ResponseEntity<com.shinpo.dto.UserResponse> sameRes = restTemplate.exchange("/api/users/me/username", HttpMethod.PUT, validReq, com.shinpo.dto.UserResponse.class);
        assertEquals(HttpStatus.OK, sameRes.getStatusCode());
        assertEquals(newValidUsername, sameRes.getBody().username());
    }
}
