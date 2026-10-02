package com.shinpo.service;

import com.shinpo.dto.FocusSessionExceptionDtos.CreateFocusSessionExceptionRequest;
import com.shinpo.dto.SentinelDtos.SentinelDaemonSyncResponse;
import com.shinpo.dto.SentinelWarningDtos.*;
import com.shinpo.entity.*;
import com.shinpo.repository.FocusSessionRepository;
import com.shinpo.repository.SentinelEnforcementWarningRepository;
import com.shinpo.repository.SentinelGraceWindowRepository;
import com.shinpo.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
public class SentinelWarningServiceTests {

    @Autowired
    private SentinelWarningService warningService;

    @Autowired
    private SentinelEnforcementWarningRepository warningRepository;

    @Autowired
    private SentinelGraceWindowRepository graceWindowRepository;

    @Autowired
    private FocusSessionRepository sessionRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private SentinelEnforcementService sentinelService;

    @Autowired
    private FocusSessionEnforcementExceptionService exceptionService;

    private User user1;
    private User user2;
    private FocusSession activeSessionUser1;
    private FocusSession pausedSessionUser1;
    private FocusSession completedSessionUser1;
    private FocusSession cancelledSessionUser1;
    private FocusSession activeSessionUser2;

    @BeforeEach
    void setUp() {
        long ts = System.currentTimeMillis();
        user1 = userRepository.save(new User(
                "warn_user1_" + ts,
                "warn1_" + ts + "@shinpo.io",
                passwordEncoder.encode("Pass123!"),
                Instant.now()
        ));
        user2 = userRepository.save(new User(
                "warn_user2_" + ts,
                "warn2_" + ts + "@shinpo.io",
                passwordEncoder.encode("Pass123!"),
                Instant.now()
        ));

        activeSessionUser1 = new FocusSession();
        activeSessionUser1.setUser(user1);
        activeSessionUser1.setName("User1 Active Session");
        activeSessionUser1.setDurationMinutes(25);
        activeSessionUser1.setStatus(FocusSessionStatus.ACTIVE);
        activeSessionUser1.setStartedAt(Instant.now());
        activeSessionUser1 = sessionRepository.save(activeSessionUser1);

        pausedSessionUser1 = new FocusSession();
        pausedSessionUser1.setUser(user1);
        pausedSessionUser1.setName("User1 Paused Session");
        pausedSessionUser1.setDurationMinutes(25);
        pausedSessionUser1.setStatus(FocusSessionStatus.PAUSED);
        pausedSessionUser1.setStartedAt(Instant.now().minus(Duration.ofMinutes(10)));
        pausedSessionUser1.setPausedAt(Instant.now());
        pausedSessionUser1 = sessionRepository.save(pausedSessionUser1);

        completedSessionUser1 = new FocusSession();
        completedSessionUser1.setUser(user1);
        completedSessionUser1.setName("User1 Completed Session");
        completedSessionUser1.setDurationMinutes(25);
        completedSessionUser1.setStatus(FocusSessionStatus.COMPLETED);
        completedSessionUser1.setStartedAt(Instant.now().minus(Duration.ofMinutes(30)));
        completedSessionUser1.setEndedAt(Instant.now().minus(Duration.ofMinutes(5)));
        completedSessionUser1 = sessionRepository.save(completedSessionUser1);

        cancelledSessionUser1 = new FocusSession();
        cancelledSessionUser1.setUser(user1);
        cancelledSessionUser1.setName("User1 Cancelled Session");
        cancelledSessionUser1.setDurationMinutes(25);
        cancelledSessionUser1.setStatus(FocusSessionStatus.CANCELLED);
        cancelledSessionUser1.setStartedAt(Instant.now().minus(Duration.ofMinutes(15)));
        cancelledSessionUser1.setEndedAt(Instant.now().minus(Duration.ofMinutes(10)));
        cancelledSessionUser1 = sessionRepository.save(cancelledSessionUser1);

        activeSessionUser2 = new FocusSession();
        activeSessionUser2.setUser(user2);
        activeSessionUser2.setName("User2 Active Session");
        activeSessionUser2.setDurationMinutes(30);
        activeSessionUser2.setStatus(FocusSessionStatus.ACTIVE);
        activeSessionUser2.setStartedAt(Instant.now());
        activeSessionUser2 = sessionRepository.save(activeSessionUser2);
    }

    @Test
    @DisplayName("1. Issue warning successfully")
    void testIssueWarning_Success() {
        IssueWarningRequest req = new IssueWarningRequest(activeSessionUser1.getId(), "steam", "/usr/bin/steam");
        SentinelWarningResponse response = warningService.issueWarning(user1.getId(), req);

        assertNotNull(response);
        assertEquals("steam", response.processName());
        assertEquals(activeSessionUser1.getId(), response.sessionId());
        assertEquals("ISSUED", response.status());
    }

    @Test
    @DisplayName("2. Warning gets valid UUID")
    void testIssueWarning_GeneratesUUID() {
        IssueWarningRequest req = new IssueWarningRequest(activeSessionUser1.getId(), "discord", null);
        SentinelWarningResponse response = warningService.issueWarning(user1.getId(), req);

        assertNotNull(response.warningId());
        assertTrue(response.warningId().toString().length() >= 36);
    }

    @Test
    @DisplayName("3. Warning deadline is approximately 60 seconds from server time")
    void testIssueWarning_DeadlineSixtySeconds() {
        Instant before = Instant.now();
        IssueWarningRequest req = new IssueWarningRequest(activeSessionUser1.getId(), "slack", null);
        SentinelWarningResponse response = warningService.issueWarning(user1.getId(), req);

        assertNotNull(response.decisionDeadline());
        long diffSeconds = Duration.between(before, response.decisionDeadline()).toSeconds();
        assertTrue(diffSeconds >= 59 && diffSeconds <= 62, "Deadline should be ~60s in future: " + diffSeconds);
    }

    @Test
    @DisplayName("4. Duplicate active warning is prevented and returns existing")
    void testIssueWarning_DuplicatePrevented() {
        IssueWarningRequest req = new IssueWarningRequest(activeSessionUser1.getId(), "steam", null);
        SentinelWarningResponse w1 = warningService.issueWarning(user1.getId(), req);
        SentinelWarningResponse w2 = warningService.issueWarning(user1.getId(), req);

        assertEquals(w1.warningId(), w2.warningId());
        assertEquals("ISSUED", w2.status());
    }

    @Test
    @DisplayName("5. Cross-user warning access rejected")
    void testRespondToWarning_CrossUserAccessRejected() {
        IssueWarningRequest req = new IssueWarningRequest(activeSessionUser1.getId(), "steam", null);
        SentinelWarningResponse w1 = warningService.issueWarning(user1.getId(), req);

        RespondWarningRequest respondReq = new RespondWarningRequest("GRANT_GRACE", 5);
        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                warningService.respondToWarning(user2.getId(), w1.warningId(), respondReq)
        );
        assertEquals(404, ex.getStatusCode().value());
    }

    @Test
    @DisplayName("6. Unknown warning rejected")
    void testRespondToWarning_UnknownWarningRejected() {
        RespondWarningRequest respondReq = new RespondWarningRequest("GRANT_GRACE", 5);
        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                warningService.respondToWarning(user1.getId(), UUID.randomUUID(), respondReq)
        );
        assertEquals(404, ex.getStatusCode().value());
    }

    @Test
    @DisplayName("7. Expired warning cannot receive grace")
    void testRespondToWarning_ExpiredWarningRejected() {
        IssueWarningRequest req = new IssueWarningRequest(activeSessionUser1.getId(), "steam", null);
        SentinelWarningResponse w1 = warningService.issueWarning(user1.getId(), req);

        // Manually adjust deadline into past
        SentinelEnforcementWarning entity = warningRepository.findByWarningId(w1.warningId()).orElseThrow();
        entity.setDecisionDeadline(Instant.now().minusSeconds(10));
        warningRepository.saveAndFlush(entity);

        RespondWarningRequest respondReq = new RespondWarningRequest("GRANT_GRACE", 5);
        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                warningService.respondToWarning(user1.getId(), w1.warningId(), respondReq)
        );
        assertTrue(ex.getStatusCode().value() == 410 || ex.getStatusCode().value() == 409);
    }

    @Test
    @DisplayName("8. GRANT_GRACE with 1 minute succeeds")
    void testRespondToWarning_OneMinuteSucceeds() {
        IssueWarningRequest req = new IssueWarningRequest(activeSessionUser1.getId(), "telegram", null);
        SentinelWarningResponse w1 = warningService.issueWarning(user1.getId(), req);

        RespondWarningRequest respondReq = new RespondWarningRequest("GRANT_GRACE", 1);
        SentinelWarningResponse resp = warningService.respondToWarning(user1.getId(), w1.warningId(), respondReq);

        assertEquals("GRACE_ACTIVE", resp.status());
        assertNotNull(resp.graceExpiresAt());
        assertTrue(resp.graceExpiresAt().isAfter(Instant.now()));
    }

    @Test
    @DisplayName("9. GRANT_GRACE with 20 minutes succeeds")
    void testRespondToWarning_TwentyMinutesSucceeds() {
        IssueWarningRequest req = new IssueWarningRequest(activeSessionUser1.getId(), "viber", null);
        SentinelWarningResponse w1 = warningService.issueWarning(user1.getId(), req);

        RespondWarningRequest respondReq = new RespondWarningRequest("GRANT_GRACE", 20);
        SentinelWarningResponse resp = warningService.respondToWarning(user1.getId(), w1.warningId(), respondReq);

        assertEquals("GRACE_ACTIVE", resp.status());
        assertNotNull(resp.graceExpiresAt());
        assertTrue(resp.graceExpiresAt().isAfter(Instant.now().plus(Duration.ofMinutes(18))));
    }

    @Test
    @DisplayName("10. GRANT_GRACE above 20 minutes rejected")
    void testRespondToWarning_AboveTwentyMinutesRejected() {
        IssueWarningRequest req = new IssueWarningRequest(activeSessionUser1.getId(), "reddit_app", null);
        SentinelWarningResponse w1 = warningService.issueWarning(user1.getId(), req);

        RespondWarningRequest respondReq = new RespondWarningRequest("GRANT_GRACE", 21);
        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                warningService.respondToWarning(user1.getId(), w1.warningId(), respondReq)
        );
        assertEquals(400, ex.getStatusCode().value());
    }

    @Test
    @DisplayName("11. GRANT_GRACE below 1 minute rejected")
    void testRespondToWarning_BelowOneMinuteRejected() {
        IssueWarningRequest req = new IssueWarningRequest(activeSessionUser1.getId(), "tiktok", null);
        SentinelWarningResponse w1 = warningService.issueWarning(user1.getId(), req);

        RespondWarningRequest respondReq = new RespondWarningRequest("GRANT_GRACE", 0);
        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                warningService.respondToWarning(user1.getId(), w1.warningId(), respondReq)
        );
        assertEquals(400, ex.getStatusCode().value());
    }

    @Test
    @DisplayName("12 & 13. Server calculates expiresAt (client cannot manipulate)")
    void testRespondToWarning_ServerCalculatesExpiresAt() {
        IssueWarningRequest req = new IssueWarningRequest(activeSessionUser1.getId(), "calculator", null);
        SentinelWarningResponse w1 = warningService.issueWarning(user1.getId(), req);

        Instant before = Instant.now();
        RespondWarningRequest respondReq = new RespondWarningRequest("GRANT_GRACE", 10);
        SentinelWarningResponse resp = warningService.respondToWarning(user1.getId(), w1.warningId(), respondReq);

        assertNotNull(resp.graceExpiresAt());
        long diff = Duration.between(before.plus(Duration.ofMinutes(10)), resp.graceExpiresAt()).abs().toSeconds();
        assertTrue(diff <= 2, "Grace expiration must match server time calculation within 2 seconds");
    }

    @Test
    @DisplayName("14. Grace cannot be extended")
    void testRespondToWarning_GraceCannotBeExtended() {
        IssueWarningRequest req = new IssueWarningRequest(activeSessionUser1.getId(), "game", null);
        SentinelWarningResponse w1 = warningService.issueWarning(user1.getId(), req);

        RespondWarningRequest respondReq = new RespondWarningRequest("GRANT_GRACE", 5);
        warningService.respondToWarning(user1.getId(), w1.warningId(), respondReq);

        // Try to respond again to the same warning
        RespondWarningRequest extendReq = new RespondWarningRequest("GRANT_GRACE", 15);
        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                warningService.respondToWarning(user1.getId(), w1.warningId(), extendReq)
        );
        assertEquals(409, ex.getStatusCode().value());
    }

    @Test
    @DisplayName("15. Second grace for same session and process rejected")
    void testRespondToWarning_SecondGraceRejected() {
        IssueWarningRequest req1 = new IssueWarningRequest(activeSessionUser1.getId(), "steam", null);
        SentinelWarningResponse w1 = warningService.issueWarning(user1.getId(), req1);

        RespondWarningRequest respondReq1 = new RespondWarningRequest("GRANT_GRACE", 5);
        warningService.respondToWarning(user1.getId(), w1.warningId(), respondReq1);

        // Manually mark first grace expired
        SentinelGraceWindow grace = graceWindowRepository.findByWarningId(w1.warningId()).orElseThrow();
        grace.setStatus(SentinelGraceStatus.EXPIRED);
        graceWindowRepository.saveAndFlush(grace);

        SentinelEnforcementWarning warning = warningRepository.findByWarningId(w1.warningId()).orElseThrow();
        warning.setStatus(SentinelWarningStatus.EXPIRED);
        warningRepository.saveAndFlush(warning);

        // Try to issue another warning for same process in same session
        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                warningService.issueWarning(user1.getId(), req1)
        );
        assertEquals(409, ex.getStatusCode().value());
    }

    @Test
    @DisplayName("16. TERMINATE_NOW transitions warning appropriately")
    void testRespondToWarning_TerminateNow() {
        IssueWarningRequest req = new IssueWarningRequest(activeSessionUser1.getId(), "steam", null);
        SentinelWarningResponse w1 = warningService.issueWarning(user1.getId(), req);

        RespondWarningRequest respondReq = new RespondWarningRequest("TERMINATE_NOW", null);
        SentinelWarningResponse resp = warningService.respondToWarning(user1.getId(), w1.warningId(), respondReq);

        assertEquals("TERMINATE_NOW", resp.status());
        assertNull(resp.graceExpiresAt());
    }

    @Test
    @DisplayName("17. Paused session cannot receive active grace")
    void testRespondToWarning_PausedSessionRejected() {
        // Warning created when session was active
        IssueWarningRequest req = new IssueWarningRequest(activeSessionUser1.getId(), "steam", null);
        SentinelWarningResponse w1 = warningService.issueWarning(user1.getId(), req);

        // Pause session
        activeSessionUser1.setStatus(FocusSessionStatus.PAUSED);
        sessionRepository.saveAndFlush(activeSessionUser1);

        RespondWarningRequest respondReq = new RespondWarningRequest("GRANT_GRACE", 5);
        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                warningService.respondToWarning(user1.getId(), w1.warningId(), respondReq)
        );
        assertEquals(409, ex.getStatusCode().value());
    }

    @Test
    @DisplayName("18. Completed session cannot receive active grace")
    void testRespondToWarning_CompletedSessionRejected() {
        IssueWarningRequest req = new IssueWarningRequest(activeSessionUser1.getId(), "steam", null);
        SentinelWarningResponse w1 = warningService.issueWarning(user1.getId(), req);

        activeSessionUser1.setStatus(FocusSessionStatus.COMPLETED);
        sessionRepository.saveAndFlush(activeSessionUser1);

        RespondWarningRequest respondReq = new RespondWarningRequest("GRANT_GRACE", 5);
        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                warningService.respondToWarning(user1.getId(), w1.warningId(), respondReq)
        );
        assertEquals(409, ex.getStatusCode().value());
    }

    @Test
    @DisplayName("19. Cancelled session cannot receive active grace")
    void testRespondToWarning_CancelledSessionRejected() {
        IssueWarningRequest req = new IssueWarningRequest(activeSessionUser1.getId(), "steam", null);
        SentinelWarningResponse w1 = warningService.issueWarning(user1.getId(), req);

        activeSessionUser1.setStatus(FocusSessionStatus.CANCELLED);
        sessionRepository.saveAndFlush(activeSessionUser1);

        RespondWarningRequest respondReq = new RespondWarningRequest("GRANT_GRACE", 5);
        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                warningService.respondToWarning(user1.getId(), w1.warningId(), respondReq)
        );
        assertEquals(409, ex.getStatusCode().value());
    }

    @Test
    @DisplayName("20. Grace expiry transitions correctly")
    void testExpireStaleItems_TransitionsGraceWindow() {
        IssueWarningRequest req = new IssueWarningRequest(activeSessionUser1.getId(), "steam", null);
        SentinelWarningResponse w1 = warningService.issueWarning(user1.getId(), req);

        RespondWarningRequest respondReq = new RespondWarningRequest("GRANT_GRACE", 5);
        warningService.respondToWarning(user1.getId(), w1.warningId(), respondReq);

        SentinelGraceWindow grace = graceWindowRepository.findByWarningId(w1.warningId()).orElseThrow();
        assertEquals(SentinelGraceStatus.ACTIVE, grace.getStatus());

        // Fast-forward grace expiration
        grace.setExpiresAt(Instant.now().minusSeconds(5));
        graceWindowRepository.saveAndFlush(grace);

        warningService.expireStaleItems();

        SentinelGraceWindow updatedGrace = graceWindowRepository.findByWarningId(w1.warningId()).orElseThrow();
        assertEquals(SentinelGraceStatus.EXPIRED, updatedGrace.getStatus());
    }

    @Test
    @DisplayName("21. Historical completed warnings do not prevent legitimate future warnings across different sessions")
    void testHistoricalWarnings_DoNotBlockDifferentSession() {
        // Warning in session 1
        IssueWarningRequest req1 = new IssueWarningRequest(activeSessionUser1.getId(), "discord", null);
        SentinelWarningResponse w1 = warningService.issueWarning(user1.getId(), req1);

        RespondWarningRequest respondReq1 = new RespondWarningRequest("TERMINATE_NOW", null);
        warningService.respondToWarning(user1.getId(), w1.warningId(), respondReq1);

        // Warning for user2 in activeSessionUser2 for same process "discord"
        IssueWarningRequest req2 = new IssueWarningRequest(activeSessionUser2.getId(), "discord", null);
        SentinelWarningResponse w2 = warningService.issueWarning(user2.getId(), req2);

        assertNotNull(w2);
        assertNotEquals(w1.warningId(), w2.warningId());
        assertEquals("ISSUED", w2.status());
    }

    @Test
    @DisplayName("22. Active grace window lookup returns valid window")
    void testGetActiveGraceWindow_Lookup() {
        IssueWarningRequest req = new IssueWarningRequest(activeSessionUser1.getId(), "steam", null);
        SentinelWarningResponse w1 = warningService.issueWarning(user1.getId(), req);

        RespondWarningRequest respondReq = new RespondWarningRequest("GRANT_GRACE", 10);
        warningService.respondToWarning(user1.getId(), w1.warningId(), respondReq);

        assertTrue(warningService.getActiveGraceWindow(activeSessionUser1.getId(), "steam").isPresent());
        assertFalse(warningService.getActiveGraceWindow(activeSessionUser1.getId(), "nonexistent").isPresent());
        assertFalse(warningService.getActiveGraceWindow(activeSessionUser2.getId(), "steam").isPresent());
    }

    @Test
    @DisplayName("23. Daemon sync contains active warning")
    void testDaemonSync_ContainsActiveWarning() {
        IssueWarningRequest req = new IssueWarningRequest(activeSessionUser1.getId(), "steam", null);
        SentinelWarningResponse w = warningService.issueWarning(user1.getId(), req);

        SentinelDaemonSyncResponse sync = sentinelService.getDaemonSyncState(user1.getId());
        assertNotNull(sync.activeWarnings());
        assertEquals(1, sync.activeWarnings().size());
        assertEquals("steam", sync.activeWarnings().get(0).processName());
        assertEquals(w.warningId(), sync.activeWarnings().get(0).warningId());
        assertEquals("ISSUED", sync.activeWarnings().get(0).status());
    }

    @Test
    @DisplayName("24. Daemon sync contains active grace")
    void testDaemonSync_ContainsActiveGrace() {
        IssueWarningRequest req = new IssueWarningRequest(activeSessionUser1.getId(), "discord", null);
        SentinelWarningResponse w = warningService.issueWarning(user1.getId(), req);

        RespondWarningRequest respondReq = new RespondWarningRequest("GRANT_GRACE", 10);
        warningService.respondToWarning(user1.getId(), w.warningId(), respondReq);

        SentinelDaemonSyncResponse sync = sentinelService.getDaemonSyncState(user1.getId());
        assertNotNull(sync.activeGraceWindows());
        assertEquals(1, sync.activeGraceWindows().size());
        assertEquals("discord", sync.activeGraceWindows().get(0).processName());
        assertEquals(w.warningId(), sync.activeGraceWindows().get(0).warningId());
        assertTrue(sync.activeGraceWindows().get(0).expiresAt().isAfter(Instant.now()));
    }

    @Test
    @DisplayName("25. Daemon sync excludes expired warning")
    void testDaemonSync_ExpiredWarningExcluded() {
        Instant past = Instant.now().minus(Duration.ofMinutes(5));
        SentinelEnforcementWarning staleWarning = new SentinelEnforcementWarning(
                user1,
                activeSessionUser1,
                "stale_app",
                null,
                past.minus(Duration.ofMinutes(1)),
                past
        );
        warningRepository.save(staleWarning);

        SentinelDaemonSyncResponse sync = sentinelService.getDaemonSyncState(user1.getId());
        assertTrue(sync.activeWarnings().stream().noneMatch(w -> "stale_app".equals(w.processName())));
    }

    @Test
    @DisplayName("26. Daemon sync excludes expired grace window")
    void testDaemonSync_ExpiredGraceExcluded() {
        Instant past = Instant.now().minus(Duration.ofMinutes(5));
        SentinelEnforcementWarning warning = new SentinelEnforcementWarning(
                user1,
                activeSessionUser1,
                "stale_grace_app",
                null,
                past.minus(Duration.ofMinutes(15)),
                past.minus(Duration.ofMinutes(14))
        );
        SentinelEnforcementWarning savedWarning = warningRepository.save(warning);

        SentinelGraceWindow staleGrace = new SentinelGraceWindow(
                savedWarning.getWarningId(),
                activeSessionUser1,
                user1,
                "stale_grace_app",
                past.minus(Duration.ofMinutes(10)),
                past,
                10
        );
        graceWindowRepository.save(staleGrace);

        SentinelDaemonSyncResponse sync = sentinelService.getDaemonSyncState(user1.getId());
        assertTrue(sync.activeGraceWindows().stream().noneMatch(g -> "stale_grace_app".equals(g.processName())));
    }

    @Test
    @DisplayName("27. Candidate evaluation: no active session produces no destructive authorization (ALLOW)")
    void testCandidate_NoActiveSessionProducesNoDestructiveAuthorization() {
        User inactiveUser = userRepository.save(new User("inactive_" + System.currentTimeMillis(), "inactive@example.com", "hash", Instant.now()));
        CandidateProcessRequest req = new CandidateProcessRequest("discord", null, 1234L);
        CandidateProcessResponse resp = warningService.evaluateCandidate(inactiveUser.getId(), req);

        assertEquals("ALLOW", resp.decision());
        assertEquals("No active focus session", resp.reason());
        assertNull(resp.warningId());
    }

    @Test
    @DisplayName("28. Candidate evaluation: authenticated user cannot target another user's session")
    void testCandidate_AuthenticatedUserCannotTargetAnotherUsersSession() {
        // user1 has activeSessionUser1 with granted grace on discord
        IssueWarningRequest req1 = new IssueWarningRequest(activeSessionUser1.getId(), "discord", null);
        SentinelWarningResponse w1 = warningService.issueWarning(user1.getId(), req1);
        warningService.respondToWarning(user1.getId(), w1.warningId(), new RespondWarningRequest("GRANT_GRACE", 10));

        // user2 evaluates candidate discord - must resolve strictly to user2's session
        CandidateProcessRequest req2 = new CandidateProcessRequest("discord", null, 5678L);
        CandidateProcessResponse respUser2 = warningService.evaluateCandidate(user2.getId(), req2);

        // user2 does NOT have grace for discord; candidate issues a new warning for user2
        assertEquals("DEFER_WARNING", respUser2.decision());
        assertNotNull(respUser2.warningId());
        assertNotEquals(w1.warningId(), respUser2.warningId());

        // Now user1 evaluates candidate discord - returns DEFER_GRACE
        CandidateProcessResponse respUser1 = warningService.evaluateCandidate(user1.getId(), req2);
        assertEquals("DEFER_GRACE", respUser1.decision());
        assertEquals(w1.warningId(), respUser1.warningId());
    }

    @Test
    @DisplayName("29. Candidate evaluation: existing session exception overrides blocked policy (ALLOW)")
    void testCandidate_ExistingSessionExceptionOverridesBlockedPolicy() {
        // Create active exception for "discord" in activeSessionUser1
        exceptionService.createException(user1.getId(), activeSessionUser1.getId(), new CreateFocusSessionExceptionRequest(
                "discord",
                FocusSessionActivityType.PROCESS
        ));

        CandidateProcessRequest req = new CandidateProcessRequest("discord", null, 1234L);
        CandidateProcessResponse resp = warningService.evaluateCandidate(user1.getId(), req);

        assertEquals("ALLOW", resp.decision());
        assertEquals("Process permitted by contextual policy", resp.reason());
    }

    @Test
    @DisplayName("30. Candidate evaluation: absent warning triggers warning creation and defers")
    void testCandidate_AbsentWarningTriggersWarningCreationAndDefers() {
        CandidateProcessRequest req = new CandidateProcessRequest("obs", "obs --portable", 9999L);
        CandidateProcessResponse resp = warningService.evaluateCandidate(user1.getId(), req);

        assertEquals("DEFER_WARNING", resp.decision());
        assertNotNull(resp.warningId());
        assertNotNull(resp.decisionDeadline());

        // Repeated call while warning is active returns DEFER_WARNING for the same warning
        CandidateProcessResponse repeat = warningService.evaluateCandidate(user1.getId(), req);
        assertEquals("DEFER_WARNING", repeat.decision());
        assertEquals(resp.warningId(), repeat.warningId());
    }

    @Test
    @DisplayName("31. Candidate evaluation: expired warning authorizes termination (ENFORCE_TERMINATE)")
    void testCandidate_ExpiredWarningAuthorizesTermination() {
        CandidateProcessRequest req = new CandidateProcessRequest("steam", null, 8888L);
        CandidateProcessResponse initial = warningService.evaluateCandidate(user1.getId(), req);
        assertEquals("DEFER_WARNING", initial.decision());

        // Force warning to expire
        SentinelEnforcementWarning warning = warningRepository.findByWarningId(initial.warningId()).orElseThrow();
        warning.setStatus(SentinelWarningStatus.EXPIRED);
        warningRepository.save(warning);

        CandidateProcessResponse afterExpiry = warningService.evaluateCandidate(user1.getId(), req);
        assertEquals("ENFORCE_TERMINATE", afterExpiry.decision());
    }
}
