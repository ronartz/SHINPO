package com.shinpo;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;

import com.shinpo.dto.AiDtos.AiChatRequest;
import com.shinpo.dto.AiDtos.AiChatResponse;
import com.shinpo.dto.AiDtos.GoalDecompositionResponse;
import com.shinpo.dto.AiDtos.NextActionResponse;
import com.shinpo.dto.FocusSessionResponse;
import com.shinpo.entity.AiSuggestion;
import com.shinpo.entity.Goal;
import com.shinpo.entity.Mission;
import com.shinpo.entity.SessionInterval;
import com.shinpo.entity.SessionIntervalType;
import com.shinpo.entity.SessionPlan;
import com.shinpo.entity.User;
import com.shinpo.repository.AiSuggestionRepository;
import com.shinpo.repository.FocusSessionRepository;
import com.shinpo.repository.GoalRepository;
import com.shinpo.repository.MissionRepository;
import com.shinpo.repository.SessionIntervalRepository;
import com.shinpo.repository.SessionPlanRepository;
import com.shinpo.repository.UserRepository;

@ActiveProfiles("test")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class ShinpoApplicationTests {

    @LocalServerPort
    private int port;

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
    private SessionPlanRepository sessionPlanRepository;

    @Autowired
    private SessionIntervalRepository sessionIntervalRepository;

    @Autowired
    private AiSuggestionRepository aiSuggestionRepository;

    private User testUser;
    private Goal testGoal;
    private Mission testMission;

    @BeforeEach
    void setUp() {
        aiSuggestionRepository.deleteAll();
        focusSessionRepository.deleteAll();
        sessionIntervalRepository.deleteAll();
        sessionPlanRepository.deleteAll();
        missionRepository.deleteAll();
        goalRepository.deleteAll();
        userRepository.deleteAll();

        testUser = userRepository.save(
                new User(
                        "focus_test_user",
                        "focus-test@example.com",
                        "test-password-hash",
                        Instant.now()
                )
        );

        testGoal = goalRepository.save(
                new Goal(
                        "Test Goal",
                        "Goal created for Focus Session tests",
                        LocalDate.now(),
                        LocalDate.now().plusDays(30),
                        testUser
                )
        );

        testMission = missionRepository.save(
                new Mission(
                        "Test Mission",
                        "Mission created for Focus Session tests",
                        LocalDate.now(),
                        60,
                        testGoal
                )
        );
    }

    @Test
    void contextLoads() {
    }

    @Test
    void shouldCreateFocusSession() {
        ResponseEntity<FocusSessionResponse> response =
                createFocusSession();

        assertEquals(201, response.getStatusCode().value());

        FocusSessionResponse body = response.getBody();
        assertNotNull(body);

        assertEquals(testUser.getId(), body.getUserId());
        assertEquals(testGoal.getId(), body.getGoalId());
        assertEquals(testMission.getId(), body.getMissionId());
        assertNull(body.getPlanId());
        assertEquals("Test Focus Session", body.getName());
        assertEquals(60, body.getDurationMinutes());
        assertEquals("SCHEDULED", body.getStatus().name());
        assertEquals(0L, body.getAccumulatedPausedSeconds());
        assertEquals(3600L, body.getRemainingSeconds());
    }

    @Test
    void shouldCreateFocusSessionWithIntervalPlan() {
        SessionPlan plan = new SessionPlan();
        plan.setUser(testUser);
        plan.setName("Classic Pomodoro 1-Hour");
        plan.setDescription("25m focus, 5m break, 25m focus");

        SessionInterval interval1 = new SessionInterval();
        interval1.setIntervalOrder(1);
        interval1.setIntervalType(SessionIntervalType.FOCUS);
        interval1.setDurationMinutes(25);
        interval1.setLabel("Sprint 1");
        plan.addInterval(interval1);

        SessionInterval interval2 = new SessionInterval();
        interval2.setIntervalOrder(2);
        interval2.setIntervalType(SessionIntervalType.SHORT_BREAK);
        interval2.setDurationMinutes(5);
        interval2.setLabel("Rest");
        plan.addInterval(interval2);

        SessionInterval interval3 = new SessionInterval();
        interval3.setIntervalOrder(3);
        interval3.setIntervalType(SessionIntervalType.FOCUS);
        interval3.setDurationMinutes(25);
        interval3.setLabel("Sprint 2");
        plan.addInterval(interval3);

        SessionPlan savedPlan = sessionPlanRepository.save(plan);

        Map<String, Object> requestBody = Map.of(
                "userId", testUser.getId(),
                "goalId", testGoal.getId(),
                "missionId", testMission.getId(),
                "planId", savedPlan.getId(),
                "name", "Pomodoro Execution Session",
                "intention", "Work with structured intervals",
                "durationMinutes", 55
        );

        ResponseEntity<FocusSessionResponse> createResponse = restTemplate.postForEntity(
                baseUrl() + "/api/focus-sessions",
                requestBody,
                FocusSessionResponse.class
        );

        assertEquals(201, createResponse.getStatusCode().value());
        FocusSessionResponse createdBody = createResponse.getBody();
        assertNotNull(createdBody);
        assertEquals(savedPlan.getId(), createdBody.getPlanId());

        ResponseEntity<FocusSessionResponse> getResponse = restTemplate.getForEntity(
                sessionUrl(createdBody.getId(), testUser.getId()),
                FocusSessionResponse.class
        );

        assertEquals(200, getResponse.getStatusCode().value());
        assertNotNull(getResponse.getBody());
        assertEquals(savedPlan.getId(), getResponse.getBody().getPlanId());
    }

    @Test
    void shouldStartFocusSession() {
        Long sessionId = createFocusSessionId();

        ResponseEntity<FocusSessionResponse> response =
                postLifecycleAction(sessionId, "/start");

        assertEquals(200, response.getStatusCode().value());

        FocusSessionResponse body = response.getBody();
        assertNotNull(body);

        assertEquals("ACTIVE", body.getStatus().name());
        assertNotNull(body.getStartedAt());
        assertNull(body.getPausedAt());
        assertNotNull(body.getActiveSeconds());
    }

    @Test
    void shouldTransitionScheduledSessionToExpiredWhenWindowHasPassed() {
        Instant pastScheduledTime = Instant.now().minus(java.time.Duration.ofHours(2));

        Map<String, Object> requestBody = Map.of(
                "userId", testUser.getId(),
                "goalId", testGoal.getId(),
                "missionId", testMission.getId(),
                "name", "Past Scheduled Session",
                "intention", "Should expire automatically",
                "durationMinutes", 30,
                "scheduledAt", pastScheduledTime.toString()
        );

        ResponseEntity<FocusSessionResponse> createResponse = restTemplate.postForEntity(
                baseUrl() + "/api/focus-sessions",
                requestBody,
                FocusSessionResponse.class
        );

        assertEquals(201, createResponse.getStatusCode().value());
        Long sessionId = createResponse.getBody().getId();

        ResponseEntity<FocusSessionResponse> getResponse = restTemplate.getForEntity(
                sessionUrl(sessionId, testUser.getId()),
                FocusSessionResponse.class
        );

        assertEquals(200, getResponse.getStatusCode().value());
        FocusSessionResponse session = getResponse.getBody();
        assertNotNull(session);
        assertEquals("EXPIRED", session.getStatus().name());
        assertNotNull(session.getEndedAt());
    }

    @Test
    void shouldPauseAndResumeFocusSessionWithAccurateTracking() throws InterruptedException {
        Long sessionId = createFocusSessionId();

        ResponseEntity<FocusSessionResponse> startResponse =
                postLifecycleAction(sessionId, "/start");
        assertEquals(200, startResponse.getStatusCode().value());
        assertEquals("ACTIVE", startResponse.getBody().getStatus().name());

        ResponseEntity<FocusSessionResponse> pauseResponse =
                postLifecycleAction(sessionId, "/pause");
        assertEquals(200, pauseResponse.getStatusCode().value());

        FocusSessionResponse pauseBody = pauseResponse.getBody();
        assertNotNull(pauseBody);
        assertEquals("PAUSED", pauseBody.getStatus().name());
        assertNotNull(pauseBody.getPausedAt());

        Thread.sleep(1050);

        ResponseEntity<FocusSessionResponse> resumeResponse =
                postLifecycleAction(sessionId, "/resume");
        assertEquals(200, resumeResponse.getStatusCode().value());

        FocusSessionResponse resumeBody = resumeResponse.getBody();
        assertNotNull(resumeBody);
        assertEquals("ACTIVE", resumeBody.getStatus().name());
        assertNull(resumeBody.getPausedAt());
        assertTrue(resumeBody.getAccumulatedPausedSeconds() >= 1L);
    }

    @Test
    void shouldCompleteFocusSession() {
        Long sessionId = createFocusSessionId();

        postLifecycleAction(sessionId, "/start");

        ResponseEntity<FocusSessionResponse> completeResponse =
                postLifecycleAction(sessionId, "/complete");

        assertEquals(200, completeResponse.getStatusCode().value());

        FocusSessionResponse body = completeResponse.getBody();
        assertNotNull(body);

        assertEquals("COMPLETED", body.getStatus().name());
        assertNotNull(body.getEndedAt());
    }

    @Test
    void shouldCompleteFocusSessionFromPausedState() {
        Long sessionId = createFocusSessionId();

        postLifecycleAction(sessionId, "/start");
        postLifecycleAction(sessionId, "/pause");

        ResponseEntity<FocusSessionResponse> completeResponse =
                postLifecycleAction(sessionId, "/complete");

        assertEquals(200, completeResponse.getStatusCode().value());

        FocusSessionResponse body = completeResponse.getBody();
        assertNotNull(body);

        assertEquals("COMPLETED", body.getStatus().name());
        assertNotNull(body.getEndedAt());
        assertNull(body.getPausedAt());
    }

    @Test
    void shouldCompleteFocusSessionWithStructuredResult() {
        Long sessionId = createFocusSessionId();

        postLifecycleAction(sessionId, "/start");

        Map<String, Object> resultPayload = Map.of(
                "quality", 5,
                "reflectionNote", "High focus, completed all key steps without distraction",
                "accomplishment", "Delivered Chunk 3.4 session result endpoint"
        );

        ResponseEntity<FocusSessionResponse> completeResponse = restTemplate.postForEntity(
                lifecycleUrl(sessionId, "/complete"),
                resultPayload,
                FocusSessionResponse.class
        );

        assertEquals(200, completeResponse.getStatusCode().value());

        FocusSessionResponse body = completeResponse.getBody();
        assertNotNull(body);
        assertEquals("COMPLETED", body.getStatus().name());
        assertNotNull(body.getResult());
        assertEquals(5, body.getResult().quality());
        assertEquals("High focus, completed all key steps without distraction", body.getResult().reflectionNote());
        assertEquals("Delivered Chunk 3.4 session result endpoint", body.getResult().accomplishment());
        assertEquals(5, body.getCompletionQuality());
    }

    @Test
    void shouldRejectStartingCompletedSession() {
        Long sessionId = createFocusSessionId();

        postLifecycleAction(sessionId, "/start");
        postLifecycleAction(sessionId, "/complete");

        ResponseEntity<String> secondStartResponse =
                restTemplate.postForEntity(
                        lifecycleUrl(sessionId, "/start"),
                        null,
                        String.class
                );

        assertEquals(409, secondStartResponse.getStatusCode().value());
        assertNotNull(secondStartResponse.getBody());
        assertTrue(secondStartResponse.getBody().contains("INVALID_STATE_TRANSITION"));
    }

    @Test
    void shouldRejectAccessFromDifferentUser() {
        Long sessionId = createFocusSessionId();

        User otherUser = userRepository.save(
                new User(
                        "other_focus_user",
                        "other-focus@example.com",
                        "test-password-hash",
                        Instant.now()
                )
        );

        ResponseEntity<String> response =
                restTemplate.getForEntity(
                        sessionUrl(sessionId, otherUser.getId()),
                        String.class
                );

        assertEquals(404, response.getStatusCode().value());
    }

    @Test
    void shouldReturnNotFoundForMissingSession() {
        ResponseEntity<String> response =
                restTemplate.getForEntity(
                        sessionUrl(999999L, testUser.getId()),
                        String.class
                );

        assertEquals(404, response.getStatusCode().value());
    }

    // ==========================================
    // AI GUIDANCE LAYER TESTS (AI.1)
    // ==========================================

    @Test
    void shouldDecomposeGoalIntoMissionsAndAuditSuggestion() {
        ResponseEntity<GoalDecompositionResponse> response = restTemplate.postForEntity(
                baseUrl() + "/api/ai/decompose-goal/" + testGoal.getId() + "?userId=" + testUser.getId(),
                null,
                GoalDecompositionResponse.class
        );

        assertEquals(200, response.getStatusCode().value());
        GoalDecompositionResponse body = response.getBody();
        assertNotNull(body);
        assertEquals(testGoal.getId(), body.goalId());
        assertNotNull(body.proposedMissions());
        assertFalse(body.proposedMissions().isEmpty());

        List<AiSuggestion> logged = aiSuggestionRepository.findAllByUser_IdOrderByCreatedAtDesc(testUser.getId());
        assertFalse(logged.isEmpty());
        assertEquals("GOAL_DECOMPOSITION", logged.get(0).getSuggestionType());
        assertNotNull(logged.get(0).getOutputPayload());
    }

    @Test
    void shouldReturnNextActionGroundedInRealData() {
        ResponseEntity<NextActionResponse> response = restTemplate.getForEntity(
                baseUrl() + "/api/ai/next-action?userId=" + testUser.getId(),
                NextActionResponse.class
        );

        assertEquals(200, response.getStatusCode().value());
        NextActionResponse body = response.getBody();
        assertNotNull(body);
        assertEquals(testGoal.getId(), body.goalId());
        assertEquals(testMission.getId(), body.missionId());
        assertNotNull(body.recommendedAction());
    }

    @Test
    void shouldRejectDecomposingGoalBelongingToDifferentUser() {
        User otherUser = userRepository.save(
                new User(
                        "other_ai_user",
                        "other-ai@example.com",
                        "test-password-hash",
                        Instant.now()
                )
        );

        ResponseEntity<String> response = restTemplate.postForEntity(
                baseUrl() + "/api/ai/decompose-goal/" + testGoal.getId() + "?userId=" + otherUser.getId(),
                null,
                String.class
        );

        assertEquals(404, response.getStatusCode().value());
    }

    @Test
    void shouldProcessChatAndReturnGroundedOverview() {
        AiChatRequest request = new AiChatRequest(
                testUser.getId(),
                "What should I do next?",
                null,
                null,
                null
        );

        ResponseEntity<AiChatResponse> response = restTemplate.postForEntity(
                baseUrl() + "/api/ai/chat",
                request,
                AiChatResponse.class
        );

        assertEquals(200, response.getStatusCode().value());
        AiChatResponse body = response.getBody();
        assertNotNull(body);
        assertEquals("NEXT_ACTION", body.suggestionType());
        assertNotNull(body.reply());
    }

    private ResponseEntity<FocusSessionResponse> createFocusSession() {
        Map<String, Object> requestBody = Map.of(
                "userId", testUser.getId(),
                "goalId", testGoal.getId(),
                "missionId", testMission.getId(),
                "name", "Test Focus Session",
                "intention", "Complete the test mission without distractions",
                "durationMinutes", 60
        );

        return restTemplate.postForEntity(
                baseUrl() + "/api/focus-sessions",
                requestBody,
                FocusSessionResponse.class
        );
    }

    @Test
    void shouldDeleteGoalAndMissions() {
        Goal goal = goalRepository.save(new Goal("Test Delete Goal", "Desc", LocalDate.now(), null, testUser));
        Mission mission = missionRepository.save(new Mission("Test Delete Mission", "Desc", LocalDate.now(), 25, goal));

        restTemplate.delete(baseUrl() + "/api/goals/" + goal.getId());

        assertFalse(goalRepository.existsById(goal.getId()));
        assertFalse(missionRepository.existsById(mission.getId()));
    }

    @Test
    void shouldDeleteMission() {
        Goal goal = goalRepository.save(new Goal("Test Goal For Mission", "Desc", LocalDate.now(), null, testUser));
        Mission mission = missionRepository.save(new Mission("Test Mission Deletion", "Desc", LocalDate.now(), 25, goal));

        restTemplate.delete(baseUrl() + "/api/missions/" + mission.getId());

        assertFalse(missionRepository.existsById(mission.getId()));
        assertTrue(goalRepository.existsById(goal.getId()));
    }

    @Test
    void shouldDeleteFocusSession() {
        Long sessionId = createFocusSessionId();
        assertTrue(focusSessionRepository.existsById(sessionId));

        restTemplate.delete(baseUrl() + "/api/focus-sessions/" + sessionId + "?userId=" + testUser.getId());

        assertFalse(focusSessionRepository.existsById(sessionId));
    }

    private Long createFocusSessionId() {
        ResponseEntity<FocusSessionResponse> response = createFocusSession();
        assertEquals(201, response.getStatusCode().value());
        FocusSessionResponse body = response.getBody();
        assertNotNull(body);
        assertNotNull(body.getId());
        return body.getId();
    }

    private ResponseEntity<FocusSessionResponse> postLifecycleAction(Long sessionId, String action) {
        return restTemplate.postForEntity(
                lifecycleUrl(sessionId, action),
                null,
                FocusSessionResponse.class
        );
    }

    private String baseUrl() {
        return "http://localhost:" + port;
    }

    private String lifecycleUrl(Long sessionId, String action) {
        return baseUrl()
                + "/api/focus-sessions/"
                + sessionId
                + action
                + "?userId="
                + testUser.getId();
    }

    private String sessionUrl(Long sessionId, Long userId) {
        return baseUrl()
                + "/api/focus-sessions/"
                + sessionId
                + "?userId="
                + userId;
    }
}