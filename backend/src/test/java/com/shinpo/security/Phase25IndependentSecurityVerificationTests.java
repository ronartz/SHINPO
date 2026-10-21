package com.shinpo.security;

import com.shinpo.config.WebSocketConfig;
import com.shinpo.dto.AuthDtos.*;
import com.shinpo.dto.UserResponse;
import com.shinpo.entity.AiAction;
import com.shinpo.entity.Goal;
import com.shinpo.entity.RefreshToken;
import com.shinpo.entity.User;
import com.shinpo.repository.AiActionRepository;
import com.shinpo.repository.GoalRepository;
import com.shinpo.repository.RefreshTokenRepository;
import com.shinpo.repository.UserRepository;
import com.shinpo.service.AuthService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.*;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.time.LocalDate;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Phase 2.5: Independent Security Verification and Remaining Risk Closure Test Suite.
 * Validates:
 * 1. Reverse-proxy header trust and spoofing rejection.
 * 2. Account-based and source-based rate limiting & lockout.
 * 3. Immediate JWT access-token invalidation (password change, logout, disablement, replay).
 * 4. Refresh-token concurrency, pessimistic row-locking, and isolated transaction guarantees.
 * 5. Multi-tenant data mutation rejection and WebSocket deny-by-default enforcement.
 */
@ActiveProfiles("test")
@TestPropertySource(properties = "shinpo.security.rate-limit.trusted-proxies=127.0.0.1/32,172.20.0.2/32,10.0.0.1/32")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
public class Phase25IndependentSecurityVerificationTests {

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    @Autowired
    private GoalRepository goalRepository;

    @Autowired
    private AiActionRepository aiActionRepository;

    @Autowired
    private AuthService authService;

    @Autowired
    private JwtTokenService jwtTokenService;

    @Autowired
    private RateLimitingService rateLimitingService;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private CustomUserDetailsService userDetailsService;

    @Autowired
    private PlatformTransactionManager transactionManager;

    private User alice;
    private User bob;
    private String aliceRawPassword = "AlicePassword123!";
    private String bobRawPassword = "BobPassword123!";

    @BeforeEach
    void setUp() {
        rateLimitingService.reset();

        String suffix = UUID.randomUUID().toString().substring(0, 8);
        alice = userRepository.save(new User(
                "alice_p25_" + suffix,
                "alice_p25_" + suffix + "@shinpo.test",
                passwordEncoder.encode(aliceRawPassword),
                Instant.now()
        ));

        bob = userRepository.save(new User(
                "bob_p25_" + suffix,
                "bob_p25_" + suffix + "@shinpo.test",
                passwordEncoder.encode(bobRawPassword),
                Instant.now()
        ));
    }

    @AfterEach
    void tearDown() {
        rateLimitingService.reset();
        if (alice != null && alice.getId() != null) {
            goalRepository.deleteAll(goalRepository.findAllByUser_Id(alice.getId()));
        }
        if (bob != null && bob.getId() != null) {
            goalRepository.deleteAll(goalRepository.findAllByUser_Id(bob.getId()));
        }
    }

    private HttpHeaders authHeaders(String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        headers.setContentType(MediaType.APPLICATION_JSON);
        return headers;
    }

    // =========================================================================
    // Area 1: Reverse-Proxy Trust and Rate-Limit Bypass
    // =========================================================================

    @Test
    @DisplayName("P2.5-1: Direct untrusted client CANNOT spoof forwarded headers to evade IP rate limiting")
    void testDirectUntrustedClientCannotSpoofForwardedHeaders() {
        // Direct client from public IP 203.0.113.195 attempting to evade rate limits
        // by rotating X-Forwarded-For headers
        for (int i = 1; i <= 5; i++) {
            MockHttpServletRequest mockReq = new MockHttpServletRequest();
            mockReq.setRemoteAddr("203.0.113.195"); // Direct untrusted IP
            mockReq.addHeader("X-Forwarded-For", "198.51.100." + i); // Spoofed header
            mockReq.addHeader("X-Real-IP", "198.51.100." + i);
            mockReq.addHeader("CF-Connecting-IP", "198.51.100." + i);

            String resolvedIp = rateLimitingService.resolveClientIp(mockReq);
            // Must resolve to the direct untrusted IP, ignoring spoofed headers
            assertEquals("203.0.113.195", resolvedIp);
            rateLimitingService.recordFailedLogin(resolvedIp);
        }

        // 6th attempt from the same direct IP with yet another spoofed header
        MockHttpServletRequest sixthReq = new MockHttpServletRequest();
        sixthReq.setRemoteAddr("203.0.113.195");
        sixthReq.addHeader("X-Forwarded-For", "198.51.100.99");
        String sixthIp = rateLimitingService.resolveClientIp(sixthReq);

        assertEquals("203.0.113.195", sixthIp);
        assertTrue(rateLimitingService.isLoginLockedOut(sixthIp),
                "Direct untrusted client must be locked out regardless of spoofed forwarded headers");
    }

    @Test
    @DisplayName("P2.5-2: Forwarded headers are trusted only from explicitly configured proxy addresses")
    void testForwardedHeadersTrustedFromTrustedProxy() {
        // Request arriving from trusted local proxy (127.0.0.1 or 172.20.0.2)
        MockHttpServletRequest loopbackReq = new MockHttpServletRequest();
        loopbackReq.setRemoteAddr("127.0.0.1");
        loopbackReq.addHeader("X-Forwarded-For", "203.0.113.55, 10.0.0.1");
        assertEquals("203.0.113.55", rateLimitingService.resolveClientIp(loopbackReq));

        MockHttpServletRequest dockerReq = new MockHttpServletRequest();
        dockerReq.setRemoteAddr("172.20.0.2"); // Docker container network
        dockerReq.addHeader("X-Forwarded-For", "198.51.100.77");
        assertEquals("198.51.100.77", rateLimitingService.resolveClientIp(dockerReq));

        MockHttpServletRequest untrustedPrivateReq = new MockHttpServletRequest();
        untrustedPrivateReq.setRemoteAddr("192.168.1.50");
        untrustedPrivateReq.addHeader("X-Forwarded-For", "198.51.100.77");
        assertEquals("192.168.1.50", rateLimitingService.resolveClientIp(untrustedPrivateReq));
    }

    @Test
    @DisplayName("P2.5-3: Account-based lockout prevents distributed brute-force across changing IPs")
    void testAccountBasedLockoutMitigatesDistributedPasswordSpraying() {
        String targetAccount = alice.getUsername();

        // 5 failed login attempts for Alice originating from 5 completely different IPs
        for (int i = 1; i <= 5; i++) {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.add("X-Forwarded-For", "198.51.100." + i); // From trusted loopback

            ResponseEntity<String> response = restTemplate.postForEntity(
                    "/api/auth/login",
                    new HttpEntity<>(new LoginRequest(targetAccount, "WrongPassword!"), headers),
                    String.class
            );
            assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
        }

        // 6th attempt from a brand-new 6th IP (which has zero IP-based failures)
        HttpHeaders sixthIpHeaders = new HttpHeaders();
        sixthIpHeaders.setContentType(MediaType.APPLICATION_JSON);
        sixthIpHeaders.add("X-Forwarded-For", "198.51.100.99");

        ResponseEntity<String> response6 = restTemplate.postForEntity(
                "/api/auth/login",
                new HttpEntity<>(new LoginRequest(targetAccount, "WrongPassword!"), sixthIpHeaders),
                String.class
        );

        assertEquals(HttpStatus.TOO_MANY_REQUESTS, response6.getStatusCode(),
                "Target account must be locked out after 5 failures even if requests arrive from new IPs");
        assertTrue(response6.getBody().contains("Too many failed login attempts for this account"));
    }

    // =========================================================================
    // Area 2: Access-Token Invalidation
    // =========================================================================

    @Test
    @DisplayName("P2.5-4: Access token is invalidated IMMEDIATELY upon password change")
    void testAccessTokenInvalidatedOnPasswordChange() {
        // Step 1: Login as Alice to acquire access token
        AuthResponse loginRes = authService.login(new LoginRequest(alice.getUsername(), aliceRawPassword));
        String accessToken = loginRes.accessToken();

        // Step 2: Verify access token works on /api/auth/me
        ResponseEntity<UserResponse> meResBefore = restTemplate.exchange(
                "/api/auth/me",
                HttpMethod.GET,
                new HttpEntity<>(authHeaders(accessToken)),
                UserResponse.class
        );
        assertEquals(HttpStatus.OK, meResBefore.getStatusCode());
        assertEquals(alice.getId(), meResBefore.getBody().id());

        // Step 3: Change Alice's password
        authService.changePassword(alice.getId(), aliceRawPassword, "NewAlicePassword123!");

        // Step 4: Verify the old access token is IMMEDIATELY rejected (401 Unauthorized)
        ResponseEntity<String> meResAfter = restTemplate.exchange(
                "/api/auth/me",
                HttpMethod.GET,
                new HttpEntity<>(authHeaders(accessToken)),
                String.class
        );
        assertEquals(HttpStatus.UNAUTHORIZED, meResAfter.getStatusCode(),
                "Pre-existing access token must be rejected immediately after password change");

        // Step 5: Login with new password yields a fresh working token
        AuthResponse newLoginRes = authService.login(new LoginRequest(alice.getUsername(), "NewAlicePassword123!"));
        ResponseEntity<UserResponse> meResNew = restTemplate.exchange(
                "/api/auth/me",
                HttpMethod.GET,
                new HttpEntity<>(authHeaders(newLoginRes.accessToken())),
                UserResponse.class
        );
        assertEquals(HttpStatus.OK, meResNew.getStatusCode());
    }

    @Test
    @DisplayName("P2.5-5: Access token is invalidated IMMEDIATELY upon logout")
    void testAccessTokenInvalidatedOnLogout() {
        AuthResponse loginRes = authService.login(new LoginRequest(alice.getUsername(), aliceRawPassword));
        String accessToken = loginRes.accessToken();
        String refreshToken = loginRes.refreshToken();

        // Access works
        ResponseEntity<UserResponse> meRes1 = restTemplate.exchange(
                "/api/auth/me",
                HttpMethod.GET,
                new HttpEntity<>(authHeaders(accessToken)),
                UserResponse.class
        );
        assertEquals(HttpStatus.OK, meRes1.getStatusCode());

        // Perform explicit logout
        HttpHeaders headers = authHeaders(accessToken);
        ResponseEntity<Void> logoutRes = restTemplate.postForEntity(
                "/api/auth/logout",
                new HttpEntity<>(new RefreshTokenRequest(refreshToken), headers),
                Void.class
        );
        assertEquals(HttpStatus.NO_CONTENT, logoutRes.getStatusCode());

        // Access token is immediately rejected
        ResponseEntity<String> meRes2 = restTemplate.exchange(
                "/api/auth/me",
                HttpMethod.GET,
                new HttpEntity<>(authHeaders(accessToken)),
                String.class
        );
        assertEquals(HttpStatus.UNAUTHORIZED, meRes2.getStatusCode(),
                "Access token must be rejected immediately after explicit logout");
    }

    @Test
    @DisplayName("P2.5-6: Access token is invalidated IMMEDIATELY when account is disabled")
    void testAccessTokenInvalidatedOnAccountDisablement() {
        AuthResponse loginRes = authService.login(new LoginRequest(alice.getUsername(), aliceRawPassword));
        String accessToken = loginRes.accessToken();

        // Disable Alice
        User user = userRepository.findById(alice.getId()).orElseThrow();
        user.setActive(false);
        userRepository.save(user);

        // Immediate rejection
        ResponseEntity<String> meRes = restTemplate.exchange(
                "/api/auth/me",
                HttpMethod.GET,
                new HttpEntity<>(authHeaders(accessToken)),
                String.class
        );
        assertEquals(HttpStatus.UNAUTHORIZED, meRes.getStatusCode(),
                "Access token must be rejected immediately when account is disabled");
    }

    @Test
    @DisplayName("P2.5-7: Refresh-token replay invalidates ALL access tokens and refresh tokens")
    void testRefreshReplayInvalidatesAllAccessAndRefreshTokens() {
        // Step 1: Login Alice -> pair 1
        AuthResponse pair1 = authService.login(new LoginRequest(alice.getUsername(), aliceRawPassword));
        String access1 = pair1.accessToken();
        String refresh1 = pair1.refreshToken();

        // Step 2: Normal rotation -> pair 2
        AuthResponse pair2 = authService.refreshToken(new RefreshTokenRequest(refresh1));
        String access2 = pair2.accessToken();
        String refresh2 = pair2.refreshToken();

        // Pair 2 access token is initially valid
        ResponseEntity<UserResponse> meRes2 = restTemplate.exchange(
                "/api/auth/me",
                HttpMethod.GET,
                new HttpEntity<>(authHeaders(access2)),
                UserResponse.class
        );
        assertEquals(HttpStatus.OK, meRes2.getStatusCode());

        // Step 3: Attacker replays refresh1
        ResponseEntity<String> replayRes = restTemplate.postForEntity(
                "/api/auth/refresh",
                new HttpEntity<>(new RefreshTokenRequest(refresh1)),
                String.class
        );
        assertEquals(HttpStatus.UNAUTHORIZED, replayRes.getStatusCode());
        assertTrue(replayRes.getBody().contains("Refresh token replay detected"));

        // Step 4: BOTH access tokens (access1 and access2) must now be rejected
        ResponseEntity<String> me1 = restTemplate.exchange(
                "/api/auth/me",
                HttpMethod.GET,
                new HttpEntity<>(authHeaders(access1)),
                String.class
        );
        assertEquals(HttpStatus.UNAUTHORIZED, me1.getStatusCode());

        ResponseEntity<String> me2 = restTemplate.exchange(
                "/api/auth/me",
                HttpMethod.GET,
                new HttpEntity<>(authHeaders(access2)),
                String.class
        );
        assertEquals(HttpStatus.UNAUTHORIZED, me2.getStatusCode(),
                "Access token 2 must be revoked upon replay detection");

        // Step 5: Refresh token 2 must also be revoked
        ResponseEntity<String> refresh2Attempt = restTemplate.postForEntity(
                "/api/auth/refresh",
                new HttpEntity<>(new RefreshTokenRequest(refresh2)),
                String.class
        );
        assertEquals(HttpStatus.UNAUTHORIZED, refresh2Attempt.getStatusCode());
    }

    @Test
    @DisplayName("P2.5-8: Invalidation of User A does NOT affect User B")
    void testInvalidationDoesNotAffectUnrelatedAccounts() {
        AuthResponse alicePair = authService.login(new LoginRequest(alice.getUsername(), aliceRawPassword));
        AuthResponse bobPair = authService.login(new LoginRequest(bob.getUsername(), bobRawPassword));

        // Alice changes password
        authService.changePassword(alice.getId(), aliceRawPassword, "NewAlicePass123!");

        // Alice's old token is invalid
        ResponseEntity<String> aliceCheck = restTemplate.exchange(
                "/api/auth/me",
                HttpMethod.GET,
                new HttpEntity<>(authHeaders(alicePair.accessToken())),
                String.class
        );
        assertEquals(HttpStatus.UNAUTHORIZED, aliceCheck.getStatusCode());

        // Bob's token remains completely unaffected and active
        ResponseEntity<UserResponse> bobCheck = restTemplate.exchange(
                "/api/auth/me",
                HttpMethod.GET,
                new HttpEntity<>(authHeaders(bobPair.accessToken())),
                UserResponse.class
        );
        assertEquals(HttpStatus.OK, bobCheck.getStatusCode());
        assertEquals(bob.getId(), bobCheck.getBody().id());
    }

    // =========================================================================
    // Area 3: Refresh-Token Concurrency & Locking
    // =========================================================================

    @Test
    @DisplayName("P2.5-9: Real concurrent refresh requests cannot both consume the same refresh token")
    void testConcurrentRefreshTokenRotationPessimisticLocking() throws Exception {
        AuthResponse loginRes = authService.login(new LoginRequest(alice.getUsername(), aliceRawPassword));
        String rawRefreshToken = loginRes.refreshToken();

        int numThreads = 2;
        ExecutorService executor = Executors.newFixedThreadPool(numThreads);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch finishLatch = new CountDownLatch(numThreads);

        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger failureCount = new AtomicInteger(0);
        List<Exception> exceptions = new CopyOnWriteArrayList<>();

        for (int i = 0; i < numThreads; i++) {
            executor.submit(() -> {
                try {
                    startLatch.await();
                    authService.refreshToken(new RefreshTokenRequest(rawRefreshToken));
                    successCount.incrementAndGet();
                } catch (Exception ex) {
                    failureCount.incrementAndGet();
                    exceptions.add(ex);
                } finally {
                    finishLatch.countDown();
                }
            });
        }

        // Fire both threads simultaneously
        startLatch.countDown();
        boolean completed = finishLatch.await(10, TimeUnit.SECONDS);
        executor.shutdown();

        assertTrue(completed, "Concurrent refresh tasks must finish within timeout");
        assertEquals(1, successCount.get(), "Exactly one concurrent thread must succeed");
        assertEquals(1, failureCount.get(), "The second concurrent thread must fail");
    }

    @Test
    @DisplayName("P2.5-10: Token replay family revocation remains committed when outer transaction fails")
    void testTokenReplayRevocationCommittedDespiteOuterRollback() {
        AuthResponse pair1 = authService.login(new LoginRequest(alice.getUsername(), aliceRawPassword));
        AuthResponse pair2 = authService.refreshToken(new RefreshTokenRequest(pair1.refreshToken()));
        assertNotNull(pair2.accessToken(), "Initial token rotation must succeed");

        // Active tokens exist for Alice
        List<RefreshToken> tokensBefore = refreshTokenRepository.findAllByUser_Id(alice.getId());
        long activeCountBefore = tokensBefore.stream().filter(t -> !t.isRevoked()).count();
        assertTrue(activeCountBefore > 0);

        // Simulate replay invocation inside an outer transaction that rolls back
        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        tx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);

        try {
            tx.execute(status -> {
                jwtTokenService.rotateRefreshToken(pair1.refreshToken());
                return null;
            });
        } catch (IllegalArgumentException expected) {
            // Expected replay exception
        }

        // Verify that in the database, all tokens remain revoked via the REQUIRES_NEW inner commit
        List<RefreshToken> tokensAfter = refreshTokenRepository.findAllByUser_Id(alice.getId());
        long activeCountAfter = tokensAfter.stream().filter(t -> !t.isRevoked()).count();
        assertEquals(0, activeCountAfter,
                "All user tokens must remain revoked in the database even after the exception");
    }

    // =========================================================================
    // Area 4: Multi-Tenant Data & STOMP Authorization
    // =========================================================================

    @Test
    @DisplayName("P2.5-11: User A unauthorized mutation attempt against User B does NOT modify DB state")
    void testUnauthorizedMutationDoesNotChangeDatabaseState() {
        // Step 1: Create a goal for Bob
        Goal bobGoal = goalRepository.save(new Goal(
                "Bob Confidential Goal",
                "High security details",
                LocalDate.now(),
                LocalDate.now().plusMonths(1),
                bob
        ));

        // Step 2: Create a pending AI action for Bob
        AiAction bobAction = aiActionRepository.save(new AiAction(
                UUID.randomUUID().toString(),
                bob,
                "CREATE_GOAL",
                "LOW",
                "PENDING",
                "User goal recommendation",
                "{\"title\":\"AI Proposed Goal\"}",
                Instant.now().plusSeconds(3600)
        ));

        // Step 3: Authenticate as Alice
        AuthResponse aliceAuth = authService.login(new LoginRequest(alice.getUsername(), aliceRawPassword));
        HttpHeaders headers = authHeaders(aliceAuth.accessToken());

        // Alice attempts to delete Bob's goal
        ResponseEntity<String> deleteGoalRes = restTemplate.exchange(
                "/api/goals/" + bobGoal.getId(),
                HttpMethod.DELETE,
                new HttpEntity<>(headers),
                String.class
        );
        assertEquals(HttpStatus.NOT_FOUND, deleteGoalRes.getStatusCode());

        // Verify Bob's goal still exists intact in the database
        Goal preservedGoal = goalRepository.findById(bobGoal.getId()).orElse(null);
        assertNotNull(preservedGoal);
        assertEquals("Bob Confidential Goal", preservedGoal.getTitle());

        // Alice attempts to confirm Bob's AI action
        ResponseEntity<String> confirmActionRes = restTemplate.exchange(
                "/api/ai/actions/" + bobAction.getActionId() + "/confirm",
                HttpMethod.POST,
                new HttpEntity<>(headers),
                String.class
        );
        assertEquals(HttpStatus.FORBIDDEN, confirmActionRes.getStatusCode());

        // Verify Bob's AI action status remains PENDING in the database
        AiAction preservedAction = aiActionRepository.findByActionId(bobAction.getActionId()).orElse(null);
        assertNotNull(preservedAction);
        assertEquals("PENDING", preservedAction.getStatus());
    }

    @Test
    @DisplayName("P2.5-12: WebSocket channel interceptor enforces deny-by-default on arbitrary destinations")
    void testWebSocketChannelInterceptorDenyByDefault() {
        WebSocketConfig config = new WebSocketConfig(jwtTokenService, userDetailsService);
        var interceptor = config.createClientInboundInterceptor();

        UsernamePasswordAuthenticationToken aliceAuthToken = new UsernamePasswordAuthenticationToken(
                UserPrincipal.create(alice),
                null,
                List.of(new SimpleGrantedAuthority("ROLE_USER"))
        );

        // 1. User A attempting to subscribe to User B's topic throws AccessDeniedException
        org.springframework.messaging.simp.stomp.StompHeaderAccessor subB =
                org.springframework.messaging.simp.stomp.StompHeaderAccessor.create(
                        org.springframework.messaging.simp.stomp.StompCommand.SUBSCRIBE);
        subB.setDestination("/topic/users/" + bob.getId() + "/events");
        subB.setUser(aliceAuthToken);
        org.springframework.messaging.Message<?> subBMsg =
                org.springframework.messaging.support.MessageBuilder.createMessage(new byte[0], subB.getMessageHeaders());
        assertThrows(AccessDeniedException.class, () -> interceptor.preSend(subBMsg, null));

        // 2. Arbitrary destination throws AccessDeniedException
        org.springframework.messaging.simp.stomp.StompHeaderAccessor subArbitrary =
                org.springframework.messaging.simp.stomp.StompHeaderAccessor.create(
                        org.springframework.messaging.simp.stomp.StompCommand.SUBSCRIBE);
        subArbitrary.setDestination("/topic/unauthorized/leak");
        subArbitrary.setUser(aliceAuthToken);
        org.springframework.messaging.Message<?> subArbMsg =
                org.springframework.messaging.support.MessageBuilder.createMessage(new byte[0], subArbitrary.getMessageHeaders());
        assertThrows(AccessDeniedException.class, () -> interceptor.preSend(subArbMsg, null));

        // 3. User A subscribing to their own topic succeeds
        org.springframework.messaging.simp.stomp.StompHeaderAccessor subOwn =
                org.springframework.messaging.simp.stomp.StompHeaderAccessor.create(
                        org.springframework.messaging.simp.stomp.StompCommand.SUBSCRIBE);
        subOwn.setDestination("/topic/users/" + alice.getId() + "/sentinel/quarantine");
        subOwn.setUser(aliceAuthToken);
        org.springframework.messaging.Message<?> subOwnMsg =
                org.springframework.messaging.support.MessageBuilder.createMessage(new byte[0], subOwn.getMessageHeaders());
        assertNotNull(interceptor.preSend(subOwnMsg, null));
    }
}
