package com.shinpo.service;

import com.shinpo.dto.CreateFocusSessionRequest;
import com.shinpo.dto.FocusSessionResponse;
import com.shinpo.entity.FocusSession;
import com.shinpo.entity.FocusSessionStatus;
import com.shinpo.entity.SessionIntervalType;
import com.shinpo.entity.User;
import com.shinpo.repository.FocusSessionRepository;
import com.shinpo.repository.ProgressEventRepository;
import com.shinpo.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class PomodoroLifecycleTests {
    @Autowired FocusSessionService service;
    @Autowired FocusSessionRepository sessions;
    @Autowired UserRepository users;
    @Autowired ProgressEventRepository progressEvents;
    @Autowired PasswordEncoder passwordEncoder;

    private User user;

    @BeforeEach
    void setUp() {
        long now = System.currentTimeMillis();
        user = users.save(new User("pomodoro_" + now, "pomodoro_" + now + "@shinpo.io", passwordEncoder.encode("Pass123!"), Instant.now()));
    }

    private FocusSessionResponse startTwoCycleSession() {
        CreateFocusSessionRequest request = new CreateFocusSessionRequest();
        request.setUserId(user.getId());
        request.setName("Pomodoro lifecycle fixture");
        request.setDurationMinutes(1);
        request.setPomodoroEnabled(true);
        request.setPomodoroFocusCycles(2);
        request.setPomodoroShortBreakMinutes(1);
        request.setPomodoroLongBreakMinutes(1);
        FocusSessionResponse created = service.createSession(request);
        return service.startSession(created.getId(), user.getId());
    }

    // Historical phase timestamps here are deterministic test fixtures, never user-work or reward evidence.
    private void ageCurrentPhase(long seconds) {
        FocusSession entity = sessions.findById(startedId).orElseThrow();
        entity.setPhaseStartedAt(Instant.now().minusSeconds(seconds));
        sessions.saveAndFlush(entity);
    }

    private Long startedId;

    @Test
    void advancesPersistedFocusAndBreakPhasesAndCompletesOnlyAfterLongBreak() {
        FocusSessionResponse started = startTwoCycleSession();
        startedId = started.getId();
        assertEquals(SessionIntervalType.FOCUS, started.getCurrentPhase());

        ageCurrentPhase(61);
        FocusSessionResponse shortBreak = service.getSession(startedId, user.getId());
        assertEquals(SessionIntervalType.SHORT_BREAK, shortBreak.getCurrentPhase());
        assertEquals(1, shortBreak.getCompletedFocusCycles());
        assertEquals(60, shortBreak.getFocusActiveSeconds());
        assertTrue(shortBreak.getBreakActiveSeconds() <= 2, "transition latency is counted as real break time");

        FocusSessionResponse paused = service.pauseSession(startedId, user.getId());
        long frozen = paused.getRemainingSeconds();
        assertEquals(FocusSessionStatus.PAUSED, paused.getStatus());
        assertTrue(frozen > 0 && frozen <= 60);
        FocusSessionResponse resumed = service.resumeSession(startedId, user.getId());
        assertEquals(frozen, resumed.getRemainingSeconds());

        ageCurrentPhase(61);
        FocusSessionResponse secondFocus = service.getSession(startedId, user.getId());
        assertEquals(SessionIntervalType.FOCUS, secondFocus.getCurrentPhase());
        assertEquals(60, secondFocus.getBreakActiveSeconds());

        ageCurrentPhase(61);
        FocusSessionResponse longBreak = service.getSession(startedId, user.getId());
        assertEquals(SessionIntervalType.LONG_BREAK, longBreak.getCurrentPhase());
        assertEquals(2, longBreak.getCompletedFocusCycles());
        assertEquals(120, longBreak.getFocusActiveSeconds());

        ageCurrentPhase(61);
        FocusSessionResponse reflectionReady = service.getSession(startedId, user.getId());
        assertEquals(SessionIntervalType.COMPLETE, reflectionReady.getCurrentPhase());
        assertEquals(120, reflectionReady.getBreakActiveSeconds());
        assertEquals(FocusSessionStatus.ACTIVE, reflectionReady.getStatus());

        FocusSessionResponse completed = service.completeSession(startedId, user.getId());
        assertEquals(FocusSessionStatus.COMPLETED, completed.getStatus());
        assertEquals(120, completed.getFocusActiveSeconds());
    }

    @Test
    void skippingBreakDoesNotCreditSkippedTimeAndContinuousSessionsRemainContinuous() {
        FocusSessionResponse started = startTwoCycleSession();
        startedId = started.getId();
        FocusSession entity = sessions.findById(startedId).orElseThrow();
        entity.setCurrentPhase(SessionIntervalType.SHORT_BREAK);
        entity.setCompletedFocusCycles(1);
        entity.setFocusActiveSeconds(60L);
        entity.setPhaseStartedAt(Instant.now().minusSeconds(10));
        sessions.saveAndFlush(entity);

        FocusSessionResponse nextFocus = service.skipBreak(startedId, user.getId());
        assertEquals(SessionIntervalType.FOCUS, nextFocus.getCurrentPhase());
        assertEquals(10, nextFocus.getBreakActiveSeconds());

        CreateFocusSessionRequest continuous = new CreateFocusSessionRequest();
        continuous.setUserId(user.getId());
        continuous.setName("Continuous fixture");
        continuous.setDurationMinutes(25);
        FocusSessionResponse plain = service.createSession(continuous);
        assertFalse(plain.isPomodoroEnabled());
        assertEquals(SessionIntervalType.FOCUS, plain.getCurrentPhase());
    }

    @Test
    void breakTimeCannotQualifyPomodoroFocusReward() {
        FocusSessionResponse started = startTwoCycleSession();
        startedId = started.getId();
        FocusSession entity = sessions.findById(startedId).orElseThrow();
        entity.setStartedAt(Instant.now().minusSeconds(24 * 60L));
        entity.setCurrentPhase(SessionIntervalType.COMPLETE);
        entity.setFocusActiveSeconds(14 * 60L);
        entity.setBreakActiveSeconds(10 * 60L);
        entity.setPhaseStartedAt(null);
        sessions.saveAndFlush(entity);

        service.completeSession(startedId, user.getId());

        assertFalse(progressEvents.findAll().stream().anyMatch(event ->
                event.getUser().getId().equals(user.getId()) && "FOCUS_SESSION_COMPLETED".equals(event.getEventType())));
    }
}
