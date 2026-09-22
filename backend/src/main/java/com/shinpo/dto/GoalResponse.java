package com.shinpo.dto;

import java.time.Instant;
import java.time.LocalDate;

public record GoalResponse(
        Long id,
        Long userId,
        String title,
        String description,
        LocalDate startDate,
        LocalDate targetDate,
        String status,
        Instant createdAt
) {
}