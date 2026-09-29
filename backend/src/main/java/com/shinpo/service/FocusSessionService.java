package com.shinpo.service;

import com.shinpo.dto.CompleteFocusSessionRequest;
import com.shinpo.dto.CreateFocusSessionRequest;
import com.shinpo.dto.FocusSessionResponse;
import com.shinpo.entity.FocusSession;
import com.shinpo.entity.FocusSessionStatus;
import com.shinpo.entity.Goal;
import com.shinpo.entity.Mission;
import com.shinpo.entity.SessionPlan;
import com.shinpo.entity.User;
import com.shinpo.repository.FocusSessionRepository;
import com.shinpo.repository.GoalRepository;
import com.shinpo.repository.MissionRepository;
import com.shinpo.repository.SessionPlanRepository;
import com.shinpo.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;

@Service
public class FocusSessionService {

    private static final Logger log = LoggerFactory.getLogger(FocusSessionService.class);

    private final FocusSessionRepository focusSessionRepository;
    private final UserRepository userRepository;
    private final GoalRepository goalRepository;
    private final MissionRepository missionRepository;
    private final SessionPlanRepository sessionPlanRepository;

    public FocusSessionService(
            FocusSessionRepository focusSessionRepository,
            UserRepository userRepository,
            GoalRepository goalRepository,
            MissionRepository missionRepository,
            SessionPlanRepository sessionPlanRepository
    ) {
        this.focusSessionRepository = focusSessionRepository;
        this.userRepository = userRepository;
        this.goalRepository = goalRepository;
        this.missionRepository = missionRepository;
        this.sessionPlanRepository = sessionPlanRepository;
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

            if (goal != null && !mission.getGoal().getId().equals(goal.getId())) {
                throw new IllegalArgumentException(
                        "Mission does not belong to the specified goal"
                );
            }
        }

        SessionPlan plan = null;

        if (request.getPlanId() != null) {
            plan = sessionPlanRepository.findByIdAndUser_Id(request.getPlanId(), user.getId())
                    .orElseThrow(() ->
                            new IllegalArgumentException(
                                    "Session plan not found or does not belong to user: " + request.getPlanId()
                            ));
        }

        FocusSession session = new FocusSession();

        session.setUser(user);
        session.setGoal(goal);
        session.setMission(mission);
        session.setPlan(plan);
        session.setName(request.getName());
        session.setIntention(request.getIntention());
        session.setDurationMinutes(request.getDurationMinutes());
        session.setScheduledAt(request.getScheduledAt());
        session.setStatus(FocusSessionStatus.SCHEDULED);
        session.setAccumulatedPausedSeconds(0L);

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

        List<FocusSession> sessions = focusSessionRepository
                .findAllByUser_IdOrderByCreatedAtDesc(userId);

        Instant now = Instant.now();
        for (FocusSession session : sessions) {
            checkAndApplyExpiration(session, now);
        }

        return sessions.stream()
                .map(FocusSessionResponse::from)
                .toList();
    }

    @Transactional
    public List<FocusSessionResponse> getSessionsByDate(Long userId, LocalDate date) {
        if (!userRepository.existsById(userId)) {
            throw new IllegalArgumentException("User not found: " + userId);
        }
        Instant start = date.atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant end = date.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
        List<FocusSession> sessions = focusSessionRepository.findSessionsForUserBetween(userId, start, end);
        Instant now = Instant.now();
        for (FocusSession session : sessions) {
            checkAndApplyExpiration(session, now);
        }
        return sessions.stream().map(FocusSessionResponse::from).toList();
    }

    @Transactional
    public List<FocusSessionResponse> getSessionsForAgenda(Long userId, LocalDate startDate, LocalDate endDate) {
        if (!userRepository.existsById(userId)) {
            throw new IllegalArgumentException("User not found: " + userId);
        }
        Instant start = startDate.atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant end = endDate.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
        List<FocusSession> sessions = focusSessionRepository.findSessionsForUserBetween(userId, start, end);
        Instant now = Instant.now();
        for (FocusSession session : sessions) {
            checkAndApplyExpiration(session, now);
        }
        return sessions.stream().map(FocusSessionResponse::from).toList();
    }

    @Transactional
    public FocusSessionResponse getSession(Long sessionId, Long userId) {
        FocusSession session = getSessionEntity(sessionId, userId);
        checkAndApplyExpiration(session, Instant.now());

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
        session.setPausedAt(null);

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
        session.setPausedAt(Instant.now());

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

        Instant now = Instant.now();
        if (session.getPausedAt() != null) {
            long pauseDurationSeconds = Duration.between(session.getPausedAt(), now).toSeconds();
            session.setAccumulatedPausedSeconds(
                    session.getAccumulatedPausedSeconds() + Math.max(0L, pauseDurationSeconds)
            );
        }

        session.setStatus(FocusSessionStatus.ACTIVE);
        session.setPausedAt(null);

        return FocusSessionResponse.from(
                focusSessionRepository.save(session)
        );
    }

    @Transactional
    public FocusSessionResponse completeSession(Long sessionId, Long userId) {
        return completeSession(sessionId, userId, null);
    }

    @Transactional
    public FocusSessionResponse completeSession(Long sessionId, Long userId, CompleteFocusSessionRequest request) {
        FocusSession session = getSessionEntity(sessionId, userId);

        if (session.getStatus() != FocusSessionStatus.ACTIVE && session.getStatus() != FocusSessionStatus.PAUSED) {
            throw new IllegalStateException(
                    "Focus session can only be completed from ACTIVE or PAUSED"
            );
        }

        Instant now = Instant.now();
        if (session.getStatus() == FocusSessionStatus.PAUSED && session.getPausedAt() != null) {
            long finalPauseSeconds = Duration.between(session.getPausedAt(), now).toSeconds();
            session.setAccumulatedPausedSeconds(
                    session.getAccumulatedPausedSeconds() + Math.max(0L, finalPauseSeconds)
            );
            session.setPausedAt(null);
        }

        session.setStatus(FocusSessionStatus.COMPLETED);
        session.setEndedAt(now);

        if (request != null) {
            session.setCompletionQuality(request.quality());
            session.setReflectionNote(request.reflectionNote());
            session.setAccomplishment(request.accomplishment());
        }

        return FocusSessionResponse.from(
                focusSessionRepository.save(session)
        );
    }

    @Transactional
    public FocusSessionResponse cancelSession(Long sessionId, Long userId) {
        FocusSession session = getSessionEntity(sessionId, userId);

        if (session.getStatus() != FocusSessionStatus.SCHEDULED && session.getStatus() != FocusSessionStatus.PAUSED) {
            throw new IllegalStateException(
                    "Focus session can only be cancelled from SCHEDULED or PAUSED"
            );
        }

        session.setStatus(FocusSessionStatus.CANCELLED);
        session.setEndedAt(Instant.now());
        session.setPausedAt(null);

        return FocusSessionResponse.from(
                focusSessionRepository.save(session)
        );
    }

    @Transactional
    public void deleteSession(Long sessionId, Long userId) {
        FocusSession session = focusSessionRepository.findById(sessionId)
                .orElseThrow(() -> new IllegalArgumentException("Session not found: " + sessionId));

        if (userId == null || !session.getUser().getId().equals(userId)) {
            throw new IllegalArgumentException("Session not found: " + sessionId);
        }

        focusSessionRepository.delete(session);
        log.info("SESSION_DELETED: Focus session {} deleted by user {}", sessionId, userId);
    }

    /**
     * Automatic periodic sweep to expire abandoned SCHEDULED and ACTIVE sessions.
     * Runs every 60 seconds in the background.
     */
    @Scheduled(fixedRate = 60000)
    @Transactional
    public void sweepExpiredSessions() {
        Instant now = Instant.now();
        List<FocusSession> activeOrScheduled = focusSessionRepository.findAll().stream()
                .filter(s -> s.getStatus() == FocusSessionStatus.SCHEDULED || s.getStatus() == FocusSessionStatus.ACTIVE)
                .toList();

        for (FocusSession session : activeOrScheduled) {
            checkAndApplyExpiration(session, now);
        }
    }

    public boolean checkAndApplyExpiration(FocusSession session, Instant now) {
        if (session.getStatus() == FocusSessionStatus.SCHEDULED) {
            if (session.getScheduledAt() != null) {
                Instant expirationThreshold = session.getScheduledAt()
                        .plus(Duration.ofMinutes(session.getDurationMinutes()));
                if (now.isAfter(expirationThreshold)) {
                    log.info("SESSION_EXPIRED: Scheduled focus session {} exceeded execution window.", session.getId());
                    session.setStatus(FocusSessionStatus.EXPIRED);
                    session.setEndedAt(now);
                    focusSessionRepository.save(session);
                    return true;
                }
            }
        } else if (session.getStatus() == FocusSessionStatus.ACTIVE) {
            long budgetSeconds = (long) session.getDurationMinutes() * 60L;
            long activeSeconds = session.calculateActiveSeconds(now);
            if (activeSeconds > budgetSeconds * 2) {
                log.info("SESSION_EXPIRED: Active focus session {} abandoned beyond duration limit.", session.getId());
                session.setStatus(FocusSessionStatus.EXPIRED);
                session.setEndedAt(now);
                focusSessionRepository.save(session);
                return true;
            }
        }
        return false;
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