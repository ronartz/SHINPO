package com.shinpo.goal;

import com.shinpo.dto.CreateGoalRequest;
import com.shinpo.dto.CreateMissionRequest;
import com.shinpo.dto.GoalResponse;
import com.shinpo.dto.MissionResponse;
import com.shinpo.dto.UpdateGoalRequest;
import com.shinpo.dto.UpdateMissionRequest;
import com.shinpo.entity.User;
import com.shinpo.repository.UserRepository;
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
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
public class GoalAndMissionLifecycleTests {

    @Autowired
    private GoalService goalService;

    @Autowired
    private MissionService missionService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private User primaryUser;
    private User secondaryUser;

    @BeforeEach
    void setUp() {
        long ts = System.currentTimeMillis();
        primaryUser = userRepository.save(new User(
                "goal_user_1_" + ts,
                "user1_" + ts + "@shinpo.io",
                passwordEncoder.encode("Pass123!"),
                Instant.now()
        ));

        secondaryUser = userRepository.save(new User(
                "goal_user_2_" + ts,
                "user2_" + ts + "@shinpo.io",
                passwordEncoder.encode("Pass123!"),
                Instant.now()
        ));
    }

    @Test
    @DisplayName("Should create, retrieve, update, and delete a goal")
    void testGoalFullLifecycle() {
        // 1. Create Goal
        CreateGoalRequest createReq = new CreateGoalRequest(
                primaryUser.getId(),
                "Master Rust & Systems Programming",
                "Deep dive into memory safety, async runtimes, and Linux eBPF",
                LocalDate.of(2026, 1, 1),
                LocalDate.of(2026, 12, 31)
        );
        GoalResponse created = goalService.createGoal(primaryUser.getId(), createReq);
        assertNotNull(created.id());
        assertEquals("Master Rust & Systems Programming", created.title());
        assertEquals("ACTIVE", created.status());

        // 2. Retrieve Goal by ID & in list
        GoalResponse fetched = goalService.getGoal(created.id(), primaryUser.getId());
        assertEquals(created.id(), fetched.id());
        assertEquals(created.title(), fetched.title());

        List<GoalResponse> userGoals = goalService.getGoalsForUser(primaryUser.getId());
        assertEquals(1, userGoals.size());
        assertEquals(created.id(), userGoals.get(0).id());

        // 3. Update Goal
        UpdateGoalRequest updateReq = new UpdateGoalRequest(
                "Master Rust & Linux Kernel Engineering",
                "Updated description: focusing on eBPF, XDP, and high-performance daemons",
                LocalDate.of(2026, 1, 1),
                LocalDate.of(2026, 6, 30),
                "COMPLETED"
        );
        GoalResponse updated = goalService.updateGoal(created.id(), primaryUser.getId(), updateReq);
        assertEquals("Master Rust & Linux Kernel Engineering", updated.title());
        assertEquals("COMPLETED", updated.status());
        assertEquals(LocalDate.of(2026, 6, 30), updated.targetDate());

        // 4. Delete Goal
        goalService.deleteGoal(created.id(), primaryUser.getId());
        assertThrows(ResponseStatusException.class, () -> goalService.getGoal(created.id(), primaryUser.getId()));
    }

    @Test
    @DisplayName("Should enforce user isolation boundary on Goal operations")
    void testGoalCrossUserBoundary() {
        GoalResponse goal = goalService.createGoal(
                primaryUser.getId(),
                new CreateGoalRequest(
                        primaryUser.getId(),
                        "Private Alpha Project",
                        "Confidential roadmap",
                        LocalDate.now(),
                        LocalDate.now().plusMonths(3)
                )
        );

        // Secondary user cannot retrieve primary user's goal
        assertThrows(ResponseStatusException.class, () -> goalService.getGoal(goal.id(), secondaryUser.getId()));

        // Secondary user cannot update primary user's goal
        UpdateGoalRequest updateReq = new UpdateGoalRequest(
                "Hijacked Goal",
                "Malicious overwrite",
                LocalDate.now(),
                LocalDate.now(),
                "ACTIVE"
        );
        assertThrows(ResponseStatusException.class, () -> goalService.updateGoal(goal.id(), secondaryUser.getId(), updateReq));

        // Secondary user cannot delete primary user's goal
        assertThrows(ResponseStatusException.class, () -> goalService.deleteGoal(goal.id(), secondaryUser.getId()));

        // Primary user can still retrieve it untouched
        GoalResponse safe = goalService.getGoal(goal.id(), primaryUser.getId());
        assertEquals("Private Alpha Project", safe.title());
    }

    @Test
    @DisplayName("Should create, retrieve, update, and reassign a Mission")
    void testMissionFullLifecycle() {
        GoalResponse goal1 = goalService.createGoal(
                primaryUser.getId(),
                new CreateGoalRequest(
                        primaryUser.getId(),
                        "Launch SHINPO V1",
                        "Ship personal execution OS",
                        LocalDate.now(),
                        LocalDate.now().plusMonths(1)
                )
        );

        GoalResponse goal2 = goalService.createGoal(
                primaryUser.getId(),
                new CreateGoalRequest(
                        primaryUser.getId(),
                        "Scale Infrastructure",
                        "High availability cluster",
                        LocalDate.now(),
                        LocalDate.now().plusMonths(2)
                )
        );

        // 1. Create Mission
        CreateMissionRequest missionReq = new CreateMissionRequest(
                goal1.id(),
                "Implement WFP Network Filter",
                "Research windows filtering platform driver hooks",
                LocalDate.now(),
                60
        );
        MissionResponse createdMission = missionService.createMission(primaryUser.getId(), missionReq);
        assertNotNull(createdMission.id());
        assertEquals("Implement WFP Network Filter", createdMission.title());
        assertEquals(goal1.id(), createdMission.goalId());
        assertEquals("PENDING", createdMission.status());

        // 2. Retrieve Mission
        MissionResponse fetched = missionService.getMission(createdMission.id(), primaryUser.getId());
        assertEquals(createdMission.id(), fetched.id());
        assertEquals(60, fetched.estimatedMinutes());

        // 3. Update Mission and Reassign to Goal 2
        UpdateMissionRequest updateReq = new UpdateMissionRequest(
                goal2.id(),
                "Implement WFP Network Filter & Telemetry Sync",
                "Updated details: complete socket interceptor and sync pipeline",
                LocalDate.now().plusDays(1),
                90,
                "IN_PROGRESS"
        );
        MissionResponse updated = missionService.updateMission(createdMission.id(), primaryUser.getId(), updateReq);
        assertEquals("Implement WFP Network Filter & Telemetry Sync", updated.title());
        assertEquals(goal2.id(), updated.goalId());
        assertEquals(90, updated.estimatedMinutes());
        assertEquals("IN_PROGRESS", updated.status());

        // 4. Delete Mission
        missionService.deleteMission(createdMission.id(), primaryUser.getId());
        assertThrows(ResponseStatusException.class, () -> missionService.getMission(createdMission.id(), primaryUser.getId()));
    }

    @Test
    @DisplayName("Should enforce user isolation boundary on Mission operations")
    void testMissionCrossUserBoundary() {
        GoalResponse user1Goal = goalService.createGoal(
                primaryUser.getId(),
                new CreateGoalRequest(primaryUser.getId(), "User 1 Goal", "Desc", LocalDate.now(), null)
        );

        GoalResponse user2Goal = goalService.createGoal(
                secondaryUser.getId(),
                new CreateGoalRequest(secondaryUser.getId(), "User 2 Goal", "Desc", LocalDate.now(), null)
        );

        // Secondary user cannot create mission under primary user's goal
        assertThrows(ResponseStatusException.class, () -> missionService.createMission(
                secondaryUser.getId(),
                new CreateMissionRequest(user1Goal.id(), "Unauthorized Mission", "Desc", LocalDate.now(), 30)
        ));

        // Create mission for User 1
        MissionResponse mission = missionService.createMission(
                primaryUser.getId(),
                new CreateMissionRequest(user1Goal.id(), "User 1 Mission", "Desc", LocalDate.now(), 45)
        );

        // Secondary user cannot read, update, or delete User 1's mission
        assertThrows(ResponseStatusException.class, () -> missionService.getMission(mission.id(), secondaryUser.getId()));

        UpdateMissionRequest updateReq = new UpdateMissionRequest(
                user1Goal.id(), "Hacked Mission", "Desc", LocalDate.now(), 15, "CANCELLED"
        );
        assertThrows(ResponseStatusException.class, () -> missionService.updateMission(mission.id(), secondaryUser.getId(), updateReq));

        assertThrows(ResponseStatusException.class, () -> missionService.deleteMission(mission.id(), secondaryUser.getId()));

        // User 1 cannot reassign their mission to User 2's goal
        UpdateMissionRequest reassignToOtherUserGoal = new UpdateMissionRequest(
                user2Goal.id(), "Reassigned Mission", "Desc", LocalDate.now(), 45, "PENDING"
        );
        assertThrows(ResponseStatusException.class, () -> missionService.updateMission(mission.id(), primaryUser.getId(), reassignToOtherUserGoal));
    }
}
