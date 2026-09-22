package com.shinpo.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record CreateMissionRequest(

        @NotNull
        Long goalId,

        @NotBlank
        @Size(max = 150)
        String title,

        String description,

        @NotNull
        LocalDate scheduledDate,

        Integer estimatedMinutes

) {
}