package com.shinpo.service;

import com.shinpo.dto.CreateGoalRequest;
import com.shinpo.dto.GoalResponse;
import com.shinpo.dto.UpdateGoalRequest;
import com.shinpo.entity.Goal;
import com.shinpo.entity.User;
import com.shinpo.entity.Mission;
import com.shinpo.repository.GoalRepository;
import com.shinpo.repository.MissionRepository;
import com.shinpo.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
@Transactional
public class GoalService {

    private final GoalRepository goalRepository;
    private final MissionRepository missionRepository;
    private final UserRepository userRepository;

    public GoalService(
            GoalRepository goalRepository,
            MissionRepository missionRepository,
            UserRepository userRepository
    ) {
        this.goalRepository = goalRepository;
        this.missionRepository = missionRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public List<GoalResponse> getGoalsForUser(Long userId) {
        return goalRepository.findAllByUser_Id(userId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public GoalResponse getGoal(Long id, Long userId) {
        Goal goal = goalRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Goal not found: " + id));

        if (!goal.getUser().getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Goal not found: " + id);
        }

        return toResponse(goal);
    }

    public GoalResponse createGoal(Long userId, CreateGoalRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

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

    public GoalResponse updateGoal(Long id, Long userId, UpdateGoalRequest request) {
        Goal goal = goalRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Goal not found: " + id));

        if (!goal.getUser().getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Goal not found: " + id);
        }

        goal.update(
                request.title(),
                request.description(),
                request.startDate(),
                request.targetDate(),
                request.status()
        );

        Goal savedGoal = goalRepository.save(goal);
        return toResponse(savedGoal);
    }

    public void deleteGoal(Long id, Long userId) {
        Goal goal = goalRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Goal not found: " + id));

        if (!goal.getUser().getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Goal not found: " + id);
        }

        List<Mission> relatedMissions = missionRepository.findAllByGoal_User_Id(userId)
                .stream()
                .filter(mission -> mission.getGoal().getId().equals(id))
                .toList();

        if (!relatedMissions.isEmpty()) {
            missionRepository.deleteAll(relatedMissions);
        }

        goalRepository.delete(goal);
    }

    public void deleteAllGoalsForUser(Long userId) {
        List<Goal> goals = goalRepository.findAllByUser_Id(userId);
        if (goals.isEmpty()) {
            return;
        }

        List<Mission> missions = missionRepository.findAllByGoal_User_Id(userId);
        if (!missions.isEmpty()) {
            missionRepository.deleteAll(missions);
        }

        goalRepository.deleteAll(goals);
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