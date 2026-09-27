package com.shinpo.service;

import com.shinpo.dto.DashboardResponse;
import com.shinpo.entity.Goal;
import com.shinpo.entity.Mission;
import com.shinpo.entity.User;
import com.shinpo.repository.GoalRepository;
import com.shinpo.repository.MissionRepository;
import com.shinpo.repository.ProgressEventRepository;
import com.shinpo.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class DashboardService {

    private final UserRepository userRepository;
    private final GoalRepository goalRepository;
    private final MissionRepository missionRepository;
    private final ProgressEventRepository progressEventRepository;

    public DashboardService(
            UserRepository userRepository,
            GoalRepository goalRepository,
            MissionRepository missionRepository,
            ProgressEventRepository progressEventRepository
    ) {
        this.userRepository = userRepository;
        this.goalRepository = goalRepository;
        this.missionRepository = missionRepository;
        this.progressEventRepository = progressEventRepository;
    }

    public DashboardResponse getDashboard(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        List<Goal> userGoals = goalRepository.findAllByUser_Id(userId);
        List<Mission> userMissions = missionRepository.findAllByGoal_User_Id(userId);

        long totalMissions = userMissions.size();

        long completedMissions = userMissions.stream()
                .filter(mission -> "COMPLETED".equals(mission.getStatus()))
                .count();

        long pendingMissions = userMissions.stream()
                .filter(mission -> "PENDING".equals(mission.getStatus()))
                .count();

        Integer totalProgress =
                progressEventRepository.getTotalProgressByUserId(userId);

        List<DashboardResponse.GoalSummary> goalSummaries =
                userGoals.stream()
                        .map(goal -> new DashboardResponse.GoalSummary(
                                goal.getId(),
                                goal.getTitle(),
                                goal.getStatus()
                        ))
                        .toList();

        return new DashboardResponse(
                new DashboardResponse.UserSummary(
                        user.getId(),
                        user.getUsername()
                ),
                new DashboardResponse.ProgressSummary(
                        totalProgress
                ),
                new DashboardResponse.MissionSummary(
                        totalMissions,
                        completedMissions,
                        pendingMissions
                ),
                goalSummaries
        );
    }
}