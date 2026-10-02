package com.shinpo.service;

import com.shinpo.dto.CreateMissionRequest;
import com.shinpo.dto.MissionResponse;
import com.shinpo.dto.UpdateMissionRequest;
import com.shinpo.entity.Goal;
import com.shinpo.entity.Mission;
import com.shinpo.repository.GoalRepository;
import com.shinpo.repository.MissionRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
@Transactional
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

    @Transactional(readOnly = true)
    public List<MissionResponse> getMissionsForUser(Long userId) {
        return missionRepository.findAllByGoal_User_Id(userId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public MissionResponse getMission(Long id, Long userId) {
        Mission mission = missionRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Mission not found: " + id));

        if (!mission.getGoal().getUser().getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Mission not found: " + id);
        }

        return toResponse(mission);
    }

    public MissionResponse createMission(Long userId, CreateMissionRequest request) {
        Goal goal = goalRepository.findById(request.goalId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Goal not found: " + request.goalId()));

        if (!goal.getUser().getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Goal not found: " + request.goalId());
        }

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

    public MissionResponse updateMission(Long id, Long userId, UpdateMissionRequest request) {
        Mission mission = missionRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Mission not found: " + id));

        if (!mission.getGoal().getUser().getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Mission not found: " + id);
        }

        Goal goal = mission.getGoal();
        if (request.goalId() != null && !request.goalId().equals(goal.getId())) {
            goal = goalRepository.findById(request.goalId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Goal not found: " + request.goalId()));
            if (!goal.getUser().getId().equals(userId)) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Goal not found: " + request.goalId());
            }
        }

        mission.update(
                request.title(),
                request.description(),
                request.scheduledDate(),
                request.estimatedMinutes(),
                request.status(),
                goal
        );

        Mission savedMission = missionRepository.save(mission);
        return toResponse(savedMission);
    }

    public void deleteMission(Long id, Long userId) {
        Mission mission = missionRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Mission not found: " + id));

        if (!mission.getGoal().getUser().getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Mission not found: " + id);
        }

        missionRepository.delete(mission);
    }

    public void deleteAllMissionsForUser(Long userId) {
        List<Mission> missions = missionRepository.findAllByGoal_User_Id(userId);
        if (missions.isEmpty()) {
            return;
        }

        missionRepository.deleteAll(missions);
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