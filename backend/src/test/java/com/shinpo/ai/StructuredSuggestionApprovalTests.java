package com.shinpo.ai;

import com.shinpo.dto.AiDtos.*;
import com.shinpo.entity.AiSuggestion;
import com.shinpo.entity.Goal;
import com.shinpo.entity.Mission;
import com.shinpo.entity.User;
import com.shinpo.repository.AiSuggestionRepository;
import com.shinpo.repository.GoalRepository;
import com.shinpo.repository.MissionRepository;
import com.shinpo.repository.UserRepository;
import com.shinpo.security.JwtTokenService;
import com.shinpo.security.UserPrincipal;
import com.shinpo.service.AiService;
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
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@ActiveProfiles("test")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class StructuredSuggestionApprovalTests {

    @Autowired
    private AiService aiService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private GoalRepository goalRepository;

    @Autowired
    private MissionRepository missionRepository;

    @Autowired
    private AiSuggestionRepository aiSuggestionRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtTokenService jwtTokenService;

    @Autowired
    private TestRestTemplate restTemplate;

    private User userA;
    private User userB;
    private Goal goalA;

    @BeforeEach
    void setUp() {
        String suffixA = UUID.randomUUID().toString().substring(0, 8);
        userA = userRepository.save(new User(
                "sugg_user_a_" + suffixA,
                "sugg_a_" + suffixA + "@shinpo.test",
                passwordEncoder.encode("secretpassA"),
                Instant.now()
        ));

        String suffixB = UUID.randomUUID().toString().substring(0, 8);
        userB = userRepository.save(new User(
                "sugg_user_b_" + suffixB,
                "sugg_b_" + suffixB + "@shinpo.test",
                passwordEncoder.encode("secretpassB"),
                Instant.now()
        ));

        goalA = goalRepository.save(new Goal(
                "Scale Core Engine",
                "Deploy distributed engine with zero latency",
                LocalDate.now(),
                LocalDate.now().plusMonths(2),
                userA
        ));
    }

    @Test
    @DisplayName("AI.4 Task 1: Goal decomposition creates an audit record and returns suggestionId")
    void testDecompositionAttachesSuggestionAuditRecord() {
        GoalDecompositionResponse decomp = aiService.decomposeGoal(goalA.getId(), userA.getId());
        assertNotNull(decomp);
        assertNotNull(decomp.suggestionId(), "Decomposition must attach a valid suggestionId");

        AiSuggestion suggestion = aiSuggestionRepository.findById(decomp.suggestionId()).orElse(null);
        assertNotNull(suggestion);
        assertEquals(userA.getId(), suggestion.getUser().getId());
        assertEquals("GOAL_DECOMPOSITION", suggestion.getSuggestionType());
        assertFalse(suggestion.getAccepted(), "Newly generated suggestion must not be accepted until approved");
        assertTrue(suggestion.getOutputPayload().contains("Map out core requirements")
                || suggestion.getOutputPayload().contains("proposedMissions"));
    }

    @Test
    @DisplayName("AI.4 Task 2: Commit suggestion transactionally creates real missions and marks accepted")
    void testCommitSuggestionPersistsMissionsAndMarksAccepted() {
        int initialMissionCount = missionRepository.findAllByGoal_User_Id(userA.getId()).size();

        GoalDecompositionResponse decomp = aiService.decomposeGoal(goalA.getId(), userA.getId());
        Long suggestionId = decomp.suggestionId();

        // Commit all proposed missions
        SuggestionCommitResponse commitResponse = aiService.commitSuggestion(suggestionId, userA.getId(), null);
        assertNotNull(commitResponse);
        assertEquals(suggestionId, commitResponse.suggestionId());
        assertEquals(goalA.getId(), commitResponse.goalId());
        assertTrue(commitResponse.committedMissionsCount() >= 3);

        // Verify missions in database
        List<Mission> currentMissions = missionRepository.findAllByGoal_User_Id(userA.getId());
        assertEquals(initialMissionCount + commitResponse.committedMissionsCount(), currentMissions.size());

        // Verify audit suggestion status
        AiSuggestion updatedSuggestion = aiSuggestionRepository.findById(suggestionId).orElseThrow();
        assertTrue(updatedSuggestion.getAccepted(), "Suggestion must be marked as accepted after commit");
    }

    @Test
    @DisplayName("AI.4 Task 3: Cross-tenant commit attack is strictly rejected with 403 Forbidden")
    void testCrossTenantCommitRejectedWithForbidden() {
        // User A generates a goal decomposition
        GoalDecompositionResponse decomp = aiService.decomposeGoal(goalA.getId(), userA.getId());
        Long suggestionId = decomp.suggestionId();

        // User B attempts to commit User A's suggestion
        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                aiService.commitSuggestion(suggestionId, userB.getId(), null)
        );

        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        assertTrue(ex.getReason().contains("Access denied"));

        // Verify suggestion was NOT marked accepted
        AiSuggestion suggestion = aiSuggestionRepository.findById(suggestionId).orElseThrow();
        assertFalse(suggestion.getAccepted());
    }

    @Test
    @DisplayName("AI.4 Task 4: Selective commit allows committing specific approved missions")
    void testCommitSpecificSelectedMissions() {
        GoalDecompositionResponse decomp = aiService.decomposeGoal(goalA.getId(), userA.getId());
        Long suggestionId = decomp.suggestionId();

        List<ProposedMission> selected = List.of(
                new ProposedMission("Focused Custom Mission A", "Description A", 35),
                new ProposedMission("Focused Custom Mission B", "Description B", 45)
        );

        SuggestionCommitRequest request = new SuggestionCommitRequest(goalA.getId(), selected);
        SuggestionCommitResponse response = aiService.commitSuggestion(suggestionId, userA.getId(), request);

        assertEquals(2, response.committedMissionsCount());
        assertEquals("Focused Custom Mission A", response.committedMissions().get(0).title());
        assertEquals(35, response.committedMissions().get(0).estimatedMinutes());
    }

    @Test
    @DisplayName("AI.4 Task 5: POST /api/ai/suggestions/{id}/commit HTTP endpoint handles authorization and mutations")
    void testCommitSuggestionViaRestEndpoint() {
        GoalDecompositionResponse decomp = aiService.decomposeGoal(goalA.getId(), userA.getId());
        Long suggestionId = decomp.suggestionId();

        // 1. Unauthenticated commit returns 401
        ResponseEntity<String> unauthResponse = restTemplate.postForEntity(
                "/api/ai/suggestions/" + suggestionId + "/commit",
                null,
                String.class
        );
        assertEquals(HttpStatus.UNAUTHORIZED, unauthResponse.getStatusCode());

        // 2. Authenticated commit for User A returns 200 with committed payload
        String tokenA = jwtTokenService.generateAccessToken(UserPrincipal.create(userA));
        HttpHeaders headersA = new HttpHeaders();
        headersA.setBearerAuth(tokenA);
        headersA.setContentType(MediaType.APPLICATION_JSON);

        HttpEntity<Void> reqA = new HttpEntity<>(headersA);
        ResponseEntity<SuggestionCommitResponse> successResponse = restTemplate.postForEntity(
                "/api/ai/suggestions/" + suggestionId + "/commit",
                reqA,
                SuggestionCommitResponse.class
        );

        assertEquals(HttpStatus.OK, successResponse.getStatusCode());
        assertNotNull(successResponse.getBody());
        assertEquals(suggestionId, successResponse.getBody().suggestionId());
        assertTrue(successResponse.getBody().committedMissionsCount() > 0);

        // 3. User B calling commit on User A's suggestion returns 403 Forbidden
        String tokenB = jwtTokenService.generateAccessToken(UserPrincipal.create(userB));
        HttpHeaders headersB = new HttpHeaders();
        headersB.setBearerAuth(tokenB);
        headersB.setContentType(MediaType.APPLICATION_JSON);

        HttpEntity<Void> reqB = new HttpEntity<>(headersB);
        ResponseEntity<String> forbiddenResponse = restTemplate.postForEntity(
                "/api/ai/suggestions/" + suggestionId + "/commit",
                reqB,
                String.class
        );

        assertEquals(HttpStatus.FORBIDDEN, forbiddenResponse.getStatusCode());
    }
}
