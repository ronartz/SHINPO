package com.shinpo.service;

import com.shinpo.dto.AnalyticsDtos.*;
import com.shinpo.entity.FocusSession;
import com.shinpo.entity.FocusSessionStatus;
import com.shinpo.entity.Mission;
import com.shinpo.repository.FocusSessionRepository;
import com.shinpo.repository.MissionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.Clock;
import java.util.*;

@Service
public class AnalyticsService {

    private final FocusSessionRepository focusSessionRepository;
    private final MissionRepository missionRepository;
    private final Clock clock;

    @Autowired
    public AnalyticsService(FocusSessionRepository focusSessionRepository, MissionRepository missionRepository) {
        this(focusSessionRepository, missionRepository, Clock.systemUTC());
    }

    AnalyticsService(
            FocusSessionRepository focusSessionRepository,
            MissionRepository missionRepository,
            Clock clock
    ) {
        this.focusSessionRepository = focusSessionRepository;
        this.missionRepository = missionRepository;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public AnalyticsDashboardResponse getAnalyticsDashboard(Long userId) {
        List<FocusSession> allSessions = focusSessionRepository.findAllByUser_IdOrderByCreatedAtDesc(userId);
        List<Mission> allMissions = missionRepository.findAllByGoal_User_IdOrderByCreatedAtDesc(userId);

        int sessionsCompleted = 0;
        int sessionsStarted = 0;
        int qualitySum = 0;
        int qualityCount = 0;
        long totalActiveSeconds = 0;
        Set<LocalDate> completedExecutionDates = new HashSet<>();
        LocalDate today = LocalDate.now(clock);

        List<RecentDebrief> debriefs = new ArrayList<>();
        Instant now = Instant.now(clock);

        for (FocusSession s : allSessions) {
            if (s.getStatus() == FocusSessionStatus.COMPLETED) {
                sessionsCompleted++;
                totalActiveSeconds += s.calculateActiveSeconds(now);
                Instant executionPoint = s.getEndedAt() != null ? s.getEndedAt() : s.getCreatedAt();
                if (executionPoint != null) {
                    completedExecutionDates.add(LocalDate.ofInstant(executionPoint, ZoneOffset.UTC));
                }
                if (s.getCompletionQuality() != null && s.getCompletionQuality() > 0) {
                    qualitySum += s.getCompletionQuality();
                    qualityCount++;
                }
                if (s.getAccomplishment() != null || s.getReflectionNote() != null) {
                    debriefs.add(new RecentDebrief(
                            s.getId(),
                            s.getName(),
                            s.getIntention(),
                            s.getDurationMinutes(),
                            Math.round(s.calculateActiveSeconds(now) / 60.0),
                            s.getCompletionQuality(),
                            s.getAccomplishment() != null ? s.getAccomplishment() : "Session completed",
                            s.getReflectionNote() != null ? s.getReflectionNote() : "",
                            s.getEndedAt() != null ? s.getEndedAt() : s.getCreatedAt()
                    ));
                }
            }
            if (s.getStartedAt() != null) {
                sessionsStarted++;
            }
        }

        int missionsCompleted = 0;
        for (Mission m : allMissions) {
            if ("COMPLETED".equalsIgnoreCase(m.getStatus())) {
                missionsCompleted++;
            }
        }

        long totalFocusMinutes = Math.round(totalActiveSeconds / 60.0);
        Double avgQuality = qualityCount > 0 ? Math.round((double) qualitySum / qualityCount * 10.0) / 10.0 : null;
        Integer completionRate = allMissions.isEmpty()
                ? null
                : (int) Math.round(((double) missionsCompleted / allMissions.size()) * 100.0);

        AnalyticsSummary summary = new AnalyticsSummary(
                totalFocusMinutes,
                sessionsCompleted,
                sessionsStarted,
                missionsCompleted,
                allMissions.size(),
                avgQuality,
                completionRate,
                calculateCurrentStreak(completedExecutionDates, today),
                "MISSIONS",
                missionsCompleted,
                allMissions.size()
        );

        // 7-day velocity
        List<DailyFocusVelocity> weeklyVelocity = new ArrayList<>();
        for (int i = 6; i >= 0; i--) {
            LocalDate d = today.minusDays(i);
            String dayName = d.getDayOfWeek().name().substring(0, 3);
            String dateStr = d.toString();

            int dayMinutes = 0;
            int dayCount = 0;

            for (FocusSession s : allSessions) {
                if (s.getStatus() == FocusSessionStatus.COMPLETED) {
                    Instant point = s.getEndedAt() != null ? s.getEndedAt() : s.getCreatedAt();
                    LocalDate sDate = LocalDate.ofInstant(point, ZoneOffset.UTC);
                    if (sDate.equals(d)) {
                        dayMinutes += Math.round(s.calculateActiveSeconds(now) / 60.0);
                        dayCount++;
                    }
                }
            }

            weeklyVelocity.add(new DailyFocusVelocity(dateStr, dayName, dayMinutes, dayCount));
        }

        return new AnalyticsDashboardResponse(summary, weeklyVelocity, debriefs);
    }

    @Transactional(readOnly = true)
    public AnalyticsPeriodResponse getAnalyticsPeriod(Long userId, String range) {
        Instant now = Instant.now(clock);
        int bucketCount;
        long bucketSeconds;
        switch (range) {
            case "24h" -> { bucketCount = 12; bucketSeconds = 2 * 60 * 60L; }
            case "7d" -> { bucketCount = 7; bucketSeconds = 24 * 60 * 60L; }
            case "30d" -> { bucketCount = 30; bucketSeconds = 24 * 60 * 60L; }
            case "90d" -> { bucketCount = 13; bucketSeconds = 7 * 24 * 60 * 60L; }
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported analytics range");
        }
        long rangeSeconds = range.equals("90d") ? 90 * 24 * 60 * 60L : bucketCount * bucketSeconds;
        Instant currentStart = now.minusSeconds(rangeSeconds);
        Instant previousStart = currentStart.minusSeconds(rangeSeconds);
        List<FocusSession> sessions = focusSessionRepository
                .findAllByUser_IdAndStatusAndEndedAtGreaterThanEqualAndEndedAtLessThanOrderByEndedAtAsc(
                        userId, FocusSessionStatus.COMPLETED, previousStart, now);

        List<ActivityBucket> current = emptyBuckets(currentStart, now, range, bucketCount, bucketSeconds);
        List<ActivityBucket> previous = emptyBuckets(previousStart, currentStart, range, bucketCount, bucketSeconds);
        long currentSeconds = 0;
        long previousSeconds = 0;
        int currentSessions = 0;
        int previousSessions = 0;
        Instant computedAt = Instant.now(clock);
        for (FocusSession session : sessions) {
            long active = session.calculateActiveSeconds(computedAt);
            Instant completedAt = session.getEndedAt();
            if (completedAt.isBefore(currentStart)) {
                int index = bucketIndex(completedAt, previousStart, range, bucketSeconds, bucketCount);
                previous.set(index, add(previous.get(index), active));
                previousSeconds += active;
                previousSessions++;
            } else if (completedAt.isBefore(now)) {
                int index = bucketIndex(completedAt, currentStart, range, bucketSeconds, bucketCount);
                current.set(index, add(current.get(index), active));
                currentSeconds += active;
                currentSessions++;
            }
        }
        return new AnalyticsPeriodResponse(range, "UTC", currentStart, now, previousStart, currentStart,
                current, previous, currentSeconds, currentSessions, previousSeconds, previousSessions);
    }

    private List<ActivityBucket> emptyBuckets(Instant start, Instant end, String range, int count, long bucketSeconds) {
        List<ActivityBucket> buckets = new ArrayList<>(count);
        for (int i = 0; i < count; i++) {
            Instant bucketStart = range.equals("90d") && i > 0
                    ? start.plusSeconds(6 * 24 * 60 * 60L + (long) (i - 1) * bucketSeconds)
                    : start.plusSeconds((long) i * bucketSeconds);
            Instant bucketEnd = i == count - 1 ? end : bucketStart.plusSeconds(
                    range.equals("90d") && i == 0 ? 6 * 24 * 60 * 60L : bucketSeconds);
            buckets.add(new ActivityBucket(bucketStart, bucketEnd, 0, 0));
        }
        return buckets;
    }

    private int bucketIndex(Instant point, Instant start, String range, long bucketSeconds, int count) {
        long offset = Math.max(0, point.getEpochSecond() - start.getEpochSecond());
        int index;
        if (range.equals("90d")) {
            long firstBucket = 6 * 24 * 60 * 60L;
            index = offset < firstBucket ? 0 : 1 + (int) ((offset - firstBucket) / bucketSeconds);
        } else {
            index = (int) (offset / bucketSeconds);
        }
        return Math.min(count - 1, Math.max(0, index));
    }

    private ActivityBucket add(ActivityBucket bucket, long activeSeconds) {
        return new ActivityBucket(bucket.start(), bucket.end(), bucket.activeSeconds() + activeSeconds,
                bucket.completedSessions() + 1);
    }

    private int calculateCurrentStreak(Set<LocalDate> completedExecutionDates, LocalDate today) {
        if (completedExecutionDates.isEmpty()) {
            return 0;
        }

        LocalDate latestExecutionDate = Collections.max(completedExecutionDates);
        if (latestExecutionDate.isBefore(today.minusDays(1)) || latestExecutionDate.isAfter(today)) {
            return 0;
        }
        int streak = 0;
        LocalDate date = latestExecutionDate;
        while (completedExecutionDates.contains(date)) {
            streak++;
            date = date.minusDays(1);
        }
        return streak;
    }
}
