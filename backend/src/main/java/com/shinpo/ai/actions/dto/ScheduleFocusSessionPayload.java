package com.shinpo.ai.actions.dto;

import java.time.Instant;

public record ScheduleFocusSessionPayload(
        String name,
        Instant scheduledAt,
        Integer durationMinutes,
        Long taskId,
        Long goalId
) {}

