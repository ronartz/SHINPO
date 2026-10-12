package com.shinpo.ai;

import com.shinpo.ai.actions.AiActionExecutor;
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
import java.util.List;
import java.util.Map;
import java.util.UUID;

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
    private AiActionExecutor aiActionExecutor;

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
}

