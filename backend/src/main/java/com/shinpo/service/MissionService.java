package com.shinpo.service;

import com.shinpo.dto.CreateMissionRequest;
import com.shinpo.dto.MissionResponse;
import com.shinpo.entity.Goal;
import com.shinpo.entity.Mission;
import com.shinpo.repository.GoalRepository;
import com.shinpo.repository.MissionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class MissionService {

    private final MissionRepository missionRepository;
    private final GoalRepository goalRepository;

    public MissionService(
            MissionRepository missionRepository,
            GoalRepository goalRepository
    ) {
        this.missionRepository = missionRepository;
        this.goalRepository = goalRepository;
    }

    public List<MissionResponse> getAllMissions() {
        return missionRepository.findAll()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public MissionResponse createMission(CreateMissionRequest request) {

        Goal goal = goalRepository.findById(request.goalId())
                .orElseThrow(() -> new IllegalArgumentException("Goal not found"));

        Mission mission = new Mission(
                request.title(),
                request.description(),
                request.scheduledDate(),
                request.estimatedMinutes(),
                goal
        );

        Mission savedMission = missionRepository.save(mission);

        return toResponse(savedMission);
    }

    @Transactional
    public void deleteMission(Long id) {
        Mission mission = missionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Mission not found: " + id));
        missionRepository.delete(mission);
    }

    private MissionResponse toResponse(Mission mission) {
        return new MissionResponse(
                mission.getId(),
                mission.getGoal().getId(),
                mission.getTitle(),
                mission.getDescription(),
                mission.getScheduledDate(),
                mission.getEstimatedMinutes(),
                mission.getStatus(),
                mission.getCreatedAt()
        );
    }
}