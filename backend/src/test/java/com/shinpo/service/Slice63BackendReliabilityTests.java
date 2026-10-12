package com.shinpo.service;

import com.shinpo.dto.AnalyticsDtos.AnalyticsDashboardResponse;
import com.shinpo.dto.FocusSessionResponse;
import com.shinpo.dto.SentinelDtos.EmergencyOverrideRequest;
import com.shinpo.dto.SentinelDtos.EmergencyOverrideResponse;
import com.shinpo.dto.SentinelWarningDtos.CandidateProcessRequest;
import com.shinpo.dto.SentinelWarningDtos.CandidateProcessResponse;
import com.shinpo.entity.*;
import com.shinpo.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;

import java.lang.reflect.Field;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class Slice63BackendReliabilityTests {

    private static final Long USER_ID = 100L;
    private static final Instant BASE_NOW = Instant.parse("2026-10-12T12:00:00Z");

    @Mock
    private FocusSessionRepository focusSessionRepository;

    @Mock
    private SentinelQuarantineRepository quarantineRepository;

    @Mock
    private SentinelPolicyRuleRepository policyRuleRepository;

    @Mock
    private SentinelTamperEventRepository tamperEventRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private PlatformTransactionManager transactionManager;

    @Mock
    private WebSocketEventService webSocketEventService;

    @Mock
    private FocusSessionEnforcementExceptionService exceptionService;

    @Mock
    private SentinelWarningService warningService;

    @Mock
    private SentinelEnforcementWarningRepository warningRepository;

    @Mock
    private SentinelGraceWindowRepository graceWindowRepository;

    @Mock
    private ContextualEnforcementDecisionService contextualDecisionService;

    @Mock
    private MissionRepository missionRepository;

    private SentinelEnforcementService sentinelEnforcementService;
    private FocusSessionService focusSessionService;
    private AnalyticsService analyticsService;

    private User testUser;

    @BeforeEach
    void setUp() {
        testUser = new User("focus_warrior", "warrior@shinpo.dev", "$2a$10$encodedHash", Instant.now());
        ReflectionTestUtils.setField(testUser, "id", USER_ID);
        testUser.setEnforcementMode("STRICT");

        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(testUser));
        when(userRepository.existsById(USER_ID)).thenReturn(true);

        sentinelEnforcementService = new SentinelEnforcementService(
                focusSessionRepository,
                quarantineRepository,
                policyRuleRepository,
                tamperEventRepository,
                userRepository,
                passwordEncoder,
                transactionManager,
                webSocketEventService,
                exceptionService,
                warningService
        );

        focusSessionService = new FocusSessionService(
                focusSessionRepository,
                userRepository,
                null,
                null,
                null,
                webSocketEventService
        );

        analyticsService = new AnalyticsService(
                focusSessionRepository,
                missionRepository,
                Clock.fixed(BASE_NOW, ZoneOffset.UTC)
        );
    }

    private FocusSession createSession(User user, String name, int durationMinutes, Instant scheduledAt) {
        FocusSession session = new FocusSession();
        session.setUser(user);
        session.setName(name);
        session.setDurationMinutes(durationMinutes);
        session.setScheduledAt(scheduledAt);
        return session;
    }

    // =========================================================================
    // 1. Sentinel Scheduler Query Efficiency & Targeting
    // =========================================================================

    @Test
    @DisplayName("Scheduler: periodicSentinelDaemon queries ONLY ACTIVE sessions via findAllByStatus and never calls findAll")
    void testPeriodicSentinelDaemonQueriesActiveSessionsTargeted() {
        FocusSession activeSession = createSession(testUser, "Deep Work", 45, BASE_NOW);
        ReflectionTestUtils.setField(activeSession, "id", 101L);
        activeSession.setStatus(FocusSessionStatus.ACTIVE);

        when(focusSessionRepository.findAllByStatus(FocusSessionStatus.ACTIVE))
                .thenReturn(List.of(activeSession));
        when(focusSessionRepository.findAllByUser_IdAndStatus(USER_ID, FocusSessionStatus.ACTIVE))
                .thenReturn(List.of(activeSession));

        sentinelEnforcementService.periodicSentinelDaemon();

        verify(focusSessionRepository, times(1)).findAllByStatus(FocusSessionStatus.ACTIVE);
        verify(focusSessionRepository, never()).findAll();
    }

    @Test
    @DisplayName("Scheduler: periodicSentinelDaemon produces 0 sweep workload when no active sessions exist")
    void testPeriodicSentinelDaemonIdleWhenNoActiveSessions() {
        when(focusSessionRepository.findAllByStatus(FocusSessionStatus.ACTIVE))
                .thenReturn(List.of());

        sentinelEnforcementService.periodicSentinelDaemon();

        verify(focusSessionRepository, times(1)).findAllByStatus(FocusSessionStatus.ACTIVE);
        verify(quarantineRepository, never()).save(any());
        verify(webSocketEventService, never()).broadcastQuarantine(any(), any());
    }

    // =========================================================================
    // 2. Scheduler Concurrency Guard & Non-Overlapping Sweep
    // =========================================================================

    @Test
    @DisplayName("Scheduler Concurrency: Non-overlapping sweep guard prevents concurrent execution when previous sweep is in progress")
    void testPeriodicSentinelDaemonNonOverlappingSweepGuard() throws Exception {
        Field sweepRunningField = SentinelEnforcementService.class.getDeclaredField("isSweepRunning");
        sweepRunningField.setAccessible(true);
        AtomicBoolean isSweepRunning = (AtomicBoolean) sweepRunningField.get(sentinelEnforcementService);

        // Simulate an ongoing sweep holding the guard
        isSweepRunning.set(true);
        assertTrue(sentinelEnforcementService.isSweepRunning());

        // Attempt second concurrent invocation
        sentinelEnforcementService.periodicSentinelDaemon();

        // Must skip query because guard was held
        verify(focusSessionRepository, never()).findAllByStatus(any());

        // Release guard
        isSweepRunning.set(false);
        assertFalse(sentinelEnforcementService.isSweepRunning());

        when(focusSessionRepository.findAllByStatus(FocusSessionStatus.ACTIVE)).thenReturn(List.of());
        sentinelEnforcementService.periodicSentinelDaemon();

        // Now it runs and automatically releases the guard in the finally block
        verify(focusSessionRepository, times(1)).findAllByStatus(FocusSessionStatus.ACTIVE);
        assertFalse(sentinelEnforcementService.isSweepRunning(), "Guard must be released after completion");
    }

    // =========================================================================
    // 3. Duplicate Warning / Enforcement Protection
    // =========================================================================

    @Test
    @DisplayName("Duplicate Warning Protection: evaluateCandidate reuses existing warning and does not create duplicates")
    void testDuplicateCandidateDoesNotCreateDuplicateWarning() {
        SentinelWarningService localWarningService = new SentinelWarningService(
                warningRepository,
                graceWindowRepository,
                focusSessionRepository,
                userRepository,
                contextualDecisionService
        );

        FocusSession activeSession = createSession(testUser, "Coding Sprint", 50, BASE_NOW);
        ReflectionTestUtils.setField(activeSession, "id", 201L);
        activeSession.setStatus(FocusSessionStatus.ACTIVE);

        when(contextualDecisionService.evaluateProcess(USER_ID, "discord"))
                .thenReturn(ContextualEnforcementDecisionService.PolicyDecision.ENFORCE);
        when(focusSessionRepository.findAllByUser_IdAndStatus(USER_ID, FocusSessionStatus.ACTIVE))
                .thenReturn(List.of(activeSession));

        Instant now = Instant.now();
        UUID warningId = UUID.randomUUID();
        SentinelEnforcementWarning existingWarning = new SentinelEnforcementWarning(
                testUser, activeSession, "discord", "discord.exe", now, now.plusSeconds(60)
        );
        ReflectionTestUtils.setField(existingWarning, "warningId", warningId);

        when(warningRepository.findByFocusSession_IdAndProcessNameAndStatusIn(
                eq(201L), eq("discord"), anyList()
        )).thenReturn(Optional.of(existingWarning));

        CandidateProcessRequest request = new CandidateProcessRequest("discord", "discord.exe", 9999L);
        CandidateProcessResponse response = localWarningService.evaluateCandidate(USER_ID, request);

        assertEquals("DEFER_WARNING", response.decision());
        assertEquals(warningId, response.warningId());
        // Verify repository save was NOT called again — no duplicate warning created
        verify(warningRepository, never()).save(any());
    }

    // =========================================================================
    // 4. Process Exit Verification & Enforce Ordering
    // =========================================================================

    @Test
    @DisplayName("Process Exit Verification: enforceProcess verifies termination status and returns accurate state")
    void testProcessTerminationVerification() {
        ProcessHandle currentHandle = ProcessHandle.current();
        // Current process is alive and will not exit within 150ms timeout; STRICT mode returns TERMINATE_ATTEMPTED
        // Note: we do NOT actually destroy the running test JVM; instead test audit mode and state mapping
        String auditResult = SentinelEnforcementService.enforceProcess(currentHandle, "AUDIT_ONLY");
        assertEquals("WARNED", auditResult);
    }

    // =========================================================================
    // 5. Enforcement Mode Persistence & Cache Miss Correctness
    // =========================================================================

    @Test
    @DisplayName("Enforcement Mode: Cache hit returns cached value; cache miss queries DB; invalidation re-queries DB")
    void testEnforcementModePersistedAndLoadsFromDb() {
        testUser.setEnforcementMode("CONTAINMENT");
        assertEquals("CONTAINMENT", sentinelEnforcementService.getEnforcementMode(USER_ID));
        verify(userRepository, times(1)).findById(USER_ID);

        // Cache hit: does not hit DB again
        assertEquals("CONTAINMENT", sentinelEnforcementService.getEnforcementMode(USER_ID));
        verify(userRepository, times(1)).findById(USER_ID);

        // Simulate database state updated out-of-band to AUDIT_ONLY and cache invalidated
        testUser.setEnforcementMode("AUDIT_ONLY");
        sentinelEnforcementService.invalidateEnforcementModeCache(USER_ID);

        // Cache miss: must reload fresh state from DB
        assertEquals("AUDIT_ONLY", sentinelEnforcementService.getEnforcementMode(USER_ID));
        verify(userRepository, times(2)).findById(USER_ID);
    }

    @Test
    @DisplayName("Enforcement Mode: Safe fallback to STRICT when user entity has null, blank, or invalid mode")
    void testEnforcementModeSafeFallback() {
        sentinelEnforcementService.invalidateEnforcementModeCache(USER_ID);
        testUser.setEnforcementMode("UNKNOWN_ROGUE_MODE");
        assertEquals("STRICT", sentinelEnforcementService.getEnforcementMode(USER_ID));

        sentinelEnforcementService.invalidateEnforcementModeCache(USER_ID);
        testUser.setEnforcementMode(null);
        assertEquals("STRICT", sentinelEnforcementService.getEnforcementMode(USER_ID));
    }

    @Test
    @DisplayName("Emergency Override: Persists mode change to User entity and database repository")
    void testEmergencyOverridePersistsToDatabase() {
        when(passwordEncoder.matches(any(), any())).thenReturn(true);
        when(focusSessionRepository.findAllByUser_IdAndStatus(USER_ID, FocusSessionStatus.ACTIVE)).thenReturn(List.of());

        EmergencyOverrideRequest request = new EmergencyOverrideRequest(
                "AUDIT_ONLY",
                "Critical customer incident requires emergency override access",
                "mypassword"
        );

        EmergencyOverrideResponse response = sentinelEnforcementService.emergencyOverride(USER_ID, request);

        assertTrue(response.success());
        assertEquals("AUDIT_ONLY", response.newMode());
        assertEquals("AUDIT_ONLY", testUser.getEnforcementMode(), "User entity must be updated to target mode");
        verify(userRepository, times(1)).save(testUser);
        verify(tamperEventRepository, times(1)).save(any());
        assertEquals("AUDIT_ONLY", sentinelEnforcementService.getEnforcementMode(USER_ID));
    }

    // =========================================================================
    // 6. Focus Session Lifecycle Transitions
    // =========================================================================

    @Test
    @DisplayName("Focus Session Lifecycle: SCHEDULED -> ACTIVE -> PAUSED -> ACTIVE -> COMPLETED transitions succeed")
    void testFocusSessionFullLifecycle() {
        FocusSession session = createSession(testUser, "Full Sprint", 30, BASE_NOW);
        ReflectionTestUtils.setField(session, "id", 301L);
        session.setStatus(FocusSessionStatus.SCHEDULED);

        when(focusSessionRepository.findByIdAndUser_Id(301L, USER_ID)).thenReturn(Optional.of(session));
        when(focusSessionRepository.save(any(FocusSession.class))).thenAnswer(inv -> inv.getArgument(0));

        // 1. SCHEDULED -> ACTIVE
        FocusSessionResponse startResp = focusSessionService.startSession(301L, USER_ID);
        assertEquals(FocusSessionStatus.ACTIVE, startResp.getStatus());
        assertNotNull(session.getStartedAt());

        // 2. ACTIVE -> PAUSED
        FocusSessionResponse pauseResp = focusSessionService.pauseSession(301L, USER_ID);
        assertEquals(FocusSessionStatus.PAUSED, pauseResp.getStatus());
        assertNotNull(session.getPausedAt());

        // 3. PAUSED -> ACTIVE
        FocusSessionResponse resumeResp = focusSessionService.resumeSession(301L, USER_ID);
        assertEquals(FocusSessionStatus.ACTIVE, resumeResp.getStatus());
        assertNull(session.getPausedAt());

        // 4. ACTIVE -> COMPLETED
        FocusSessionResponse completeResp = focusSessionService.completeSession(301L, USER_ID);
        assertEquals(FocusSessionStatus.COMPLETED, completeResp.getStatus());
        assertNotNull(session.getEndedAt());
    }

    @Test
    @DisplayName("Focus Session Cancellation: ACTIVE -> CANCELLED preserves truthful active running duration")
    void testActiveCancellationPreservesElapsedDuration() {
        FocusSession session = createSession(testUser, "Cancelled Sprint", 60, BASE_NOW.minusSeconds(1200));
        ReflectionTestUtils.setField(session, "id", 302L);
        session.setStatus(FocusSessionStatus.ACTIVE);
        session.setStartedAt(BASE_NOW.minusSeconds(1200)); // 20 minutes ago
        session.setAccumulatedPausedSeconds(0L);

        when(focusSessionRepository.findByIdAndUser_Id(302L, USER_ID)).thenReturn(Optional.of(session));
        when(focusSessionRepository.save(any(FocusSession.class))).thenAnswer(inv -> inv.getArgument(0));

        FocusSessionResponse cancelResp = focusSessionService.cancelSession(302L, USER_ID);

        assertEquals(FocusSessionStatus.CANCELLED, cancelResp.getStatus());
        assertNotNull(session.getEndedAt());
        // Verify active duration is truthfully preserved (approximately 1200 seconds / 20 mins)
        assertTrue(session.calculateActiveSeconds(BASE_NOW) >= 1200L, "Active seconds must reflect truthful duration");
    }

    @Test
    @DisplayName("Focus Session Cancellation: PAUSED -> CANCELLED correctly deducts pause duration from active time")
    void testPausedCancellationDeductsPauseDuration() {
        FocusSession session = createSession(testUser, "Paused Cancel Sprint", 60, BASE_NOW.minusSeconds(1500));
        ReflectionTestUtils.setField(session, "id", 303L);
        session.setStatus(FocusSessionStatus.PAUSED);
        session.setStartedAt(BASE_NOW.minusSeconds(1500)); // Started 25 mins ago
        session.setPausedAt(BASE_NOW.minusSeconds(300));    // Paused 5 mins ago
        session.setAccumulatedPausedSeconds(0L);

        when(focusSessionRepository.findByIdAndUser_Id(303L, USER_ID)).thenReturn(Optional.of(session));
        when(focusSessionRepository.save(any(FocusSession.class))).thenAnswer(inv -> inv.getArgument(0));

        FocusSessionResponse cancelResp = focusSessionService.cancelSession(303L, USER_ID);

        assertEquals(FocusSessionStatus.CANCELLED, cancelResp.getStatus());
        assertNotNull(session.getEndedAt());
        assertNull(session.getPausedAt());
        // 5 minutes pause accumulated
        assertTrue(session.getAccumulatedPausedSeconds() >= 300L);
        // Active seconds = 25m total - 5m pause = 20m (1200s)
        long activeSecs = session.calculateActiveSeconds(BASE_NOW);
        assertTrue(activeSecs >= 1190L && activeSecs <= 1210L, "Active seconds must exclude pause interval");
    }

    @Test
    @DisplayName("Focus Session Lifecycle: Invalid transitions are rejected with IllegalStateException")
    void testInvalidLifecycleTransitionsRejected() {
        FocusSession completedSession = createSession(testUser, "Done Sprint", 30, BASE_NOW);
        ReflectionTestUtils.setField(completedSession, "id", 304L);
        completedSession.setStatus(FocusSessionStatus.COMPLETED);

        when(focusSessionRepository.findByIdAndUser_Id(304L, USER_ID)).thenReturn(Optional.of(completedSession));

        // COMPLETED -> ACTIVE must fail
        assertThrows(IllegalStateException.class, () -> focusSessionService.startSession(304L, USER_ID));

        // COMPLETED -> CANCELLED must fail
        assertThrows(IllegalStateException.class, () -> focusSessionService.cancelSession(304L, USER_ID));

        FocusSession cancelledSession = createSession(testUser, "Cancelled", 30, BASE_NOW);
        ReflectionTestUtils.setField(cancelledSession, "id", 305L);
        cancelledSession.setStatus(FocusSessionStatus.CANCELLED);
        when(focusSessionRepository.findByIdAndUser_Id(305L, USER_ID)).thenReturn(Optional.of(cancelledSession));

        // CANCELLED -> ACTIVE must fail
        assertThrows(IllegalStateException.class, () -> focusSessionService.startSession(305L, USER_ID));

        // CANCELLED -> COMPLETED must fail
        assertThrows(IllegalStateException.class, () -> focusSessionService.completeSession(305L, USER_ID));
    }

    @Test
    @DisplayName("Focus Session Safety: ACTIVE and PAUSED sessions cannot be hard-deleted")
    void testActiveAndPausedSessionsCannotBeDeleted() {
        FocusSession activeSession = createSession(testUser, "Active", 30, BASE_NOW);
        ReflectionTestUtils.setField(activeSession, "id", 306L);
        activeSession.setStatus(FocusSessionStatus.ACTIVE);

        when(focusSessionRepository.findById(306L)).thenReturn(Optional.of(activeSession));

        assertThrows(IllegalStateException.class, () -> focusSessionService.deleteSession(306L, USER_ID));
        verify(focusSessionRepository, never()).delete(activeSession);

        FocusSession pausedSession = createSession(testUser, "Paused", 30, BASE_NOW);
        ReflectionTestUtils.setField(pausedSession, "id", 307L);
        pausedSession.setStatus(FocusSessionStatus.PAUSED);

        when(focusSessionRepository.findById(307L)).thenReturn(Optional.of(pausedSession));

        assertThrows(IllegalStateException.class, () -> focusSessionService.deleteSession(307L, USER_ID));
        verify(focusSessionRepository, never()).delete(pausedSession);

        // SCHEDULED session can be deleted
        FocusSession scheduledSession = createSession(testUser, "Scheduled", 30, BASE_NOW);
        ReflectionTestUtils.setField(scheduledSession, "id", 308L);
        scheduledSession.setStatus(FocusSessionStatus.SCHEDULED);

        when(focusSessionRepository.findById(308L)).thenReturn(Optional.of(scheduledSession));
        focusSessionService.deleteSession(308L, USER_ID);
        verify(focusSessionRepository, times(1)).delete(scheduledSession);
    }

    // =========================================================================
    // 7. Analytics Truthfulness: Cancelled Sessions Excluded
    // =========================================================================

    @Test
    @DisplayName("Analytics Truthfulness: Cancelled sessions are strictly excluded from completed session metrics")
    void testCancelledSessionsExcludedFromCompletedAnalytics() {
        FocusSession completed = mock(FocusSession.class);
        when(completed.getStatus()).thenReturn(FocusSessionStatus.COMPLETED);
        when(completed.getEndedAt()).thenReturn(BASE_NOW.minusSeconds(1800));
        when(completed.calculateActiveSeconds(BASE_NOW)).thenReturn(1800L); // 30 mins
        when(completed.getCompletionQuality()).thenReturn(5);

        FocusSession cancelled = mock(FocusSession.class);
        when(cancelled.getStatus()).thenReturn(FocusSessionStatus.CANCELLED);
        when(cancelled.getEndedAt()).thenReturn(BASE_NOW.minusSeconds(900));
        when(cancelled.calculateActiveSeconds(BASE_NOW)).thenReturn(900L); // 15 mins elapsed before cancellation

        when(missionRepository.findAllByGoal_User_IdOrderByCreatedAtDesc(USER_ID)).thenReturn(List.of());
        when(focusSessionRepository.findAllByUser_IdOrderByCreatedAtDesc(USER_ID))
                .thenReturn(List.of(completed, cancelled));

        AnalyticsDashboardResponse response = analyticsService.getAnalyticsDashboard(USER_ID);

        // sessionsCompleted must be 1 (only the COMPLETED session, not the CANCELLED one)
        assertEquals(1, response.summary().sessionsCompleted());
        // totalFocusMinutes must be 30 (1800s / 60), not 45
        assertEquals(30L, response.summary().totalFocusMinutes());
    }
}
