package com.shinpo.ai.actions.dto;

import java.time.LocalDate;

public record CreateGoalPayload(
        String title,
        String description,
        LocalDate targetDate
) {}

