package com.shinpo.sentinel;

import com.shinpo.dto.SentinelDtos.*;
import com.shinpo.dto.TaskManagerDtos.DeviceSystemInfo;
import com.shinpo.dto.TaskManagerDtos.ProcessControlResult;
import com.shinpo.dto.TaskManagerDtos.ProcessInfo;
import com.shinpo.dto.TaskManagerDtos.ProcessSnapshot;
import com.shinpo.entity.*;
import com.shinpo.repository.*;
import com.shinpo.security.JwtTokenService;
import com.shinpo.security.UserPrincipal;
import com.shinpo.service.SentinelEnforcementService;
import com.shinpo.service.TaskManagerService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.PlatformTransactionManager;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/**
 * P0 Process Safety & Security Boundary Verification Test Suite
 *
 * Enforces:
 * 1. Unauthenticated process termination attempts return 401 Unauthorized.
 * 2. Authenticated process termination attempts are rejected with 403 Forbidden.
 * 3. Server host processes (PID 1, server JVM PID, arbitrary PIDs) are never touched or killed.
 * 4. Default configuration fails closed (server-side scanning is disabled by default).
 * 5. Device telemetry endpoints (/processes, /system-info, /snapshot) never dump host processes.
 * 6. Starting/running Focus Sessions never scan or terminate server host processes.
 * 7. Scheduled background daemon sweeps skip host scanning and never terminate host processes.
 * 8. Triggered sweeps safely delegate to desktop Native Shield.
 * 9. Native Shield desktop sync and quarantine reporting endpoints remain 100% operational.
 * 10. Existing core business features (Goals, Missions, Tasks, Focus Sessions) remain 100% functional.
 */
@ActiveProfiles("test")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
public class ProcessSafetySecurityBoundaryTests {

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private GoalRepository goalRepository;

    @Autowired
    private MissionRepository missionRepository;

    @Autowired
    private FocusSessionRepository focusSessionRepository;

    @Autowired
    private SentinelQuarantineRepository quarantineRepository;

    @Autowired
    private SentinelPolicyRuleRepository policyRuleRepository;

    @Autowired
    private SentinelTamperEventRepository tamperEventRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtTokenService jwtTokenService;

    @Autowired
    private TaskManagerService taskManagerService;

    @Autowired
    private SentinelEnforcementService sentinelEnforcementService;

    @Autowired
    private PlatformTransactionManager transactionManager;

    private User primaryUser;
    private String primaryToken;
    private User secondaryUser;

    @BeforeEach
    void setUp() {
        String suffixA = UUID.randomUUID().toString().substring(0, 8);
        primaryUser = userRepository.save(new User(
                "p0_user_a_" + suffixA,
                "p0_user_a_" + suffixA + "@shinpo.test",
                passwordEncoder.encode("SecurePass123!"),
                Instant.now()
        ));
        primaryToken = jwtTokenService.generateAccessToken(UserPrincipal.create(primaryUser));

        String suffixB = UUID.randomUUID().toString().substring(0, 8);
        secondaryUser = userRepository.save(new User(
                "p0_user_b_" + suffixB,
                "p0_user_b_" + suffixB + "@shinpo.test",
                passwordEncoder.encode("SecurePass123!"),
                Instant.now()
        ));
    }

    private HttpHeaders authHeaders(String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        headers.setContentType(MediaType.APPLICATION_JSON);
        return headers;
    }

    // =========================================================================
    // 1. Process Termination Safety & HTTP Security Boundaries
    // =========================================================================

    @Test
    @DisplayName("P0-1: Unauthenticated process termination attempt returns 401 Unauthorized")
    void testUnauthenticatedProcessTerminationReturns401() {
        ResponseEntity<String> response = restTemplate.postForEntity(
                "/api/device/processes/1/terminate",
                null,
                String.class
        );

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
    }

    @Test
    @DisplayName("P0-2: Authenticated process termination returns 403 Forbidden with clear disabled status")
    void testAuthenticatedProcessTerminationRejectedWith403() {
        long arbitraryPid = 48291L;
        HttpEntity<Void> entity = new HttpEntity<>(authHeaders(primaryToken));

        ResponseEntity<ProcessControlResult> response = restTemplate.exchange(
                "/api/device/processes/" + arbitraryPid + "/terminate?force=false",
                HttpMethod.POST,
                entity,
                ProcessControlResult.class
        );

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        ProcessControlResult body = response.getBody();
        assertNotNull(body);
        assertEquals(arbitraryPid, body.pid());
        assertEquals("TERMINATE", body.action());
        assertEquals("REJECTED", body.status());
        assertTrue(body.message().contains("Server-side process termination is disabled in cloud deployment"),
                "Message must explain that server-side termination is disabled");
    }

    @Test
    @DisplayName("P0-3: Remote attempt to terminate PID 1 (init/systemd) is rejected with 403 Forbidden")
    void testPid1RemoteTerminationRefused() {
        HttpEntity<Void> entity = new HttpEntity<>(authHeaders(primaryToken));

        ResponseEntity<ProcessControlResult> response = restTemplate.exchange(
                "/api/device/processes/1/terminate?force=true",
                HttpMethod.POST,
                entity,
                ProcessControlResult.class
        );

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        ProcessControlResult body = response.getBody();
        assertNotNull(body);
        assertEquals(1L, body.pid());
        assertEquals("REJECTED", body.status());
    }

    @Test
    @DisplayName("P0-4: Remote attempt to terminate current JVM server PID is rejected with 403 and server remains alive")
    void testServerHostCurrentJvmPidCannotBeTerminated() {
        long currentServerPid = ProcessHandle.current().pid();
        HttpEntity<Void> entity = new HttpEntity<>(authHeaders(primaryToken));

        ResponseEntity<ProcessControlResult> response = restTemplate.exchange(
                "/api/device/processes/" + currentServerPid + "/terminate?force=true",
                HttpMethod.POST,
                entity,
                ProcessControlResult.class
        );

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        ProcessControlResult body = response.getBody();
        assertNotNull(body);
        assertEquals(currentServerPid, body.pid());
        assertEquals("REJECTED", body.status());

        // Verify the server JVM is still completely alive and operational
        assertTrue(ProcessHandle.current().isAlive(), "Server JVM process must remain alive");
    }

    @Test
    @DisplayName("P0-5: Forged PIDs (negative, zero, extreme values) are consistently refused with 403 Forbidden")
    void testForgedPidsConsistentlyRefused() {
        List<Long> forgedPids = List.of(-1L, 0L, 99999999L);
        HttpEntity<Void> entity = new HttpEntity<>(authHeaders(primaryToken));

        for (Long pid : forgedPids) {
            ResponseEntity<ProcessControlResult> response = restTemplate.exchange(
                    "/api/device/processes/" + pid + "/terminate",
                    HttpMethod.POST,
                    entity,
                    ProcessControlResult.class
            );
            assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode(), "PID " + pid + " must return 403");
            assertEquals("REJECTED", response.getBody().status());
        }
    }

    // =========================================================================
    // 2. Fail-Closed Configuration Defaults
    // =========================================================================

    @Test
    @DisplayName("P0-6: Zero-configuration default fails closed (server-side scanning strictly disabled)")
    void testDefaultConfigurationFailsClosed() {
        // TaskManagerService zero-arg constructor must default to false
        TaskManagerService defaultTmService = new TaskManagerService();
        assertFalse(defaultTmService.isServerProcessScanningEnabled(),
                "TaskManagerService default constructor must fail closed (false)");

        // SentinelEnforcementService zero-arg/standard constructor must default to false
        SentinelEnforcementService defaultSentinel = new SentinelEnforcementService(
                focusSessionRepository,
                quarantineRepository,
                policyRuleRepository,
                tamperEventRepository,
                userRepository,
                passwordEncoder,
                transactionManager,
                null,
                null,
                null
        );
        assertFalse(defaultSentinel.isServerProcessScanningEnabled(),
                "SentinelEnforcementService default constructor must fail closed (false)");

        // Active Spring bean must also be false in test/prod profile
        assertFalse(taskManagerService.isServerProcessScanningEnabled(),
                "Active TaskManagerService bean must have server-side scanning disabled");
        assertFalse(sentinelEnforcementService.isServerProcessScanningEnabled(),
                "Active SentinelEnforcementService bean must have server-side scanning disabled");
    }

    // =========================================================================
    // 3. Telemetry Boundary: No Host Processes Exposed
    // =========================================================================

    @Test
    @DisplayName("P0-7: GET /api/device/processes does not dump backend server host processes to users")
    void testDeviceProcessesEndpointDoesNotExposeHostProcesses() {
        HttpEntity<Void> entity = new HttpEntity<>(authHeaders(primaryToken));

        ResponseEntity<List<ProcessInfo>> response = restTemplate.exchange(
                "/api/device/processes",
                HttpMethod.GET,
                entity,
                new ParameterizedTypeReference<>() {}
        );

        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<ProcessInfo> procs = response.getBody();
        assertNotNull(procs);
        assertTrue(procs.isEmpty(), "Server host processes must not be leaked to the client");
    }

    @Test
    @DisplayName("P0-8: GET /api/device/system-info reports 0 process count and indicates remote node")
    void testDeviceSystemInfoDoesNotExposeHostProcessCount() {
        HttpEntity<Void> entity = new HttpEntity<>(authHeaders(primaryToken));

        ResponseEntity<DeviceSystemInfo> response = restTemplate.exchange(
                "/api/device/system-info",
                HttpMethod.GET,
                entity,
                DeviceSystemInfo.class
        );

        assertEquals(HttpStatus.OK, response.getStatusCode());
        DeviceSystemInfo info = response.getBody();
        assertNotNull(info);
        assertEquals(0, info.processCount(), "Process count must be 0 when server scanning is disabled");
    }

    @Test
    @DisplayName("P0-9: GET /api/device/snapshot returns empty process list and 0 process count")
    void testDeviceSnapshotReturnsEmptyProcessList() {
        HttpEntity<Void> entity = new HttpEntity<>(authHeaders(primaryToken));

        ResponseEntity<ProcessSnapshot> response = restTemplate.exchange(
                "/api/device/snapshot",
                HttpMethod.GET,
                entity,
                ProcessSnapshot.class
        );

        assertEquals(HttpStatus.OK, response.getStatusCode());
        ProcessSnapshot snapshot = response.getBody();
        assertNotNull(snapshot);
        assertEquals(0, snapshot.systemInfo().processCount());
        assertTrue(snapshot.processes().isEmpty(), "Snapshot processes list must be empty");
    }

    // =========================================================================
    // 4. Focus Session Lifecycle & Sweep Safety
    // =========================================================================

    @Test
    @DisplayName("P0-10: Starting a Focus Session updates database state and never scans or kills server host processes")
    void testFocusSessionLifecycleDoesNotScanOrKillHostProcesses() {
        FocusSession session = new FocusSession();
        session.setUser(primaryUser);
        session.setName("Production Safety Sprint");
        session.setIntention("Zero Distraction Safe Execution");
        session.setDurationMinutes(25);
        session.setStatus(FocusSessionStatus.ACTIVE);
        session.setStartedAt(Instant.now());
        session = focusSessionRepository.save(session);

        assertNotNull(session.getId());
        assertEquals(FocusSessionStatus.ACTIVE, session.getStatus());

        // Sentinel status reflects active session
        SentinelStatusResponse status = sentinelEnforcementService.getSentinelStatus(primaryUser.getId());
        assertNotNull(status);
        assertEquals(session.getId(), status.activeFocusSessionId());
        assertEquals("Production Safety Sprint", status.activeFocusSessionName());

        // Verify host JVM is untouched
        assertTrue(ProcessHandle.current().isAlive());
    }

    @Test
    @DisplayName("P0-11: Sentinel sweep trigger safely delegates to desktop Shield without scanning host processes")
    void testTriggerSweepSafelyDelegatesWithoutHostScanning() {
        HttpEntity<Void> entity = new HttpEntity<>(authHeaders(primaryToken));

        ResponseEntity<SentinelSweepResponse> response = restTemplate.exchange(
                "/api/device/sentinel/sweep",
                HttpMethod.POST,
                entity,
                SentinelSweepResponse.class
        );

        assertEquals(HttpStatus.OK, response.getStatusCode());
        SentinelSweepResponse sweep = response.getBody();
        assertNotNull(sweep);
        assertEquals(0, sweep.scannedProcessCount(), "Scanned process count must be 0 on server");
        assertEquals(0, sweep.interceptedCount(), "Intercepted count must be 0 on server");
        assertTrue(sweep.interceptedPids().isEmpty());
        assertTrue(sweep.message().contains("Server-side process scanning is disabled in cloud deployment"),
                "Sweep message must confirm delegation to SHINPO Shield daemon");
    }

    @Test
    @DisplayName("P0-12: Scheduled background daemon skips server host sweep and does not terminate processes")
    void testScheduledDaemonSkipsServerHostSweep() {
        assertDoesNotThrow(() -> sentinelEnforcementService.periodicSentinelDaemon(),
                "Periodic sentinel daemon must execute cleanly and skip host scanning");
        assertFalse(sentinelEnforcementService.isSweepRunning(),
                "Sweep running guard must remain false");
    }

    // =========================================================================
    // 5. Desktop Native Shield Ingestion & Multi-User Business Integrity
    // =========================================================================

    @Test
    @DisplayName("P0-13: Native Shield can report single and batch quarantines from desktop agent")
    void testNativeShieldQuarantineReportingSucceeds() {
        FocusSession session = new FocusSession();
        session.setUser(primaryUser);
        session.setName("Shield Report Sprint");
        session.setStatus(FocusSessionStatus.ACTIVE);
        session.setStartedAt(Instant.now());
        session.setDurationMinutes(30);
        session = focusSessionRepository.save(session);

        // 1. Single quarantine reporting
        RecordQuarantineRequest singleReq = new RecordQuarantineRequest(
                91823L,
                "game_client",
                "/opt/games/game_client",
                "TERMINATED",
                "STRICT",
                "Intercepted by local desktop Native Shield"
        );
        HttpEntity<RecordQuarantineRequest> singleEntity = new HttpEntity<>(singleReq, authHeaders(primaryToken));

        ResponseEntity<SentinelQuarantineItem> singleResp = restTemplate.exchange(
                "/api/device/sentinel/quarantines",
                HttpMethod.POST,
                singleEntity,
                SentinelQuarantineItem.class
        );

        assertEquals(HttpStatus.CREATED, singleResp.getStatusCode());
        assertNotNull(singleResp.getBody());
        assertEquals("game_client", singleResp.getBody().processName());
        assertEquals(session.getId(), singleResp.getBody().focusSessionId());

        // 2. Batch quarantine reporting (offline spool sync)
        BatchQuarantineRequest batchReq = new BatchQuarantineRequest(List.of(
                new RecordQuarantineRequest(91824L, "discord", "/bin/discord", "TERMINATED", "STRICT", "Batch sync 1"),
                new RecordQuarantineRequest(91825L, "steam", "/bin/steam", "TERMINATED", "STRICT", "Batch sync 2")
        ));
        HttpEntity<BatchQuarantineRequest> batchEntity = new HttpEntity<>(batchReq, authHeaders(primaryToken));

        ResponseEntity<BatchQuarantineResponse> batchResp = restTemplate.exchange(
                "/api/device/sentinel/quarantines/batch",
                HttpMethod.POST,
                batchEntity,
                BatchQuarantineResponse.class
        );

        assertEquals(HttpStatus.OK, batchResp.getStatusCode());
        assertNotNull(batchResp.getBody());
        assertEquals(2, batchResp.getBody().savedCount());

        List<SentinelQuarantineItem> quarantines = sentinelEnforcementService.getQuarantinesForSession(primaryUser.getId(), session.getId());
        assertEquals(3, quarantines.size());
    }

    @Test
    @DisplayName("P0-14: Core business features (Goals, Missions, Sessions) remain fully functional with user isolation")
    void testExistingBusinessFeaturesGoalsAndSessionsRemainFunctional() {
        // Create Goal for Primary User
        Goal goal = goalRepository.save(new Goal(
                "Launch Independent Beta",
                "Support four independent users on remote cloud backend",
                LocalDate.now().plusWeeks(2),
                null,
                primaryUser
        ));
        assertNotNull(goal.getId());

        // Create Mission under Goal
        Mission mission = missionRepository.save(new Mission(
                "Verify Server Trust Boundary",
                "Eliminate dangerous server-side process enforcement",
                LocalDate.now().plusDays(3),
                30,
                goal
        ));
        assertNotNull(mission.getId());

        // Verify Secondary User cannot access Primary User's goal
        List<Goal> userBGoals = goalRepository.findAllByUser_Id(secondaryUser.getId());
        assertTrue(userBGoals.isEmpty(), "User B must have complete data isolation from User A");

        // Verify Primary User can retrieve goal
        List<Goal> userAGoals = goalRepository.findAllByUser_Id(primaryUser.getId());
        assertEquals(1, userAGoals.size());
        assertEquals("Launch Independent Beta", userAGoals.get(0).getTitle());
    }
}
