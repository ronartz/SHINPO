package com.shinpo.controller;

import com.shinpo.dto.DashboardResponse;
import com.shinpo.security.UserPrincipal;
import com.shinpo.service.DashboardService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    private final DashboardService dashboardService;

    public DashboardController(DashboardService dashboardService) {
        this.dashboardService = dashboardService;
    }

    @GetMapping
    public DashboardResponse getDefaultDashboard(@AuthenticationPrincipal UserPrincipal principal) {
        return dashboardService.getDashboard(principal.getUserId());
    }

    @GetMapping("/{userId}")
    public DashboardResponse getDashboard(
            @PathVariable Long userId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        if (!principal.getUserId().equals(userId)) {
            return dashboardService.getDashboard(principal.getUserId());
        }
        return dashboardService.getDashboard(userId);
    }
}