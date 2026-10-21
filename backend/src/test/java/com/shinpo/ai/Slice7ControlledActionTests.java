package com.shinpo.ai;

import com.shinpo.ai.actions.AiActionService;
import com.shinpo.ai.actions.AiActionValidator;
import com.shinpo.ai.actions.dto.AiActionDto;
import com.shinpo.ai.actions.dto.AiActionExecutionResponse;
import com.shinpo.ai.actions.dto.CreateGoalPayload;
import com.shinpo.ai.actions.dto.UpdateTaskPayload;
import com.shinpo.controller.AiActionController.ProposeActionRequest;
import com.shinpo.entity.AiAction;
import com.shinpo.entity.Goal;
import com.shinpo.entity.Mission;
import com.shinpo.entity.User;
import com.shinpo.repository.AiActionRepository;
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
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import com.shinpo.ai.tool.AiToolRegistry;
import com.shinpo.repository.FocusSessionRepository;
import com.shinpo.service.TaskManagerService;

import static org.junit.jupiter.api.Assertions.*;

@ActiveProfiles("test")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class Slice7ControlledActionTests {

    @Autowired
    private AiActionService aiActionService;

    @Autowired
    private AiActionValidator aiActionValidator;


    @Autowired
    private AiActionRepository aiActionRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private GoalRepository goalRepository;

    @Autowired
    private MissionRepository missionRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtTokenService jwtTokenService;

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private FocusSessionRepository focusSessionRepository;

    @Autowired
    private TaskManagerService taskManagerService;

    @Autowired
    private AiToolRegistry aiToolRegistry;

    private User userA;
    private User userB;

    @BeforeEach
    void setUp() {
        String suffixA = UUID.randomUUID().toString().substring(0, 8);
        userA = userRepository.save(new User(
                "userA_" + suffixA,
                "userA_" + suffixA + "@shinpo.test",
                passwordEncoder.encode("password123"),
                Instant.now()
        ));

        String suffixB = UUID.randomUUID().toString().substring(0, 8);
        userB = userRepository.save(new User(
                "userB_" + suffixB,
                "userB_" + suffixB + "@shinpo.test",
                passwordEncoder.encode("password123"),
                Instant.now()
        ));
    }

    private HttpHeaders createAuthHeaders(User user) {
        String token = jwtTokenService.generateAccessToken(UserPrincipal.create(user));
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        headers.setContentType(MediaType.APPLICATION_JSON);
        return headers;
    }

    @Test
    @DisplayName("Prohibited action types throw SecurityException immediately")
    void shouldRejectProhibitedActions() {
        List<String> prohibitedTypes = List.of(
                "DELETE_GOAL",
                "DELETE_TASK",
                "DELETE_MISSION",
                "DELETE_FOCUS_SESSION",
                "TERMINATE_PROCESS",
                "MODIFY_POLICY",
                "MODIFY_RULES",
                "OVERRIDE_SECURITY",
                "CHANGE_ENFORCEMENT_MODE"
        );

        for (String type : prohibitedTypes) {
            assertThrows(SecurityException.class, () ->
                    aiActionValidator.validateActionType(type),
                    "Expected SecurityException for prohibited type: " + type
            );
        }
    }

    @Test
    @DisplayName("Invalid action payloads throw IllegalArgumentException")
    void shouldRejectInvalidPayloads() {
        // Missing title in CREATE_GOAL
        assertThrows(IllegalArgumentException.class, () ->
                aiActionValidator.validatePayload(userA.getId(), "CREATE_GOAL", "{\"description\":\"no title\"}")
        );

        // Negative duration in CREATE_TASK
        assertThrows(IllegalArgumentException.class, () ->
                aiActionValidator.validatePayload(userA.getId(), "CREATE_TASK", "{\"title\":\"Task\",\"estimatedMinutes\":-10}")
        );
    }

    @Test
    @DisplayName("Cross-user resource ownership: Cannot mutate another user's task or goal")
    void shouldRejectCrossUserResourceTargeting() throws Exception {
        Goal goalOfB = goalRepository.save(new Goal("User B Goal", "Private", LocalDate.now(), LocalDate.now().plusMonths(1), userB));
        Mission missionOfB = missionRepository.save(new Mission("User B Mission", "Desc", LocalDate.now(), 25, goalOfB));

        // User A attempts to target User B's mission
        UpdateTaskPayload payload = new UpdateTaskPayload(missionOfB.getId(), "Hijacked Title", "Desc", 25);
        String payloadJson = objectMapper.writeValueAsString(payload);

        // Validated against user A: must throw SecurityException
        assertThrows(SecurityException.class, () ->
                aiActionValidator.validatePayload(userA.getId(), "UPDATE_TASK", payloadJson)
        );
    }

    @Test
    @DisplayName("End-to-end propose, confirm, and verify CREATE_GOAL")
    void shouldProposeAndConfirmCreateGoal() {
        CreateGoalPayload payload = new CreateGoalPayload("Ship Slice 7", "Complete EONPAI Controlled Actions", LocalDate.now().plusDays(30));

        AiActionDto proposed = aiActionService.proposeAction(
                userA.getId(),
                "CREATE_GOAL",
                "User requested goal alignment for Slice 7",
                payload
        );

        assertNotNull(proposed.actionId());
        assertEquals("PROPOSED", proposed.status());
        assertNotNull(proposed.expiresAt());

        // Confirm action
        AiActionExecutionResponse execRes = aiActionService.confirmAndExecute(proposed.actionId(), userA.getId());
        assertEquals("COMPLETED", execRes.status());
        assertNotNull(execRes.resultSummary());

        // Verify goal in repository
        List<Goal> goals = goalRepository.findAllByUser_Id(userA.getId());
        assertTrue(goals.stream().anyMatch(g -> "Ship Slice 7".equals(g.getTitle())));
    }

    @Test
    @DisplayName("Idempotency guard: Confirming an already completed action returns cached result without duplicates")
    void shouldBeIdempotentOnSubsequentConfirms() {
        CreateGoalPayload payload = new CreateGoalPayload("Unique Goal", "Desc", LocalDate.now().plusDays(10));

        AiActionDto proposed = aiActionService.proposeAction(
                userA.getId(),
                "CREATE_GOAL",
                "Idempotency test",
                payload
        );

        long initialGoalCount = goalRepository.count();

        // First execution
        AiActionExecutionResponse res1 = aiActionService.confirmAndExecute(proposed.actionId(), userA.getId());
        assertEquals("COMPLETED", res1.status());
        assertEquals(initialGoalCount + 1, goalRepository.count());

        // Second execution (replay)
        AiActionExecutionResponse res2 = aiActionService.confirmAndExecute(proposed.actionId(), userA.getId());
        assertEquals("COMPLETED", res2.status());
        assertEquals(res1.actionId(), res2.actionId());
        // Verify no duplicate goal was created
        assertEquals(initialGoalCount + 1, goalRepository.count());
    }

    @Test
    @DisplayName("Cross-user confirmation is blocked with SecurityException")
    void shouldPreventUserBFromConfirmingUserAAction() {
        CreateGoalPayload payload = new CreateGoalPayload("Secret Goal", "Desc", LocalDate.now().plusDays(5));

        AiActionDto proposed = aiActionService.proposeAction(
                userA.getId(),
                "CREATE_GOAL",
                "Cross-user test",
                payload
        );

        assertThrows(SecurityException.class, () ->
                aiActionService.confirmAndExecute(proposed.actionId(), userB.getId())
        );
    }

    @Test
    @DisplayName("Rejecting an action marks it REJECTED and forbids future execution")
    void shouldRejectActionSuccessfully() {
        CreateGoalPayload payload = new CreateGoalPayload("Discarded Goal", "Desc", LocalDate.now().plusDays(5));

        AiActionDto proposed = aiActionService.proposeAction(
                userA.getId(),
                "CREATE_GOAL",
                "Rejection test",
                payload
        );

        AiActionDto rejected = aiActionService.rejectAction(proposed.actionId(), userA.getId());
        assertEquals("REJECTED", rejected.status());

        // Attempting to confirm rejected action must fail
        assertThrows(IllegalStateException.class, () ->
                aiActionService.confirmAndExecute(proposed.actionId(), userA.getId())
        );
    }

    @Test
    @DisplayName("Expired action cannot be confirmed")
    void shouldRejectExpiredAction() {
        CreateGoalPayload payload = new CreateGoalPayload("Expired Goal", "Desc", LocalDate.now().plusDays(5));

        AiActionDto proposed = aiActionService.proposeAction(
                userA.getId(),
                "CREATE_GOAL",
                "Expired test",
                payload
        );

        // Manually expire action in DB
        AiAction actionEntity = aiActionRepository.findByActionId(proposed.actionId()).orElseThrow();
        actionEntity.setExpiresAt(Instant.now().minus(5, ChronoUnit.MINUTES));
        aiActionRepository.save(actionEntity);

        assertThrows(IllegalStateException.class, () ->
                aiActionService.confirmAndExecute(proposed.actionId(), userA.getId())
        );
    }

    @Test
    @DisplayName("REST API: Propose, Pending, and Confirm via HTTP endpoints")
    void testRestApiActionLifecycle() {
        HttpHeaders headers = createAuthHeaders(userA);

        ProposeActionRequest req = new ProposeActionRequest(
                "CREATE_GOAL",
                "Proposing goal via REST endpoint",
                Map.of("title", "HTTP Proposed Goal", "description", "Through REST API", "targetDate", LocalDate.now().plusDays(7).toString())
        );

        // 1. Propose
        ResponseEntity<AiActionDto> proposeResp = restTemplate.exchange(
                "/api/ai/actions/propose",
                HttpMethod.POST,
                new HttpEntity<>(req, headers),
                AiActionDto.class
        );
        assertEquals(HttpStatus.CREATED, proposeResp.getStatusCode());
        assertNotNull(proposeResp.getBody());
        String actionId = proposeResp.getBody().actionId();

        // 2. Pending list check
        ResponseEntity<List<AiActionDto>> pendingResp = restTemplate.exchange(
                "/api/ai/actions/pending",
                HttpMethod.GET,
                new HttpEntity<>(headers),
                new ParameterizedTypeReference<>() {}
        );
        assertEquals(HttpStatus.OK, pendingResp.getStatusCode());
        assertTrue(pendingResp.getBody().stream().anyMatch(a -> a.actionId().equals(actionId)));

        // 3. Confirm
        ResponseEntity<AiActionExecutionResponse> confirmResp = restTemplate.exchange(
                "/api/ai/actions/" + actionId + "/confirm",
                HttpMethod.POST,
                new HttpEntity<>(headers),
                AiActionExecutionResponse.class
        );
        assertEquals(HttpStatus.OK, confirmResp.getStatusCode());
        assertEquals("COMPLETED", confirmResp.getBody().status());
    }

    @Test
    @DisplayName("Concurrency protection: Simultaneous confirmation requests execute domain mutation exactly once")
    void testConcurrentConfirmationPreventsDuplicateExecution() throws Exception {
        CreateGoalPayload payload = new CreateGoalPayload("Concurrent Test Goal", "Testing race conditions", LocalDate.now().plusDays(10));
        AiActionDto proposed = aiActionService.proposeAction(
                userA.getId(),
                "CREATE_GOAL",
                "Concurrent goal proposal",
                payload
        );

        long initialGoalCount = goalRepository.findAllByUser_Id(userA.getId()).size();

        int threads = 2;
        ExecutorService executorService = Executors.newFixedThreadPool(threads);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(threads);
        List<AiActionExecutionResponse> responses = Collections.synchronizedList(new ArrayList<>());
        List<Throwable> errors = Collections.synchronizedList(new ArrayList<>());

        for (int i = 0; i < threads; i++) {
            executorService.submit(() -> {
                try {
                    startLatch.await();
                    AiActionExecutionResponse res = aiActionService.confirmAndExecute(proposed.actionId(), userA.getId());
                    responses.add(res);
                } catch (Throwable t) {
                    errors.add(t);
                } finally {
                    doneLatch.countDown();
                }
            });
        }

        startLatch.countDown();
        assertTrue(doneLatch.await(10, TimeUnit.SECONDS), "Concurrent confirmation requests timed out");
        executorService.shutdown();

        // Exactly 1 goal should be added to userA's goals
        List<Goal> currentGoals = goalRepository.findAllByUser_Id(userA.getId());
        assertEquals(initialGoalCount + 1, currentGoals.size(), "Domain mutation must occur exactly once under concurrent confirmation");

        // Both calls should either succeed with COMPLETED status
        assertTrue(errors.isEmpty(), "Unexpected errors during concurrent confirmation: " + errors);
        assertEquals(2, responses.size());
        for (AiActionExecutionResponse res : responses) {
            assertEquals("COMPLETED", res.status());
            assertEquals(proposed.actionId(), res.actionId());
        }

        // Verify persisted status in repository is COMPLETED
        AiAction persisted = aiActionRepository.findByActionId(proposed.actionId()).orElseThrow();
        assertEquals("COMPLETED", persisted.getStatus());
    }

    @Test
    @DisplayName("End-to-end proposal, confirmation, and task manager integration for CREATE_TASK")
    void testCreateTaskE2EAndAppearanceInTaskManager() {
        Goal goal = goalRepository.save(new Goal("Project Phoenix", "Key Goal", LocalDate.now(), LocalDate.now().plusMonths(1), userA));

        Map<String, Object> taskPayload = Map.of(
                "goalId", goal.getId(),
                "title", "Implement Security Filter",
                "description", "Add STOMP JWT authentication interceptor",
                "scheduledDate", LocalDate.now().plusDays(1).toString(),
                "estimatedMinutes", 45
        );

        // 1. Propose task
        AiActionDto proposed = aiActionService.proposeAction(
                userA.getId(),
                "CREATE_TASK",
                "Create task for Project Phoenix",
                taskPayload
        );
        assertNotNull(proposed.actionId());
        assertEquals("PROPOSED", proposed.status());

        // 2. Pending list check
        List<AiActionDto> pending = aiActionService.getPendingActions(userA.getId());
        assertTrue(pending.stream().anyMatch(a -> a.actionId().equals(proposed.actionId())));

        // 3. Confirm
        AiActionExecutionResponse confirmed = aiActionService.confirmAndExecute(proposed.actionId(), userA.getId());
        assertEquals("COMPLETED", confirmed.status());
        assertNotNull(confirmed.executedAt());

        // 4. Verify task exists in MissionRepository
        List<Mission> missions = missionRepository.findAllByGoal_User_Id(userA.getId());
        Mission createdMission = missions.stream()
                .filter(m -> "Implement Security Filter".equals(m.getTitle()))
                .findFirst()
                .orElse(null);
        assertNotNull(createdMission, "EONPAI-created task must be present in user's mission list");
        assertEquals("Add STOMP JWT authentication interceptor", createdMission.getDescription());
        assertEquals(45, createdMission.getEstimatedMinutes());
        assertEquals(goal.getId(), createdMission.getGoal().getId());

        // 5. Verify pending list no longer includes the confirmed action
        List<AiActionDto> pendingAfter = aiActionService.getPendingActions(userA.getId());
        assertFalse(pendingAfter.stream().anyMatch(a -> a.actionId().equals(proposed.actionId())));

        // 6. Verify recent list includes it
        List<AiActionDto> recent = aiActionService.getRecentActions(userA.getId());
        assertTrue(recent.stream().anyMatch(a -> a.actionId().equals(proposed.actionId()) && "COMPLETED".equals(a.status())));
    }

    @Test
    @DisplayName("AiToolRegistry proposal tools fail explicitly when AiActionService is unavailable")
    void testAiToolRegistryProposalToolFailsWhenServiceUnavailable() {
        // Construct tool registry without AiActionService
        AiToolRegistry unconfiguredRegistry = new AiToolRegistry(
                userRepository,
                goalRepository,
                missionRepository,
                focusSessionRepository,
                taskManagerService,
                null,
                null
        );

        var tool = unconfiguredRegistry.getTool("propose_create_task").orElseThrow();
        var result = tool.execute(userA.getId(), Map.of("goalId", 1, "title", "Test"));
        assertFalse(result.success(), "Tool execution must fail when required action service is unavailable");
        assertNotNull(result.errorMessage());
        assertTrue(result.errorMessage().contains("Action service unavailable"), "Error message must indicate service unavailable");
        assertNull(result.data(), "Must never return fake actionId preview");
    }

    @Test
    @DisplayName("AiToolRegistry proposal tools generate real persisted proposal when service is wired")
    @SuppressWarnings("unchecked")
    void testAiToolRegistryProposalToolPersistsWhenServiceWired() {
        assertNotNull(aiToolRegistry);
        var tool = aiToolRegistry.getTool("propose_create_task").orElseThrow();
        Goal goal = goalRepository.save(new Goal("Wired Goal", "Desc", LocalDate.now(), LocalDate.now().plusMonths(1), userA));

        var result = tool.execute(userA.getId(), Map.of("goalId", goal.getId(), "title", "Tool Generated Task"));
        assertTrue(result.success(), "Tool execution must succeed when action service is wired");
        Map<String, Object> data = (Map<String, Object>) result.data();
        assertEquals("PROPOSED", data.get("status"));
        String actionId = (String) data.get("actionId");
        assertNotNull(actionId);
        assertNotEquals("act_preview", actionId, "Must be a genuine persisted actionId, not act_preview");

        // Verify it was actually saved in DB
        AiAction inDb = aiActionRepository.findByActionId(actionId).orElse(null);
        assertNotNull(inDb, "Tool-generated action must be persisted in database");
        assertEquals(userA.getId(), inDb.getUser().getId());
    }

    @Test
    @DisplayName("Malformed action requests return HTTP 400 Bad Request")
    void testMalformedActionRequestsReturnBadRequest() {
        HttpHeaders headers = createAuthHeaders(userA);

        // Missing actionType
        ResponseEntity<String> resp = restTemplate.exchange(
                "/api/ai/actions/propose",
                HttpMethod.POST,
                new HttpEntity<>("{\"description\":\"Missing actionType\"}", headers),
                String.class
        );
        assertEquals(HttpStatus.BAD_REQUEST, resp.getStatusCode());
    }
}

