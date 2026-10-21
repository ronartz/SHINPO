package com.shinpo.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;

public class OnboardingDtos {

    public record OnboardingResponse(
            Long userId,
            String status,
            int currentStep,
            int completedStepsCount,
            String verifiedSteps,
            Instant completedAt,
            boolean isCompleted,
            boolean canClaimReward
    ) {}

    public record StartOnboardingRequest(
            @Min(0) @Max(5)
            Integer fromStep
    ) {}

    public record OnboardingStepRequest(
            @NotNull
            @Min(0) @Max(5)
            Integer stepIndex
    ) {}

    public record OnboardingPauseRequest(
            @Min(0) @Max(6)
            Integer stepIndex
    ) {}
}

