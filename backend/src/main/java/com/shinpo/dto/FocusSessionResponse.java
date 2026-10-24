package com.shinpo.dto;

import com.shinpo.entity.FocusSession;
import com.shinpo.entity.FocusSessionStatus;
import com.shinpo.entity.SessionIntervalType;

import java.time.Instant;

public class FocusSessionResponse {

    public record SessionResultResponse(
        Integer quality,
        String reflectionNote,
        String accomplishment
    ) {}

    private Long id;
    private Long userId;
    private Long goalId;
    private Long missionId;
    private String name;
    private Long planId;
    private String intention;
    private Integer durationMinutes;
    private FocusSessionStatus status;
    private Instant scheduledAt;
    private Instant startedAt;
    private Instant pausedAt;
    private Long accumulatedPausedSeconds;
    private Long activeSeconds;
    private Long remainingSeconds;
    private Instant serverTime;
    private Instant endedAt;
    private Instant createdAt;
    private Instant updatedAt;
    private Integer completionQuality;
    private String reflectionNote;
    private String accomplishment;
    private SessionResultResponse result;
    private boolean pomodoroEnabled;
    private Integer pomodoroFocusCycles;
    private Integer pomodoroShortBreakMinutes;
    private Integer pomodoroLongBreakMinutes;
    private Integer pomodoroGraceMinutes;
    private Integer completedFocusCycles;
    private SessionIntervalType currentPhase;
    private Long focusActiveSeconds;
    private Long breakActiveSeconds;

    public static FocusSessionResponse from(FocusSession session) {
        FocusSessionResponse response = new FocusSessionResponse();
        Instant now = Instant.now();

        response.id = session.getId();
        response.userId = session.getUser().getId();
        response.planId = session.getPlan() != null ? session.getPlan().getId() : null;
        response.goalId = session.getGoal() != null ? session.getGoal().getId() : null;
        response.missionId = session.getMission() != null ? session.getMission().getId() : null;
        response.name = session.getName();
        response.intention = session.getIntention();
        response.durationMinutes = session.getDurationMinutes();
        response.pomodoroEnabled = session.isPomodoroEnabled();
        response.pomodoroFocusCycles = session.getPomodoroFocusCycles();
        response.pomodoroShortBreakMinutes = session.getPomodoroShortBreakMinutes();
        response.pomodoroLongBreakMinutes = session.getPomodoroLongBreakMinutes();
        response.pomodoroGraceMinutes = session.getPomodoroGraceMinutes();
        response.completedFocusCycles = session.getCompletedFocusCycles();
        response.currentPhase = session.getCurrentPhase();
        response.focusActiveSeconds = session.calculateActiveSeconds(now);
        response.breakActiveSeconds = session.getBreakActiveSeconds() + (session.isPomodoroEnabled() && session.getCurrentPhase() != SessionIntervalType.FOCUS && session.getCurrentPhase() != SessionIntervalType.COMPLETE
                ? session.getPhaseElapsedSeconds() + (session.getStatus() == FocusSessionStatus.ACTIVE && session.getPhaseStartedAt() != null ? Math.max(0L, java.time.Duration.between(session.getPhaseStartedAt(), now).toSeconds()) : 0L)
                : 0L);
        response.status = session.getStatus();
        response.scheduledAt = session.getScheduledAt();
        response.startedAt = session.getStartedAt();
        response.pausedAt = session.getPausedAt();
        response.accumulatedPausedSeconds = session.getAccumulatedPausedSeconds();
        response.activeSeconds = session.calculateActiveSeconds(now);
        response.remainingSeconds = session.calculateRemainingSeconds(now);
        response.serverTime = now;
        response.endedAt = session.getEndedAt();
        response.createdAt = session.getCreatedAt();
        response.updatedAt = session.getUpdatedAt();
        response.completionQuality = session.getCompletionQuality();
        response.reflectionNote = session.getReflectionNote();
        response.accomplishment = session.getAccomplishment();

        if (session.getCompletionQuality() != null || session.getReflectionNote() != null || session.getAccomplishment() != null) {
            response.result = new SessionResultResponse(
                    session.getCompletionQuality(),
                    session.getReflectionNote(),
                    session.getAccomplishment()
            );
        }

        return response;
    }

    public Long getId() {
        return id;
    }

    public Long getUserId() {
        return userId;
    }

    public Long getGoalId() {
        return goalId;
    }

    public Long getMissionId() {
        return missionId;
    }

    public String getName() {
        return name;
    }

    public String getIntention() {
        return intention;
    }

    public Integer getDurationMinutes() {
        return durationMinutes;
    }

    public FocusSessionStatus getStatus() {
        return status;
    }
    
    public Long getPlanId() {
        return planId;
    }
    
    public Instant getScheduledAt() {
        return scheduledAt;
    }

    public Instant getStartedAt() {
        return startedAt;
    }

    public Instant getPausedAt() {
        return pausedAt;
    }

    public Long getAccumulatedPausedSeconds() {
        return accumulatedPausedSeconds;
    }

    public Long getActiveSeconds() {
        return activeSeconds;
    }

    public Long getRemainingSeconds() {
        return remainingSeconds;
    }

    public Instant getServerTime() {
        return serverTime;
    }

    public Instant getEndedAt() {
        return endedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public Integer getCompletionQuality() {
        return completionQuality;
    }

    public String getReflectionNote() {
        return reflectionNote;
    }

    public String getAccomplishment() {
        return accomplishment;
    }

    public SessionResultResponse getResult() {
        return result;
    }

    public boolean isPomodoroEnabled() { return pomodoroEnabled; }
    public Integer getPomodoroFocusCycles() { return pomodoroFocusCycles; }
    public Integer getPomodoroShortBreakMinutes() { return pomodoroShortBreakMinutes; }
    public Integer getPomodoroLongBreakMinutes() { return pomodoroLongBreakMinutes; }
    public Integer getPomodoroGraceMinutes() { return pomodoroGraceMinutes; }
    public Integer getCompletedFocusCycles() { return completedFocusCycles; }
    public SessionIntervalType getCurrentPhase() { return currentPhase; }
    public Long getFocusActiveSeconds() { return focusActiveSeconds; }
    public Long getBreakActiveSeconds() { return breakActiveSeconds; }
}
