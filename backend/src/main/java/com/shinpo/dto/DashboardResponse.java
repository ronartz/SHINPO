package com.shinpo.dto;

import java.util.List;

public record DashboardResponse(
        UserSummary user,
        ProgressSummary progress,
        MissionSummary missions,
        List<GoalSummary> goals
) {

    public record UserSummary(
            Long id,
            String username
    ) {
    }

    public record ProgressSummary(
            Integer total
    ) {
    }

    public record MissionSummary(
            long total,
            long completed,
            long pending
    ) {
    }

    public record GoalSummary(
            Long id,
            String title,
            String status
    ) {
    }
}