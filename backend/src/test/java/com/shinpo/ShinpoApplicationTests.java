package com.shinpo;

import com.shinpo.dto.FocusSessionResponse;
import com.shinpo.entity.Goal;
import com.shinpo.entity.Mission;
import com.shinpo.entity.User;
import com.shinpo.repository.FocusSessionRepository;
import com.shinpo.repository.GoalRepository;
import com.shinpo.repository.MissionRepository;
import com.shinpo.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.http.ResponseEntity;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

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

    private User testUser;
    private Goal testGoal;
    private Mission testMission;

    @BeforeEach
    void setUp() {
        focusSessionRepository.deleteAll();
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

        assertEquals(
                201,
                response.getStatusCode().value()
        );

        FocusSessionResponse body =
                response.getBody();

        assertNotNull(body);

        assertEquals(
                testUser.getId(),
                body.getUserId()
        );

        assertEquals(
                testGoal.getId(),
                body.getGoalId()
        );

        assertEquals(
                testMission.getId(),
                body.getMissionId()
        );

        assertEquals(
                "Test Focus Session",
                body.getName()
        );

        assertEquals(
                60,
                body.getDurationMinutes()
        );

        assertEquals(
                "SCHEDULED",
                body.getStatus().name()
        );
    }

    @Test
    void shouldStartFocusSession() {
        Long sessionId = createFocusSessionId();

        ResponseEntity<FocusSessionResponse> response =
                postLifecycleAction(
                        sessionId,
                        "/start"
                );

        assertEquals(
                200,
                response.getStatusCode().value()
        );

        FocusSessionResponse body =
                response.getBody();

        assertNotNull(body);

        assertEquals(
                "ACTIVE",
                body.getStatus().name()
        );

        assertNotNull(
                body.getStartedAt()
        );
    }

    @Test
    void shouldPauseAndResumeFocusSession() {
        Long sessionId = createFocusSessionId();

        ResponseEntity<FocusSessionResponse> startResponse =
                postLifecycleAction(
                        sessionId,
                        "/start"
                );

        assertEquals(
                200,
                startResponse.getStatusCode().value()
        );

        assertEquals(
                "ACTIVE",
                startResponse.getBody().getStatus().name()
        );

        ResponseEntity<FocusSessionResponse> pauseResponse =
                postLifecycleAction(
                        sessionId,
                        "/pause"
                );

        assertEquals(
                200,
                pauseResponse.getStatusCode().value()
        );

        assertEquals(
                "PAUSED",
                pauseResponse.getBody().getStatus().name()
        );

        ResponseEntity<FocusSessionResponse> resumeResponse =
                postLifecycleAction(
                        sessionId,
                        "/resume"
                );

        assertEquals(
                200,
                resumeResponse.getStatusCode().value()
        );

        assertEquals(
                "ACTIVE",
                resumeResponse.getBody().getStatus().name()
        );
    }

    @Test
    void shouldCompleteFocusSession() {
        Long sessionId = createFocusSessionId();

        ResponseEntity<FocusSessionResponse> startResponse =
                postLifecycleAction(
                        sessionId,
                        "/start"
                );

        assertEquals(
                200,
                startResponse.getStatusCode().value()
        );

        assertEquals(
                "ACTIVE",
                startResponse.getBody().getStatus().name()
        );

        ResponseEntity<FocusSessionResponse> completeResponse =
                postLifecycleAction(
                        sessionId,
                        "/complete"
                );

        assertEquals(
                200,
                completeResponse.getStatusCode().value()
        );

        FocusSessionResponse body =
                completeResponse.getBody();

        assertNotNull(body);

        assertEquals(
                "COMPLETED",
                body.getStatus().name()
        );

        assertNotNull(
                body.getEndedAt()
        );
    }

    @Test
    void shouldRejectStartingCompletedSession() {
        Long sessionId = createFocusSessionId();

        ResponseEntity<FocusSessionResponse> startResponse =
                postLifecycleAction(
                        sessionId,
                        "/start"
                );

        assertEquals(
                200,
                startResponse.getStatusCode().value()
        );

        ResponseEntity<FocusSessionResponse> completeResponse =
                postLifecycleAction(
                        sessionId,
                        "/complete"
                );

        assertEquals(
                200,
                completeResponse.getStatusCode().value()
        );

        assertEquals(
                "COMPLETED",
                completeResponse.getBody().getStatus().name()
        );

        ResponseEntity<String> secondStartResponse =
                restTemplate.postForEntity(
                        lifecycleUrl(
                                sessionId,
                                "/start"
                        ),
                        null,
                        String.class
                );

        assertEquals(
                409,
                secondStartResponse.getStatusCode().value()
        );

        assertNotNull(
                secondStartResponse.getBody()
        );

        assertEquals(
                true,
                secondStartResponse
                        .getBody()
                        .contains("INVALID_STATE_TRANSITION")
        );
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
                        sessionUrl(
                                sessionId,
                                otherUser.getId()
                        ),
                        String.class
                );

        assertEquals(
                404,
                response.getStatusCode().value()
        );
    }

    @Test
    void shouldReturnNotFoundForMissingSession() {
        ResponseEntity<String> response =
                restTemplate.getForEntity(
                        sessionUrl(
                                999999L,
                                testUser.getId()
                        ),
                        String.class
                );

        assertEquals(
                404,
                response.getStatusCode().value()
        );
    }

    private ResponseEntity<FocusSessionResponse> createFocusSession() {
        Map<String, Object> requestBody = Map.of(
                "userId",
                testUser.getId(),

                "goalId",
                testGoal.getId(),

                "missionId",
                testMission.getId(),

                "name",
                "Test Focus Session",

                "intention",
                "Complete the test mission without distractions",

                "durationMinutes",
                60
        );

        return restTemplate.postForEntity(
                baseUrl() + "/api/focus-sessions",
                requestBody,
                FocusSessionResponse.class
        );
    }

    private Long createFocusSessionId() {
        ResponseEntity<FocusSessionResponse> response =
                createFocusSession();

        assertEquals(
                201,
                response.getStatusCode().value()
        );

        FocusSessionResponse body =
                response.getBody();

        assertNotNull(body);
        assertNotNull(body.getId());

        return body.getId();
    }

    private ResponseEntity<FocusSessionResponse> postLifecycleAction(
            Long sessionId,
            String action
    ) {
        return restTemplate.postForEntity(
                lifecycleUrl(
                        sessionId,
                        action
                ),
                null,
                FocusSessionResponse.class
        );
    }

    private String baseUrl() {
        return "http://localhost:" + port;
    }

    private String lifecycleUrl(
            Long sessionId,
            String action
    ) {
        return baseUrl()
                + "/api/focus-sessions/"
                + sessionId
                + action
                + "?userId="
                + testUser.getId();
    }

    private String sessionUrl(
            Long sessionId,
            Long userId
    ) {
        return baseUrl()
                + "/api/focus-sessions/"
                + sessionId
                + "?userId="
                + userId;
    }
}