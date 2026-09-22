package com.shinpo.dto;

import java.time.Instant;
import java.time.LocalDate;

public record MissionResponse(
        Long id,
        Long goalId,
        String title,
        String description,
        LocalDate scheduledDate,
        Integer estimatedMinutes,
        String status,
        Instant createdAt
) {
}