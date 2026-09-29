package com.shinpo.dto;

import java.time.Instant;
import java.util.List;

public class AnalyticsDtos {

    public record AnalyticsSummary(
            Long totalFocusMinutes,
            Integer sessionsCompleted,
            Integer sessionsStarted,
            Integer missionsCompleted,
            Integer missionsTotal,
            Double avgQuality,
            Integer completionRate,
            Integer currentStreak
    ) {}

    public record DailyFocusVelocity(
            String date,
            String dayName,
            Integer focusMinutes,
            Integer completedCount
    ) {}

    public record RecentDebrief(
            Long sessionId,
            String sessionName,
            String intention,
            Integer durationMinutes,
            Integer quality,
            String accomplishment,
            String reflectionNote,
            Instant completedAt
    ) {}

    public record AnalyticsDashboardResponse(
            AnalyticsSummary summary,
            List<DailyFocusVelocity> weeklyVelocity,
            List<RecentDebrief> recentDebriefs
    ) {}
}
