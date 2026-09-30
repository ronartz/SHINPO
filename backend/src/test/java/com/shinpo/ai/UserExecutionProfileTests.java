package com.shinpo.ai;

import com.shinpo.ai.orchestrator.AiGateway;
import com.shinpo.ai.tool.AiToolRegistry;
import com.shinpo.ai.tool.ToolResult;
import com.shinpo.dto.AiDtos.AiChatRequest;
import com.shinpo.dto.AiDtos.AiChatResponse;
import com.shinpo.dto.AiDtos.UserExecutionProfileDto;
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
import com.shinpo.service.UserExecutionProfileService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@ActiveProfiles("test")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class UserExecutionProfileTests {

    @Autowired
    private UserExecutionProfileService profileService;

    @Autowired
    private AiGateway aiGateway;

    @Autowired
    private AiToolRegistry toolRegistry;

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

    private User userA;
    private User userB;
    private Goal goalA;
    private Mission missionA;
    private String tokenA;

    @BeforeEach
    void setUp() {
        String suffixA = UUID.randomUUID().toString().substring(0, 8);
        userA = userRepository.save(new User(
                "prof_user_a_" + suffixA,
                "prof_a_" + suffixA + "@shinpo.test",
                passwordEncoder.encode("SecretPassword123!"),
                Instant.now()
        ));

        String suffixB = UUID.randomUUID().toString().substring(0, 8);
        userB = userRepository.save(new User(
                "prof_user_b_" + suffixB,
                "prof_b_" + suffixB + "@shinpo.test",
                passwordEncoder.encode("SecretPassword123!"),
                Instant.now()
        ));

        goalA = goalRepository.save(new Goal(
                "Engine Performance",
                "Scale event dispatcher to 10k eps",
                LocalDate.now(),
                LocalDate.now().plusMonths(1),
                userA
        ));

        missionA = missionRepository.save(new Mission(
                "Benchmark ring buffer",
                "Measure L1/L2 cache hit ratios",
                LocalDate.now(),
                30,
                goalA
        ));

        tokenA = jwtTokenService.generateAccessToken(UserPrincipal.create(userA));
    }

    private FocusSession createCompletedSession(User user, String name, int plannedMins, int actualMins, Instant startedAt) {
        FocusSession s = new FocusSession();
        s.setUser(user);
        s.setGoal(goalA);
        s.setMission(missionA);
        s.setName(name);
        s.setDurationMinutes(plannedMins);
        s.setStatus(FocusSessionStatus.COMPLETED);
        s.setStartedAt(startedAt);
        s.setEndedAt(startedAt.plusSeconds((long) actualMins * 60L));
        s.setAccumulatedPausedSeconds(0L);
        return focusSessionRepository.save(s);
    }

    @Test
    @DisplayName("AI.7 Task 1: 0 completed sessions returns insufficient data without fabricating metrics")
    void testZeroSessions_ReturnsInsufficientDataWithoutFabrication() {
        UserExecutionProfileDto profile = profileService.getUserExecutionProfile(userA.getId());

        assertNotNull(profile);
        assertEquals(userA.getId(), profile.userId());
        assertFalse(profile.hasSufficientData(), "Must not claim sufficient data with 0 sessions");
        assertEquals(0, profile.completedSessionsCount());
        assertNull(profile.averageFocusMinutes(), "Must not fabricate average focus duration");
        assertNull(profile.estimationBiasPercentage(), "Must not fabricate estimation bias percentage");
        assertEquals("INSUFFICIENT_DATA", profile.estimationAccuracyCategory());
        assertEquals("NONE", profile.confidenceLevel());
        assertNull(profile.completionVelocityPerDay(), "Must not fabricate completion velocity");
        assertTrue(profile.statusMessage().contains("0/3"));
        assertTrue(profile.statusMessage().contains("No estimations fabricated"));
    }

    @Test
    @DisplayName("AI.7 Task 2: 2 completed sessions (< 3 threshold) still enforces zero-fabrication constraint")
    void testTwoSessions_BelowThreshold_NeverFabricatesMetrics() {
        Instant now = Instant.now();
        createCompletedSession(userA, "Sprint 1", 25, 25, now.minusSeconds(7200));
        createCompletedSession(userA, "Sprint 2", 25, 30, now.minusSeconds(3600));

        UserExecutionProfileDto profile = profileService.getUserExecutionProfile(userA.getId());

        assertFalse(profile.hasSufficientData(), "Must strictly require at least 3 sessions");
        assertEquals(2, profile.completedSessionsCount());
        assertNull(profile.averageFocusMinutes());
        assertNull(profile.estimationBiasPercentage());
        assertEquals("INSUFFICIENT_DATA", profile.estimationAccuracyCategory());
        assertEquals("NONE", profile.confidenceLevel());
        assertTrue(profile.statusMessage().contains("2/3"));
    }

    @Test
    @DisplayName("AI.7 Task 3: 3 completed sessions with positive bias (>15%) classifies as UNDERESTIMATING")
    void testThreeSessions_Underestimating_CalculatesEmpiricalBias() {
        Instant baseTime = Instant.now().minusSeconds(10800);
        // Each session planned for 30m, took 36m (+20% bias)
        createCompletedSession(userA, "Sprint A1", 30, 36, baseTime);
        createCompletedSession(userA, "Sprint A2", 30, 36, baseTime.plusSeconds(3600));
        createCompletedSession(userA, "Sprint A3", 30, 36, baseTime.plusSeconds(7200));

        UserExecutionProfileDto profile = profileService.getUserExecutionProfile(userA.getId());

        assertTrue(profile.hasSufficientData());
        assertEquals(3, profile.completedSessionsCount());
        assertEquals(36.0, profile.averageFocusMinutes());
        assertEquals(20.0, profile.estimationBiasPercentage());
        assertEquals("UNDERESTIMATING", profile.estimationAccuracyCategory());
        assertEquals("LOW", profile.confidenceLevel());
        assertNotNull(profile.completionVelocityPerDay());
        assertTrue(profile.statusMessage().contains("+20.0%"));
        assertTrue(profile.statusMessage().contains("UNDERESTIMATING"));
    }

    @Test
    @DisplayName("AI.7 Task 4: Completed sessions with negative bias (<-15%) classifies as OVERESTIMATING")
    void testOverestimatingBias_CalculatesNegativeBiasAndCategory() {
        Instant baseTime = Instant.now().minusSeconds(10800);
        // Each session planned for 40m, took 30m (-25% bias)
        createCompletedSession(userA, "Fast Sprint 1", 40, 30, baseTime);
        createCompletedSession(userA, "Fast Sprint 2", 40, 30, baseTime.plusSeconds(3600));
        createCompletedSession(userA, "Fast Sprint 3", 40, 30, baseTime.plusSeconds(7200));

        UserExecutionProfileDto profile = profileService.getUserExecutionProfile(userA.getId());

        assertTrue(profile.hasSufficientData());
        assertEquals(-25.0, profile.estimationBiasPercentage());
        assertEquals("OVERESTIMATING", profile.estimationAccuracyCategory());
        assertTrue(profile.statusMessage().contains("-25.0%"));
    }

    @Test
    @DisplayName("AI.7 Task 5: Completed sessions within +-15% classifies as ON_TRACK")
    void testOnTrackBias_WithinTolerance() {
        Instant baseTime = Instant.now().minusSeconds(10800);
        // Planned 30m: 31m (+3.3%), 29m (-3.3%), 30m (0.0%) -> avg bias ~ 0.0%
        createCompletedSession(userA, "Balanced Sprint 1", 30, 31, baseTime);
        createCompletedSession(userA, "Balanced Sprint 2", 30, 29, baseTime.plusSeconds(3600));
        createCompletedSession(userA, "Balanced Sprint 3", 30, 30, baseTime.plusSeconds(7200));

        UserExecutionProfileDto profile = profileService.getUserExecutionProfile(userA.getId());

        assertTrue(profile.hasSufficientData());
        assertEquals(0.0, profile.estimationBiasPercentage());
        assertEquals("ON_TRACK", profile.estimationAccuracyCategory());
    }

    @Test
    @DisplayName("AI.7 Task 6: Incomplete sessions (ACTIVE, SCHEDULED, FAILED) do not distort completed calibration")
    void testNonCompletedSessionsIgnoredInCalibration() {
        Instant baseTime = Instant.now().minusSeconds(10800);
        createCompletedSession(userA, "Finished 1", 30, 30, baseTime);
        createCompletedSession(userA, "Finished 2", 30, 30, baseTime.plusSeconds(3600));
        createCompletedSession(userA, "Finished 3", 30, 30, baseTime.plusSeconds(7200));

        // Add incomplete sessions
        FocusSession active = new FocusSession();
        active.setUser(userA);
        active.setName("Active Session");
        active.setDurationMinutes(25);
        active.setStatus(FocusSessionStatus.ACTIVE);
        active.setStartedAt(Instant.now());
        focusSessionRepository.save(active);

        FocusSession failed = new FocusSession();
        failed.setUser(userA);
        failed.setName("Failed Session");
        failed.setDurationMinutes(25);
        failed.setStatus(FocusSessionStatus.FAILED);
        failed.setStartedAt(Instant.now().minusSeconds(500));
        failed.setEndedAt(Instant.now());
        focusSessionRepository.save(failed);

        UserExecutionProfileDto profile = profileService.getUserExecutionProfile(userA.getId());

        // Count must strictly remain 3 completed sessions
        assertEquals(3, profile.completedSessionsCount());
        assertEquals(30.0, profile.averageFocusMinutes());
        assertEquals(0.0, profile.estimationBiasPercentage());
    }

    @Test
    @DisplayName("AI.7 Task 7: Cross-tenant isolation ensures User A's data never leaks into User B's profile")
    void testCrossTenantIsolation_NeverLeaksDataBetweenUsers() {
        Instant baseTime = Instant.now().minusSeconds(10800);
        createCompletedSession(userA, "User A Sprint 1", 30, 36, baseTime);
        createCompletedSession(userA, "User A Sprint 2", 30, 36, baseTime.plusSeconds(3600));
        createCompletedSession(userA, "User A Sprint 3", 30, 36, baseTime.plusSeconds(7200));

        UserExecutionProfileDto profileA = profileService.getUserExecutionProfile(userA.getId());
        UserExecutionProfileDto profileB = profileService.getUserExecutionProfile(userB.getId());

        assertTrue(profileA.hasSufficientData());
        assertEquals(3, profileA.completedSessionsCount());

        assertFalse(profileB.hasSufficientData(), "User B must have 0 completed sessions and insufficient data");
        assertEquals(0, profileB.completedSessionsCount());
        assertNull(profileB.estimationBiasPercentage());
    }

    @Test
    @DisplayName("AI.7 Task 8: get_user_execution_profile tool executes cleanly via registry with IDOR defense")
    void testToolExecution_GetUserExecutionProfile_ThroughRegistry() {
        Instant baseTime = Instant.now().minusSeconds(10800);
        createCompletedSession(userA, "Tool Sprint 1", 25, 25, baseTime);
        createCompletedSession(userA, "Tool Sprint 2", 25, 25, baseTime.plusSeconds(3600));
        createCompletedSession(userA, "Tool Sprint 3", 25, 25, baseTime.plusSeconds(7200));

        // Attempt IDOR parameter spoofing: caller is userA, but parameters supply userId=userB.getId()
        ToolResult result = toolRegistry.executeTool("get_user_execution_profile", userA.getId(), Map.of("userId", userB.getId()));

        assertTrue(result.success());
        assertNotNull(result.data());
        assertTrue(result.data() instanceof Map<?, ?>);

        Map<?, ?> dataMap = (Map<?, ?>) result.data();
        assertEquals(userA.getId(), dataMap.get("userId"), "Must execute strictly against caller authenticated principal");
        assertEquals(true, dataMap.get("hasSufficientData"));
        assertEquals(3, dataMap.get("completedSessionsCount"));
    }

    @Test
    @DisplayName("AI.7 Task 9: GET /api/ai/profile REST endpoint enforces authentication and returns profile")
    void testRestEndpoint_GetProfile_AuthenticatedAndUnauthenticated() {
        // 1. Unauthenticated request returns 401
        ResponseEntity<String> unauthRes = restTemplate.getForEntity("/api/ai/profile", String.class);
        assertEquals(HttpStatus.UNAUTHORIZED, unauthRes.getStatusCode());

        // 2. Authenticated request returns 200 OK
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(tokenA);
        HttpEntity<Void> entity = new HttpEntity<>(headers);

        ResponseEntity<UserExecutionProfileDto> authRes = restTemplate.exchange(
                "/api/ai/profile",
                HttpMethod.GET,
                entity,
                UserExecutionProfileDto.class
        );

        assertEquals(HttpStatus.OK, authRes.getStatusCode());
        assertNotNull(authRes.getBody());
        assertEquals(userA.getId(), authRes.getBody().userId());
    }

    @Test
    @DisplayName("AI.7 Task 10: AiGateway processes profile intent message with calibrated feedback")
    void testAiGateway_ProcessesProfileIntent() {
        Instant baseTime = Instant.now().minusSeconds(10800);
        createCompletedSession(userA, "AI Sprint 1", 30, 36, baseTime);
        createCompletedSession(userA, "AI Sprint 2", 30, 36, baseTime.plusSeconds(3600));
        createCompletedSession(userA, "AI Sprint 3", 30, 36, baseTime.plusSeconds(7200));

        AiChatRequest request = new AiChatRequest(userA.getId(), "What is my execution profile and velocity?", null, null, null);
        AiChatResponse response = aiGateway.processChat(request);

        assertNotNull(response);
        assertEquals("PROFILE", response.suggestionType());
        assertTrue(response.reply().contains("Personal Execution Profile"));
        assertTrue(response.reply().contains("+20.0%"));
        assertTrue(response.reply().contains("UNDERESTIMATING"));
    }
}
