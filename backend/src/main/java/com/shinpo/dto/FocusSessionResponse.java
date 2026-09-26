package com.shinpo.dto;

import com.shinpo.entity.FocusSession;
import com.shinpo.entity.FocusSessionStatus;

import java.time.Instant;

public class FocusSessionResponse {

    private Long id;
    private Long userId;
    private Long goalId;
    private Long missionId;
    private String name;
    private String intention;
    private Integer durationMinutes;
    private FocusSessionStatus status;
    private Instant scheduledAt;
    private Instant startedAt;
    private Instant endedAt;
    private Instant createdAt;
    private Instant updatedAt;

    public static FocusSessionResponse from(FocusSession session) {
        FocusSessionResponse response = new FocusSessionResponse();

        response.id = session.getId();
        response.userId = session.getUser().getId();
        response.goalId = session.getGoal() != null ? session.getGoal().getId() : null;
        response.missionId = session.getMission() != null ? session.getMission().getId() : null;
        response.name = session.getName();
        response.intention = session.getIntention();
        response.durationMinutes = session.getDurationMinutes();
        response.status = session.getStatus();
        response.scheduledAt = session.getScheduledAt();
        response.startedAt = session.getStartedAt();
        response.endedAt = session.getEndedAt();
        response.createdAt = session.getCreatedAt();
        response.updatedAt = session.getUpdatedAt();

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

    public Instant getScheduledAt() {
        return scheduledAt;
    }

    public Instant getStartedAt() {
        return startedAt;
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
}