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
import java.time.ZoneOffset;
import java.lang.reflect.Constructor;
import java.util.List;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;

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
        assertEquals(1, summary.sessionsStarted());
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
    void calculatesCurrentStreakWhenLastExecutionWasTodayOrYesterday() {
        FocusSession today = completedSession(60, 60, Instant.parse("2026-10-03T09:00:00Z"));
        FocusSession yesterday = completedSession(60, 60, Instant.parse("2026-10-02T09:00:00Z"));
        FocusSession twoDaysAgo = completedSession(60, 60, Instant.parse("2026-10-01T09:00:00Z"));
        when(missionRepository.findAllByGoal_User_IdOrderByCreatedAtDesc(USER_ID)).thenReturn(List.of());
        when(focusSessionRepository.findAllByUser_IdOrderByCreatedAtDesc(USER_ID))
                .thenReturn(List.of(today, yesterday, twoDaysAgo));

        assertEquals(3, analyticsService.getAnalyticsDashboard(USER_ID).summary().currentStreak());

        when(focusSessionRepository.findAllByUser_IdOrderByCreatedAtDesc(USER_ID))
                .thenReturn(List.of(yesterday));
        assertEquals(1, analyticsService.getAnalyticsDashboard(USER_ID).summary().currentStreak());
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

    @Test
    void expiresAStreakAfterMoreThanOneInactiveDay() {
        FocusSession oldSession = completedSession(60, 60, Instant.parse("2026-09-30T09:00:00Z"));
        when(missionRepository.findAllByGoal_User_IdOrderByCreatedAtDesc(USER_ID)).thenReturn(List.of());
        when(focusSessionRepository.findAllByUser_IdOrderByCreatedAtDesc(USER_ID))
                .thenReturn(List.of(oldSession));

        assertEquals(0, analyticsService.getAnalyticsDashboard(USER_ID).summary().currentStreak());
    }

    @Test
    void reportsPlannedAndActualFocusDurationSeparatelyForReflections() {
        FocusSession session = completedSession(120, 62, NOW.minusSeconds(60));
        when(session.getDurationMinutes()).thenReturn(120);
        when(session.getAccomplishment()).thenReturn("Finished the draft");
        when(missionRepository.findAllByGoal_User_IdOrderByCreatedAtDesc(USER_ID)).thenReturn(List.of());
        when(focusSessionRepository.findAllByUser_IdOrderByCreatedAtDesc(USER_ID))
                .thenReturn(List.of(session));

        var debrief = analyticsService.getAnalyticsDashboard(USER_ID).recentDebriefs().getFirst();

        assertEquals(120, debrief.durationMinutes());
        assertEquals(1L, debrief.actualFocusMinutes());
    }

    @Test
    void calculates24HourCurrentAndPreviousBucketsUsingOnlyCompletedUserSessions() {
        FocusSession current = periodSession(60, NOW.minusSeconds(3600));
        FocusSession previous = periodSession(90, NOW.minusSeconds(25 * 3600L));
        when(focusSessionRepository.findAllByUser_IdAndStatusAndEndedAtGreaterThanEqualAndEndedAtLessThanOrderByEndedAtAsc(
                USER_ID, FocusSessionStatus.COMPLETED, NOW.minusSeconds(48 * 3600L), NOW))
                .thenReturn(List.of(previous, current));

        var result = analyticsService.getAnalyticsPeriod(USER_ID, "24h");

        assertEquals("UTC", result.timezone());
        assertEquals(12, result.currentBuckets().size());
        assertEquals(12, result.previousBuckets().size());
        assertEquals(60, result.currentActiveSeconds());
        assertEquals(90, result.previousActiveSeconds());
        assertEquals(1, result.currentCompletedSessions());
        assertEquals(1, result.previousCompletedSessions());
        assertEquals(1, result.currentBuckets().get(11).completedSessions());
        assertEquals(1, result.previousBuckets().get(11).completedSessions());
        verify(focusSessionRepository).findAllByUser_IdAndStatusAndEndedAtGreaterThanEqualAndEndedAtLessThanOrderByEndedAtAsc(
                USER_ID, FocusSessionStatus.COMPLETED, NOW.minusSeconds(48 * 3600L), NOW);
    }

    @Test
    void makes90DayBucketsContinuousAndReturnsEmptyActivityWithoutFakeValues() {
        when(focusSessionRepository.findAllByUser_IdAndStatusAndEndedAtGreaterThanEqualAndEndedAtLessThanOrderByEndedAtAsc(
                USER_ID, FocusSessionStatus.COMPLETED, NOW.minusSeconds(180 * 86400L), NOW)).thenReturn(List.of());

        var result = analyticsService.getAnalyticsPeriod(USER_ID, "90d");

        assertEquals(13, result.currentBuckets().size());
        assertEquals(13, result.previousBuckets().size());
        assertEquals(result.currentBuckets().get(0).end(), result.currentBuckets().get(1).start());
        assertEquals(NOW, result.currentBuckets().get(12).end());
        assertTrue(result.currentBuckets().stream().allMatch(bucket -> bucket.activeSeconds() == 0 && bucket.completedSessions() == 0));
        assertEquals(0, result.currentActiveSeconds());
        assertEquals(0, result.currentCompletedSessions());
    }

    @Test
    void supportsSevenAndThirtyDayWindowsWithMatchingComparisonLengths() {
        when(focusSessionRepository.findAllByUser_IdAndStatusAndEndedAtGreaterThanEqualAndEndedAtLessThanOrderByEndedAtAsc(
                anyLong(), eq(FocusSessionStatus.COMPLETED), any(Instant.class), any(Instant.class))).thenReturn(List.of());

        var week = analyticsService.getAnalyticsPeriod(USER_ID, "7d");
        var month = analyticsService.getAnalyticsPeriod(USER_ID, "30d");

        assertEquals(7, week.currentBuckets().size());
        assertEquals(7, week.previousBuckets().size());
        assertEquals(7 * 86400L, week.currentEnd().getEpochSecond() - week.currentStart().getEpochSecond());
        assertEquals(30, month.currentBuckets().size());
        assertEquals(30, month.previousBuckets().size());
        assertEquals(30 * 86400L, month.currentEnd().getEpochSecond() - month.currentStart().getEpochSecond());
        verify(focusSessionRepository, times(2)).findAllByUser_IdAndStatusAndEndedAtGreaterThanEqualAndEndedAtLessThanOrderByEndedAtAsc(
                eq(USER_ID), eq(FocusSessionStatus.COMPLETED), any(Instant.class), any(Instant.class));
    }

    @Test
    void rejectsUnsupportedAnalyticsRanges() {
        assertThrows(ResponseStatusException.class, () -> analyticsService.getAnalyticsPeriod(USER_ID, "all"));
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
        when(session.getStartedAt()).thenReturn(endedAt.minusSeconds(activeSeconds));
        lenient().when(session.calculateActiveSeconds(NOW)).thenReturn(activeSeconds);
        return session;
    }

    private FocusSession periodSession(long activeSeconds, Instant endedAt) {
        FocusSession session = mock(FocusSession.class);
        when(session.getEndedAt()).thenReturn(endedAt);
        when(session.calculateActiveSeconds(NOW)).thenReturn(activeSeconds);
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
