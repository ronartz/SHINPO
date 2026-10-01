package com.shinpo.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record UpdateGoalRequest(
        @NotBlank
        @Size(max = 150)
        String title,

        String description,

        @NotNull
        LocalDate startDate,

        LocalDate targetDate,

        @Size(max = 20)
        String status
) {
}
