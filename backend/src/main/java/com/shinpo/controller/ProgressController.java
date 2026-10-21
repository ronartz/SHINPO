package com.shinpo.controller;

import com.shinpo.dto.ProgressResponse;
import com.shinpo.security.UserPrincipal;
import com.shinpo.service.ProgressService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/progress")
public class ProgressController {

    private final ProgressService progressService;
    private final com.shinpo.service.OnboardingService onboardingService;

    public ProgressController(
            ProgressService progressService,
            com.shinpo.service.OnboardingService onboardingService
    ) {
        this.progressService = progressService;
        this.onboardingService = onboardingService;
    }

    @GetMapping
    public ProgressResponse getCurrentUserProgress(@AuthenticationPrincipal UserPrincipal principal) {
        if (principal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        return progressService.getUserProgress(principal.getUserId());
    }

    @PostMapping("/onboarding")
    public ProgressResponse completeOnboarding(@AuthenticationPrincipal UserPrincipal principal) {
        if (principal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        return onboardingService.completeOnboarding(principal.getUserId());
    }

    @GetMapping("/{userId}")
    public ProgressResponse getUserProgress(
            @PathVariable Long userId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        if (principal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        if (!principal.getUserId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access to other user's progress is forbidden");
        }
        return progressService.getUserProgress(userId);
    }
}