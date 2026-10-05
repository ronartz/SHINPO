package com.shinpo.ai;

import com.shinpo.ai.orchestrator.AiGateway;
import com.shinpo.dto.AiDtos.*;
import com.shinpo.service.AiService;
import com.shinpo.entity.FocusSession;
import com.shinpo.entity.FocusSessionStatus;
import com.shinpo.entity.Goal;
import com.shinpo.entity.Mission;
import com.shinpo.entity.User;
import com.shinpo.repository.AiSuggestionRepository;
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
import org.springframework.http.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@ActiveProfiles("test")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class AdaptivePlanningTests {

    @Autowired
    private AiGateway aiGateway;

    @Autowired
    private AiService aiService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private GoalRepository goalRepository;

    @Autowired
    private MissionRepository missionRepository;

    @Autowired
    private FocusSessionRepository focusSessionRepository;

    @Autowired
    private AiSuggestionRepository aiSuggestionRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtTokenService jwtTokenService;

    @Autowired
    private TestRestTemplate restTemplate;

    private User testUser;
    private Goal testGoal;
    private String jwtToken;

    @BeforeEach
    void setUp() {
        focusSessionRepository.deleteAll();
        aiSuggestionRepository.deleteAll();
        missionRepository.deleteAll();
        goalRepository.deleteAll();
        userRepository.deleteAll();

        String suffix = UUID.randomUUID().toString().substring(0, 8);
        testUser = userRepository.save(new User(
                "pilot_" + suffix,
                "pilot_" + suffix + "@shinpo.io",
                passwordEncoder.encode("SecretPass123!"),
                Instant.now()
        ));

        jwtToken = jwtTokenService.generateAccessToken(UserPrincipal.create(testUser));

        testGoal = goalRepository.save(new Goal(
                "Master Distributed Systems",
                "Deep study and implementation",
                LocalDate.now(),
                LocalDate.now().plusMonths(2),
                testUser
        ));

        Mission m1 = new Mission("Implement Raft Leader Election", "Write heartbeat loop", LocalDate.now(), 30, testGoal);
        Mission m2 = new Mission("Log Compaction Engine", "Snapshotting mechanism", LocalDate.now(), 45, testGoal);
        Mission m3 = new Mission("Chaos Engineering Tests", "Simulate network partitions", LocalDate.now(), 25, testGoal);
        missionRepository.saveAll(List.of(m1, m2, m3));
    }

    @Test
    @DisplayName("Adaptive Planning: generates circadian energy windows with restorative micro-breaks")
    void testCircadianEnergyWindowsAndPacing() {
        DailyPlanResponse plan = aiGateway.getDailyPlan(testUser.getId());

        assertNotNull(plan);
        assertNotNull(plan.planItems());
        assertFalse(plan.planItems().isEmpty());
        assertTrue(plan.totalPlannedMinutes() > 0);
        assertTrue(plan.totalFocusMinutes() > 0);

        // Verify circadian windows are assigned
        boolean hasDeepFocus = plan.planItems().stream().anyMatch(i -> "DEEP_FOCUS".equals(i.energyWindow()));
        boolean hasRestorativeBreak = plan.planItems().stream().anyMatch(item -> item != null && Boolean.TRUE.equals(item.isRestorativeBreak()));

        assertTrue(hasDeepFocus, "Must contain at least one DEEP_FOCUS block");
        assertTrue(hasRestorativeBreak, "Must insert non-screen restorative micro-breaks between sprints");
    }

    @Test
    @DisplayName("Adaptive Planning: calibrates sprint durations using historical estimation bias")
    void testEstimationBiasCalibration() {
        // Create 3 historical sessions with intentional overrun (planned 20m, actual 40m = +100% overrun)
        Instant now = Instant.now();
        for (int i = 0; i < 3; i++) {
            FocusSession session = new FocusSession();
            session.setUser(testUser);
            session.setName("Past Sprint " + i);
            session.setIntention("Calibration baseline");
            session.setDurationMinutes(20);
            session.setStatus(FocusSessionStatus.COMPLETED);
            session.setStartedAt(now.minus(i + 1, ChronoUnit.DAYS));
            session.setEndedAt(now.minus(i + 1, ChronoUnit.DAYS).plus(40, ChronoUnit.MINUTES));
            session.setAccumulatedPausedSeconds(0L);
            focusSessionRepository.save(session);
        }

        DailyPlanResponse plan = aiGateway.getDailyPlan(testUser.getId());

        assertNotNull(plan);
        assertTrue(plan.userEstimationBiasPct() > 0, "Estimation bias must detect historical overruns");
        // Verify durations were scaled up
        DailyPlanItem firstFocus = plan.planItems().stream()
                .filter(i -> !i.isRestorativeBreak())
                .findFirst()
                .orElseThrow();

        assertTrue(firstFocus.biasCorrectionFactor() > 1.0, "Bias correction factor must scale up durations");
        assertTrue(firstFocus.durationMinutes() >= firstFocus.originalEstimatedMinutes(),
                "Calibrated duration must account for historical underestimation");
    }

    @Test
    @DisplayName("Adaptive Planning: detects schedule conflicts and automatically offsets with 10m buffers")
    void testScheduleConflictResolution() {
        // Create an already scheduled focus session overlapping with the 9:00 AM circadian window
        ZoneId userZone = ZoneId.of("Asia/Kolkata");
        Instant scheduledStart = LocalDate.now(userZone).atTime(9, 15).atZone(userZone).toInstant();
        FocusSession existing = new FocusSession();
        existing.setUser(testUser);
        existing.setName("Client Alignment Sync");
        existing.setIntention("Review architecture diagram");
        existing.setDurationMinutes(30);
        existing.setScheduledAt(scheduledStart);
        existing.setStatus(FocusSessionStatus.SCHEDULED);
        existing.setAccumulatedPausedSeconds(0L);
        focusSessionRepository.save(existing);

        DailyPlanResponse plan = aiGateway.getDailyPlan(testUser.getId(), userZone);

        assertNotNull(plan);
        // Verify conflict detection triggered
        assertTrue(plan.hasConflictsResolved(), "Must flag conflicts as resolved");
    }

    @Test
    @DisplayName("Adaptive Planning: POST /api/ai/daily-plan/commit batches sessions into database")
    void testCommitDailyPlanEndpoint() {
        DailyPlanResponse plan = aiGateway.getDailyPlan(testUser.getId());
        assertNotNull(plan.suggestionId());

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(jwtToken);
        headers.set("X-Timezone", "Asia/Kolkata");

        CommitDailyPlanRequest commitReq = new CommitDailyPlanRequest(plan.suggestionId(), null);
        HttpEntity<CommitDailyPlanRequest> requestEntity = new HttpEntity<>(commitReq, headers);

        ResponseEntity<CommitDailyPlanResponse> response = restTemplate.postForEntity(
                "/api/ai/daily-plan/commit",
                requestEntity,
                CommitDailyPlanResponse.class
        );

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertTrue(response.getBody().scheduledSessionsCount() > 0);
        assertFalse(response.getBody().createdSessionIds().isEmpty());

        // Verify focus sessions exist in database with SCHEDULED status
        List<FocusSession> scheduledSessions = focusSessionRepository.findAllByUser_IdAndStatus(
                testUser.getId(), FocusSessionStatus.SCHEDULED
        );
        assertFalse(scheduledSessions.isEmpty());
        assertEquals(response.getBody().scheduledSessionsCount(), scheduledSessions.size());
    }

    @Test
    @DisplayName("Adaptive Planning: schedules HH:mm using the user's Asia/Kolkata calendar date")
    void testCommitDailyPlanUsesRequestedTimezone() {
        ZoneId zone = ZoneId.of("Asia/Kolkata");
        ZonedDateTime target = ZonedDateTime.now(zone).withHour(23).withMinute(59).withSecond(0).withNano(0);
        DailyPlanItem item = new DailyPlanItem(
                null, "Timezone boundary session", "Timezone boundary", 25, "HIGH",
                target.toLocalTime().toString(), null, "TACTICAL_SPRINT", 25, 1.0, false, testGoal.getId()
        );

        aiService.commitDailyPlan(
                testUser.getId(),
                new CommitDailyPlanRequest(null, List.of(item)),
                zone
        );

        FocusSession scheduled = focusSessionRepository.findAllByUser_IdAndStatus(
                testUser.getId(), FocusSessionStatus.SCHEDULED
        ).stream().findFirst().orElseThrow();
        assertEquals(target.toInstant(), scheduled.getScheduledAt());
    }

    @Test
    @DisplayName("Adaptive Planning: typo-tolerant chat intent returns PLANNER with DailyPlan card")
    void testTypoTolerantChatResolvesDailyPlan() {
        String[] typoQueries = new String[] {
                "plan my day",
                "scheudle today",
                "organize my day",
                "daily agenda"
        };

        for (String q : typoQueries) {
            AiChatRequest req = new AiChatRequest(testUser.getId(), q, null, null, null, null);
            AiChatResponse res = aiGateway.processChat(req);

            assertNotNull(res);
            assertEquals("PLANNER", res.suggestionType(), "Query '" + q + "' must resolve to PLANNER intent");
            assertNotNull(res.structuredCard(), "Must contain DailyPlan structured card");
            assertTrue(res.structuredCard() instanceof DailyPlanResponse);
        }
    }
}
