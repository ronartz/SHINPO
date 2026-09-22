package com.shinpo.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record CompleteMissionRequest(

        @NotNull
        @Min(0)
        Integer actualMinutes

) {
}