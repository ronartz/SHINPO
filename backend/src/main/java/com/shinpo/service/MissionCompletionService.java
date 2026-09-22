package com.shinpo.service;

import com.shinpo.dto.CompleteMissionRequest;
import com.shinpo.dto.MissionCompletionResponse;
import com.shinpo.entity.Goal;
import com.shinpo.entity.Mission;
import com.shinpo.entity.MissionCompletion;
import com.shinpo.entity.ProgressEvent;
import com.shinpo.entity.User;
import com.shinpo.repository.MissionCompletionRepository;
import com.shinpo.repository.MissionRepository;
import com.shinpo.repository.ProgressEventRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Service
public class MissionCompletionService {

    private static final int MISSION_COMPLETION_PROGRESS = 10;

    private final MissionRepository missionRepository;
    private final MissionCompletionRepository completionRepository;
    private final ProgressEventRepository progressEventRepository;

    public MissionCompletionService(
            MissionRepository missionRepository,
            MissionCompletionRepository completionRepository,
            ProgressEventRepository progressEventRepository
    ) {
        this.missionRepository = missionRepository;
        this.completionRepository = completionRepository;
        this.progressEventRepository = progressEventRepository;
    }

    @Transactional
    public MissionCompletionResponse completeMission(
            Long missionId,
            CompleteMissionRequest request
    ) {
        Mission mission = missionRepository.findById(missionId)
                .orElseThrow(() -> new IllegalArgumentException("Mission not found"));

        if ("COMPLETED".equals(mission.getStatus())) {
            throw new IllegalStateException("Mission is already completed");
        }

        Goal goal = mission.getGoal();
        User user = goal.getUser();

        Instant now = Instant.now();

        MissionCompletion completion = new MissionCompletion(
                mission,
                null,
                now,
                request.actualMinutes(),
                "COMPLETED",
                MISSION_COMPLETION_PROGRESS
        );

        MissionCompletion savedCompletion =
                completionRepository.save(completion);

        mission.markCompleted();
        missionRepository.save(mission);

        ProgressEvent progressEvent = new ProgressEvent(
                user,
                savedCompletion,
                "MISSION_COMPLETED",
                MISSION_COMPLETION_PROGRESS
        );

        progressEventRepository.save(progressEvent);

        return new MissionCompletionResponse(
                savedCompletion.getId(),
                mission.getId(),
                savedCompletion.getStartedAt(),
                savedCompletion.getCompletedAt(),
                savedCompletion.getActualMinutes(),
                savedCompletion.getResult(),
                savedCompletion.getEarnedProgress()
        );
    }
}