package com.shinpo.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import java.time.Instant;

public record UpdateFocusSessionRequest(
    Long goalId,
    Long missionId,
    Boolean unlinkTask,
    @Size(max = 150) String name,
    String intention,
    @Min(1) Integer durationMinutes,
    Instant scheduledAt
) {
    public UpdateFocusSessionRequest(Long goalId, Long missionId, String name, String intention, Integer durationMinutes, Instant scheduledAt) {
        this(goalId, missionId, false, name, intention, durationMinutes, scheduledAt);
    }
}

