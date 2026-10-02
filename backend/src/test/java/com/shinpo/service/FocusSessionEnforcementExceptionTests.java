package com.shinpo.service;

import com.shinpo.dto.FocusSessionExceptionDtos.CreateFocusSessionExceptionRequest;
import com.shinpo.dto.FocusSessionExceptionDtos.FocusSessionExceptionResponse;
import com.shinpo.dto.SentinelDtos.*;
import com.shinpo.entity.*;
import com.shinpo.repository.*;
import com.shinpo.service.ContextualEnforcementDecisionService.PolicyDecision;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
public class FocusSessionEnforcementExceptionTests {

    @Autowired
    private FocusSessionEnforcementExceptionService exceptionService;

    @Autowired
    private ContextualEnforcementDecisionService decisionService;

    @Autowired
    private FocusSessionRepository sessionRepository;

    @Autowired
    private SentinelPolicyRuleRepository policyRuleRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private User user1;
    private User user2;
    private FocusSession activeSessionUser1;
    private FocusSession scheduledSessionUser1;
    private FocusSession pausedSessionUser1;
    private FocusSession completedSessionUser1;
    private FocusSession activeSessionUser2;

    @BeforeEach
    void setUp() {
        long ts = System.currentTimeMillis();
        user1 = userRepository.save(new User(
                "user1_" + ts,
                "user1_" + ts + "@shinpo.io",
                passwordEncoder.encode("Pass123!"),
                Instant.now()
        ));
        user2 = userRepository.save(new User(
                "user2_" + ts,
                "user2_" + ts + "@shinpo.io",
                passwordEncoder.encode("Pass123!"),
                Instant.now()
        ));

        activeSessionUser1 = new FocusSession();
        activeSessionUser1.setUser(user1);
        activeSessionUser1.setName("Active Sprint User 1");
        activeSessionUser1.setDurationMinutes(25);
        activeSessionUser1.setStatus(FocusSessionStatus.ACTIVE);
        activeSessionUser1.setStartedAt(Instant.now());
        activeSessionUser1 = sessionRepository.save(activeSessionUser1);

        scheduledSessionUser1 = new FocusSession();
        scheduledSessionUser1.setUser(user1);
        scheduledSessionUser1.setName("Scheduled Sprint User 1");
        scheduledSessionUser1.setDurationMinutes(25);
        scheduledSessionUser1.setStatus(FocusSessionStatus.SCHEDULED);
        scheduledSessionUser1.setScheduledAt(Instant.now().plusSeconds(3600));
        scheduledSessionUser1 = sessionRepository.save(scheduledSessionUser1);

        pausedSessionUser1 = new FocusSession();
        pausedSessionUser1.setUser(user1);
        pausedSessionUser1.setName("Paused Sprint User 1");
        pausedSessionUser1.setDurationMinutes(25);
        pausedSessionUser1.setStatus(FocusSessionStatus.PAUSED);
        pausedSessionUser1.setStartedAt(Instant.now().minusSeconds(600));
        pausedSessionUser1.setPausedAt(Instant.now());
        pausedSessionUser1 = sessionRepository.save(pausedSessionUser1);

        completedSessionUser1 = new FocusSession();
        completedSessionUser1.setUser(user1);
        completedSessionUser1.setName("Completed Sprint User 1");
        completedSessionUser1.setDurationMinutes(25);
        completedSessionUser1.setStatus(FocusSessionStatus.COMPLETED);
        completedSessionUser1.setStartedAt(Instant.now().minusSeconds(1800));
        completedSessionUser1.setEndedAt(Instant.now());
        completedSessionUser1 = sessionRepository.save(completedSessionUser1);

        activeSessionUser2 = new FocusSession();
        activeSessionUser2.setUser(user2);
        activeSessionUser2.setName("Active Sprint User 2");
        activeSessionUser2.setDurationMinutes(30);
        activeSessionUser2.setStatus(FocusSessionStatus.ACTIVE);
        activeSessionUser2.setStartedAt(Instant.now());
        activeSessionUser2 = sessionRepository.save(activeSessionUser2);
    }

    @Test
    @DisplayName("Scenario 1: Create PROCESS exception for own FocusSession -> succeeds")
    void testCreateProcessExceptionForOwnSession() {
        CreateFocusSessionExceptionRequest request = new CreateFocusSessionExceptionRequest(
                "discord",
                FocusSessionActivityType.PROCESS
        );

        FocusSessionExceptionResponse response = exceptionService.createException(
                user1.getId(),
                activeSessionUser1.getId(),
                request
        );

        assertNotNull(response);
        assertNotNull(response.id());
        assertEquals(activeSessionUser1.getId(), response.focusSessionId());
        assertEquals("discord", response.activityPattern());
        assertEquals(FocusSessionActivityType.PROCESS, response.activityType());
    }

    @Test
    @DisplayName("Scenario 2: Create exception for another user's FocusSession -> rejected")
    void testCreateExceptionForAnotherUsersSessionRejected() {
        CreateFocusSessionExceptionRequest request = new CreateFocusSessionExceptionRequest(
                "discord",
                FocusSessionActivityType.PROCESS
        );

        // user1 tries to add an exception to user2's session
        assertThrows(IllegalArgumentException.class, () ->
                exceptionService.createException(user1.getId(), activeSessionUser2.getId(), request)
        );
    }

    @Test
    @DisplayName("Scenario 3: List own FocusSession exceptions -> returns only that session's exceptions")
    void testListOwnSessionExceptions() {
        exceptionService.createException(
                user1.getId(),
                activeSessionUser1.getId(),
                new CreateFocusSessionExceptionRequest("discord", FocusSessionActivityType.PROCESS)
        );
        exceptionService.createException(
                user1.getId(),
                activeSessionUser1.getId(),
                new CreateFocusSessionExceptionRequest("steam", FocusSessionActivityType.PROCESS)
        );

        List<FocusSessionExceptionResponse> list = exceptionService.listExceptions(user1.getId(), activeSessionUser1.getId());
        assertEquals(2, list.size());
        assertTrue(list.stream().anyMatch(e -> "discord".equals(e.activityPattern())));
        assertTrue(list.stream().anyMatch(e -> "steam".equals(e.activityPattern())));
    }

    @Test
    @DisplayName("Scenario 4: List another user's FocusSession exceptions -> rejected")
    void testListAnotherUsersExceptionsRejected() {
        assertThrows(IllegalArgumentException.class, () ->
                exceptionService.listExceptions(user1.getId(), activeSessionUser2.getId())
        );
    }

    @Test
    @DisplayName("Scenario 5: Delete own exception -> succeeds")
    void testDeleteOwnException() {
        FocusSessionExceptionResponse created = exceptionService.createException(
                user1.getId(),
                activeSessionUser1.getId(),
                new CreateFocusSessionExceptionRequest("obs", FocusSessionActivityType.PROCESS)
        );

        exceptionService.deleteException(user1.getId(), activeSessionUser1.getId(), created.id());

        List<FocusSessionExceptionResponse> list = exceptionService.listExceptions(user1.getId(), activeSessionUser1.getId());
        assertTrue(list.isEmpty());
    }

    @Test
    @DisplayName("Scenario 6: Delete another user's exception -> rejected")
    void testDeleteAnotherUsersExceptionRejected() {
        FocusSessionExceptionResponse createdByUser2 = exceptionService.createException(
                user2.getId(),
                activeSessionUser2.getId(),
                new CreateFocusSessionExceptionRequest("discord", FocusSessionActivityType.PROCESS)
        );

        // user1 attempts to delete user2's exception
        assertThrows(IllegalArgumentException.class, () ->
                exceptionService.deleteException(user1.getId(), activeSessionUser2.getId(), createdByUser2.id())
        );
    }

    @Test
    @DisplayName("Scenario 7: Duplicate identical exception for the same session -> rejected")
    void testDuplicateExceptionRejected() {
        CreateFocusSessionExceptionRequest req = new CreateFocusSessionExceptionRequest(
                "discord",
                FocusSessionActivityType.PROCESS
        );

        exceptionService.createException(user1.getId(), activeSessionUser1.getId(), req);

        assertThrows(IllegalArgumentException.class, () ->
                exceptionService.createException(user1.getId(), activeSessionUser1.getId(), req)
        );
    }

    @Test
    @DisplayName("Scenario 8: Same activity pattern on two different FocusSessions -> allowed")
    void testSamePatternOnDifferentSessionsAllowed() {
        CreateFocusSessionExceptionRequest req = new CreateFocusSessionExceptionRequest(
                "discord",
                FocusSessionActivityType.PROCESS
        );

        FocusSessionExceptionResponse r1 = exceptionService.createException(user1.getId(), activeSessionUser1.getId(), req);
        FocusSessionExceptionResponse r2 = exceptionService.createException(user1.getId(), scheduledSessionUser1.getId(), req);

        assertNotNull(r1);
        assertNotNull(r2);
        assertNotEquals(r1.focusSessionId(), r2.focusSessionId());
    }

    @Test
    @DisplayName("Scenario 9: Exception on SCHEDULED session -> not considered active enforcement permission")
    void testExceptionOnScheduledSessionNotActive() {
        exceptionService.createException(
                user1.getId(),
                scheduledSessionUser1.getId(),
                new CreateFocusSessionExceptionRequest("discord", FocusSessionActivityType.PROCESS)
        );

        assertFalse(exceptionService.isActivityPermittedForSession(scheduledSessionUser1.getId(), "discord"));
    }

    @Test
    @DisplayName("Scenario 10: Exception on PAUSED session -> not considered active enforcement permission")
    void testExceptionOnPausedSessionNotActive() {
        exceptionService.createException(
                user1.getId(),
                pausedSessionUser1.getId(),
                new CreateFocusSessionExceptionRequest("discord", FocusSessionActivityType.PROCESS)
        );

        assertFalse(exceptionService.isActivityPermittedForSession(pausedSessionUser1.getId(), "discord"));
    }

    @Test
    @DisplayName("Scenario 11: Exception on COMPLETED session -> not considered active enforcement permission")
    void testExceptionOnCompletedSessionNotActive() {
        exceptionService.createException(
                user1.getId(),
                completedSessionUser1.getId(),
                new CreateFocusSessionExceptionRequest("discord", FocusSessionActivityType.PROCESS)
        );

        assertFalse(exceptionService.isActivityPermittedForSession(completedSessionUser1.getId(), "discord"));
    }

    @Test
    @DisplayName("Scenario 12: Exception on currently ACTIVE session -> considered permitted")
    void testExceptionOnActiveSessionPermitted() {
        exceptionService.createException(
                user1.getId(),
                activeSessionUser1.getId(),
                new CreateFocusSessionExceptionRequest("discord", FocusSessionActivityType.PROCESS)
        );

        assertTrue(exceptionService.isActivityPermittedByActiveSessionException(user1.getId(), "discord"));
        assertTrue(exceptionService.isActivityPermittedForSession(activeSessionUser1.getId(), "discord"));
    }

    @Test
    @DisplayName("Scenario 13: Existing global ALLOWED SentinelPolicyRule still works")
    void testGlobalAllowedPolicyRuleWorks() {
        policyRuleRepository.save(new SentinelPolicyRule(user1, "slack", "ALLOWED"));

        PolicyDecision decision = decisionService.evaluateProcess(user1.getId(), "slack");
        assertEquals(PolicyDecision.ALLOW, decision);
    }

    @Test
    @DisplayName("Scenario 14: Existing global BLOCKED SentinelPolicyRule still works")
    void testGlobalBlockedPolicyRuleWorks() {
        policyRuleRepository.save(new SentinelPolicyRule(user1, "steam", "BLOCKED"));

        PolicyDecision decision = decisionService.evaluateProcess(user1.getId(), "steam");
        assertEquals(PolicyDecision.ENFORCE, decision);
    }

    @Test
    @DisplayName("Scenario 15: Session exception overrides a matching global BLOCKED rule only for that active FocusSession")
    void testSessionExceptionOverridesGlobalBlockedForActiveSession() {
        // user1 has global rule blocking discord
        policyRuleRepository.save(new SentinelPolicyRule(user1, "discord", "BLOCKED"));

        // Prior to exception, discord is ENFORCE
        assertEquals(PolicyDecision.ENFORCE, decisionService.evaluateProcess(user1.getId(), "discord"));

        // Add exception to the ACTIVE session
        exceptionService.createException(
                user1.getId(),
                activeSessionUser1.getId(),
                new CreateFocusSessionExceptionRequest("discord", FocusSessionActivityType.PROCESS)
        );

        // Now during active session, discord is ALLOW
        assertEquals(PolicyDecision.ALLOW, decisionService.evaluateProcess(user1.getId(), "discord"));
    }

    @Test
    @DisplayName("Scenario 16: The same blocked activity remains enforceable outside that active FocusSession")
    void testSameBlockedActivityRemainsEnforceableOutsideActiveSession() {
        // user1 has global rule blocking discord
        policyRuleRepository.save(new SentinelPolicyRule(user1, "discord", "BLOCKED"));

        // Exception added to a SCHEDULED session (not active)
        exceptionService.createException(
                user1.getId(),
                scheduledSessionUser1.getId(),
                new CreateFocusSessionExceptionRequest("discord", FocusSessionActivityType.PROCESS)
        );

        // Outside active session (or when only scheduled has exception), decision remains ENFORCE
        assertEquals(PolicyDecision.ENFORCE, decisionService.evaluateProcess(user1.getId(), "discord"));

        // User2 does not have the exception, so user2 is ENFORCE
        assertEquals(PolicyDecision.ENFORCE, decisionService.evaluateProcess(user2.getId(), "discord"));
    }

    @Autowired
    private SentinelEnforcementService sentinelService;

    @Test
    @DisplayName("Scenario 17: Protected process behavior remains unchanged")
    void testProtectedProcessBehaviorUnchanged() {
        // systemd and shinpo are protected processes
        assertEquals(PolicyDecision.ALLOW, decisionService.evaluateProcess(user1.getId(), "systemd"));
        assertEquals(PolicyDecision.ALLOW, decisionService.evaluateProcess(user1.getId(), "shinpo-shield"));
        assertEquals(PolicyDecision.ALLOW, decisionService.evaluateProcess(user1.getId(), "postgres"));
    }

    @Test
    @DisplayName("Scenario 18: Spotify and VLC remain absent from default blocked policy")
    void testSpotifyAndVlcRemainAbsentFromDefaultBlocked() {
        assertFalse(SentinelEnforcementService.DEFAULT_DISTRACTIONS.contains("spotify"));
        assertFalse(SentinelEnforcementService.DEFAULT_DISTRACTIONS.contains("vlc"));

        assertEquals(PolicyDecision.ALLOW, decisionService.evaluateProcess(user1.getId(), "spotify"));
        assertEquals(PolicyDecision.ALLOW, decisionService.evaluateProcess(user1.getId(), "vlc"));
    }

    @Test
    @DisplayName("Slice 3C-2: Active session exception appears in daemon sync allowedPatterns")
    void testActiveSessionExceptionAppearsInDaemonSync() {
        exceptionService.createException(
                user1.getId(),
                activeSessionUser1.getId(),
                new CreateFocusSessionExceptionRequest("discord", FocusSessionActivityType.PROCESS)
        );

        SentinelDaemonSyncResponse sync = sentinelService.getDaemonSyncState(user1.getId());
        assertNotNull(sync);
        assertTrue(sync.hasActiveSession());
        assertTrue(sync.allowedPatterns().contains("discord"),
                "Active session exception 'discord' must appear in daemon sync allowedPatterns");
    }

    @Test
    @DisplayName("Slice 3C-2: Inactive session exceptions do NOT appear in daemon sync allowedPatterns")
    void testInactiveSessionExceptionNotInDaemonSync() {
        exceptionService.createException(
                user1.getId(),
                scheduledSessionUser1.getId(),
                new CreateFocusSessionExceptionRequest("discord", FocusSessionActivityType.PROCESS)
        );
        exceptionService.createException(
                user1.getId(),
                pausedSessionUser1.getId(),
                new CreateFocusSessionExceptionRequest("steam", FocusSessionActivityType.PROCESS)
        );
        exceptionService.createException(
                user1.getId(),
                completedSessionUser1.getId(),
                new CreateFocusSessionExceptionRequest("obs", FocusSessionActivityType.PROCESS)
        );

        SentinelDaemonSyncResponse sync = sentinelService.getDaemonSyncState(user1.getId());
        assertNotNull(sync);
        assertFalse(sync.allowedPatterns().contains("discord"));
        assertFalse(sync.allowedPatterns().contains("steam"));
        assertFalse(sync.allowedPatterns().contains("obs"));
    }

    @Test
    @DisplayName("Slice 3C-2: User B cannot benefit from User A's active session exception in daemon sync")
    void testUserBCannotBenefitFromUserAActiveException() {
        exceptionService.createException(
                user1.getId(),
                activeSessionUser1.getId(),
                new CreateFocusSessionExceptionRequest("discord", FocusSessionActivityType.PROCESS)
        );

        SentinelDaemonSyncResponse syncUser2 = sentinelService.getDaemonSyncState(user2.getId());
        assertNotNull(syncUser2);
        assertFalse(syncUser2.allowedPatterns().contains("discord"),
                "User 2 must not receive User 1's active session exception");
    }

    @Test
    @DisplayName("Slice 3C-2: Sentinel sweep trigger does not quarantine process permitted by active session exception")
    void testSentinelSweepRespectsActiveSessionException() {
        // user1 has active session with exception for "nonexistent_proc_allowed"
        exceptionService.createException(
                user1.getId(),
                activeSessionUser1.getId(),
                new CreateFocusSessionExceptionRequest("nonexistent_proc_allowed", FocusSessionActivityType.PROCESS)
        );

        // Add blocked rule for "nonexistent_proc_allowed"
        sentinelService.addPolicyRule(user1.getId(), new AddPolicyRuleRequest("nonexistent_proc_allowed", "BLOCKED"));

        // Trigger sweep
        SentinelSweepResponse sweep = sentinelService.triggerSweep(user1.getId());
        assertNotNull(sweep);
        assertFalse(sweep.interceptedNames().contains("nonexistent_proc_allowed"));
    }
}
