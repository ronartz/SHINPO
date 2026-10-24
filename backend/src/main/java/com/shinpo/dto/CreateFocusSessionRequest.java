package com.shinpo.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.Max;

import java.time.Instant;

public class CreateFocusSessionRequest {

    private Long userId;

    private Long goalId;

    private Long missionId;

    private Long planId;

    @NotBlank
    @Size(max = 150)
    private String name;

    private String intention;

    @NotNull
    @Min(1)
    private Integer durationMinutes;

    private Instant scheduledAt;

    private boolean pomodoroEnabled;
    @Min(1) @Max(12) private Integer pomodoroFocusCycles = 4;
    @Min(1) @Max(60) private Integer pomodoroShortBreakMinutes = 5;
    @Min(1) @Max(120) private Integer pomodoroLongBreakMinutes = 15;

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public Long getGoalId() {
        return goalId;
    }

    public void setGoalId(Long goalId) {
        this.goalId = goalId;
    }

    public Long getMissionId() {
        return missionId;
    }

    public void setMissionId(Long missionId) {
        this.missionId = missionId;
    }

    public Long getPlanId() {
        return planId;
    }

    public void setPlanId(Long planId) {
        this.planId = planId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getIntention() {
        return intention;
    }

    public void setIntention(String intention) {
        this.intention = intention;
    }

    public Integer getDurationMinutes() {
        return durationMinutes;
    }

    public void setDurationMinutes(Integer durationMinutes) {
        this.durationMinutes = durationMinutes;
    }

    public Instant getScheduledAt() {
        return scheduledAt;
    }

    public void setScheduledAt(Instant scheduledAt) {
        this.scheduledAt = scheduledAt;
    }

    public boolean isPomodoroEnabled() { return pomodoroEnabled; }
    public void setPomodoroEnabled(boolean value) { this.pomodoroEnabled = value; }
    public Integer getPomodoroFocusCycles() { return pomodoroFocusCycles; }
    public void setPomodoroFocusCycles(Integer value) { this.pomodoroFocusCycles = value; }
    public Integer getPomodoroShortBreakMinutes() { return pomodoroShortBreakMinutes; }
    public void setPomodoroShortBreakMinutes(Integer value) { this.pomodoroShortBreakMinutes = value; }
    public Integer getPomodoroLongBreakMinutes() { return pomodoroLongBreakMinutes; }
    public void setPomodoroLongBreakMinutes(Integer value) { this.pomodoroLongBreakMinutes = value; }
}
