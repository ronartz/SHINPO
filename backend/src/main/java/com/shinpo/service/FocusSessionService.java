package com.shinpo.service;

import com.shinpo.dto.CreateFocusSessionRequest;
import com.shinpo.dto.FocusSessionResponse;
import com.shinpo.entity.FocusSession;
import com.shinpo.entity.FocusSessionStatus;
import com.shinpo.entity.Goal;
import com.shinpo.entity.Mission;
import com.shinpo.entity.User;
import com.shinpo.repository.FocusSessionRepository;
import com.shinpo.repository.GoalRepository;
import com.shinpo.repository.MissionRepository;
import com.shinpo.repository.UserRepository;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Service
public class FocusSessionService {

    private final FocusSessionRepository focusSessionRepository;
    private final UserRepository userRepository;
    private final GoalRepository goalRepository;
    private final MissionRepository missionRepository;

    public FocusSessionService(
            FocusSessionRepository focusSessionRepository,
            UserRepository userRepository,
            GoalRepository goalRepository,
            MissionRepository missionRepository
    ) {
        this.focusSessionRepository = focusSessionRepository;
        this.userRepository = userRepository;
        this.goalRepository = goalRepository;
        this.missionRepository = missionRepository;
    }

    @Transactional
    public FocusSessionResponse createSession(CreateFocusSessionRequest request) {
        User user = userRepository.findById(request.getUserId())
                .orElseThrow(() ->
                        new IllegalArgumentException(
                                "User not found: " + request.getUserId()
                        ));

        Goal goal = null;

        if (request.getGoalId() != null) {
            goal = goalRepository.findById(request.getGoalId())
                    .orElseThrow(() ->
                            new IllegalArgumentException(
                                    "Goal not found: " + request.getGoalId()
                            ));

            if (!goal.getUser().getId().equals(user.getId())) {
                throw new IllegalArgumentException(
                        "Goal does not belong to user: " + request.getGoalId()
                );
            }
        }

        Mission mission = null;

        if (request.getMissionId() != null) {
            mission = missionRepository.findById(request.getMissionId())
                    .orElseThrow(() ->
                            new IllegalArgumentException(
                                    "Mission not found: " + request.getMissionId()
                            ));

            if (!mission.getGoal().getUser().getId().equals(user.getId())) {
                throw new IllegalArgumentException(
                        "Mission does not belong to user: " + request.getMissionId()
                );
            }

            if (goal != null
                    && !mission.getGoal().getId().equals(goal.getId())) {
                throw new IllegalArgumentException(
                        "Mission does not belong to the specified goal"
                );
            }
        }

        FocusSession session = new FocusSession();

        session.setUser(user);
        session.setGoal(goal);
        session.setMission(mission);
        session.setName(request.getName());
        session.setIntention(request.getIntention());
        session.setDurationMinutes(request.getDurationMinutes());
        session.setScheduledAt(request.getScheduledAt());
        session.setStatus(FocusSessionStatus.SCHEDULED);

        FocusSession savedSession = focusSessionRepository.save(session);

        return FocusSessionResponse.from(savedSession);
    }

    @Transactional
    public List<FocusSessionResponse> getSessionsForUser(Long userId) {
        if (!userRepository.existsById(userId)) {
            throw new IllegalArgumentException(
                    "User not found: " + userId
            );
        }

        return focusSessionRepository
                .findAllByUser_IdOrderByCreatedAtDesc(userId)
                .stream()
                .map(FocusSessionResponse::from)
                .toList();
    }

    @Transactional
    public FocusSessionResponse getSession(Long sessionId, Long userId) {
        FocusSession session = getSessionEntity(sessionId, userId);

        return FocusSessionResponse.from(session);
    }

    @Transactional
    public FocusSessionResponse startSession(Long sessionId, Long userId) {
        FocusSession session = getSessionEntity(sessionId, userId);

        if (session.getStatus() != FocusSessionStatus.SCHEDULED) {
            throw new IllegalStateException(
                    "Focus session can only be started from SCHEDULED"
            );
        }

        session.setStatus(FocusSessionStatus.ACTIVE);
        session.setStartedAt(Instant.now());

        return FocusSessionResponse.from(
                focusSessionRepository.save(session)
        );
    }

    @Transactional
    public FocusSessionResponse pauseSession(Long sessionId, Long userId) {
        FocusSession session = getSessionEntity(sessionId, userId);

        if (session.getStatus() != FocusSessionStatus.ACTIVE) {
            throw new IllegalStateException(
                    "Focus session can only be paused from ACTIVE"
            );
        }

        session.setStatus(FocusSessionStatus.PAUSED);

        return FocusSessionResponse.from(
                focusSessionRepository.save(session)
        );
    }

    @Transactional
    public FocusSessionResponse resumeSession(Long sessionId, Long userId) {
        FocusSession session = getSessionEntity(sessionId, userId);

        if (session.getStatus() != FocusSessionStatus.PAUSED) {
            throw new IllegalStateException(
                    "Focus session can only be resumed from PAUSED"
            );
        }

        session.setStatus(FocusSessionStatus.ACTIVE);

        return FocusSessionResponse.from(
                focusSessionRepository.save(session)
        );
    }

    @Transactional
    public FocusSessionResponse completeSession(Long sessionId, Long userId) {
        FocusSession session = getSessionEntity(sessionId, userId);

        if (session.getStatus() != FocusSessionStatus.ACTIVE) {
            throw new IllegalStateException(
                    "Focus session can only be completed from ACTIVE"
            );
        }

        session.setStatus(FocusSessionStatus.COMPLETED);
        session.setEndedAt(Instant.now());

        return FocusSessionResponse.from(
                focusSessionRepository.save(session)
        );
    }

    @Transactional
    public FocusSessionResponse cancelSession(Long sessionId, Long userId) {
        FocusSession session = getSessionEntity(sessionId, userId);

        if (session.getStatus() != FocusSessionStatus.SCHEDULED) {
            throw new IllegalStateException(
                    "Focus session can only be cancelled from SCHEDULED"
            );
        }

        session.setStatus(FocusSessionStatus.CANCELLED);
        session.setEndedAt(Instant.now());

        return FocusSessionResponse.from(
                focusSessionRepository.save(session)
        );
    }

    private FocusSession getSessionEntity(Long sessionId, Long userId) {
        return focusSessionRepository
                .findByIdAndUser_Id(sessionId, userId)
                .orElseThrow(() ->
                        new IllegalArgumentException(
                                "Focus session not found: " + sessionId
                        ));
    }
}