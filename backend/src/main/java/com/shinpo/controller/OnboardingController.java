package com.shinpo.controller;

import com.shinpo.dto.OnboardingDtos.OnboardingPauseRequest;
import com.shinpo.dto.OnboardingDtos.OnboardingResponse;
import com.shinpo.dto.OnboardingDtos.OnboardingStepRequest;
import com.shinpo.dto.OnboardingDtos.StartOnboardingRequest;
import com.shinpo.security.UserPrincipal;
import com.shinpo.service.OnboardingService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/onboarding")
public class OnboardingController {

    private final OnboardingService onboardingService;

    public OnboardingController(OnboardingService onboardingService) {
        this.onboardingService = onboardingService;
    }

    @GetMapping
    public OnboardingResponse getState(@AuthenticationPrincipal UserPrincipal principal) {
        return onboardingService.getOnboardingState(principal.getUserId());
    }

    @PostMapping("/start")
    public OnboardingResponse start(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestBody(required = false) StartOnboardingRequest request
    ) {
        Integer fromStep = request != null ? request.fromStep() : null;
        return onboardingService.startOnboarding(principal.getUserId(), fromStep);
    }

    @PostMapping("/finish")
    public OnboardingResponse finish(@AuthenticationPrincipal UserPrincipal principal) {
        return onboardingService.finishOnboarding(principal.getUserId());
    }

    @PostMapping("/step")
    public OnboardingResponse step(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody OnboardingStepRequest request
    ) {
        return onboardingService.recordStepProgress(
                principal.getUserId(),
                request.stepIndex()
        );
    }

    @PostMapping("/pause")
    public OnboardingResponse pause(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestBody(required = false) OnboardingPauseRequest request
    ) {
        int step = request != null && request.stepIndex() != null ? request.stepIndex() : 0;
        return onboardingService.pauseOnboarding(principal.getUserId(), step);
    }

    @PostMapping("/skip")
    public OnboardingResponse skip(@AuthenticationPrincipal UserPrincipal principal) {
        return onboardingService.skipOnboarding(principal.getUserId());
    }
}

