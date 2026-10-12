package com.shinpo.ai.actions.dto;

import java.time.LocalDate;

public record CreateTaskPayload(
        String title,
        String description,
        Long goalId,
        LocalDate scheduledDate,
        Integer estimatedMinutes
) {}

