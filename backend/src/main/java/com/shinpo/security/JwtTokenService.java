package com.shinpo.security;

import com.auth0.jwt.JWT;
import com.auth0.jwt.JWTVerifier;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.exceptions.JWTVerificationException;
import com.auth0.jwt.interfaces.Claim;
import com.auth0.jwt.interfaces.DecodedJWT;
import com.shinpo.entity.RefreshToken;
import com.shinpo.entity.User;
import com.shinpo.repository.RefreshTokenRepository;
import com.shinpo.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class JwtTokenService {

    public static final String KNOWN_DEV_SECRET = "shinpo_arise_master_key_secure_development_secret_2026_production_grade_32b";
    private static final String LEGACY_COMPOSE_FALLBACK = "shinpo_default_super_secure_production_secret_key_2026";
    private static final java.util.Set<String> FORBIDDEN_PRODUCTION_SECRETS = java.util.Set.of(
            KNOWN_DEV_SECRET,
            LEGACY_COMPOSE_FALLBACK
    );
    private static final String ISSUER = "shinpo-arise";
    private static final Duration ACCESS_TOKEN_EXPIRY = Duration.ofMinutes(60);
    private static final Duration REFRESH_TOKEN_EXPIRY = Duration.ofDays(30);

    private final Algorithm algorithm;
    private final JWTVerifier verifier;
    private final RefreshTokenRepository refreshTokenRepository;
    private final UserRepository userRepository;
    private final SecureRandom secureRandom = new SecureRandom();
    private final TransactionTemplate requiresNewTransactionTemplate;
    private final Map<String, Instant> blacklistedTokens = new ConcurrentHashMap<>();

    public JwtTokenService(
            @Value("${shinpo.jwt.secret:}") String secret,
            Environment environment,
            RefreshTokenRepository refreshTokenRepository
    ) {
        this(secret, environment, refreshTokenRepository, null, null);
    }

    public JwtTokenService(
            @Value("${shinpo.jwt.secret:}") String secret,
            Environment environment,
            RefreshTokenRepository refreshTokenRepository,
            PlatformTransactionManager transactionManager
    ) {
        this(secret, environment, refreshTokenRepository, null, transactionManager);
    }

    @Autowired
    public JwtTokenService(
            @Value("${shinpo.jwt.secret:}") String secret,
            Environment environment,
            RefreshTokenRepository refreshTokenRepository,
            @Autowired(required = false) UserRepository userRepository,
            @Autowired(required = false) PlatformTransactionManager transactionManager
    ) {
        boolean isProduction = Arrays.stream(environment.getActiveProfiles())
                .anyMatch(p -> p.equalsIgnoreCase("prod") || p.equalsIgnoreCase("production"));
        boolean isDevOrTest = Arrays.stream(environment.getActiveProfiles())
                .anyMatch(p -> p.equalsIgnoreCase("dev") || p.equalsIgnoreCase("development") || p.equalsIgnoreCase("test"));

        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException(
                    "shinpo.jwt.secret must be configured via the SHINPO_JWT_SECRET environment variable. " +
                    "A hardcoded or empty secret is not permitted.");
        }
        if (isProduction && FORBIDDEN_PRODUCTION_SECRETS.contains(secret)) {
            throw new IllegalStateException(
                    "Default development JWT secret detected in production profile! " +
                    "You must provide a secure, unique SHINPO_JWT_SECRET in production.");
        }
        if (!isDevOrTest && FORBIDDEN_PRODUCTION_SECRETS.contains(secret)) {
            throw new IllegalStateException(
                    "Default development JWT secret is strictly forbidden outside dev/test profiles! " +
                    "You must provide a secure, unique SHINPO_JWT_SECRET.");
        }
        if (secret.length() < 32) {
            throw new IllegalStateException(
                    "shinpo.jwt.secret must be at least 32 characters long to ensure HMAC-SHA256 security.");
        }
        this.algorithm = Algorithm.HMAC256(secret);
        this.verifier = JWT.require(algorithm).withIssuer(ISSUER).build();
        this.refreshTokenRepository = refreshTokenRepository;
        this.userRepository = userRepository;
        if (transactionManager != null) {
            this.requiresNewTransactionTemplate = new TransactionTemplate(transactionManager);
            this.requiresNewTransactionTemplate.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        } else {
            this.requiresNewTransactionTemplate = null;
        }
    }

    public String generateAccessToken(UserPrincipal principal) {
        Instant now = Instant.now();
        Instant expiresAt = now.plus(ACCESS_TOKEN_EXPIRY);

        return JWT.create()
                .withIssuer(ISSUER)
                .withSubject(String.valueOf(principal.getUserId()))
                .withJWTId(UUID.randomUUID().toString())
                .withClaim("userId", principal.getUserId())
                .withClaim("username", principal.getUsername())
                .withClaim("email", principal.getEmail())
                .withClaim("tokenVersion", principal.getTokenVersion())
                .withIssuedAt(now)
                .withExpiresAt(expiresAt)
                .sign(algorithm);
    }

    public DecodedJWT verifyAccessToken(String token) throws JWTVerificationException {
        return verifier.verify(token);
    }

    public Long extractUserId(String token) throws JWTVerificationException {
        DecodedJWT decoded = verifyAccessToken(token);
        return decoded.getClaim("userId").asLong();
    }

    @Transactional
    public String generateRefreshToken(User user) {
        byte[] randomBytes = new byte[32];
        secureRandom.nextBytes(randomBytes);
        String rawToken = Base64.getUrlEncoder().withoutPadding().encodeToString(randomBytes);
        String tokenHash = hashToken(rawToken);

        Instant expiresAt = Instant.now().plus(REFRESH_TOKEN_EXPIRY);
        RefreshToken refreshToken = new RefreshToken(user, tokenHash, expiresAt);
        refreshTokenRepository.save(refreshToken);

        return rawToken;
    }

    @Transactional(noRollbackFor = {IllegalArgumentException.class})
    public TokenPair rotateRefreshToken(String rawRefreshToken) {
        String tokenHash = hashToken(rawRefreshToken);
        RefreshToken refreshToken = refreshTokenRepository.findByTokenHash(tokenHash)
                .orElseThrow(() -> new IllegalArgumentException("Invalid refresh token"));

        if (refreshToken.isRevoked()) {
            // Replay detection: An already-revoked refresh token was presented!
            // Revoke all tokens for this user immediately (token family compromise)
            revokeAllUserTokens(refreshToken.getUser().getId());
            throw new IllegalArgumentException("Refresh token replay detected. All sessions have been revoked.");
        }

        if (refreshToken.isExpired()) {
            throw new IllegalArgumentException("Refresh token is expired");
        }

        // Revoke the old token (one-time use / rotation)
        refreshToken.revoke();
        refreshTokenRepository.save(refreshToken);

        User user = refreshToken.getUser();
        if (!user.isActive()) {
            throw new IllegalArgumentException("User account is disabled");
        }

        UserPrincipal principal = UserPrincipal.create(user);

        String newAccessToken = generateAccessToken(principal);
        String newRefreshToken = generateRefreshToken(user);

        return new TokenPair(newAccessToken, newRefreshToken);
    }

    @Transactional
    public void revokeRefreshToken(String rawRefreshToken) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) {
            return;
        }
        String tokenHash = hashToken(rawRefreshToken);
        refreshTokenRepository.findByTokenHash(tokenHash).ifPresent(token -> {
            token.revoke();
            refreshTokenRepository.save(token);
        });
    }

    public Long extractTokenVersion(String token) throws JWTVerificationException {
        DecodedJWT decoded = verifyAccessToken(token);
        Claim claim = decoded.getClaim("tokenVersion");
        return (claim != null && !claim.isNull()) ? claim.asLong() : null;
    }

    public String extractJwtId(String token) throws JWTVerificationException {
        DecodedJWT decoded = verifyAccessToken(token);
        return decoded.getId();
    }

    public void blacklistToken(String token) {
        if (token == null || token.isBlank()) {
            return;
        }
        try {
            DecodedJWT jwt = verifyAccessToken(token);
            String jti = jwt.getId();
            Instant expiresAt = jwt.getExpiresAtAsInstant();
            if (jti != null && expiresAt != null && expiresAt.isAfter(Instant.now())) {
                blacklistedTokens.put(jti, expiresAt);
            }
        } catch (Exception ignored) {
        }
    }

    public boolean isTokenBlacklisted(String token) {
        if (token == null || token.isBlank()) {
            return false;
        }
        try {
            DecodedJWT jwt = verifyAccessToken(token);
            String jti = jwt.getId();
            if (jti == null) {
                return false;
            }
            Instant expiresAt = blacklistedTokens.get(jti);
            if (expiresAt == null) {
                return false;
            }
            if (Instant.now().isAfter(expiresAt)) {
                blacklistedTokens.remove(jti);
                return false;
            }
            return true;
        } catch (Exception e) {
            return true;
        }
    }

    @Transactional
    public void revokeAllUserTokens(Long userId) {
        if (userId == null) {
            return;
        }
        Runnable revokeTask = () -> {
            if (userRepository != null) {
                userRepository.incrementTokenVersion(userId);
            }
            List<RefreshToken> activeTokens = refreshTokenRepository.findAllByUser_Id(userId);
            for (RefreshToken token : activeTokens) {
                if (!token.isRevoked()) {
                    token.revoke();
                }
            }
            refreshTokenRepository.saveAll(activeTokens);
        };

        if (requiresNewTransactionTemplate != null) {
            requiresNewTransactionTemplate.executeWithoutResult(status -> revokeTask.run());
        } else {
            revokeTask.run();
        }
    }

    public static String hashToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 algorithm not available", e);
        }
    }

    public record TokenPair(String accessToken, String refreshToken) {}
}
