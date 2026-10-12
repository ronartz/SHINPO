package com.shinpo.sentinel;

import com.shinpo.dto.SentinelDtos.AddPolicyRuleRequest;
import com.shinpo.dto.SentinelDtos.PolicyRuleResponse;
import com.shinpo.dto.SentinelWarningDtos.CandidateProcessRequest;
import com.shinpo.dto.SentinelWarningDtos.CandidateProcessResponse;
import com.shinpo.entity.FocusSession;
import com.shinpo.entity.FocusSessionStatus;
import com.shinpo.entity.User;
import com.shinpo.repository.FocusSessionRepository;
import com.shinpo.repository.UserRepository;
import com.shinpo.service.ContextualEnforcementDecisionService;
import com.shinpo.service.ContextualEnforcementDecisionService.PolicyDecision;
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
import java.util.List;
import java.util.concurrent.CompletableFuture;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class ProcessSafetyPolicyCorrectionTests {

    @Autowired
    private SentinelEnforcementService enforcementService;

    @Autowired
    private SentinelWarningService warningService;

    @Autowired
    private ContextualEnforcementDecisionService contextualDecisionService;

    @Autowired
    private FocusSessionRepository sessionRepository;

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
                "safety_user_" + ts,
                "tester_" + ts + "@shinpo.dev",
                passwordEncoder.encode("SecretPass123!"),
                Instant.now()
        ));

        activeSession = new FocusSession();
        activeSession.setUser(testUser);
        activeSession.setName("Slice 6.1 Policy Verification Sprint");
        activeSession.setStatus(FocusSessionStatus.ACTIVE);
        activeSession.setDurationMinutes(25);
        activeSession.setStartedAt(Instant.now());
        activeSession = sessionRepository.save(activeSession);
    }

    @Test
    @DisplayName("Requirement 1: Ordinary browser process names are NOT rejected by addPolicyRule")
    void testOrdinaryBrowsersAreNotRejectedByPolicyRule() {
        for (String browserName : List.of("chrome", "google-chrome", "chromium", "firefox", "brave", "edge")) {
            AddPolicyRuleRequest req = new AddPolicyRuleRequest(browserName, "BLOCKED");
            PolicyRuleResponse resp = enforcementService.addPolicyRule(testUser.getId(), req);

            assertNotNull(resp);
            assertEquals(browserName, resp.processNamePattern());
            assertEquals("BLOCKED", resp.policyType());
        }
    }

    @Test
    @DisplayName("Requirement 2: PID 1 and core system daemons remain strictly immune")
    void testPid1AndCoreSystemDaemonsRemainImmune() {
        for (String coreDaemon : List.of("systemd", "init", "kernel", "kthreadd", "dbus-daemon", "mutter", "kwin", "wireplumber", "postgres")) {
            // Cannot be added as a BLOCKED rule
            AddPolicyRuleRequest req = new AddPolicyRuleRequest(coreDaemon, "BLOCKED");
            IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                    enforcementService.addPolicyRule(testUser.getId(), req));
            assertTrue(ex.getMessage().contains("Cannot block protected system core process"),
                    "Expected protected error for: " + coreDaemon);

            // Contextual policy evaluation must always yield ALLOW
            PolicyDecision decision = contextualDecisionService.evaluateProcess(testUser.getId(), coreDaemon);
            assertEquals(PolicyDecision.ALLOW, decision, "Core daemon must be ALLOWED: " + coreDaemon);

            // Candidate evaluation must always yield ALLOW
            CandidateProcessRequest candReq = new CandidateProcessRequest(coreDaemon, "/usr/bin/" + coreDaemon, 1L);
            CandidateProcessResponse candResp = warningService.evaluateCandidate(testUser.getId(), candReq);
            assertEquals("ALLOW", candResp.decision());
        }
    }

    @Test
    @DisplayName("Requirement 3: SHINPO-owned processes remain immune by name or commandLine")
    void testShinpoOwnedProcessesRemainImmune() {
        // Name containing shinpo
        CandidateProcessRequest nameReq = new CandidateProcessRequest("shinpo-desktop", "/usr/bin/shinpo-desktop", 9999L);
        CandidateProcessResponse nameResp = warningService.evaluateCandidate(testUser.getId(), nameReq);
        assertEquals("ALLOW", nameResp.decision());

        // Name is generic (e.g. node, java) but command line contains SHINPO
        CandidateProcessRequest nodeDevReq = new CandidateProcessRequest(
                "node",
                "/usr/bin/node /home/user/Projects/SHINPO/frontend/node_modules/vite/bin/vite.js",
                8888L
        );
        CandidateProcessResponse nodeDevResp = warningService.evaluateCandidate(testUser.getId(), nodeDevReq);
        assertEquals("ALLOW", nodeDevResp.decision());
        assertTrue(nodeDevResp.reason().contains("SHINPO runtime process is protected"));

        CandidateProcessRequest javaBackendReq = new CandidateProcessRequest(
                "java",
                "java -jar /opt/shinpo/shinpo-backend.jar",
                7777L
        );
        CandidateProcessResponse javaResp = warningService.evaluateCandidate(testUser.getId(), javaBackendReq);
        assertEquals("ALLOW", javaResp.decision());
        assertTrue(javaResp.reason().contains("SHINPO runtime process is protected"));
    }

    @Test
    @DisplayName("Requirement 4: Normal browser process can be policy-matched and restricted")
    void testNormalBrowserCanBePolicyMatchedAndRestricted() {
        // 1. Add BLOCKED rule for chrome
        enforcementService.addPolicyRule(testUser.getId(), new AddPolicyRuleRequest("chrome", "BLOCKED"));

        // 2. Contextual evaluation must return ENFORCE
        PolicyDecision decision = contextualDecisionService.evaluateProcess(testUser.getId(), "chrome");
        assertEquals(PolicyDecision.ENFORCE, decision);

        // 3. Candidate evaluation must emit DEFER_WARNING
        CandidateProcessRequest req = new CandidateProcessRequest("chrome", "/opt/google/chrome/chrome", 54321L);
        CandidateProcessResponse resp = warningService.evaluateCandidate(testUser.getId(), req);

        assertNotNull(resp);
        assertEquals("DEFER_WARNING", resp.decision());
        assertNotNull(resp.warningId());
    }

    @Test
    @DisplayName("Requirement 5: Normal editor process can be policy-matched and restricted")
    void testNormalEditorCanBePolicyMatchedAndRestricted() {
        for (String editor : List.of("code", "idea", "nvim", "vim")) {
            enforcementService.addPolicyRule(testUser.getId(), new AddPolicyRuleRequest(editor, "BLOCKED"));

            PolicyDecision decision = contextualDecisionService.evaluateProcess(testUser.getId(), editor);
            assertEquals(PolicyDecision.ENFORCE, decision, "Editor must be ENFORCE: " + editor);

            CandidateProcessRequest req = new CandidateProcessRequest(editor, "/usr/bin/" + editor, 12345L);
            CandidateProcessResponse resp = warningService.evaluateCandidate(testUser.getId(), req);
            assertEquals("DEFER_WARNING", resp.decision());
        }
    }

    @Test
    @DisplayName("Requirement 6: Developer tools and local AI runtimes can be policy-matched when chosen")
    void testDeveloperToolsAndOllamaCanBePolicyMatched() {
        for (String tool : List.of("node", "python", "cargo", "ollama", "qwen")) {
            enforcementService.addPolicyRule(testUser.getId(), new AddPolicyRuleRequest(tool, "BLOCKED"));

            PolicyDecision decision = contextualDecisionService.evaluateProcess(testUser.getId(), tool);
            assertEquals(PolicyDecision.ENFORCE, decision, "Tool/AI runtime must be ENFORCE: " + tool);

            // Generic external script / tool (not owned by shinpo)
            CandidateProcessRequest req = new CandidateProcessRequest(tool, "/usr/bin/" + tool + " /tmp/external-app", 65432L);
            CandidateProcessResponse resp = warningService.evaluateCandidate(testUser.getId(), req);
            assertEquals("DEFER_WARNING", resp.decision(), "Tool must trigger warning: " + tool);
        }
    }

    @Test
    @DisplayName("Requirement 7: Forced kill remains disabled unless explicitly permitted by policy")
    void testForcedKillRemainsDisabledUnlessExplicitlyPermitted() {
        ProcessHandle handle = mock(ProcessHandle.class);
        when(handle.destroy()).thenReturn(true);
        when(handle.onExit()).thenReturn(new CompletableFuture<>());
        when(handle.isAlive()).thenReturn(true);

        // Forced kill disabled: must record CONTAINMENT_FAILED and NEVER call destroyForcibly()
        String result = SentinelEnforcementService.enforceProcess(handle, "CONTAINMENT", false);
        assertEquals("CONTAINMENT_FAILED", result);

        verify(handle).destroy();
        verify(handle, never()).destroyForcibly();
    }
}

