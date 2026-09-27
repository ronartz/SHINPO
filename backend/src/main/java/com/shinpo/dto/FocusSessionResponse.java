package com.shinpo.dto;

import com.shinpo.entity.FocusSession;
import com.shinpo.entity.FocusSessionStatus;

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
    private Instant endedAt;
    private Instant createdAt;
    private Instant updatedAt;
    private Integer completionQuality;
    private String reflectionNote;
    private String accomplishment;
    private SessionResultResponse result;

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
        response.status = session.getStatus();
        response.scheduledAt = session.getScheduledAt();
        response.startedAt = session.getStartedAt();
        response.pausedAt = session.getPausedAt();
        response.accumulatedPausedSeconds = session.getAccumulatedPausedSeconds();
        response.activeSeconds = session.calculateActiveSeconds(now);
        response.remainingSeconds = session.calculateRemainingSeconds(now);
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
}