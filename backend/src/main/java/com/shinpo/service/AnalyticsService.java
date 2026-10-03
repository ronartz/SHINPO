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
                            s.getCompletionQuality(),
                            s.getAccomplishment() != null ? s.getAccomplishment() : "Session completed",
                            s.getReflectionNote() != null ? s.getReflectionNote() : "",
                            s.getEndedAt() != null ? s.getEndedAt() : s.getCreatedAt()
                    ));
                }
            } else if (s.getStatus() == FocusSessionStatus.ACTIVE || s.getStatus() == FocusSessionStatus.PAUSED) {
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
                calculateCurrentStreak(completedExecutionDates),
                "MISSIONS",
                missionsCompleted,
                allMissions.size()
        );

        // 7-day velocity
        List<DailyFocusVelocity> weeklyVelocity = new ArrayList<>();
        LocalDate today = LocalDate.now(clock);

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

    private int calculateCurrentStreak(Set<LocalDate> completedExecutionDates) {
        if (completedExecutionDates.isEmpty()) {
            return 0;
        }

        LocalDate latestExecutionDate = Collections.max(completedExecutionDates);
        int streak = 0;
        LocalDate date = latestExecutionDate;
        while (completedExecutionDates.contains(date)) {
            streak++;
            date = date.minusDays(1);
        }
        return streak;
    }
}
