package com.shinpo.service;

import com.shinpo.dto.FocusSessionResponse;
import com.shinpo.dto.ContextualFocusDtos.PolicySnapshotResponse;
import com.shinpo.entity.*;
import com.shinpo.repository.FocusSessionRepository;
import com.shinpo.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Import;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;

import static org.junit.jupiter.api.Assertions.assertEquals;

@SpringBootTest
@ActiveProfiles("test")
@Import(FocusBreakGraceLifecycleTests.MutableClockConfig.class)
@Transactional
class FocusBreakGraceLifecycleTests {

    @Autowired private FocusSessionService service;
    @Autowired private ContextualFocusPolicyService policies;
    @Autowired private FocusSessionRepository sessions;
    @Autowired private UserRepository users;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private MutableClock clock;

    @Test
    void finalBreakMovesToGraceThenHoldsReturnRequiredUntilUserReturns() {
        clock.set(Instant.now());
        User user = users.save(new User("break_lifecycle_" + System.nanoTime(),
                "break_" + System.nanoTime() + "@shinpo.test", passwordEncoder.encode("Pass123!"), clock.instant()));
        FocusSession session = new FocusSession();
        session.setUser(user);
        session.setName("Study block");
        session.setDurationMinutes(60);
        session.setPomodoroEnabled(true);
        session.setPomodoroFocusCycles(1);
        session.setPomodoroLongBreakMinutes(15);
        session.setPomodoroGraceMinutes(10);
        session = sessions.saveAndFlush(session);
        Long sessionId = session.getId();
        Long userId = user.getId();

        service.startSession(sessionId, userId);
        clock.advance(Duration.ofMinutes(60));
        PolicySnapshotResponse breakPolicy = policies.getActivePolicy(userId);
        assertEquals(SessionIntervalType.LONG_BREAK, breakPolicy.currentPhase());
        assertEquals(clock.instant().plus(Duration.ofMinutes(15)), breakPolicy.phaseDeadlineAt());
        assertEquals(60 * 60L, sessions.findById(sessionId).orElseThrow().calculateActiveSeconds(clock.instant()));

        clock.advance(Duration.ofMinutes(15));
        assertEquals(SessionIntervalType.GRACE, policies.getActivePolicy(userId).currentPhase());
        assertEquals(15 * 60L, sessions.findById(sessionId).orElseThrow().getBreakActiveSeconds());

        clock.advance(Duration.ofMinutes(10));
        PolicySnapshotResponse cutoffPolicy = policies.getActivePolicy(userId);
        FocusSessionResponse cutoff = service.getSession(sessionId, userId);
        assertEquals(SessionIntervalType.RETURN_REQUIRED, cutoffPolicy.currentPhase());
        assertEquals(SessionIntervalType.RETURN_REQUIRED, cutoff.getCurrentPhase());
        assertEquals(60 * 60L, cutoff.getFocusActiveSeconds());
        assertEquals(25 * 60L, cutoff.getBreakActiveSeconds());
        assertEquals(SessionIntervalType.RETURN_REQUIRED, sessions.findById(sessionId).orElseThrow().getCurrentPhase());

        FocusSessionResponse resumed = service.returnToFocus(sessionId, userId);
        assertEquals(SessionIntervalType.FOCUS, resumed.getCurrentPhase());
        assertEquals(0, resumed.getCompletedFocusCycles());
        assertEquals(60 * 60L, resumed.getFocusActiveSeconds());
    }

    @TestConfiguration
    static class MutableClockConfig {
        @Bean @Primary MutableClock mutableClock() { return new MutableClock(); }
    }

    static class MutableClock extends Clock {
        private Instant now = Instant.EPOCH;
        void set(Instant instant) { now = instant; }
        void advance(Duration duration) { now = now.plus(duration); }
        @Override public ZoneId getZone() { return ZoneId.of("UTC"); }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
    }
}
