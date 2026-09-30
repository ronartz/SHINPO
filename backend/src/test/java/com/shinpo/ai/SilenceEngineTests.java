package com.shinpo.ai;

import com.shinpo.ai.context.ContextEngine;
import com.shinpo.ai.context.ExecutionIntelligenceContext;
import com.shinpo.ai.orchestrator.AiGateway;
import com.shinpo.ai.provider.MockAIProvider;
import com.shinpo.dto.AiDtos.AiChatRequest;
import com.shinpo.dto.AiDtos.AiChatResponse;
import com.shinpo.entity.FocusSession;
import com.shinpo.entity.FocusSessionStatus;
import com.shinpo.entity.Goal;
import com.shinpo.entity.Mission;
import com.shinpo.entity.User;
import com.shinpo.repository.FocusSessionRepository;
import com.shinpo.repository.GoalRepository;
import com.shinpo.repository.MissionRepository;
import com.shinpo.repository.UserRepository;
import com.shinpo.security.JwtTokenService;
import com.shinpo.security.UserPrincipal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@ActiveProfiles("test")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class SilenceEngineTests {

    @Autowired
    private AiGateway aiGateway;

    @Autowired
    private ContextEngine contextEngine;

    @Autowired
    private MockAIProvider mockAIProvider;

    @Autowired
    private com.shinpo.ai.config.AiProperties aiProperties;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private GoalRepository goalRepository;

    @Autowired
    private MissionRepository missionRepository;

    @Autowired
    private FocusSessionRepository focusSessionRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtTokenService jwtTokenService;

    @Autowired
    private TestRestTemplate restTemplate;

    private User testUser;
    private Goal testGoal;
    private Mission testMission;
    private String jwtToken;

    @BeforeEach
    void setUp() {
        String uniqueSuffix = UUID.randomUUID().toString().substring(0, 8);
        testUser = new User(
                "silence_user_" + uniqueSuffix,
                "silence_" + uniqueSuffix + "@example.com",
                passwordEncoder.encode("Password123!"),
                Instant.now()
        );
        testUser = userRepository.save(testUser);

        testGoal = new Goal(
                "Autonomous Consensus Engine",
                "Deliver production-grade raft implementation",
                LocalDate.now(),
                LocalDate.now().plusWeeks(4),
                testUser
        );
        testGoal = goalRepository.save(testGoal);

        testMission = new Mission(
                "Write AppendEntries RPC Handlers",
                "Implement state transition logic",
                LocalDate.now(),
                45,
                testGoal
        );
        testMission = missionRepository.save(testMission);

        jwtToken = jwtTokenService.generateAccessToken(UserPrincipal.create(testUser));
    }

    private FocusSession createActiveFocusSession(String name, int durationMinutes) {
        FocusSession session = new FocusSession();
        session.setUser(testUser);
        session.setGoal(testGoal);
        session.setMission(testMission);
        session.setName(name);
        session.setDurationMinutes(durationMinutes);
        session.setStatus(FocusSessionStatus.ACTIVE);
        session.setStartedAt(Instant.now());
        session.setAccumulatedPausedSeconds(0L);
        return focusSessionRepository.save(session);
    }

    @Test
    @DisplayName("AI.6 — Silence Engine intercepts planning intent during active focus session")
    void testSilenceEngineInterceptsPlanningWhenFocusSessionIsActive() {
        createActiveFocusSession("Raft Consensus Sprint", 30);

        AiChatRequest request = new AiChatRequest(testUser.getId(), "Plan my day", null, null, null, null);
        AiChatResponse response = aiGateway.processChat(request);

        assertNotNull(response);
        assertEquals("FOCUS_ASSISTANT", response.suggestionType());
        assertTrue(response.reply().contains("Focus sprint in progress"));
        assertTrue(response.reply().contains("Raft Consensus Sprint"));
        assertTrue(response.reply().contains("complete or pause this sprint before scheduling new blocks"));
    }

    @Test
    @DisplayName("AI.6 — Silence Engine intercepts goal deconstruction during active focus session")
    void testSilenceEngineInterceptsGoalDecompositionWhenFocusSessionIsActive() {
        createActiveFocusSession("Shield Hardening Sprint", 25);

        AiChatRequest request = new AiChatRequest(testUser.getId(), "Break down my goal into steps", testGoal.getId(), null, null, null);
        AiChatResponse response = aiGateway.processChat(request);

        assertNotNull(response);
        assertEquals("FOCUS_ASSISTANT", response.suggestionType());
        assertTrue(response.reply().contains("Focus sprint in progress"));
        assertTrue(response.reply().contains("Shield Hardening Sprint"));
        assertTrue(response.reply().contains("Avoid task switching during an active sprint"));
    }

    @Test
    @DisplayName("AI.6 — Silence Engine delivers calm minimal greeting during active focus session")
    void testSilenceEngineMinimalGreetingDuringFocusSession() {
        createActiveFocusSession("Deep Work Sprint Alpha", 50);

        AiChatRequest request = new AiChatRequest(testUser.getId(), "Hi EONPAI", null, null, null, null);
        AiChatResponse response = aiGateway.processChat(request);

        assertNotNull(response);
        assertEquals("FOCUS_ASSISTANT", response.suggestionType());
        assertTrue(response.reply().contains("Focus sprint"));
        assertTrue(response.reply().contains("Deep Work Sprint Alpha"));
        assertTrue(response.reply().contains("Shield active. What quick assistance do you need to stay in flow?"));
        // Must NOT spam with full 4-bullet planning options
        assertFalse(response.reply().contains("• `Plan my day`"));
    }

    @Test
    @DisplayName("AI.6 — Silence Engine deterministic fallback avoids task rabbit holes during active sprint")
    void testSilenceEngineDeterministicFallbackDuringFocusSession() {
        createActiveFocusSession("Kernel Driver Optimization", 40);

        aiProperties.setEnabled(false);
        try {
            AiChatRequest request = new AiChatRequest(testUser.getId(), "Tell me a story about robots", null, null, null, null);
            AiChatResponse response = aiGateway.processChat(request);

            assertNotNull(response);
            assertEquals("FOCUS_ASSISTANT", response.suggestionType());
            assertTrue(response.reply().contains("Focus sprint"));
            assertTrue(response.reply().contains("Kernel Driver Optimization"));
            assertTrue(response.reply().contains("keeping interruptions minimal"));
            assertFalse(response.reply().contains("• `Plan my day`"));
        } finally {
            aiProperties.setEnabled(true);
        }
    }

    @Test
    @DisplayName("AI.6 — ContextEngine detects active session and injects silence directives into prompt")
    void testSilenceEngineDirectivesInContextEngineAndPrompt() {
        createActiveFocusSession("Telemetry Parser Sprint", 35);

        ExecutionIntelligenceContext ctx = contextEngine.assembleContext(
                testUser.getId(),
                testGoal.getId(),
                testMission.getId(),
                null,
                List.of()
        );

        assertNotNull(ctx.activeSession());
        assertTrue(ctx.activeSession().isActive());
        assertTrue(ctx.isSilenceModeActive());

        String isolatedPrompt = contextEngine.buildIsolatedPrompt("System baseline", ctx, "How do I format logs?");
        assertTrue(isolatedPrompt.contains("SILENCE_ENGINE: ACTIVE"));
        assertTrue(isolatedPrompt.contains("User is in a deep focus sprint"));
    }

    @Test
    @DisplayName("AI.6 — Normal planning capability is cleanly restored once focus session is completed")
    void testNormalPlanningRestoredAfterFocusSessionCompleted() {
        FocusSession session = createActiveFocusSession("Morning Sprint", 25);

        // Complete session
        session.setStatus(FocusSessionStatus.COMPLETED);
        session.setEndedAt(Instant.now());
        focusSessionRepository.save(session);

        AiChatRequest request = new AiChatRequest(testUser.getId(), "Plan my day", null, null, null, null);
        AiChatResponse response = aiGateway.processChat(request);

        assertNotNull(response);
        assertEquals("PLANNER", response.suggestionType());
        assertTrue(response.reply().contains("Tactical daily itinerary assembled"));
    }

    @Test
    @DisplayName("AI.6 — Silence Engine is enforced over authenticated REST API /api/ai/chat")
    void testSilenceEngineViaRestEndpoint() {
        createActiveFocusSession("API Hardening Sprint", 45);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(jwtToken);

        Map<String, Object> body = Map.of(
                "userId", testUser.getId(),
                "message", "Plan my day"
        );
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

        ResponseEntity<AiChatResponse> res = restTemplate.exchange(
                "/api/ai/chat",
                HttpMethod.POST,
                entity,
                AiChatResponse.class
        );

        assertEquals(HttpStatus.OK, res.getStatusCode());
        assertNotNull(res.getBody());
        assertEquals("FOCUS_ASSISTANT", res.getBody().suggestionType());
        assertTrue(res.getBody().reply().contains("Focus sprint in progress"));
        assertTrue(res.getBody().reply().contains("API Hardening Sprint"));
    }
}
