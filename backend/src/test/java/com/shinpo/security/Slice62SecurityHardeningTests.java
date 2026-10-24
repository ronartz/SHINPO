package com.shinpo.security;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.exceptions.JWTVerificationException;
import com.shinpo.config.WebSocketConfig;
import com.shinpo.dto.FocusSessionResponse;
import com.shinpo.entity.FocusSession;
import com.shinpo.entity.FocusSessionStatus;
import com.shinpo.entity.RefreshToken;
import com.shinpo.entity.User;
import com.shinpo.repository.FocusSessionRepository;
import com.shinpo.repository.RefreshTokenRepository;
import com.shinpo.repository.UserRepository;
import com.shinpo.service.FocusSessionEnforcementExceptionService;
import com.shinpo.service.FocusSessionService;
import com.shinpo.service.SentinelEnforcementService;
import com.shinpo.service.SentinelWarningService;
import com.shinpo.service.WebSocketEventService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.messaging.Message;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.PlatformTransactionManager;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.lang.reflect.Field;
import java.time.Duration;
import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class Slice62SecurityHardeningTests {

    private static final String STRONG_TEST_SECRET = "secure_production_secret_key_minimum_32_characters_for_hmac256_testing";

    @Mock
    private RefreshTokenRepository refreshTokenRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private FocusSessionRepository focusSessionRepository;

    @Mock
    private WebSocketEventService webSocketEventService;

    @Mock
    private CustomUserDetailsService userDetailsService;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private PlatformTransactionManager transactionManager;

    private User testUser;
    private UserPrincipal testUserPrincipal;

    @BeforeEach
    void setUp() {
        testUser = new User(
                "shinpo_tester",
                "tester@shinpo.io",
                "encoded_pw",
                "ROLE_USER",
                true,
                "STRICT",
                Instant.now()
        );
        setId(testUser, 100L);

        testUserPrincipal = new UserPrincipal(
                testUser.getId(),
                testUser.getUsername(),
                testUser.getEmail(),
                testUser.getPasswordHash(),
                testUser.isActive(),
                List.of(new SimpleGrantedAuthority("ROLE_USER"))
        );
    }

    private void setId(Object entity, Long id) {
        try {
            Field idField = entity.getClass().getDeclaredField("id");
            idField.setAccessible(true);
            idField.set(entity, id);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    // =========================================================================
    // 1. JWT Secret Configuration & Profile Isolation Tests
    // =========================================================================

    @Test
    @DisplayName("JWT: Startup fails in production when secret is null, empty, or whitespace")
    void testProductionStartupRefusesEmptySecret() {
        MockEnvironment prodEnv = new MockEnvironment();
        prodEnv.setActiveProfiles("prod");

        assertThrows(IllegalStateException.class, () ->
                new JwtTokenService(null, prodEnv, refreshTokenRepository)
        );
        assertThrows(IllegalStateException.class, () ->
                new JwtTokenService("", prodEnv, refreshTokenRepository)
        );
        assertThrows(IllegalStateException.class, () ->
                new JwtTokenService("   ", prodEnv, refreshTokenRepository)
        );
    }

    @Test
    @DisplayName("JWT: Startup fails in production when known dev secret or compose fallback is provided")
    void testProductionStartupRefusesKnownSecrets() {
        MockEnvironment prodEnv = new MockEnvironment();
        prodEnv.setActiveProfiles("prod");

        IllegalStateException ex1 = assertThrows(IllegalStateException.class, () ->
                new JwtTokenService(JwtTokenService.KNOWN_DEV_SECRET, prodEnv, refreshTokenRepository)
        );
        assertTrue(ex1.getMessage().contains("Default development JWT secret detected"));

        IllegalStateException ex2 = assertThrows(IllegalStateException.class, () ->
                new JwtTokenService("shinpo_default_super_secure_production_secret_key_2026", prodEnv, refreshTokenRepository)
        );
        assertTrue(ex2.getMessage().contains("Default development JWT secret detected"));
    }

    @Test
    @DisplayName("JWT: Known dev secret is permitted under explicit dev and test profiles")
    void testDevAndTestProfilesAllowDevSecret() {
        MockEnvironment devEnv = new MockEnvironment();
        devEnv.setActiveProfiles("dev");

        MockEnvironment testEnv = new MockEnvironment();
        testEnv.setActiveProfiles("test");

        assertDoesNotThrow(() -> new JwtTokenService(JwtTokenService.KNOWN_DEV_SECRET, devEnv, refreshTokenRepository));
        assertDoesNotThrow(() -> new JwtTokenService(JwtTokenService.KNOWN_DEV_SECRET, testEnv, refreshTokenRepository));
    }

    @Test
    @DisplayName("JWT: Secret shorter than 32 characters is rejected in all profiles")
    void testShortSecretRejected() {
        MockEnvironment devEnv = new MockEnvironment();
        devEnv.setActiveProfiles("dev");

        assertThrows(IllegalStateException.class, () ->
                new JwtTokenService("short_key_123", devEnv, refreshTokenRepository)
        );
    }

    // =========================================================================
    // 2. Token Verification & Expiration Tests
    // =========================================================================

    @Test
    @DisplayName("JWT: Invalid or malformed tokens are rejected")
    void testInvalidTokenRejected() {
        MockEnvironment testEnv = new MockEnvironment();
        testEnv.setActiveProfiles("test");
        JwtTokenService service = new JwtTokenService(STRONG_TEST_SECRET, testEnv, refreshTokenRepository);

        assertThrows(JWTVerificationException.class, () -> service.extractUserId("invalid.jwt.token"));
        assertThrows(JWTVerificationException.class, () -> service.extractUserId("not-even-a-jwt"));
    }

    @Test
    @DisplayName("JWT: Expired token is rejected on extraction")
    void testExpiredTokenRejected() {
        MockEnvironment testEnv = new MockEnvironment();
        testEnv.setActiveProfiles("test");
        JwtTokenService service = new JwtTokenService(STRONG_TEST_SECRET, testEnv, refreshTokenRepository);

        // Sign token that expired 10 minutes ago
        Algorithm algo = Algorithm.HMAC256(STRONG_TEST_SECRET);
        String expiredToken = JWT.create()
                .withIssuer("shinpo-arise")
                .withSubject("100")
                .withClaim("userId", 100L)
                .withIssuedAt(Instant.now().minus(Duration.ofMinutes(20)))
                .withExpiresAt(Instant.now().minus(Duration.ofMinutes(10)))
                .sign(algo);

        assertThrows(JWTVerificationException.class, () -> service.extractUserId(expiredToken));
    }

    @Test
    @DisplayName("JWT: Valid token successfully extracts claims")
    void testValidTokenExtraction() {
        MockEnvironment testEnv = new MockEnvironment();
        testEnv.setActiveProfiles("test");
        JwtTokenService service = new JwtTokenService(STRONG_TEST_SECRET, testEnv, refreshTokenRepository);

        String token = service.generateAccessToken(testUserPrincipal);
        assertNotNull(token);
        assertEquals(100L, service.extractUserId(token));
    }

    // =========================================================================
    // 3. Refresh Token Rotation & Revocation
    // =========================================================================

    @Test
    @DisplayName("JWT: Refresh token rotation revokes old token and issues fresh pair")
    void testRefreshTokenRotationLifecycle() {
        MockEnvironment testEnv = new MockEnvironment();
        testEnv.setActiveProfiles("test");
        JwtTokenService service = new JwtTokenService(STRONG_TEST_SECRET, testEnv, refreshTokenRepository);

        when(refreshTokenRepository.save(any(RefreshToken.class))).thenAnswer(i -> i.getArgument(0));

        String rawRefreshToken = service.generateRefreshToken(testUser);
        assertNotNull(rawRefreshToken);

        ArgumentCaptor<RefreshToken> captor = ArgumentCaptor.forClass(RefreshToken.class);
        verify(refreshTokenRepository).save(captor.capture());
        RefreshToken storedToken = captor.getValue();

        when(refreshTokenRepository.findByTokenHash(storedToken.getTokenHash()))
                .thenReturn(Optional.of(storedToken));

        // Rotate once
        JwtTokenService.TokenPair newPair = service.rotateRefreshToken(rawRefreshToken);
        assertNotNull(newPair.accessToken());
        assertNotNull(newPair.refreshToken());
        assertTrue(storedToken.isRevoked(), "Original refresh token must be revoked");

        // Attempting to rotate the now-revoked token must throw
        assertThrows(IllegalArgumentException.class, () ->
                service.rotateRefreshToken(rawRefreshToken)
        );
    }

    // =========================================================================
    // 4. WebSocket STOMP Authentication & Subscription Authorization
    // =========================================================================

    @Test
    @DisplayName("WebSocket: CONNECT without token assigns null principal")
    void testStompConnectWithoutToken() {
        WebSocketConfig wsConfig = new WebSocketConfig(null, userDetailsService);
        ChannelInterceptor interceptor = wsConfig.createClientInboundInterceptor();

        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.CONNECT);
        Message<?> connectMsg = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

        interceptor.preSend(connectMsg, null);
        assertNull(accessor.getUser());
    }

    @Test
    @DisplayName("WebSocket: CONNECT with valid token assigns UserDetails principal")
    void testStompConnectWithValidToken() {
        JwtTokenService jwtTokenService = mock(JwtTokenService.class);
        when(jwtTokenService.extractUserId("valid_jwt")).thenReturn(100L);
        when(jwtTokenService.extractTokenVersion("valid_jwt")).thenReturn(testUserPrincipal.getTokenVersion());
        when(userDetailsService.loadUserById(100L)).thenReturn(testUserPrincipal);

        WebSocketConfig wsConfig = new WebSocketConfig(jwtTokenService, userDetailsService);
        ChannelInterceptor interceptor = wsConfig.createClientInboundInterceptor();

        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.CONNECT);
        accessor.addNativeHeader("Authorization", "Bearer valid_jwt");
        accessor.setLeaveMutable(true);
        Message<?> connectMsg = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

        Message<?> postMsg = interceptor.preSend(connectMsg, null);
        StompHeaderAccessor resultAccessor = StompHeaderAccessor.wrap(postMsg);
        assertNotNull(resultAccessor.getUser());
        assertTrue(resultAccessor.getUser() instanceof UsernamePasswordAuthenticationToken);
    }

    @Test
    @DisplayName("WebSocket: SUBSCRIBE to user destination without auth throws AccessDeniedException")
    void testStompSubscribeUnauthenticatedThrows() {
        WebSocketConfig wsConfig = new WebSocketConfig(null, userDetailsService);
        ChannelInterceptor interceptor = wsConfig.createClientInboundInterceptor();

        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
        accessor.setDestination("/topic/users/100/focus-session");
        Message<?> msg = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

        assertThrows(AccessDeniedException.class, () -> interceptor.preSend(msg, null));
    }

    @Test
    @DisplayName("WebSocket: SUBSCRIBE to another user's destination throws AccessDeniedException")
    void testStompSubscribeCrossUserThrows() {
        WebSocketConfig wsConfig = new WebSocketConfig(null, userDetailsService);
        ChannelInterceptor interceptor = wsConfig.createClientInboundInterceptor();

        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
        accessor.setDestination("/topic/users/200/focus-session"); // Bob
        accessor.setUser(new UsernamePasswordAuthenticationToken(testUserPrincipal, null)); // Alice (100)
        Message<?> msg = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

        AccessDeniedException ex = assertThrows(AccessDeniedException.class, () -> interceptor.preSend(msg, null));
        assertTrue(ex.getMessage().contains("not authorized"));
    }

    // =========================================================================
    // 5. Enforcement Mode Persistence Across Service Restarts
    // =========================================================================

    @Test
    @DisplayName("EnforcementMode: Persists to User entity and reloads on new service instance (restart)")
    void testEnforcementModeSurvivesRestart() {
        when(userRepository.findById(100L)).thenReturn(Optional.of(testUser));
        when(userRepository.save(any(User.class))).thenAnswer(i -> i.getArgument(0));

        SentinelEnforcementService serviceInstance1 = new SentinelEnforcementService(
                focusSessionRepository,
                mock(com.shinpo.repository.SentinelQuarantineRepository.class),
                mock(com.shinpo.repository.SentinelPolicyRuleRepository.class),
                mock(com.shinpo.repository.SentinelTamperEventRepository.class),
                userRepository,
                passwordEncoder,
                transactionManager,
                webSocketEventService,
                mock(FocusSessionEnforcementExceptionService.class),
                mock(SentinelWarningService.class)
        );

        // Initially STRICT
        assertEquals("STRICT", serviceInstance1.getEnforcementMode(100L));

        // Change mode to AUDIT_ONLY
        serviceInstance1.setEnforcementMode(100L, "AUDIT_ONLY");
        assertEquals("AUDIT_ONLY", serviceInstance1.getEnforcementMode(100L));
        assertEquals("AUDIT_ONLY", testUser.getEnforcementMode(), "User entity must be updated");
        verify(userRepository, atLeastOnce()).save(testUser);

        // Simulate backend restart by creating fresh service instance with empty in-memory cache
        SentinelEnforcementService serviceInstance2 = new SentinelEnforcementService(
                focusSessionRepository,
                mock(com.shinpo.repository.SentinelQuarantineRepository.class),
                mock(com.shinpo.repository.SentinelPolicyRuleRepository.class),
                mock(com.shinpo.repository.SentinelTamperEventRepository.class),
                userRepository,
                passwordEncoder,
                transactionManager,
                webSocketEventService,
                mock(FocusSessionEnforcementExceptionService.class),
                mock(SentinelWarningService.class)
        );

        // Must reload AUDIT_ONLY from repository, NOT reset silently to STRICT
        assertEquals("AUDIT_ONLY", serviceInstance2.getEnforcementMode(100L));
    }

    // =========================================================================
    // 6. Active Focus Session Cancellation Bug (B-01) Verification
    // =========================================================================

    @Test
    @DisplayName("FocusSession: Cancelling an ACTIVE session succeeds and sets CANCELLED status truthfully")
    void testCancelActiveSessionSucceeds() {
        FocusSession activeSession = new FocusSession();
        activeSession.setUser(testUser);
        activeSession.setName("Active Sprint");
        activeSession.setIntention("Writing code");
        activeSession.setDurationMinutes(25);
        activeSession.setStatus(FocusSessionStatus.ACTIVE);
        activeSession.setStartedAt(Instant.now().minus(Duration.ofMinutes(10)));
        setId(activeSession, 501L);

        when(focusSessionRepository.findByIdAndUser_IdForUpdate(501L, testUser.getId())).thenReturn(Optional.of(activeSession));
        when(focusSessionRepository.save(any(FocusSession.class))).thenAnswer(i -> i.getArgument(0));

        FocusSessionService sessionService = new FocusSessionService(
                focusSessionRepository,
                userRepository,
                mock(com.shinpo.repository.GoalRepository.class),
                mock(com.shinpo.repository.MissionRepository.class),
                mock(com.shinpo.repository.SessionPlanRepository.class),
                webSocketEventService
        );

        FocusSessionResponse response = sessionService.cancelSession(501L, testUser.getId());
        assertEquals(FocusSessionStatus.CANCELLED, response.getStatus());
        assertNotNull(response.getEndedAt());
        assertEquals(FocusSessionStatus.CANCELLED, activeSession.getStatus());
        verify(focusSessionRepository).save(activeSession);
    }

    @Test
    @DisplayName("FocusSession: Cancelling a PAUSED session calculates pause duration and sets CANCELLED")
    void testCancelPausedSessionSucceeds() {
        FocusSession pausedSession = new FocusSession();
        pausedSession.setUser(testUser);
        pausedSession.setName("Paused Sprint");
        pausedSession.setIntention("Reviewing docs");
        pausedSession.setDurationMinutes(25);
        pausedSession.setStatus(FocusSessionStatus.PAUSED);
        pausedSession.setStartedAt(Instant.now().minus(Duration.ofMinutes(15)));
        pausedSession.setPausedAt(Instant.now().minus(Duration.ofMinutes(5)));
        setId(pausedSession, 502L);

        when(focusSessionRepository.findByIdAndUser_IdForUpdate(502L, testUser.getId())).thenReturn(Optional.of(pausedSession));
        when(focusSessionRepository.save(any(FocusSession.class))).thenAnswer(i -> i.getArgument(0));

        FocusSessionService sessionService = new FocusSessionService(
                focusSessionRepository,
                userRepository,
                mock(com.shinpo.repository.GoalRepository.class),
                mock(com.shinpo.repository.MissionRepository.class),
                mock(com.shinpo.repository.SessionPlanRepository.class),
                webSocketEventService
        );

        FocusSessionResponse response = sessionService.cancelSession(502L, testUser.getId());
        assertEquals(FocusSessionStatus.CANCELLED, response.getStatus());
        assertNull(pausedSession.getPausedAt());
        assertTrue(pausedSession.getAccumulatedPausedSeconds() >= 300L);
    }

    @Test
    @DisplayName("FocusSession: Cancelling a COMPLETED or already CANCELLED session throws IllegalStateException")
    void testCancelTerminalSessionThrows() {
        FocusSession completedSession = new FocusSession();
        completedSession.setUser(testUser);
        completedSession.setName("Done Sprint");
        completedSession.setIntention("Done");
        completedSession.setDurationMinutes(25);
        completedSession.setStatus(FocusSessionStatus.COMPLETED);
        setId(completedSession, 503L);

        when(focusSessionRepository.findByIdAndUser_IdForUpdate(503L, testUser.getId())).thenReturn(Optional.of(completedSession));

        FocusSessionService sessionService = new FocusSessionService(
                focusSessionRepository,
                userRepository,
                mock(com.shinpo.repository.GoalRepository.class),
                mock(com.shinpo.repository.MissionRepository.class),
                mock(com.shinpo.repository.SessionPlanRepository.class),
                webSocketEventService
        );

        assertThrows(IllegalStateException.class, () -> sessionService.cancelSession(503L, testUser.getId()));
    }

    // =========================================================================
    // 7. Retired Python Daemon Guard Test
    // =========================================================================

    @Test
    @DisplayName("Legacy Daemon: Invoking daemon/shinpo_shield.py exits with code 1 and error message")
    void testLegacyPythonDaemonRefusesExecution() throws Exception {
        java.io.File script = new java.io.File("daemon/shinpo_shield.py");
        if (!script.exists()) {
            script = new java.io.File("../daemon/shinpo_shield.py");
        }
        assertTrue(script.exists(), "daemon/shinpo_shield.py must exist");

        ProcessBuilder pb = new ProcessBuilder("python3", script.getAbsolutePath());
        pb.redirectErrorStream(true);
        Process process = pb.start();

        int exitCode = process.waitFor();
        assertEquals(1, exitCode, "Retired Python daemon must exit with status code 1");

        StringBuilder output = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
            String line;
            while ((line = reader.readLine()) != null) {
                output.append(line).append("\n");
            }
        }
        assertTrue(output.toString().contains("RETIRED and DEPRECATED"));
    }
}
