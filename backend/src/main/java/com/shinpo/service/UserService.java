package com.shinpo.service;

import com.shinpo.dto.CreateUserRequest;
import com.shinpo.dto.UserResponse;
import com.shinpo.entity.User;
import com.shinpo.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Instant;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public UserService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    public UserResponse createUser(CreateUserRequest request) {
        String hashedPassword = passwordEncoder.encode(request.password());

        User user = new User(
                request.username(),
                request.email(),
                hashedPassword,
                Instant.now()
        );

        User savedUser = userRepository.save(user);

        return new UserResponse(
                savedUser.getId(),
                savedUser.getUsername(),
                savedUser.getEmail(),
                savedUser.getRole()
        );
    }

    @org.springframework.transaction.annotation.Transactional
    public UserResponse updateUsername(Long userId, String newUsername) {
        if (newUsername == null || newUsername.isBlank()) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.BAD_REQUEST, "Username cannot be blank"
            );
        }
        String trimmed = newUsername.trim();
        if (trimmed.length() < 3 || trimmed.length() > 50) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.BAD_REQUEST, "Username must be between 3 and 50 characters"
            );
        }
        if (!trimmed.matches("^[a-zA-Z0-9_.-]+$")) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.BAD_REQUEST, "Username can only contain letters, numbers, underscores, hyphens, and periods"
            );
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(
                        org.springframework.http.HttpStatus.NOT_FOUND, "User not found: " + userId
                ));

        if (user.getUsername().equalsIgnoreCase(trimmed)) {
            return new UserResponse(user.getId(), user.getUsername(), user.getEmail(), user.getRole());
        }

        if (userRepository.existsByUsername(trimmed)) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.CONFLICT, "Username '" + trimmed + "' is already taken"
            );
        }

        user.setUsername(trimmed);
        User saved = userRepository.save(user);

        return new UserResponse(
                saved.getId(),
                saved.getUsername(),
                saved.getEmail(),
                saved.getRole()
        );
    }
}