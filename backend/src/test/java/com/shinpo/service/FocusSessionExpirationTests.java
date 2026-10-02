package com.shinpo.service;

import com.shinpo.entity.FocusSession;
import com.shinpo.entity.FocusSessionStatus;
import com.shinpo.entity.User;
import com.shinpo.repository.FocusSessionRepository;
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

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit-style integration tests for FocusSession expiration logic:
 * - SCHEDULED sessions past their window → EXPIRED
 * - ACTIVE sessions abandoned beyond 2× budget → EXPIRED
 * - PAUSED sessions abandoned beyond 4× budget → EXPIRED
 * - Normal ACTIVE sessions are NOT expired prematurely
 * - Normal PAUSED sessions (recently paused) are NOT expired prematurely
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class FocusSessionExpirationTests {

    @Autowired
    private FocusSessionService focusSessionService;

    @Autowired
    private FocusSessionRepository focusSessionRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private User testUser;

    @BeforeEach
    void setUp() {
        long ts = System.currentTimeMillis();
        testUser = userRepository.save(new User(
                "expiry_test_" + ts,
                "expiry_" + ts + "@shinpo.io",
                passwordEncoder.encode("Pass123!"),
                Instant.now()
        ));
    }

    private FocusSession buildSession(FocusSessionStatus status, int durationMinutes) {
        FocusSession s = new FocusSession();
        s.setUser(testUser);
        s.setName("Test Session");
        s.setDurationMinutes(durationMinutes);
        s.setStatus(status);
        s.setAccumulatedPausedSeconds(0L);
        return s;
    }

    @Test
    @DisplayName("SCHEDULED session past its window is expired")
    void scheduledSessionExpiredWhenWindowPassed() {
        FocusSession s = buildSession(FocusSessionStatus.SCHEDULED, 30);
        // Scheduled 2 hours ago — well past the 30m window
        s.setScheduledAt(Instant.now().minus(Duration.ofHours(2)));
        s = focusSessionRepository.save(s);

        boolean expired = focusSessionService.checkAndApplyExpiration(s, Instant.now());

        assertTrue(expired);
        assertEquals(FocusSessionStatus.EXPIRED, s.getStatus());
        assertNotNull(s.getEndedAt());
    }

    @Test
    @DisplayName("SCHEDULED session within its window is NOT expired")
    void scheduledSessionNotExpiredWithinWindow() {
        FocusSession s = buildSession(FocusSessionStatus.SCHEDULED, 60);
        // Scheduled 10 minutes ago — within the 60m window
        s.setScheduledAt(Instant.now().minus(Duration.ofMinutes(10)));
        s = focusSessionRepository.save(s);

        boolean expired = focusSessionService.checkAndApplyExpiration(s, Instant.now());

        assertFalse(expired);
        assertEquals(FocusSessionStatus.SCHEDULED, s.getStatus());
    }

    @Test
    @DisplayName("ACTIVE session abandoned beyond 2× budget is expired")
    void activeSessionExpiredWhenAbandoned() {
        FocusSession s = buildSession(FocusSessionStatus.ACTIVE, 25);
        // Started 3 hours ago (2×25m = 50m budget, so 3h >> 2×)
        s.setStartedAt(Instant.now().minus(Duration.ofHours(3)));
        s = focusSessionRepository.save(s);

        boolean expired = focusSessionService.checkAndApplyExpiration(s, Instant.now());

        assertTrue(expired);
        assertEquals(FocusSessionStatus.EXPIRED, s.getStatus());
        assertNotNull(s.getEndedAt());
    }

    @Test
    @DisplayName("ACTIVE session running within budget is NOT expired")
    void activeSessionNotExpiredWithinBudget() {
        FocusSession s = buildSession(FocusSessionStatus.ACTIVE, 60);
        // Started 30 minutes ago — within budget
        s.setStartedAt(Instant.now().minus(Duration.ofMinutes(30)));
        s = focusSessionRepository.save(s);

        boolean expired = focusSessionService.checkAndApplyExpiration(s, Instant.now());

        assertFalse(expired);
        assertEquals(FocusSessionStatus.ACTIVE, s.getStatus());
    }

    @Test
    @DisplayName("PAUSED session abandoned beyond 4× budget is expired")
    void pausedSessionExpiredWhenAbandoned() {
        FocusSession s = buildSession(FocusSessionStatus.PAUSED, 25);
        // Started and paused 6 hours ago — 4×25m = 100m threshold, 6h >> 100m
        Instant longAgo = Instant.now().minus(Duration.ofHours(6));
        s.setStartedAt(longAgo);
        s.setPausedAt(longAgo);
        s = focusSessionRepository.save(s);

        boolean expired = focusSessionService.checkAndApplyExpiration(s, Instant.now());

        assertTrue(expired);
        assertEquals(FocusSessionStatus.EXPIRED, s.getStatus());
        assertNotNull(s.getEndedAt());
        assertNull(s.getPausedAt());
    }

    @Test
    @DisplayName("PAUSED session recently paused is NOT expired")
    void pausedSessionNotExpiredWhenRecentlyPaused() {
        FocusSession s = buildSession(FocusSessionStatus.PAUSED, 60);
        // Paused 5 minutes ago — well within 4×60m = 240m threshold
        s.setStartedAt(Instant.now().minus(Duration.ofMinutes(20)));
        s.setPausedAt(Instant.now().minus(Duration.ofMinutes(5)));
        s = focusSessionRepository.save(s);

        boolean expired = focusSessionService.checkAndApplyExpiration(s, Instant.now());

        assertFalse(expired);
        assertEquals(FocusSessionStatus.PAUSED, s.getStatus());
    }

    @Test
    @DisplayName("sweepExpiredSessions picks up PAUSED sessions without full table scan")
    void sweepPicksUpPausedAbandonedSessions() {
        // Create an abandoned paused session (paused for 6h, 25m session → 4×25=100m threshold)
        FocusSession abandoned = buildSession(FocusSessionStatus.PAUSED, 25);
        Instant veryLongAgo = Instant.now().minus(Duration.ofHours(6));
        abandoned.setStartedAt(veryLongAgo);
        abandoned.setPausedAt(veryLongAgo);
        abandoned = focusSessionRepository.save(abandoned);

        // Create a recently-paused session that must NOT be expired
        FocusSession recent = buildSession(FocusSessionStatus.PAUSED, 60);
        recent.setStartedAt(Instant.now().minus(Duration.ofMinutes(20)));
        recent.setPausedAt(Instant.now().minus(Duration.ofMinutes(2)));
        recent = focusSessionRepository.save(recent);

        focusSessionService.sweepExpiredSessions();

        FocusSession reloadedAbandoned = focusSessionRepository.findById(abandoned.getId()).orElseThrow();
        FocusSession reloadedRecent = focusSessionRepository.findById(recent.getId()).orElseThrow();

        assertEquals(FocusSessionStatus.EXPIRED, reloadedAbandoned.getStatus(),
                "Abandoned PAUSED session should be EXPIRED after sweep");
        assertEquals(FocusSessionStatus.PAUSED, reloadedRecent.getStatus(),
                "Recently paused session should remain PAUSED after sweep");
    }
}
