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

    public AuthService(
            UserRepository userRepository,
            GoalRepository goalRepository,
            MissionRepository missionRepository,
            PasswordEncoder passwordEncoder,
            JwtTokenService jwtTokenService
    ) {
        this.userRepository = userRepository;
        this.goalRepository = goalRepository;
        this.missionRepository = missionRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenService = jwtTokenService;
    }

    public AuthResponse register(RegisterRequest request) {
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

        // Seed initial starter goal and mission for this new user
        Goal initialGoal = goalRepository.save(new Goal(
                "Master Execution System",
                "Build disciplined execution habits with SHINPO",
                LocalDate.now(),
                LocalDate.now().plusMonths(3),
                savedUser
        ));

        missionRepository.save(new Mission(
                "Complete First Focus Session",
                "Initiate and complete a 25-minute deep focus session",
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
        User user = userRepository.findByUsername(request.usernameOrEmail())
                .or(() -> userRepository.findByEmail(request.usernameOrEmail()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid username/email or password"));

        if (!user.isActive()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User account is disabled");
        }

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid username/email or password");
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
}
