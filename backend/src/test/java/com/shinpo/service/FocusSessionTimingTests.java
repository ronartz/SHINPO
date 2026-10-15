package com.shinpo.service;

import com.shinpo.dto.CompleteFocusSessionRequest;
import com.shinpo.dto.FocusSessionResponse;
import com.shinpo.dto.UpdateFocusSessionRequest;
import com.shinpo.entity.FocusSession;
import com.shinpo.entity.FocusSessionStatus;
import com.shinpo.entity.Goal;
import com.shinpo.entity.Mission;
import com.shinpo.entity.User;
import com.shinpo.repository.FocusSessionRepository;
import com.shinpo.repository.GoalRepository;
import com.shinpo.repository.MissionRepository;
import com.shinpo.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Regression test suite for Focus Session server-authoritative timing:
 * - Active seconds computation excludes paused duration
 * - Paused sessions freeze remaining seconds at pausedAt
 * - Resumed sessions preserve remaining budget and correctly accumulate paused seconds
 * - Remaining seconds never drop below 0
 * - Service start/pause/resume/complete lifecycle accurately updates timing fields and serverTime
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class FocusSessionTimingTests {

    @Autowired
    private FocusSessionService focusSessionService;

    @Autowired
    private FocusSessionRepository focusSessionRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private GoalRepository goalRepository;

    @Autowired
    private MissionRepository missionRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private User testUser;

    @BeforeEach
    void setUp() {
        long ts = System.currentTimeMillis();
        testUser = userRepository.save(new User(
                "timing_test_" + ts,
                "timing_" + ts + "@shinpo.io",
                passwordEncoder.encode("Pass123!"),
                Instant.now()
        ));
    }

    private FocusSession createTestSession(FocusSessionStatus status, int durationMinutes) {
        FocusSession s = new FocusSession();
        s.setUser(testUser);
        s.setName("Timing Regression Session");
        s.setDurationMinutes(durationMinutes);
        s.setStatus(status);
        s.setAccumulatedPausedSeconds(0L);
        return focusSessionRepository.save(s);
    }

    @Test
    @DisplayName("Active session correctly calculates active and remaining seconds")
    void activeSessionCalculatesActiveAndRemainingSeconds() {
        FocusSession session = createTestSession(FocusSessionStatus.ACTIVE, 25);
        Instant startedAt = Instant.parse("2026-01-01T10:00:00Z");
        session.setStartedAt(startedAt);

        Instant checkTime = Instant.parse("2026-01-01T10:10:00Z");
        long activeSeconds = session.calculateActiveSeconds(checkTime);
        long remainingSeconds = session.calculateRemainingSeconds(checkTime);

        // 10 minutes = 600s active, 25m budget = 1500s total, remaining = 900s
        assertEquals(600L, activeSeconds);
        assertEquals(900L, remainingSeconds);
    }

    @Test
    @DisplayName("Paused session freezes active seconds and remaining seconds at pause timestamp")
    void pausedSessionFreezesTimingAtPausedInstant() {
        FocusSession session = createTestSession(FocusSessionStatus.PAUSED, 25);
        Instant startedAt = Instant.now().minus(Duration.ofMinutes(15));
        Instant pausedAt = startedAt.plus(Duration.ofMinutes(5)); // paused after 5 minutes

        session.setStartedAt(startedAt);
        session.setPausedAt(pausedAt);
        session.setAccumulatedPausedSeconds(0L);

        // Check at current time (10 minutes after pause happened)
        Instant later = Instant.now();
        long activeSeconds = session.calculateActiveSeconds(later);
        long remainingSeconds = session.calculateRemainingSeconds(later);

        // Should be frozen at the 5-minute active mark (300s), NOT 15m (900s)
        assertEquals(300L, activeSeconds);
        assertEquals(1200L, remainingSeconds); // 1500 - 300 = 1200s remaining
    }

    @Test
    @DisplayName("Resumed session correctly excludes accumulated paused duration from active seconds")
    void resumedSessionExcludesAccumulatedPausedDuration() {
        FocusSession session = createTestSession(FocusSessionStatus.ACTIVE, 30);
        // Timeline:
        // Started 20 minutes ago
        // Paused for 10 minutes (accumulatedPausedSeconds = 600)
        // Current active elapsed = 20 - 10 = 10 minutes = 600 seconds
        Instant startedAt = Instant.now().minus(Duration.ofMinutes(20));
        session.setStartedAt(startedAt);
        session.setPausedAt(null);
        session.setAccumulatedPausedSeconds(600L); // 10 minutes paused

        Instant checkTime = Instant.now();
        long activeSeconds = session.calculateActiveSeconds(checkTime);
        long remainingSeconds = session.calculateRemainingSeconds(checkTime);

        // 20 minutes total - 10 minutes pause = 10 minutes active (600s)
        // Remaining out of 30 minutes (1800s) = 1800 - 600 = 1200s
        assertEquals(600L, activeSeconds, 2L);
        assertEquals(1200L, remainingSeconds, 2L);
    }

    @Test
    @DisplayName("Remaining seconds never drops below zero even when active duration exceeds budget")
    void remainingSecondsFloorsAtZero() {
        FocusSession session = createTestSession(FocusSessionStatus.ACTIVE, 15);
        // Session ran for 40 minutes (budget was only 15 minutes)
        Instant startedAt = Instant.now().minus(Duration.ofMinutes(40));
        session.setStartedAt(startedAt);

        Instant checkTime = Instant.now();
        long remainingSeconds = session.calculateRemainingSeconds(checkTime);

        assertEquals(0L, remainingSeconds);
    }

    @Test
    @DisplayName("Completed session uses endedAt rather than current timestamp")
    void completedSessionUsesEndedAtForTiming() {
        FocusSession session = createTestSession(FocusSessionStatus.COMPLETED, 25);
        Instant startedAt = Instant.now().minus(Duration.ofHours(2));
        Instant endedAt = startedAt.plus(Duration.ofMinutes(25)); // completed right at 25m

        session.setStartedAt(startedAt);
        session.setEndedAt(endedAt);

        Instant checkTime = Instant.now();
        long activeSeconds = session.calculateActiveSeconds(checkTime);
        long remainingSeconds = session.calculateRemainingSeconds(checkTime);

        assertEquals(1500L, activeSeconds);
        assertEquals(0L, remainingSeconds);
    }

    @Test
    @DisplayName("Full service lifecycle: start, pause, resume, complete maintain timing invariants")
    void serviceLifecycleMaintainsTimingInvariants() throws InterruptedException {
        FocusSession session = createTestSession(FocusSessionStatus.SCHEDULED, 20);

        // 1. Start session
        FocusSessionResponse started = focusSessionService.startSession(session.getId(), testUser.getId());
        assertEquals(FocusSessionStatus.ACTIVE, started.getStatus());
        assertNotNull(started.getStartedAt());
        assertNotNull(started.getServerTime());
        assertEquals(1200L, started.getRemainingSeconds(), 1L);
        assertEquals(0L, started.getActiveSeconds(), 1L);

        // Sleep briefly to let active time tick
        Thread.sleep(1050);

        // 2. Pause session
        FocusSessionResponse paused = focusSessionService.pauseSession(session.getId(), testUser.getId());
        assertEquals(FocusSessionStatus.PAUSED, paused.getStatus());
        assertNotNull(paused.getPausedAt());
        assertNotNull(paused.getServerTime());
        assertTrue(paused.getActiveSeconds() >= 1L);
        long remainingAtPause = paused.getRemainingSeconds();
        assertTrue(remainingAtPause <= 1199L);

        // Sleep during pause: timing must stay frozen
        Thread.sleep(1100);

        FocusSession reloadedDuringPause = focusSessionRepository.findById(session.getId()).orElseThrow();
        assertEquals(remainingAtPause, reloadedDuringPause.calculateRemainingSeconds(Instant.now()));

        // 3. Resume session
        FocusSessionResponse resumed = focusSessionService.resumeSession(session.getId(), testUser.getId());
        assertEquals(FocusSessionStatus.ACTIVE, resumed.getStatus());
        assertNull(resumed.getPausedAt());
        assertTrue(resumed.getAccumulatedPausedSeconds() >= 1L);
        // Remaining time upon resume must equal remaining time at pause
        assertEquals(remainingAtPause, resumed.getRemainingSeconds(), 1L);

        // 4. Complete session
        FocusSessionResponse completed = focusSessionService.completeSession(session.getId(), testUser.getId(), null);
        assertEquals(FocusSessionStatus.COMPLETED, completed.getStatus());
        assertNotNull(completed.getEndedAt());
        assertNotNull(completed.getServerTime());
    }

    @Test
    @DisplayName("FocusSessionResponse factory always produces serverTime and non-null timing metrics")
    void responseFactoryPopulatesTimingFields() {
        FocusSession session = createTestSession(FocusSessionStatus.SCHEDULED, 15);
        FocusSessionResponse response = FocusSessionResponse.from(session);

        assertNotNull(response.getServerTime());
        assertEquals(900L, response.getRemainingSeconds());
        assertEquals(0L, response.getActiveSeconds());
        assertEquals(0L, response.getAccumulatedPausedSeconds());
    }

    @Test
    @DisplayName("updateSession allows updating scheduled session details and linking/unlinking tasks")
    void updateSession_allowsEditingDetailsAndLinkedTask() {
        Goal goal = goalRepository.save(new Goal(
                "Goal A",
                "Description A",
                LocalDate.now(),
                LocalDate.now().plusDays(30),
                testUser
        ));

        Mission mission = missionRepository.save(new Mission(
                "Mission 1",
                "Description 1",
                LocalDate.now(),
                25,
                goal
        ));

        FocusSession session = createTestSession(FocusSessionStatus.SCHEDULED, 25);
        assertEquals("Timing Regression Session", session.getName());

        Instant newScheduledAt = Instant.now().plus(Duration.ofHours(2));
        UpdateFocusSessionRequest updateReq = new UpdateFocusSessionRequest(
                goal.getId(),
                mission.getId(),
                false,
                "Edited Deep Work Block",
                "New Intention",
                50,
                newScheduledAt
        );

        FocusSessionResponse updated = focusSessionService.updateSession(session.getId(), testUser.getId(), updateReq);
        assertEquals("Edited Deep Work Block", updated.getName());
        assertEquals("New Intention", updated.getIntention());
        assertEquals(50, updated.getDurationMinutes());
        assertEquals(mission.getId(), updated.getMissionId());
        assertEquals(goal.getId(), updated.getGoalId());

        // Now test unlinking task
        UpdateFocusSessionRequest unlinkReq = new UpdateFocusSessionRequest(
                null,
                null,
                true,
                "Independent Block",
                null,
                30,
                null
        );
        FocusSessionResponse unlinked = focusSessionService.updateSession(session.getId(), testUser.getId(), unlinkReq);
        assertEquals("Independent Block", unlinked.getName());
        assertNull(unlinked.getMissionId());
        assertNull(unlinked.getGoalId());
    }

    @Test
    @DisplayName("completeSession with markMissionCompleted marks linked task completed and awards progress")
    void completeSession_withMarkMissionCompleted_completesMissionAndAwardsProgress() {
        Goal goal = goalRepository.save(new Goal(
                "Infrastructure Scaling",
                "Description",
                LocalDate.now(),
                LocalDate.now().plusDays(30),
                testUser
        ));

        Mission mission = missionRepository.save(new Mission(
                "Pool Tuning",
                "Task description",
                LocalDate.now(),
                25,
                goal
        ));

        FocusSession session = createTestSession(FocusSessionStatus.SCHEDULED, 25);
        session.setMission(mission);
        session.setGoal(goal);
        focusSessionRepository.save(session);

        // Start session
        focusSessionService.startSession(session.getId(), testUser.getId());

        // Complete session with markMissionCompleted = true
        CompleteFocusSessionRequest completeReq = new CompleteFocusSessionRequest(
                5,
                "Everything tuned smoothly",
                "Connection pool max fixed to 20",
                true
        );

        FocusSessionResponse completed = focusSessionService.completeSession(session.getId(), testUser.getId(), completeReq);
        assertEquals(FocusSessionStatus.COMPLETED, completed.getStatus());
        assertEquals("Connection pool max fixed to 20", completed.getResult().accomplishment());

        // Verify that the linked mission is now COMPLETED
        Mission reloadedMission = missionRepository.findById(mission.getId()).orElseThrow();
        assertEquals("COMPLETED", reloadedMission.getStatus());
    }
}
