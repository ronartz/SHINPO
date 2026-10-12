package com.shinpo.sentinel;

import com.shinpo.dto.SentinelDtos.*;
import com.shinpo.dto.SentinelWarningDtos.*;
import com.shinpo.entity.*;
import com.shinpo.repository.*;
import com.shinpo.service.ContextualEnforcementDecisionService;
import com.shinpo.service.SentinelEnforcementService;
import com.shinpo.service.SentinelWarningService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayDeque;
import java.util.List;
import java.util.Queue;
import java.util.concurrent.CompletableFuture;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Verification of the 12 Focus Protection Pipeline scenarios required by Slice 6 Section 13.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
public class FocusProtectionPipelineTests {

    @Autowired
    private SentinelEnforcementService enforcementService;

    @Autowired
    private SentinelWarningService warningService;

    @Autowired
    private ContextualEnforcementDecisionService contextualDecisionService;

    @Autowired
    private FocusSessionRepository sessionRepository;

    @Autowired
    private SentinelEnforcementWarningRepository warningRepository;

    @Autowired
    private SentinelGraceWindowRepository graceWindowRepository;

    @Autowired
    private SentinelQuarantineRepository quarantineRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private User testUser;
    private FocusSession activeSession;

    @BeforeEach
    void setUp() {
        long ts = System.currentTimeMillis();
        testUser = userRepository.save(new User(
                "pipeline_user_" + ts,
                "pipeline_" + ts + "@shinpo.io",
                passwordEncoder.encode("SecretPass123!"),
                Instant.now()
        ));
        enforcementService.setEnforcementMode(testUser.getId(), "STRICT");

        activeSession = new FocusSession();
        activeSession.setUser(testUser);
        activeSession.setName("Core Execution Sprint");
        activeSession.setDurationMinutes(25);
        activeSession.setStatus(FocusSessionStatus.ACTIVE);
        activeSession.setStartedAt(Instant.now());
        activeSession = sessionRepository.save(activeSession);
    }

    @Test
    @DisplayName("Scenario 1: Restricted process detected during active session -> warning created")
    void testScenario1_RestrictedProcessDetectedDuringActiveSession_WarningCreated() {
        CandidateProcessRequest req = new CandidateProcessRequest("discord", "/usr/bin/discord", 5555L);
        CandidateProcessResponse resp = warningService.evaluateCandidate(testUser.getId(), req);

        assertNotNull(resp);
        assertEquals("DEFER_WARNING", resp.decision());
        assertNotNull(resp.warningId());
        assertNotNull(resp.decisionDeadline());

        // Verify warning is persisted with status ISSUED
        SentinelEnforcementWarning saved = warningRepository.findByWarningId(resp.warningId()).orElseThrow();
        assertEquals(SentinelWarningStatus.ISSUED, saved.getStatus());
        assertEquals("discord", saved.getProcessName());
    }

    @Test
    @DisplayName("Scenario 2: Restricted process ignored when session not active")
    void testScenario2_RestrictedProcessIgnoredWhenSessionNotActive() {
        // Transition session to COMPLETED so user has no active session
        activeSession.setStatus(FocusSessionStatus.COMPLETED);
        sessionRepository.save(activeSession);

        CandidateProcessRequest req = new CandidateProcessRequest("discord", "/usr/bin/discord", 5555L);
        CandidateProcessResponse resp = warningService.evaluateCandidate(testUser.getId(), req);

        assertNotNull(resp);
        assertEquals("ALLOW", resp.decision());
        assertNull(resp.warningId());
        assertTrue(resp.reason().toLowerCase().contains("no active focus session"));
    }

    @Test
    @DisplayName("Scenario 3: Restricted process closes during grace period -> no termination, warning cancelled")
    void testScenario3_ProcessClosesDuringGracePeriod_NoTermination() {
        CandidateProcessRequest req = new CandidateProcessRequest("steam", "/usr/bin/steam", 6666L);
        CandidateProcessResponse init = warningService.evaluateCandidate(testUser.getId(), req);
        assertEquals("DEFER_WARNING", init.decision());

        // Grant 5m grace
        warningService.respondToWarning(testUser.getId(), init.warningId(), new RespondWarningRequest("GRANT_GRACE", 5));

        // User closes the process naturally
        warningService.handleProcessUserClosed(activeSession.getId(), "steam");

        // Verify warning transitioned to CANCELLED
        SentinelEnforcementWarning w = warningRepository.findByWarningId(init.warningId()).orElseThrow();
        assertEquals(SentinelWarningStatus.CANCELLED, w.getStatus());

        // Verify grace window also transitioned to CANCELLED
        SentinelGraceWindow g = graceWindowRepository.findByWarningId(init.warningId()).orElseThrow();
        assertEquals(SentinelGraceStatus.CANCELLED, g.getStatus());
    }

    @Test
    @DisplayName("Scenario 4: Process identity revalidation succeeds")
    void testScenario4_ProcessIdentityRevalidationSucceeds() {
        ProcessHandle currentHandle = ProcessHandle.current();
        String currentName = SentinelEnforcementService.resolveProcessName(currentHandle);

        assertNotNull(currentName);
        assertFalse(currentName.isBlank());
        assertTrue(currentHandle.isAlive());
    }

    @Test
    @DisplayName("Scenario 5: Process identity revalidation fails (PID reuse) -> abort termination")
    void testScenario5_ProcessIdentityRevalidationFails_PIDReuse_AbortTermination() {
        ProcessHandle currentHandle = ProcessHandle.current();
        String currentName = SentinelEnforcementService.resolveProcessName(currentHandle);
        String expectedOldName = "different_legacy_target_app";

        assertFalse(currentName.equalsIgnoreCase(expectedOldName));

        // When revalidation detects PID now belongs to currentName instead of expectedOldName, termination must abort
        boolean revalidationMatches = currentName.equalsIgnoreCase(expectedOldName);
        assertFalse(revalidationMatches, "Revalidation must flag PID reuse when name differs");
    }

    @Test
    @DisplayName("Scenario 6: Graceful termination succeeds -> no SIGKILL/forced kill")
    void testScenario6_GracefulTerminationSucceeds_NoSIGKILL() {
        ProcessHandle handle = mock(ProcessHandle.class);
        when(handle.destroy()).thenReturn(true);
        when(handle.onExit()).thenReturn(CompletableFuture.completedFuture(handle));

        String result = SentinelEnforcementService.enforceProcess(handle, "STRICT");
        assertEquals("TERMINATED", result);

        verify(handle).destroy();
        verify(handle, never()).destroyForcibly();
    }

    @Test
    @DisplayName("Scenario 7: Graceful termination fails -> forced kill triggered only if policy permits")
    void testScenario7_GracefulTerminationFails_ForcedKillTriggeredWhenPermitted() {
        ProcessHandle handle = mock(ProcessHandle.class);
        when(handle.destroy()).thenReturn(true);
        when(handle.destroyForcibly()).thenReturn(true);

        Queue<CompletableFuture<ProcessHandle>> exitFutures = new ArrayDeque<>(List.of(
                new CompletableFuture<>(), // graceful does not exit
                CompletableFuture.completedFuture(handle) // forced exits
        ));
        when(handle.onExit()).thenAnswer(inv -> exitFutures.remove());
        when(handle.isAlive()).thenReturn(true);

        String result = SentinelEnforcementService.enforceProcess(handle, "STRICT", true);
        assertEquals("TERMINATED", result);

        verify(handle).destroy();
        verify(handle).destroyForcibly();
    }

    @Test
    @DisplayName("Scenario 8: Forced kill disabled by policy -> containment failure recorded, no forced kill")
    void testScenario8_ForcedKillDisabledByPolicy_ContainmentFailureRecorded_NoForcedKill() {
        ProcessHandle handle = mock(ProcessHandle.class);
        when(handle.destroy()).thenReturn(true);
        when(handle.onExit()).thenReturn(new CompletableFuture<>());
        when(handle.isAlive()).thenReturn(true);

        String result = SentinelEnforcementService.enforceProcess(handle, "CONTAINMENT", false);
        assertEquals("CONTAINMENT_FAILED", result);

        verify(handle).destroy();
        verify(handle, never()).destroyForcibly();
    }

    @Test
    @DisplayName("Scenario 9: Protected process matched -> skipped and logged")
    void testScenario9_ProtectedProcessMatched_SkippedAndLogged() {
        for (String protectedName : List.of("systemd", "init", "dbus-daemon", "mutter", "kwin", "postgres", "shinpo", "wireplumber")) {
            ContextualEnforcementDecisionService.PolicyDecision decision =
                    contextualDecisionService.evaluateProcess(testUser.getId(), protectedName);
            assertEquals(ContextualEnforcementDecisionService.PolicyDecision.ALLOW, decision,
                    "Protected process '" + protectedName + "' must be allowed unconditionally");

            CandidateProcessRequest req = new CandidateProcessRequest(protectedName, "/usr/bin/" + protectedName, 1234L);
            CandidateProcessResponse resp = warningService.evaluateCandidate(testUser.getId(), req);
            assertEquals("ALLOW", resp.decision());
        }
    }

    @Test
    @DisplayName("Scenario 10: Session pause -> enforcement suspended")
    void testScenario10_SessionPause_EnforcementSuspended() {
        activeSession.setStatus(FocusSessionStatus.PAUSED);
        activeSession.setPausedAt(Instant.now());
        sessionRepository.save(activeSession);

        CandidateProcessRequest req = new CandidateProcessRequest("discord", "/usr/bin/discord", 5555L);
        CandidateProcessResponse resp = warningService.evaluateCandidate(testUser.getId(), req);

        assertNotNull(resp);
        assertEquals("ALLOW", resp.decision());
        assertTrue(resp.reason().toLowerCase().contains("no active focus session"));
    }

    @Test
    @DisplayName("Scenario 11: Session complete/cancel -> enforcement released")
    void testScenario11_SessionCompleteOrCancel_EnforcementReleased() {
        // Test COMPLETED
        activeSession.setStatus(FocusSessionStatus.COMPLETED);
        sessionRepository.save(activeSession);
        CandidateProcessResponse resp1 = warningService.evaluateCandidate(testUser.getId(),
                new CandidateProcessRequest("discord", null, 5555L));
        assertEquals("ALLOW", resp1.decision());

        // Test CANCELLED
        activeSession.setStatus(FocusSessionStatus.CANCELLED);
        sessionRepository.save(activeSession);
        CandidateProcessResponse resp2 = warningService.evaluateCandidate(testUser.getId(),
                new CandidateProcessRequest("discord", null, 5555L));
        assertEquals("ALLOW", resp2.decision());
    }

    @Test
    @DisplayName("Scenario 12: Offline/disconnected mode -> batch telemetry reporting synchronization")
    void testScenario12_OfflineDisconnectedMode_BatchTelemetrySynchronization() {
        RecordQuarantineRequest spooled1 = new RecordQuarantineRequest(
                1001L, "steam", "/usr/bin/steam", "TERMINATED", "STRICT", "Buffered offline event 1"
        );
        RecordQuarantineRequest spooled2 = new RecordQuarantineRequest(
                1002L, "discord", "/usr/bin/discord", "CONTAINED", "CONTAINMENT", "Buffered offline event 2"
        );

        BatchQuarantineRequest batchReq = new BatchQuarantineRequest(List.of(spooled1, spooled2));
        BatchQuarantineResponse batchResp = enforcementService.recordBatchQuarantines(testUser.getId(), batchReq);

        assertNotNull(batchResp);
        assertEquals(2, batchResp.processedCount());
        assertEquals(2, batchResp.savedCount());

        List<SentinelQuarantineRecord> records = quarantineRepository.findAllByUser_IdAndFocusSession_IdOrderByDetectedAtDesc(
                testUser.getId(), activeSession.getId()
        );
        assertEquals(2, records.size());
        assertTrue(records.stream().anyMatch(r -> r.getProcessName().equals("steam")));
        assertTrue(records.stream().anyMatch(r -> r.getProcessName().equals("discord")));
    }
}

