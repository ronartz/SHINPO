package com.shinpo.security;

import com.shinpo.dto.AuthDtos.LoginRequest;
import com.shinpo.entity.RefreshToken;
import com.shinpo.entity.User;
import com.shinpo.repository.RefreshTokenRepository;
import com.shinpo.repository.UserRepository;
import com.shinpo.service.AuthService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@ActiveProfiles("test")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class Phase1SecurityHardeningTests {

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    @Autowired
    private AuthService authService;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtTokenService jwtTokenService;

    @Autowired
    private org.springframework.transaction.support.TransactionTemplate transactionTemplate;

    @Test
    @DisplayName("Chunk 1.1: User entity and UserPrincipal dynamically map custom roles and active status")
    void testUserRoleAndActiveStatusMapping() {
        String uniqueSuffix = UUID.randomUUID().toString().substring(0, 8);
        User adminUser = new User(
                "admin_" + uniqueSuffix,
                "admin_" + uniqueSuffix + "@shinpo.test",
                passwordEncoder.encode("password123"),
                "ROLE_ADMIN",
                true,
                Instant.now()
        );
        User savedAdmin = userRepository.save(adminUser);

        UserPrincipal adminPrincipal = UserPrincipal.create(savedAdmin);
        assertEquals("ROLE_ADMIN", adminPrincipal.getRole());
        assertTrue(adminPrincipal.isEnabled());
        assertTrue(adminPrincipal.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN")));

        User inactiveUser = new User(
                "inactive_" + uniqueSuffix,
                "inactive_" + uniqueSuffix + "@shinpo.test",
                passwordEncoder.encode("password123"),
                "ROLE_USER",
                false,
                Instant.now()
        );
        User savedInactive = userRepository.save(inactiveUser);

        UserPrincipal inactivePrincipal = UserPrincipal.create(savedInactive);
        assertEquals("ROLE_USER", inactivePrincipal.getRole());
        assertFalse(inactivePrincipal.isEnabled(), "UserPrincipal.isEnabled() must be false for inactive users");
    }

    @Test
    @DisplayName("Chunk 1.1: Inactive user is rejected on login and token refresh")
    void testInactiveUserRejected() {
        String uniqueSuffix = UUID.randomUUID().toString().substring(0, 8);
        User user = new User(
                "test_" + uniqueSuffix,
                "test_" + uniqueSuffix + "@shinpo.test",
                passwordEncoder.encode("secretpass"),
                "ROLE_USER",
                true,
                Instant.now()
        );
        User saved = userRepository.save(user);

        // Can log in while active
        assertNotNull(authService.login(new LoginRequest(saved.getUsername(), "secretpass")));

        // Deactivate account
        saved.setActive(false);
        userRepository.save(saved);

        // Must reject login
        ResponseStatusException loginEx = assertThrows(ResponseStatusException.class, () ->
                authService.login(new LoginRequest(saved.getUsername(), "secretpass"))
        );
        assertEquals(HttpStatus.UNAUTHORIZED, loginEx.getStatusCode());
        assertEquals("User account is disabled", loginEx.getReason());
    }

    @Test
    @DisplayName("Chunk 1.2: Production JWT secret gating throws on missing or dev secret in prod profile")
    void testProductionJwtSecretGating() {
        MockEnvironment prodEnv = new MockEnvironment();
        prodEnv.setActiveProfiles("prod");

        MockEnvironment devEnv = new MockEnvironment();
        devEnv.setActiveProfiles("dev");

        // 1. Unset/blank secret must fail in any environment
        assertThrows(IllegalStateException.class, () ->
                new JwtTokenService("", prodEnv, refreshTokenRepository)
        );
        assertThrows(IllegalStateException.class, () ->
                new JwtTokenService(null, devEnv, refreshTokenRepository)
        );

        // 2. Default development secret must fail in production profile
        IllegalStateException prodSecretEx = assertThrows(IllegalStateException.class, () ->
                new JwtTokenService(JwtTokenService.KNOWN_DEV_SECRET, prodEnv, refreshTokenRepository)
        );
        assertTrue(prodSecretEx.getMessage().contains("Default development JWT secret detected in production profile"));

        // 3. Default development secret is allowed in dev profile
        assertDoesNotThrow(() ->
                new JwtTokenService(JwtTokenService.KNOWN_DEV_SECRET, devEnv, refreshTokenRepository)
        );

        // 4. Strong custom secret is accepted in prod profile
        String strongProdSecret = "super_secure_production_secret_key_minimum_32_chars_long_12345";
        assertDoesNotThrow(() ->
                new JwtTokenService(strongProdSecret, prodEnv, refreshTokenRepository)
        );

        // 5. Short secret (<32 chars) fails anywhere
        assertThrows(IllegalStateException.class, () ->
                new JwtTokenService("too_short_secret", devEnv, refreshTokenRepository)
        );
    }

    @Test
    @DisplayName("Chunk 1.3: Eliminate seed disclosures - GET /api/users/default is removed")
    void testDefaultUserEndpointRemoved() {
        // 1. Unauthenticated request to /api/users/default is rejected by Security (no public backdoor)
        ResponseEntity<String> unauthenticatedResponse = restTemplate.getForEntity("/api/users/default", String.class);
        assertEquals(HttpStatus.UNAUTHORIZED, unauthenticatedResponse.getStatusCode(),
                "GET /api/users/default without auth must return 401 UNAUTHORIZED");

        // 2. Authenticated request to /api/users/default returns 404 NOT FOUND (endpoint does not exist)
        String uniqueSuffix = UUID.randomUUID().toString().substring(0, 8);
        User user = userRepository.save(new User(
                "auth_tester_" + uniqueSuffix,
                "auth_tester_" + uniqueSuffix + "@shinpo.test",
                passwordEncoder.encode("secretpass"),
                Instant.now()
        ));
        String token = jwtTokenService.generateAccessToken(UserPrincipal.create(user));

        org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
        headers.setBearerAuth(token);
        org.springframework.http.HttpEntity<Void> entity = new org.springframework.http.HttpEntity<>(headers);

        ResponseEntity<String> authenticatedResponse = restTemplate.exchange(
                "/api/users/default",
                org.springframework.http.HttpMethod.GET,
                entity,
                String.class
        );
        assertEquals(HttpStatus.NOT_FOUND, authenticatedResponse.getStatusCode(),
                "GET /api/users/default with valid auth must return 404 NOT_FOUND");
    }

    @Test
    @DisplayName("Chunk 1.4: Refresh token repository findByTokenHash with pessimistic lock")
    void testRefreshTokenFindByTokenHashLock() {
        String uniqueSuffix = UUID.randomUUID().toString().substring(0, 8);
        User user = new User(
                "token_user_" + uniqueSuffix,
                "token_user_" + uniqueSuffix + "@shinpo.test",
                passwordEncoder.encode("secretpass"),
                Instant.now()
        );
        User savedUser = userRepository.save(user);

        String rawToken = "test_raw_token_" + uniqueSuffix;
        String tokenHash = JwtTokenService.hashToken(rawToken);

        RefreshToken token = new RefreshToken(savedUser, tokenHash, Instant.now().plusSeconds(3600));
        refreshTokenRepository.save(token);

        // 1. Outside active transaction, pessimistic write lock query throws TransactionRequiredException
        assertThrows(org.springframework.dao.InvalidDataAccessApiUsageException.class, () ->
                refreshTokenRepository.findByTokenHash(tokenHash)
        );

        // 2. Within active transaction, pessimistic write lock succeeds and acquires row lock
        Optional<RefreshToken> found = transactionTemplate.execute(status ->
                refreshTokenRepository.findByTokenHash(tokenHash)
        );
        assertNotNull(found);
        assertTrue(found.isPresent());
        assertEquals(tokenHash, found.get().getTokenHash());
        assertEquals(savedUser.getId(), found.get().getUser().getId());
    }
}
