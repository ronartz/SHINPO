package com.shinpo;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
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
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.test.context.ActiveProfiles;

import com.shinpo.dto.AiDtos.AiChatRequest;
import com.shinpo.dto.AiDtos.AiChatResponse;
import com.shinpo.dto.AiDtos.GoalDecompositionResponse;
import com.shinpo.dto.AiDtos.NextActionResponse;
import com.shinpo.dto.AuthDtos;
import com.shinpo.dto.FocusSessionResponse;
import com.shinpo.entity.AiSuggestion;
import com.shinpo.entity.Goal;
import com.shinpo.entity.FocusSession;
import com.shinpo.entity.FocusSessionStatus;
import com.shinpo.entity.Mission;
import com.shinpo.entity.SessionInterval;
import com.shinpo.entity.SessionIntervalType;
import com.shinpo.entity.SessionPlan;
import com.shinpo.entity.User;
import com.shinpo.repository.AiSuggestionRepository;
import com.shinpo.repository.FocusSessionRepository;
import com.shinpo.repository.GoalRepository;
import com.shinpo.repository.MissionRepository;
import com.shinpo.repository.RefreshTokenRepository;
import com.shinpo.repository.SessionIntervalRepository;
import com.shinpo.repository.SessionPlanRepository;
import com.shinpo.repository.UserRepository;
import com.shinpo.security.JwtTokenService;
import com.shinpo.security.UserPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;

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
    private RefreshTokenRepository refreshTokenRepository;

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

    @Autowired
    private JwtTokenService jwtTokenService;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private User testUser;
    private Goal testGoal;
    private Mission testMission;
    private String authToken;

    @BeforeEach
    void setUp() {
        aiSuggestionRepository.deleteAll();
        focusSessionRepository.deleteAll();
        sessionIntervalRepository.deleteAll();
        sessionPlanRepository.deleteAll();
        missionRepository.deleteAll();
        goalRepository.deleteAll();
        refreshTokenRepository.deleteAll();
        userRepository.deleteAll();

        testUser = userRepository.save(
                new User(
                        "focus_test_user",
                        "focus-test@example.com",
                        passwordEncoder.encode("test-password-123"),
                        Instant.now()
                )
        );

        authToken = jwtTokenService.generateAccessToken(UserPrincipal.create(testUser));
        restTemplate.getRestTemplate().setInterceptors(List.of((request, body, execution) -> {
            if (request.getHeaders().getFirst(org.springframework.http.HttpHeaders.AUTHORIZATION) == null) {
                request.getHeaders().setBearerAuth(authToken);
            }
            return execution.execute(request, body);
        }));

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
        assertNotNull(body.getServerTime());
        assertTrue(java.time.Duration.between(body.getServerTime(), java.time.Instant.now()).abs().toSeconds() <= 2L);
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
    void shouldRejectStartingSecondSessionWhenOneIsAlreadyActive() {
        Long session1Id = createFocusSessionId();
        ResponseEntity<FocusSessionResponse> res1 = postLifecycleAction(session1Id, "/start");
        assertEquals(200, res1.getStatusCode().value());

        Long session2Id = createFocusSessionId();
        ResponseEntity<String> res2 = restTemplate.postForEntity(
                baseUrl() + "/api/focus-sessions/" + session2Id + "/start?userId=" + testUser.getId(),
                null,
                String.class
        );
        assertEquals(409, res2.getStatusCode().value());

        // Complete session 1
        postLifecycleAction(session1Id, "/complete");

        // Now session 2 can start
        ResponseEntity<FocusSessionResponse> res2Retry = postLifecycleAction(session2Id, "/start");
        assertEquals(200, res2Retry.getStatusCode().value());
        assertNotNull(res2Retry.getBody());
        assertEquals("ACTIVE", res2Retry.getBody().getStatus().name());
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

        String otherToken = jwtTokenService.generateAccessToken(UserPrincipal.create(otherUser));
        org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
        headers.setBearerAuth(otherToken);
        org.springframework.http.HttpEntity<Void> entity = new org.springframework.http.HttpEntity<>(headers);

        ResponseEntity<String> response = restTemplate.exchange(
                sessionUrl(sessionId, otherUser.getId()),
                org.springframework.http.HttpMethod.GET,
                entity,
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

        String otherToken = jwtTokenService.generateAccessToken(UserPrincipal.create(otherUser));
        org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
        headers.setBearerAuth(otherToken);
        org.springframework.http.HttpEntity<Void> entity = new org.springframework.http.HttpEntity<>(headers);

        ResponseEntity<String> response = restTemplate.exchange(
                baseUrl() + "/api/ai/decompose-goal/" + testGoal.getId(),
                org.springframework.http.HttpMethod.POST,
                entity,
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
    void shouldDeleteAllGoalsForCurrentUserAndTheirMissions() {
        Goal firstGoal = goalRepository.save(new Goal("Goal A", "Desc", LocalDate.now(), null, testUser));
        Goal secondGoal = goalRepository.save(new Goal("Goal B", "Desc", LocalDate.now(), null, testUser));
        missionRepository.save(new Mission("Mission A", "Desc", LocalDate.now(), 25, firstGoal));
        missionRepository.save(new Mission("Mission B", "Desc", LocalDate.now(), 25, secondGoal));

        restTemplate.delete(baseUrl() + "/api/goals/all");

        assertEquals(0, goalRepository.findAllByUser_Id(testUser.getId()).size());
        assertEquals(0, missionRepository.findAllByGoal_User_Id(testUser.getId()).size());
    }

    @Test
    void shouldDeleteAllMissionsForCurrentUserWithoutRemovingGoals() {
        Goal goal = goalRepository.save(new Goal("Persist Goal", "Desc", LocalDate.now(), null, testUser));
        missionRepository.save(new Mission("Mission 1", "Desc", LocalDate.now(), 25, goal));
        missionRepository.save(new Mission("Mission 2", "Desc", LocalDate.now(), 25, goal));

                int goalCountBeforeDelete = goalRepository.findAllByUser_Id(testUser.getId()).size();

        restTemplate.delete(baseUrl() + "/api/missions/all");

                assertEquals(goalCountBeforeDelete, goalRepository.findAllByUser_Id(testUser.getId()).size());
        assertEquals(0, missionRepository.findAllByGoal_User_Id(testUser.getId()).size());
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
    void shouldReturnNotFoundWhenDeletingNonexistentMission() {
        org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
        headers.setBearerAuth(authToken);
        org.springframework.http.HttpEntity<Void> entity = new org.springframework.http.HttpEntity<>(headers);

        ResponseEntity<String> response = restTemplate.exchange(
                baseUrl() + "/api/missions/999999",
                org.springframework.http.HttpMethod.DELETE,
                entity,
                String.class
        );

        assertEquals(404, response.getStatusCode().value());
    }

    @Test
    void shouldPreventDeletingMissionOwnedByAnotherUser() {
        User otherUser = userRepository.save(
                new User("mission_victim", "victim@shinpo.dev", passwordEncoder.encode("secret"), Instant.now())
        );
        Goal otherGoal = goalRepository.save(
                new Goal("Victim Goal", "Private", LocalDate.now(), null, otherUser)
        );
        Mission otherMission = missionRepository.save(
                new Mission("Victim Mission", "Private Mission", LocalDate.now(), 25, otherGoal)
        );

        org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
        headers.setBearerAuth(authToken);
        org.springframework.http.HttpEntity<Void> entity = new org.springframework.http.HttpEntity<>(headers);

        ResponseEntity<String> response = restTemplate.exchange(
                baseUrl() + "/api/missions/" + otherMission.getId(),
                org.springframework.http.HttpMethod.DELETE,
                entity,
                String.class
        );

        assertEquals(404, response.getStatusCode().value());
        assertTrue(missionRepository.existsById(otherMission.getId()));
    }

    @Test
    void shouldHandleDuplicateDeleteOfMissionGracefully() {
        Goal goal = goalRepository.save(new Goal("Duplicate Delete Goal", "Desc", LocalDate.now(), null, testUser));
        Mission mission = missionRepository.save(new Mission("Duplicate Delete Mission", "Desc", LocalDate.now(), 25, goal));

        org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
        headers.setBearerAuth(authToken);
        org.springframework.http.HttpEntity<Void> entity = new org.springframework.http.HttpEntity<>(headers);

        // First delete -> 204
        ResponseEntity<Void> firstDelete = restTemplate.exchange(
                baseUrl() + "/api/missions/" + mission.getId(),
                org.springframework.http.HttpMethod.DELETE,
                entity,
                Void.class
        );
        assertEquals(204, firstDelete.getStatusCode().value());

        // Second delete -> 404
        ResponseEntity<String> secondDelete = restTemplate.exchange(
                baseUrl() + "/api/missions/" + mission.getId(),
                org.springframework.http.HttpMethod.DELETE,
                entity,
                String.class
        );
        assertEquals(404, secondDelete.getStatusCode().value());
    }


    @Test
    void shouldDeleteFocusSession() {
        Long sessionId = createFocusSessionId();
        assertTrue(focusSessionRepository.existsById(sessionId));

        restTemplate.delete(baseUrl() + "/api/focus-sessions/" + sessionId + "?userId=" + testUser.getId());

        assertFalse(focusSessionRepository.existsById(sessionId));
    }

    @Test
    void shouldRejectUnauthenticatedRequestsToProtectedEndpoints() {
        org.springframework.web.client.RestTemplate rawClient = new org.springframework.web.client.RestTemplate();
        try {
            rawClient.getForEntity(baseUrl() + "/api/goals", String.class);
            org.junit.jupiter.api.Assertions.fail("Expected 401 Unauthorized");
        } catch (org.springframework.web.client.HttpClientErrorException.Unauthorized ex) {
            assertEquals(401, ex.getStatusCode().value());
        }
    }

    @Test
    void shouldRegisterUserAndReturnJwtTokens() {
        Map<String, Object> registerPayload = Map.of(
                "username", "new_cadet",
                "email", "cadet@shinpo.local",
                "password", "secret12345"
        );

        ResponseEntity<AuthDtos.AuthResponse> response = restTemplate.postForEntity(
                baseUrl() + "/api/auth/register",
                registerPayload,
                AuthDtos.AuthResponse.class
        );

        assertEquals(201, response.getStatusCode().value());
        AuthDtos.AuthResponse body = response.getBody();
        assertNotNull(body);
        assertNotNull(body.accessToken());
        assertNotNull(body.refreshToken());
        assertNotNull(body.user());
        assertEquals("new_cadet", body.user().username());
        assertEquals("cadet@shinpo.local", body.user().email());
    }

    @Test
    void shouldLoginWithValidCredentialsAndReturnJwtTokens() {
        Map<String, Object> loginPayload = Map.of(
                "usernameOrEmail", "focus_test_user",
                "password", "test-password-123"
        );

        ResponseEntity<AuthDtos.AuthResponse> response = restTemplate.postForEntity(
                baseUrl() + "/api/auth/login",
                loginPayload,
                AuthDtos.AuthResponse.class
        );

        assertEquals(200, response.getStatusCode().value());
        AuthDtos.AuthResponse body = response.getBody();
        assertNotNull(body);
        assertNotNull(body.accessToken());
        assertNotNull(body.refreshToken());
    }

    @Test
    void shouldRejectInvalidLoginCredentials() {
        Map<String, Object> badLoginPayload = Map.of(
                "usernameOrEmail", "focus_test_user",
                "password", "wrong-password"
        );

        ResponseEntity<String> response = restTemplate.postForEntity(
                baseUrl() + "/api/auth/login",
                badLoginPayload,
                String.class
        );

        assertEquals(401, response.getStatusCode().value());
    }

    @Test
    void shouldRotateRefreshToken() {
        String refreshToken = jwtTokenService.generateRefreshToken(testUser);

        Map<String, Object> refreshPayload = Map.of(
                "refreshToken", refreshToken
        );

        ResponseEntity<AuthDtos.AuthResponse> response = restTemplate.postForEntity(
                baseUrl() + "/api/auth/refresh",
                refreshPayload,
                AuthDtos.AuthResponse.class
        );

        assertEquals(200, response.getStatusCode().value());
        AuthDtos.AuthResponse body = response.getBody();
        assertNotNull(body);
        assertNotNull(body.accessToken());
        String newRefreshToken = body.refreshToken();
        assertNotNull(newRefreshToken);

        // Replay of old refresh token must be rejected
        ResponseEntity<String> replayResponse = restTemplate.postForEntity(
                baseUrl() + "/api/auth/refresh",
                refreshPayload,
                String.class
        );
        assertEquals(401, replayResponse.getStatusCode().value());
    }

    @Test
    void shouldPreventCrossUserDataAccessOrIdor() {
        User otherUser = userRepository.save(
                new User("other_user", "other@example.com", passwordEncoder.encode("secret"), Instant.now())
        );
        Goal otherGoal = goalRepository.save(
                new Goal("Other Goal", "Private", LocalDate.now(), null, otherUser)
        );

        // testUser is authenticated. Attempting to delete otherUser's goal should fail
        restTemplate.delete(baseUrl() + "/api/goals/" + otherGoal.getId());

        // otherGoal must still exist in DB!
        assertTrue(goalRepository.existsById(otherGoal.getId()));
    }

    @Test
    void shouldQueryFocusSessionsByDateAndAgenda() {
        LocalDate today = LocalDate.now();
        ResponseEntity<FocusSessionResponse[]> byDateResponse = restTemplate.getForEntity(
                baseUrl() + "/api/focus-sessions/by-date?date=" + today,
                FocusSessionResponse[].class
        );
        assertEquals(200, byDateResponse.getStatusCode().value());
        assertNotNull(byDateResponse.getBody());

        ResponseEntity<FocusSessionResponse[]> agendaResponse = restTemplate.getForEntity(
                baseUrl() + "/api/focus-sessions/agenda?startDate=" + today + "&endDate=" + today.plusDays(7),
                FocusSessionResponse[].class
        );
        assertEquals(200, agendaResponse.getStatusCode().value());
        assertNotNull(agendaResponse.getBody());
    }

    @Test
    void shouldQueryFocusSessionsUsingIstCalendarBoundaries() {
        FocusSession beforeIstMidnight = new FocusSession();
        beforeIstMidnight.setUser(testUser);
        beforeIstMidnight.setName("IST Included");
        beforeIstMidnight.setDurationMinutes(25);
        beforeIstMidnight.setScheduledAt(Instant.parse("2026-10-01T18:00:00Z"));
        beforeIstMidnight.setStatus(FocusSessionStatus.SCHEDULED);

        FocusSession afterIstMidnight = new FocusSession();
        afterIstMidnight.setUser(testUser);
        afterIstMidnight.setName("IST Excluded");
        afterIstMidnight.setDurationMinutes(25);
        afterIstMidnight.setScheduledAt(Instant.parse("2026-10-01T19:00:00Z"));
        afterIstMidnight.setStatus(FocusSessionStatus.SCHEDULED);
        focusSessionRepository.saveAll(List.of(beforeIstMidnight, afterIstMidnight));

        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Timezone", "Asia/Kolkata");
        ResponseEntity<FocusSessionResponse[]> response = restTemplate.exchange(
                baseUrl() + "/api/focus-sessions/by-date?date=2026-10-01",
                HttpMethod.GET,
                new HttpEntity<>(headers),
                FocusSessionResponse[].class
        );

        assertEquals(200, response.getStatusCode().value());
        assertNotNull(response.getBody());
        assertEquals(1, response.getBody().length);
        assertEquals("IST Included", response.getBody()[0].getName());
        Instant expectedStart = LocalDate.of(2026, 10, 1)
                .atStartOfDay(ZoneId.of("Asia/Kolkata"))
                .toInstant();
        Instant expectedEnd = LocalDate.of(2026, 10, 2)
                .atStartOfDay(ZoneId.of("Asia/Kolkata"))
                .toInstant();
        assertEquals(
                Instant.parse("2026-09-30T18:30:00Z"),
                expectedStart
        );
        assertEquals(
                Instant.parse("2026-10-01T18:30:00Z"),
                expectedEnd
        );
    }

    @Test
    void shouldRejectInvalidFocusSessionTimezone() {
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Timezone", "Not/A-Timezone");
        ResponseEntity<String> response = restTemplate.exchange(
                baseUrl() + "/api/focus-sessions/by-date?date=2026-10-01",
                HttpMethod.GET,
                new HttpEntity<>(headers),
                String.class
        );

        assertEquals(400, response.getStatusCode().value());
    }

    @Test
    void shouldFetchDeviceSystemInfoAndProcesses() {
        ResponseEntity<com.shinpo.dto.TaskManagerDtos.DeviceSystemInfo> sysInfoResp = restTemplate.getForEntity(
                baseUrl() + "/api/device/system-info",
                com.shinpo.dto.TaskManagerDtos.DeviceSystemInfo.class
        );
        assertEquals(200, sysInfoResp.getStatusCode().value());
        assertNotNull(sysInfoResp.getBody());
        assertTrue(sysInfoResp.getBody().totalMemoryBytes() > 0);

        ResponseEntity<com.shinpo.dto.TaskManagerDtos.ProcessInfo[]> procResp = restTemplate.getForEntity(
                baseUrl() + "/api/device/processes",
                com.shinpo.dto.TaskManagerDtos.ProcessInfo[].class
        );
        assertEquals(200, procResp.getStatusCode().value());
        assertNotNull(procResp.getBody());
        assertTrue(procResp.getBody().length > 0);

        ResponseEntity<com.shinpo.dto.TaskManagerDtos.ProcessSnapshot> snapResp = restTemplate.getForEntity(
                baseUrl() + "/api/device/snapshot",
                com.shinpo.dto.TaskManagerDtos.ProcessSnapshot.class
        );
        assertEquals(200, snapResp.getStatusCode().value());
        assertNotNull(snapResp.getBody());
        assertTrue(snapResp.getBody().processes().size() > 0);
    }

    @Test
    void shouldPreventTerminatingProtectedSystemProcess() {
        // PID 1 is systemd / init or protected
        ResponseEntity<com.shinpo.dto.TaskManagerDtos.ProcessControlResult> result = restTemplate.postForEntity(
                baseUrl() + "/api/device/processes/1/terminate",
                null,
                com.shinpo.dto.TaskManagerDtos.ProcessControlResult.class
        );
        assertEquals(200, result.getStatusCode().value());
        assertNotNull(result.getBody());
        assertEquals("REJECTED", result.getBody().status());
        assertTrue(result.getBody().message().contains("Cannot terminate core system process 1"));
    }

    @Test
    void shouldFetchAnalyticsDashboard() {
        ResponseEntity<com.shinpo.dto.AnalyticsDtos.AnalyticsDashboardResponse> response = restTemplate.getForEntity(
                baseUrl() + "/api/analytics/dashboard",
                com.shinpo.dto.AnalyticsDtos.AnalyticsDashboardResponse.class
        );
        assertEquals(200, response.getStatusCode().value());
        assertNotNull(response.getBody());
        assertNotNull(response.getBody().summary());
        assertEquals(7, response.getBody().weeklyVelocity().size());
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