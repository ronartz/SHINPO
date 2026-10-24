package com.shinpo.service;

import com.shinpo.dto.CompleteFocusSessionRequest;
import com.shinpo.dto.CreateFocusSessionRequest;
import com.shinpo.dto.FocusSessionResponse;
import com.shinpo.dto.UpdateFocusSessionRequest;
import com.shinpo.entity.FocusSession;
import com.shinpo.entity.FocusSessionStatus;
import com.shinpo.entity.Goal;
import com.shinpo.entity.Mission;
import com.shinpo.entity.ProgressEvent;
import com.shinpo.entity.SessionPlan;
import com.shinpo.entity.SessionIntervalType;
import com.shinpo.entity.User;
import com.shinpo.repository.FocusSessionRepository;
import com.shinpo.repository.GoalRepository;
import com.shinpo.repository.MissionRepository;
import com.shinpo.repository.ProgressEventRepository;
import com.shinpo.repository.SessionPlanRepository;
import com.shinpo.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

@Service
public class FocusSessionService {

    private static final Logger log = LoggerFactory.getLogger(FocusSessionService.class);

    private final FocusSessionRepository focusSessionRepository;
    private final UserRepository userRepository;
    private final GoalRepository goalRepository;
    private final MissionRepository missionRepository;
    private final SessionPlanRepository sessionPlanRepository;
    private final WebSocketEventService webSocketEventService;
    private final MissionCompletionService missionCompletionService;
    private final ProgressEventRepository progressEventRepository;

    public FocusSessionService(
            FocusSessionRepository focusSessionRepository,
            UserRepository userRepository,
            GoalRepository goalRepository,
            MissionRepository missionRepository,
            SessionPlanRepository sessionPlanRepository,
            WebSocketEventService webSocketEventService
    ) {
        this(focusSessionRepository, userRepository, goalRepository, missionRepository, sessionPlanRepository, webSocketEventService, null, null);
    }

    @Autowired
    public FocusSessionService(
            FocusSessionRepository focusSessionRepository,
            UserRepository userRepository,
            GoalRepository goalRepository,
            MissionRepository missionRepository,
            SessionPlanRepository sessionPlanRepository,
            WebSocketEventService webSocketEventService,
            @Lazy MissionCompletionService missionCompletionService,
            @Autowired(required = false) ProgressEventRepository progressEventRepository
    ) {
        this.focusSessionRepository = focusSessionRepository;
        this.userRepository = userRepository;
        this.goalRepository = goalRepository;
        this.missionRepository = missionRepository;
        this.sessionPlanRepository = sessionPlanRepository;
        this.webSocketEventService = webSocketEventService;
        this.missionCompletionService = missionCompletionService;
        this.progressEventRepository = progressEventRepository;
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
        session.setPomodoroEnabled(request.isPomodoroEnabled());
        session.setPomodoroFocusCycles(request.getPomodoroFocusCycles());
        session.setPomodoroShortBreakMinutes(request.getPomodoroShortBreakMinutes());
        session.setPomodoroLongBreakMinutes(request.getPomodoroLongBreakMinutes());
        session.setScheduledAt(request.getScheduledAt());
        session.setStatus(FocusSessionStatus.SCHEDULED);
        session.setAccumulatedPausedSeconds(0L);

        FocusSession savedSession = focusSessionRepository.save(session);
        webSocketEventService.broadcastFocusSession(user.getId(), savedSession);

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
            FocusSession locked = getSessionEntity(session.getId(), userId);
            advancePomodoro(locked, now);
            checkAndApplyExpiration(locked, now);
        }

        return sessions.stream()
                .map(FocusSessionResponse::from)
                .toList();
    }

    @Transactional
    public List<FocusSessionResponse> getSessionsByDate(Long userId, LocalDate date, ZoneId zoneId) {
        if (!userRepository.existsById(userId)) {
            throw new IllegalArgumentException("User not found: " + userId);
        }
        Instant start = date.atStartOfDay(zoneId).toInstant();
        Instant end = date.plusDays(1).atStartOfDay(zoneId).toInstant();
        List<FocusSession> sessions = focusSessionRepository.findSessionsForUserBetween(userId, start, end);
        Instant now = Instant.now();
        for (FocusSession session : sessions) {
            FocusSession locked = getSessionEntity(session.getId(), userId);
            advancePomodoro(locked, now);
            checkAndApplyExpiration(locked, now);
        }
        return sessions.stream().map(FocusSessionResponse::from).toList();
    }

    @Transactional
    public List<FocusSessionResponse> getSessionsForAgenda(
            Long userId,
            LocalDate startDate,
            LocalDate endDate,
            ZoneId zoneId
    ) {
        if (!userRepository.existsById(userId)) {
            throw new IllegalArgumentException("User not found: " + userId);
        }
        Instant start = startDate.atStartOfDay(zoneId).toInstant();
        Instant end = endDate.plusDays(1).atStartOfDay(zoneId).toInstant();
        List<FocusSession> sessions = focusSessionRepository.findSessionsForUserBetween(userId, start, end);
        Instant now = Instant.now();
        for (FocusSession session : sessions) {
            FocusSession locked = getSessionEntity(session.getId(), userId);
            advancePomodoro(locked, now);
            checkAndApplyExpiration(locked, now);
        }
        return sessions.stream().map(FocusSessionResponse::from).toList();
    }

    @Transactional
    public List<FocusSessionResponse> getAgenda(Long userId, LocalDate startDate, LocalDate endDate, ZoneId zoneId) {
        return getSessionsForAgenda(userId, startDate, endDate, zoneId);
    }

    @Transactional
    public FocusSessionResponse getSession(Long sessionId, Long userId) {
        FocusSession session = getSessionEntity(sessionId, userId);
        advancePomodoro(session, Instant.now());
        checkAndApplyExpiration(session, Instant.now());
        return FocusSessionResponse.from(session);
    }

    @Transactional
    public FocusSessionResponse updateSession(Long sessionId, Long userId, UpdateFocusSessionRequest request) {
        FocusSession session = getSessionEntity(sessionId, userId);

        if (session.getStatus() != FocusSessionStatus.SCHEDULED) {
            throw new IllegalStateException("Only SCHEDULED sessions can be edited");
        }

        if (request.name() != null && !request.name().trim().isEmpty()) {
            session.setName(request.name().trim());
        }
        if (request.intention() != null) {
            session.setIntention(request.intention().trim());
        }
        if (request.durationMinutes() != null && request.durationMinutes() > 0) {
            session.setDurationMinutes(request.durationMinutes());
        }
        if (request.scheduledAt() != null) {
            session.setScheduledAt(request.scheduledAt());
        }

        if (Boolean.TRUE.equals(request.unlinkTask())) {
            session.setMission(null);
            session.setGoal(null);
        } else if (request.missionId() != null) {
            Mission mission = missionRepository.findById(request.missionId())
                    .orElseThrow(() -> new IllegalArgumentException("Mission not found: " + request.missionId()));
            if (!mission.getGoal().getUser().getId().equals(userId)) {
                throw new IllegalArgumentException("Mission does not belong to user");
            }
            session.setMission(mission);
            session.setGoal(mission.getGoal());
        } else if (request.goalId() != null) {
            Goal goal = goalRepository.findById(request.goalId())
                    .orElseThrow(() -> new IllegalArgumentException("Goal not found: " + request.goalId()));
            if (!goal.getUser().getId().equals(userId)) {
                throw new IllegalArgumentException("Goal does not belong to user");
            }
            session.setGoal(goal);
            session.setMission(null);
        }

        session.incrementContextPolicyRevision();
        FocusSession saved = focusSessionRepository.save(session);
        webSocketEventService.broadcastFocusSession(userId, saved);

        return FocusSessionResponse.from(saved);
    }

    @Transactional
    public FocusSessionResponse startSession(Long sessionId, Long userId) {
        FocusSession session = getSessionEntity(sessionId, userId);

        if (session.getStatus() != FocusSessionStatus.SCHEDULED) {
            throw new IllegalStateException(
                    "Focus session can only be started from SCHEDULED"
            );
        }

        if (focusSessionRepository.existsByUser_IdAndStatusIn(
            userId,
            List.of(FocusSessionStatus.ACTIVE, FocusSessionStatus.PAUSED)
        )) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "User already has an active focus session");
        }

        session.setStatus(FocusSessionStatus.ACTIVE);
        session.setStartedAt(Instant.now());
        session.setPhaseStartedAt(session.isPomodoroEnabled() ? session.getStartedAt() : null);
        session.setPausedAt(null);
        session.incrementContextPolicyRevision();

        FocusSession saved = focusSessionRepository.save(session);
        webSocketEventService.broadcastFocusSession(userId, saved);

        return FocusSessionResponse.from(saved);
    }

    @Transactional
    public FocusSessionResponse pauseSession(Long sessionId, Long userId) {
        FocusSession session = getSessionEntity(sessionId, userId);
        Instant now = Instant.now();
        advancePomodoro(session, now);

        if (session.getStatus() != FocusSessionStatus.ACTIVE) {
            throw new IllegalStateException(
                    "Focus session can only be paused from ACTIVE"
            );
        }
        if (session.getCurrentPhase() == SessionIntervalType.COMPLETE) {
            throw new IllegalStateException("Pomodoro sequence is complete; finish the reflection instead");
        }

        session.setStatus(FocusSessionStatus.PAUSED);
        session.setPausedAt(now);
        if (session.isPomodoroEnabled()) {
            session.setPhaseElapsedSeconds(currentPhaseElapsed(session, now));
            session.setPhaseStartedAt(null);
        }
        session.incrementContextPolicyRevision();

        FocusSession saved = focusSessionRepository.save(session);
        webSocketEventService.broadcastFocusSession(userId, saved);

        return FocusSessionResponse.from(saved);
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
        if (session.isPomodoroEnabled()) session.setPhaseStartedAt(now);
        session.incrementContextPolicyRevision();

        FocusSession saved = focusSessionRepository.save(session);
        webSocketEventService.broadcastFocusSession(userId, saved);

        return FocusSessionResponse.from(saved);
    }

    @Transactional
    public FocusSessionResponse completeSession(Long sessionId, Long userId) {
        return completeSession(sessionId, userId, null);
    }

    @Transactional
    public FocusSessionResponse completeSession(Long sessionId, Long userId, CompleteFocusSessionRequest request) {
        FocusSession session = getSessionEntity(sessionId, userId);
        Instant now = Instant.now();
        advancePomodoro(session, now);

        if (session.getStatus() != FocusSessionStatus.ACTIVE && session.getStatus() != FocusSessionStatus.PAUSED) {
            throw new IllegalStateException(
                    "Focus session can only be completed from ACTIVE or PAUSED"
            );
        }

        if (session.getStatus() == FocusSessionStatus.PAUSED && session.getPausedAt() != null) {
            long finalPauseSeconds = Duration.between(session.getPausedAt(), now).toSeconds();
            session.setAccumulatedPausedSeconds(
                    session.getAccumulatedPausedSeconds() + Math.max(0L, finalPauseSeconds)
            );
            session.setPausedAt(null);
        }

        if (session.isPomodoroEnabled()) {
            long elapsed = currentPhaseElapsed(session, now);
            if (session.getCurrentPhase() == SessionIntervalType.FOCUS) session.setFocusActiveSeconds(session.getFocusActiveSeconds() + elapsed);
            else if (session.getCurrentPhase() == SessionIntervalType.SHORT_BREAK || session.getCurrentPhase() == SessionIntervalType.LONG_BREAK) session.setBreakActiveSeconds(session.getBreakActiveSeconds() + elapsed);
            session.setPhaseElapsedSeconds(0L);
            session.setPhaseStartedAt(null);
        }

        long rewardableSeconds = session.isPomodoroEnabled()
                ? session.getFocusActiveSeconds()
                : Math.min(session.calculateActiveSeconds(now), (long) (session.getDurationMinutes() != null ? session.getDurationMinutes() : 0) * 60L);
        long activeMinutes = rewardableSeconds / 60L;

        session.setStatus(FocusSessionStatus.COMPLETED);
        session.setEndedAt(now);
        session.incrementContextPolicyRevision();

        if (progressEventRepository != null && activeMinutes >= 15) {
            int earnedProgress = activeMinutes >= 45 ? 25 : 15;
            ProgressEvent progressEvent = new ProgressEvent(
                    session.getUser(), session, session.getGoal(),
                    "FOCUS_SESSION_COMPLETED",
                    earnedProgress
            );
            progressEventRepository.save(progressEvent);
        }

        if (request != null) {
            session.setCompletionQuality(request.quality());
            session.setReflectionNote(request.reflectionNote());
            session.setAccomplishment(request.accomplishment());

            if (Boolean.TRUE.equals(request.markMissionCompleted()) && session.getMission() != null) {
                Mission mission = session.getMission();
                if (!"COMPLETED".equalsIgnoreCase(mission.getStatus()) && missionCompletionService != null) {
                    try {
                        long activeSeconds = rewardableSeconds;
                        int actualMins = (int) Math.max(1, activeSeconds / 60);
                        missionCompletionService.completeMission(
                                mission.getId(),
                                userId,
                                new com.shinpo.dto.CompleteMissionRequest(actualMins)
                        );
                    } catch (Exception e) {
                        log.warn("Auto-completion of linked mission {} skipped: {}", mission.getId(), e.getMessage());
                    }
                }
            }
        }

        FocusSession saved = focusSessionRepository.save(session);
        webSocketEventService.broadcastFocusSession(userId, saved);

        return FocusSessionResponse.from(saved);
    }

    @Transactional
    public FocusSessionResponse cancelSession(Long sessionId, Long userId) {
        FocusSession session = getSessionEntity(sessionId, userId);
        Instant now = Instant.now();
        advancePomodoro(session, now);

        if (session.getStatus() != FocusSessionStatus.SCHEDULED
                && session.getStatus() != FocusSessionStatus.ACTIVE
                && session.getStatus() != FocusSessionStatus.PAUSED) {
            throw new IllegalStateException(
                    "Focus session can only be cancelled from SCHEDULED, ACTIVE, or PAUSED"
            );
        }

        if (session.getStatus() == FocusSessionStatus.PAUSED && session.getPausedAt() != null) {
            long finalPauseSeconds = Duration.between(session.getPausedAt(), now).toSeconds();
            session.setAccumulatedPausedSeconds(
                    session.getAccumulatedPausedSeconds() + Math.max(0L, finalPauseSeconds)
            );
        }

        if (session.isPomodoroEnabled()) {
            long elapsed = currentPhaseElapsed(session, now);
            if (session.getCurrentPhase() == SessionIntervalType.FOCUS) session.setFocusActiveSeconds(session.getFocusActiveSeconds() + elapsed);
            else if (session.getCurrentPhase() == SessionIntervalType.SHORT_BREAK || session.getCurrentPhase() == SessionIntervalType.LONG_BREAK) session.setBreakActiveSeconds(session.getBreakActiveSeconds() + elapsed);
            session.setPhaseElapsedSeconds(0L);
        }

        session.setStatus(FocusSessionStatus.CANCELLED);
        session.setEndedAt(now);
        session.setPausedAt(null);
        session.setPhaseStartedAt(null);
        session.incrementContextPolicyRevision();

        FocusSession saved = focusSessionRepository.save(session);
        webSocketEventService.broadcastFocusSession(userId, saved);

        return FocusSessionResponse.from(saved);
    }

    @Transactional
    public void deleteSession(Long sessionId, Long userId) {
        FocusSession session = focusSessionRepository.findById(sessionId)
                .orElseThrow(() -> new IllegalArgumentException("Session not found: " + sessionId));

        if (userId == null || !session.getUser().getId().equals(userId)) {
            throw new IllegalArgumentException("Session not found: " + sessionId);
        }

        if (session.getStatus() == FocusSessionStatus.ACTIVE || session.getStatus() == FocusSessionStatus.PAUSED) {
            throw new IllegalStateException("Active or paused focus session cannot be deleted. Cancel the session first.");
        }

        focusSessionRepository.delete(session);
        log.info("SESSION_DELETED: Focus session {} deleted by user {}", sessionId, userId);
    }

    /**
     * Automatic periodic sweep to expire abandoned SCHEDULED, ACTIVE, and PAUSED sessions.
     * Uses an indexed status-filter query instead of a full table scan.
     * Runs every 60 seconds.
     */
    @Scheduled(fixedRate = 60000)
    @Transactional
    public void sweepExpiredSessions() {
        Instant now = Instant.now();
        List<FocusSession> candidates = focusSessionRepository.findAllByStatusIn(
                List.of(FocusSessionStatus.SCHEDULED, FocusSessionStatus.ACTIVE, FocusSessionStatus.PAUSED)
        );
        for (FocusSession session : candidates) {
            FocusSession locked = getSessionEntity(session.getId(), session.getUser().getId());
            advancePomodoro(locked, now);
            checkAndApplyExpiration(locked, now);
        }
    }

    @Transactional
    public FocusSessionResponse skipBreak(Long sessionId, Long userId) {
        FocusSession session = getSessionEntity(sessionId, userId);
        Instant now = Instant.now();
        advancePomodoro(session, now);
        if (!session.isPomodoroEnabled() || session.getStatus() != FocusSessionStatus.ACTIVE
                || (session.getCurrentPhase() != SessionIntervalType.SHORT_BREAK && session.getCurrentPhase() != SessionIntervalType.LONG_BREAK)) {
            throw new IllegalStateException("Only an active Pomodoro break can be skipped");
        }
        session.setBreakActiveSeconds(session.getBreakActiveSeconds() + currentPhaseElapsed(session, now));
        session.setPhaseElapsedSeconds(0L);
        session.setPhaseStartedAt(now);
        session.setCurrentPhase(session.getCurrentPhase() == SessionIntervalType.LONG_BREAK
                ? SessionIntervalType.COMPLETE : SessionIntervalType.FOCUS);
        if (session.getCurrentPhase() == SessionIntervalType.COMPLETE) session.setPhaseStartedAt(null);
        FocusSession saved = focusSessionRepository.save(session);
        webSocketEventService.broadcastFocusSession(userId, saved);
        return FocusSessionResponse.from(saved);
    }

    private void advancePomodoro(FocusSession session, Instant now) {
        if (!session.isPomodoroEnabled() || session.getStatus() != FocusSessionStatus.ACTIVE) return;
        int guard = session.getPomodoroFocusCycles() * 2 + 2;
        while (guard-- > 0 && session.getPhaseStartedAt() != null && session.getCurrentPhase() != SessionIntervalType.COMPLETE) {
            long phaseBudget = (long) session.currentPhaseDurationMinutes() * 60L;
            long carried = session.getPhaseElapsedSeconds();
            long elapsed = carried + Math.max(0L, Duration.between(session.getPhaseStartedAt(), now).toSeconds());
            if (elapsed < phaseBudget) break;
            Instant boundary = session.getPhaseStartedAt().plusSeconds(Math.max(0L, phaseBudget - carried));
            long completedPhaseSeconds = Math.max(0L, phaseBudget - carried);
            if (session.getCurrentPhase() == SessionIntervalType.FOCUS) {
                session.setFocusActiveSeconds(session.getFocusActiveSeconds() + completedPhaseSeconds);
                session.setCompletedFocusCycles(session.getCompletedFocusCycles() + 1);
                session.setCurrentPhase(session.getCompletedFocusCycles() >= session.getPomodoroFocusCycles()
                        ? SessionIntervalType.LONG_BREAK : SessionIntervalType.SHORT_BREAK);
            } else {
                session.setBreakActiveSeconds(session.getBreakActiveSeconds() + completedPhaseSeconds);
                if (session.getCurrentPhase() == SessionIntervalType.LONG_BREAK) {
                    session.setCurrentPhase(SessionIntervalType.COMPLETE);
                } else {
                    session.setCurrentPhase(SessionIntervalType.FOCUS);
                }
            }
            session.setPhaseElapsedSeconds(0L);
            session.setPhaseStartedAt(session.getCurrentPhase() == SessionIntervalType.COMPLETE ? null : boundary);
        }
    }

    private long currentPhaseElapsed(FocusSession session, Instant now) {
        long elapsed = session.getPhaseElapsedSeconds();
        if (session.getPhaseStartedAt() != null && session.getStatus() == FocusSessionStatus.ACTIVE) {
            elapsed += Math.max(0L, Duration.between(session.getPhaseStartedAt(), now).toSeconds());
        }
        return elapsed;
    }

    public boolean checkAndApplyExpiration(FocusSession session, Instant now) {
        if (session.getStatus() == FocusSessionStatus.SCHEDULED) {
            if (session.getScheduledAt() != null) {
                long plannedMinutes = session.getDurationMinutes();
                if (session.isPomodoroEnabled()) {
                    plannedMinutes = (long) session.getDurationMinutes() * session.getPomodoroFocusCycles()
                            + (long) session.getPomodoroShortBreakMinutes() * Math.max(0, session.getPomodoroFocusCycles() - 1)
                            + session.getPomodoroLongBreakMinutes();
                }
                Instant expirationThreshold = session.getScheduledAt()
                        .plus(Duration.ofMinutes(plannedMinutes));
                if (now.isAfter(expirationThreshold)) {
                    log.info("SESSION_EXPIRED: Scheduled focus session {} exceeded execution window.", session.getId());
                    session.setStatus(FocusSessionStatus.EXPIRED);
                    session.setEndedAt(now);
                    session.incrementContextPolicyRevision();
                    focusSessionRepository.save(session);
                    return true;
                }
            }
        } else if (session.getStatus() == FocusSessionStatus.ACTIVE) {
            long budgetSeconds = (long) session.getDurationMinutes() * 60L
                    * (session.isPomodoroEnabled() ? session.getPomodoroFocusCycles() : 1L);
            long activeSeconds = session.calculateActiveSeconds(now);
            if (activeSeconds > budgetSeconds * 2) {
                log.info("SESSION_EXPIRED: Active focus session {} abandoned beyond duration limit.", session.getId());
                session.setStatus(FocusSessionStatus.EXPIRED);
                session.setEndedAt(now);
                session.incrementContextPolicyRevision();
                focusSessionRepository.save(session);
                return true;
            }
        } else if (session.getStatus() == FocusSessionStatus.PAUSED) {
            // Abandon paused sessions that have been paused for more than 4× the session duration
            // (i.e., the user clearly forgot about them).
            if (session.getPausedAt() != null) {
                long pausedForSeconds = Duration.between(session.getPausedAt(), now).toSeconds();
                long abandonThresholdSeconds = (long) session.getDurationMinutes() * 60L
                        * (session.isPomodoroEnabled() ? session.getPomodoroFocusCycles() : 1L) * 4L;
                if (pausedForSeconds > abandonThresholdSeconds) {
                    log.info("SESSION_EXPIRED: Paused focus session {} abandoned — paused for {}s.", session.getId(), pausedForSeconds);
                    // Accumulate the pause time up to the threshold so activeSeconds is still sane
                    session.setAccumulatedPausedSeconds(
                            session.getAccumulatedPausedSeconds() + pausedForSeconds
                    );
                    session.setPausedAt(null);
                    session.setStatus(FocusSessionStatus.EXPIRED);
                    session.setEndedAt(now);
                    session.incrementContextPolicyRevision();
                    focusSessionRepository.save(session);
                    return true;
                }
            }
        }
        return false;
    }

    private FocusSession getSessionEntity(Long sessionId, Long userId) {
        return focusSessionRepository
                .findByIdAndUser_IdForUpdate(sessionId, userId)
                .orElseThrow(() ->
                        new IllegalArgumentException(
                                "Focus session not found: " + sessionId
                        ));
    }
}
