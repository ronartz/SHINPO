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
}