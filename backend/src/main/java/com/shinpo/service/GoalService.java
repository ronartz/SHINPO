package com.shinpo.service;

import com.shinpo.dto.CreateGoalRequest;
import com.shinpo.dto.GoalResponse;
import com.shinpo.entity.Goal;
import com.shinpo.entity.User;
import com.shinpo.repository.GoalRepository;
import com.shinpo.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class GoalService {

    private final GoalRepository goalRepository;
    private final UserRepository userRepository;

    public GoalService(
            GoalRepository goalRepository,
            UserRepository userRepository
    ) {
        this.goalRepository = goalRepository;
        this.userRepository = userRepository;
    }

    public List<GoalResponse> getAllGoals() {

        return goalRepository.findAll()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public GoalResponse createGoal(CreateGoalRequest request) {

        User user = userRepository.findById(request.userId())
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        Goal goal = new Goal(
                request.title(),
                request.description(),
                request.startDate(),
                request.targetDate(),
                user
        );

        Goal savedGoal = goalRepository.save(goal);

        return toResponse(savedGoal);
    }

    private GoalResponse toResponse(Goal goal) {

        return new GoalResponse(
                goal.getId(),
                goal.getUser().getId(),
                goal.getTitle(),
                goal.getDescription(),
                goal.getStartDate(),
                goal.getTargetDate(),
                goal.getStatus(),
                goal.getCreatedAt()
        );
    }
}