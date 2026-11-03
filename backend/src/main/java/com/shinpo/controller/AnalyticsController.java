package com.shinpo.controller;

import com.shinpo.dto.AnalyticsDtos.AnalyticsDashboardResponse;
import com.shinpo.security.UserPrincipal;
import com.shinpo.service.AnalyticsService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestParam;
import com.shinpo.dto.AnalyticsDtos.AnalyticsPeriodResponse;

@RestController
@RequestMapping("/api/analytics")
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    public AnalyticsController(AnalyticsService analyticsService) {
        this.analyticsService = analyticsService;
    }

    @GetMapping("/dashboard")
    public ResponseEntity<AnalyticsDashboardResponse> getAnalyticsDashboard(
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(analyticsService.getAnalyticsDashboard(principal.getUserId()));
    }

    @GetMapping("/period")
    public ResponseEntity<AnalyticsPeriodResponse> getAnalyticsPeriod(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam String range
    ) {
        return ResponseEntity.ok(analyticsService.getAnalyticsPeriod(principal.getUserId(), range));
    }
}
