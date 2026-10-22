package com.shinpo.service;

import com.shinpo.dto.AuthDtos.AuthResponse;
import com.shinpo.dto.AuthDtos.LoginRequest;
import com.shinpo.dto.AuthDtos.RefreshTokenRequest;
import com.shinpo.dto.AuthDtos.RegisterRequest;
import com.shinpo.dto.UserResponse;
import com.shinpo.entity.Goal;
import com.shinpo.entity.Mission;
import com.shinpo.entity.User;
import com.shinpo.repository.GoalRepository;
import com.shinpo.repository.MissionRepository;
import com.shinpo.repository.UserRepository;
import com.shinpo.security.JwtTokenService;
import com.shinpo.security.JwtTokenService.TokenPair;
import com.shinpo.security.UserPrincipal;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;

@Service
@Transactional
public class AuthService {

    private final UserRepository userRepository;
    private final GoalRepository goalRepository;
    private final MissionRepository missionRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenService jwtTokenService;
    private final com.shinpo.security.RateLimitingService rateLimitingService;

    public AuthService(
            UserRepository userRepository,
            GoalRepository goalRepository,
            MissionRepository missionRepository,
            PasswordEncoder passwordEncoder,
            JwtTokenService jwtTokenService
    ) {
        this(userRepository, goalRepository, missionRepository, passwordEncoder, jwtTokenService, null);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public AuthService(
            UserRepository userRepository,
            GoalRepository goalRepository,
            MissionRepository missionRepository,
            PasswordEncoder passwordEncoder,
            JwtTokenService jwtTokenService,
            com.shinpo.security.RateLimitingService rateLimitingService
    ) {
        this.userRepository = userRepository;
        this.goalRepository = goalRepository;
        this.missionRepository = missionRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenService = jwtTokenService;
        this.rateLimitingService = rateLimitingService;
    }

    private void validatePasswordSafety(String password) {
        if (password == null || password.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password cannot be empty");
        }
        if (password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password exceeds maximum allowable length of 72 bytes");
        }
    }

    public AuthResponse register(RegisterRequest request) {
        validatePasswordSafety(request.password());
        if (userRepository.existsByUsername(request.username())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Username is already taken");
        }
        if (userRepository.existsByEmail(request.email())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email is already registered");
        }

        String hashedPassword = passwordEncoder.encode(request.password());
        User user = new User(
                request.username(),
                request.email(),
                hashedPassword,
                Instant.now()
        );

        User savedUser = userRepository.save(user);

        // Seed clearly labeled examples; onboarding actions are recorded separately.
        Goal initialGoal = goalRepository.save(new Goal(
                "Starter goal: Master Execution System",
                "Starter example — edit or replace this goal with an outcome that matters to you.",
                LocalDate.now(),
                LocalDate.now().plusMonths(3),
                savedUser
        ));

        missionRepository.save(new Mission(
                "Starter task: First Focus Session",
                "Starter example — edit or replace this with a concrete next action for your goal.",
                LocalDate.now(),
                25,
                initialGoal
        ));

        UserPrincipal principal = UserPrincipal.create(savedUser);
        String accessToken = jwtTokenService.generateAccessToken(principal);
        String refreshToken = jwtTokenService.generateRefreshToken(savedUser);

        UserResponse userResponse = new UserResponse(
                savedUser.getId(),
                savedUser.getUsername(),
                savedUser.getEmail(),
                savedUser.getRole()
        );

        return AuthResponse.of(accessToken, refreshToken, userResponse);
    }

    public AuthResponse login(LoginRequest request) {
        validatePasswordSafety(request.password());

        if (rateLimitingService != null && rateLimitingService.isAccountLockedOut(request.usernameOrEmail())) {
            long retryAfter = rateLimitingService.getRetryAfterSeconds(
                    "login_fail_account:" + request.usernameOrEmail().toLowerCase().trim(),
                    com.shinpo.security.RateLimitingService.FAILED_LOGIN_WINDOW
            );
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "Too many failed login attempts for this account. Account locked for " + retryAfter + " seconds.");
        }

        User user = userRepository.findByUsername(request.usernameOrEmail())
                .or(() -> userRepository.findByEmail(request.usernameOrEmail()))
                .orElse(null);

        if (user == null) {
            if (rateLimitingService != null) {
                rateLimitingService.recordFailedLoginForAccount(request.usernameOrEmail());
            }
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid username/email or password");
        }

        if (!user.isActive()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User account is disabled");
        }

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            if (rateLimitingService != null) {
                rateLimitingService.recordFailedLoginForAccount(request.usernameOrEmail());
            }
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid username/email or password");
        }

        if (rateLimitingService != null) {
            rateLimitingService.recordSuccessfulLoginForAccount(request.usernameOrEmail());
        }

        UserPrincipal principal = UserPrincipal.create(user);
        String accessToken = jwtTokenService.generateAccessToken(principal);
        String refreshToken = jwtTokenService.generateRefreshToken(user);

        UserResponse userResponse = new UserResponse(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getRole()
        );

        return AuthResponse.of(accessToken, refreshToken, userResponse);
    }

    public AuthResponse refreshToken(RefreshTokenRequest request) {
        try {
            TokenPair pair = jwtTokenService.rotateRefreshToken(request.refreshToken());
            Long userId = jwtTokenService.extractUserId(pair.accessToken());
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));

            if (!user.isActive()) {
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User account is disabled");
            }

            UserResponse userResponse = new UserResponse(
                    user.getId(),
                    user.getUsername(),
                    user.getEmail(),
                    user.getRole()
            );

            return AuthResponse.of(pair.accessToken(), pair.refreshToken(), userResponse);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, e.getMessage());
        }
    }

    public void logout(String refreshToken) {
        jwtTokenService.revokeRefreshToken(refreshToken);
    }

    public void logoutAllForUser(Long userId) {
        jwtTokenService.revokeAllUserTokens(userId);
    }

    public void changePassword(Long userId, String currentPassword, String newPassword) {
        validatePasswordSafety(newPassword);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Current password does not match");
        }
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.setTokenVersion(user.getTokenVersion() + 1);
        userRepository.save(user);

        // Security Hardening: Revoke all refresh tokens on password change to terminate other active sessions
        jwtTokenService.revokeAllUserTokens(userId);
    }
}
