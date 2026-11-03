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
            Integer currentStreak,
            String completionRatePopulation,
            Integer completionRateNumerator,
            Integer completionRateDenominator
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
            Long actualFocusMinutes,
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

    public record ActivityBucket(Instant start, Instant end, long activeSeconds, int completedSessions) {}

    public record AnalyticsPeriodResponse(
            String range,
            String timezone,
            Instant currentStart,
            Instant currentEnd,
            Instant previousStart,
            Instant previousEnd,
            List<ActivityBucket> currentBuckets,
            List<ActivityBucket> previousBuckets,
            long currentActiveSeconds,
            int currentCompletedSessions,
            long previousActiveSeconds,
            int previousCompletedSessions
    ) {}
}
