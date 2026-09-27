package com.shinpo.service;

import com.shinpo.dto.CreateUserRequest;
import com.shinpo.dto.UserResponse;
import com.shinpo.entity.Goal;
import com.shinpo.entity.Mission;
import com.shinpo.entity.User;
import com.shinpo.repository.GoalRepository;
import com.shinpo.repository.MissionRepository;
import com.shinpo.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final GoalRepository goalRepository;
    private final MissionRepository missionRepository;
    private final PasswordEncoder passwordEncoder;

    public UserService(
            UserRepository userRepository,
            GoalRepository goalRepository,
            MissionRepository missionRepository,
            PasswordEncoder passwordEncoder
    ) {
        this.userRepository = userRepository;
        this.goalRepository = goalRepository;
        this.missionRepository = missionRepository;
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
                savedUser.getEmail()
        );
    }

    @Transactional
    public UserResponse getOrCreateDefaultUser() {
        return userRepository.findAll().stream()
                .findFirst()
                .map(u -> new UserResponse(u.getId(), u.getUsername(), u.getEmail()))
                .orElseGet(() -> {
                    // Seed initial user matching your mockup: EONX
                    User defaultUser = new User(
                            "EONX",
                            "eonx@shinpo.local",
                            passwordEncoder.encode("shinpo_dev"),
                            Instant.now()
                    );
                    User savedUser = userRepository.save(defaultUser);

                    // Seed an initial starter goal and mission
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

                    return new UserResponse(
                            savedUser.getId(),
                            savedUser.getUsername(),
                            savedUser.getEmail()
                    );
                });
    }
}