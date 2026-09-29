package com.shinpo.controller;

import com.shinpo.dto.ProgressResponse;
import com.shinpo.security.UserPrincipal;
import com.shinpo.service.ProgressService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/progress")
public class ProgressController {

    private final ProgressService progressService;

    public ProgressController(ProgressService progressService) {
        this.progressService = progressService;
    }

    @GetMapping
    public ProgressResponse getCurrentUserProgress(@AuthenticationPrincipal UserPrincipal principal) {
        return progressService.getUserProgress(principal.getUserId());
    }

    @GetMapping("/{userId}")
    public ProgressResponse getUserProgress(
            @PathVariable Long userId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        if (!principal.getUserId().equals(userId)) {
            return progressService.getUserProgress(principal.getUserId());
        }
        return progressService.getUserProgress(userId);
    }
}