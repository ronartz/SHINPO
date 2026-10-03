package com.shinpo.service;

import com.shinpo.dto.AnalyticsDtos.AnalyticsDashboardResponse;
import com.shinpo.entity.FocusSession;
import com.shinpo.entity.FocusSessionStatus;
import com.shinpo.entity.Mission;
import com.shinpo.repository.FocusSessionRepository;
import com.shinpo.repository.MissionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.lang.reflect.Constructor;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AnalyticsServiceTests {

    private static final Long USER_ID = 42L;
    private static final Instant NOW = Instant.parse("2026-10-03T12:00:00Z");

    @Mock
    private FocusSessionRepository focusSessionRepository;

    @Mock
    private MissionRepository missionRepository;

    private AnalyticsService analyticsService;

    @BeforeEach
    void setUp() {
        analyticsService = new AnalyticsService(
                focusSessionRepository,
                missionRepository,
                Clock.fixed(NOW, ZoneOffset.UTC)
        );
    }

    @Test
    void calculatesMissionCompletionPopulationAndActualFocusTime() {
        Mission completed = mission("COMPLETED");
        Mission pending = mission("PENDING");
        Mission cancelled = mission("CANCELLED");
        FocusSession session = completedSession(60, 125, NOW.minusSeconds(60));
        when(missionRepository.findAllByGoal_User_IdOrderByCreatedAtDesc(USER_ID))
                .thenReturn(List.of(completed, pending, cancelled));
        when(focusSessionRepository.findAllByUser_IdOrderByCreatedAtDesc(USER_ID))
                .thenReturn(List.of(session));

        var summary = analyticsService.getAnalyticsDashboard(USER_ID).summary();

        assertEquals("MISSIONS", summary.completionRatePopulation());
        assertEquals(1, summary.completionRateNumerator());
        assertEquals(3, summary.completionRateDenominator());
        assertEquals(33, summary.completionRate());
        assertEquals(2L, summary.totalFocusMinutes());
        assertEquals(1, summary.sessionsCompleted());
    }

    @Test
    void returnsNoCompletionRateForZeroMissions() {
        when(missionRepository.findAllByGoal_User_IdOrderByCreatedAtDesc(USER_ID)).thenReturn(List.of());
        when(focusSessionRepository.findAllByUser_IdOrderByCreatedAtDesc(USER_ID)).thenReturn(List.of());

        var summary = analyticsService.getAnalyticsDashboard(USER_ID).summary();

        assertNull(summary.completionRate());
        assertEquals("MISSIONS", summary.completionRatePopulation());
        assertEquals(0, summary.completionRateNumerator());
        assertEquals(0, summary.completionRateDenominator());
    }

    @Test
    void excludesPausedSecondsAndUsesActualTimeForWeeklyVelocity() throws Exception {
        Instant endedAt = Instant.parse("2026-10-02T10:02:05Z");
        FocusSession session = realCompletedSession(60, endedAt);
        when(missionRepository.findAllByGoal_User_IdOrderByCreatedAtDesc(USER_ID)).thenReturn(List.of());
        when(focusSessionRepository.findAllByUser_IdOrderByCreatedAtDesc(USER_ID))
                .thenReturn(List.of(session));

        AnalyticsDashboardResponse response = analyticsService.getAnalyticsDashboard(USER_ID);

        assertEquals(2L, response.summary().totalFocusMinutes());
        var velocity = response.weeklyVelocity().stream()
                .filter(day -> day.date().equals("2026-10-02"))
                .findFirst()
                .orElseThrow();
        assertEquals(2, velocity.focusMinutes());
    }

    @Test
    void calculatesQualityAndReturnsNoQualityWhenThereAreNoObservations() {
        FocusSession qualityFive = completedSession(60, 60, NOW.minusSeconds(60));
        FocusSession qualityThree = completedSession(60, 60, NOW.minusSeconds(120));
        when(qualityFive.getCompletionQuality()).thenReturn(5);
        when(qualityThree.getCompletionQuality()).thenReturn(3);
        when(missionRepository.findAllByGoal_User_IdOrderByCreatedAtDesc(USER_ID)).thenReturn(List.of());
        when(focusSessionRepository.findAllByUser_IdOrderByCreatedAtDesc(USER_ID))
                .thenReturn(List.of(qualityFive, qualityThree));

        assertEquals(4.0, analyticsService.getAnalyticsDashboard(USER_ID).summary().avgQuality());

        when(focusSessionRepository.findAllByUser_IdOrderByCreatedAtDesc(USER_ID)).thenReturn(List.of());
        assertNull(analyticsService.getAnalyticsDashboard(USER_ID).summary().avgQuality());
    }

    @Test
    void calculatesConsecutiveDayStreakFromLatestExecutionDay() {
        FocusSession today = completedSession(60, 60, Instant.parse("2026-10-03T09:00:00Z"));
        FocusSession yesterday = completedSession(60, 60, Instant.parse("2026-10-02T09:00:00Z"));
        FocusSession twoDaysAgo = completedSession(60, 60, Instant.parse("2026-10-01T09:00:00Z"));
        when(missionRepository.findAllByGoal_User_IdOrderByCreatedAtDesc(USER_ID)).thenReturn(List.of());
        when(focusSessionRepository.findAllByUser_IdOrderByCreatedAtDesc(USER_ID))
                .thenReturn(List.of(today, yesterday, twoDaysAgo));

        assertEquals(3, analyticsService.getAnalyticsDashboard(USER_ID).summary().currentStreak());
    }

    @Test
    void stopsStreakAtCalendarGapAndReturnsZeroWithoutCompletedSessions() {
        FocusSession today = completedSession(60, 60, Instant.parse("2026-10-03T09:00:00Z"));
        FocusSession twoDaysAgo = completedSession(60, 60, Instant.parse("2026-10-01T09:00:00Z"));
        when(missionRepository.findAllByGoal_User_IdOrderByCreatedAtDesc(USER_ID)).thenReturn(List.of());
        when(focusSessionRepository.findAllByUser_IdOrderByCreatedAtDesc(USER_ID))
                .thenReturn(List.of(today, twoDaysAgo));

        assertEquals(1, analyticsService.getAnalyticsDashboard(USER_ID).summary().currentStreak());

        when(focusSessionRepository.findAllByUser_IdOrderByCreatedAtDesc(USER_ID)).thenReturn(List.of());
        assertEquals(0, analyticsService.getAnalyticsDashboard(USER_ID).summary().currentStreak());
    }

    private Mission mission(String status) {
        Mission mission = mock(Mission.class);
        when(mission.getStatus()).thenReturn(status);
        return mission;
    }

    private FocusSession completedSession(long plannedMinutes, long activeSeconds, Instant endedAt) {
        FocusSession session = mock(FocusSession.class);
        when(session.getStatus()).thenReturn(FocusSessionStatus.COMPLETED);
        when(session.getEndedAt()).thenReturn(endedAt);
        lenient().when(session.calculateActiveSeconds(NOW)).thenReturn(activeSeconds);
        return session;
    }

    private FocusSession realCompletedSession(long plannedMinutes, Instant endedAt) throws Exception {
        Constructor<FocusSession> constructor = FocusSession.class.getDeclaredConstructor();
        constructor.setAccessible(true);
        FocusSession session = constructor.newInstance();
        session.setStatus(FocusSessionStatus.COMPLETED);
        session.setDurationMinutes((int) plannedMinutes);
        session.setStartedAt(endedAt.minusSeconds(300));
        session.setEndedAt(endedAt);
        session.setAccumulatedPausedSeconds(175L);
        return session;
    }
}
