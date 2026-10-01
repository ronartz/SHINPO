package com.shinpo.ai;

import com.shinpo.dto.AiDtos.ExecutiveBriefingResponse;
import com.shinpo.dto.CreateGoalRequest;
import com.shinpo.dto.CreateMissionRequest;
import com.shinpo.entity.User;
import com.shinpo.repository.UserRepository;
import com.shinpo.service.AiService;
import com.shinpo.service.GoalService;
import com.shinpo.service.MissionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
public class ExecutiveBriefingTests {

    @Autowired
    private AiService aiService;

    @Autowired
    private GoalService goalService;

    @Autowired
    private MissionService missionService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private User testUser;

    @BeforeEach
    void setUp() {
        long ts = System.currentTimeMillis();
        testUser = userRepository.save(new User(
                "briefing_user_" + ts,
                "briefing_" + ts + "@shinpo.io",
                passwordEncoder.encode("Pass123!"),
                Instant.now()
        ));
    }

    @Test
    @DisplayName("Should generate initial executive briefing with zero goals and missions")
    void testInitialBriefingEmptyState() {
        ExecutiveBriefingResponse briefing = aiService.generateExecutiveBriefing(testUser.getId());
        assertNotNull(briefing);
        assertNotNull(briefing.executiveHeadline());
        assertNotNull(briefing.tacticalSummary());
        assertNotNull(briefing.primaryRecommendation());
        assertEquals(0, briefing.activeGoalsCount());
        assertEquals(0, briefing.pendingMissionsCount());
        assertEquals(0, briefing.completedMissionsCount());
        assertEquals("SECURE", briefing.sentinelThreatPosture());
        assertFalse(briefing.keyActionItems().isEmpty());
    }

    @Test
    @DisplayName("Should generate executive briefing synthesizing goals, missions, and action items")
    void testBriefingWithActiveGoalsAndMissions() {
        var goal = goalService.createGoal(
                testUser.getId(),
                new CreateGoalRequest(
                        testUser.getId(),
                        "Strategic Initiative Alpha",
                        "High priority quarterly goal",
                        LocalDate.now(),
                        LocalDate.now().plusMonths(1)
                )
        );

        missionService.createMission(
                testUser.getId(),
                new CreateMissionRequest(
                        goal.id(),
                        "Compile Kernel Drivers",
                        "Build native eBPF probe",
                        LocalDate.now(),
                        45
                )
        );

        ExecutiveBriefingResponse briefing = aiService.generateExecutiveBriefing(testUser.getId());
        assertNotNull(briefing);
        assertEquals(1, briefing.activeGoalsCount());
        assertEquals(1, briefing.pendingMissionsCount());
        assertEquals(0, briefing.completedMissionsCount());
        assertTrue(briefing.primaryRecommendation().contains("Compile Kernel Drivers"));
        assertEquals("SECURE", briefing.sentinelThreatPosture());
    }
}
