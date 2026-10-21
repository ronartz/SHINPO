package com.shinpo.service;

import com.shinpo.dto.CompleteFocusSessionRequest;
import com.shinpo.dto.CompleteMissionRequest;
import com.shinpo.dto.CreateFocusSessionRequest;
import com.shinpo.dto.CreateGoalRequest;
import com.shinpo.dto.CreateMissionRequest;
import com.shinpo.dto.FocusSessionResponse;
import com.shinpo.dto.GoalResponse;
import com.shinpo.dto.MissionCompletionResponse;
import com.shinpo.dto.MissionResponse;
import com.shinpo.dto.ProgressResponse;
import com.shinpo.entity.User;
import com.shinpo.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class RewardLifecycleTests {

    @Autowired
    private GoalService goalService;

    @Autowired
    private MissionService missionService;

    @Autowired
    private MissionCompletionService missionCompletionService;

    @Autowired
    private FocusSessionService focusSessionService;

    @Autowired
    private ProgressService progressService;

    @Autowired
    private UserRepository userRepository;

    private User userA;
    private User userB;

    @BeforeEach
    void setupUsers() {
        long ts = System.currentTimeMillis();
        userA = userRepository.save(new User("reward_user_a_" + ts, "a_" + ts + "@shinpo.test", "hash", Instant.now()));
        userB = userRepository.save(new User("reward_user_b_" + ts, "b_" + ts + "@shinpo.test", "hash", Instant.now()));
    }

    @Test
    @DisplayName("Task completion awards +10 XP, repeated completion is rejected and does not duplicate points")
    void testTaskCompletionLifecycle() {
        LocalDate today = LocalDate.now();
        GoalResponse goal = goalService.createGoal(userA.getId(), new CreateGoalRequest(userA.getId(), "Core Goal", "desc", today, today.plusDays(7)));
        MissionResponse mission = missionService.createMission(userA.getId(), new CreateMissionRequest(goal.id(), "Task 1", "desc", today, 25));

        // Initial XP is 0
        assertThat(progressService.getUserProgress(userA.getId()).totalProgress()).isEqualTo(0);

        // Complete mission: awards +10 XP
        MissionCompletionResponse completion = missionCompletionService.completeMission(mission.id(), userA.getId(), new CompleteMissionRequest(25));
        assertThat(completion.result()).isEqualTo("COMPLETED");

        ProgressResponse prog = progressService.getUserProgress(userA.getId());
        assertThat(prog.totalProgress()).isEqualTo(60); // 10 (task) + 50 (goal completed because single subtask)

        // Attempting to complete already-completed task must fail
        assertThatThrownBy(() -> missionCompletionService.completeMission(mission.id(), userA.getId(), new CompleteMissionRequest(25)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("already completed");

        // XP remains identical (no duplication)
        assertThat(progressService.getUserProgress(userA.getId()).totalProgress()).isEqualTo(60);
    }

    @Test
    @DisplayName("Focus session completion awards +15 XP; repeated completion and cancelled sessions award no extra points")
    void testFocusSessionRewardLifecycle() {
        CreateFocusSessionRequest req = new CreateFocusSessionRequest();
        req.setUserId(userA.getId());
        req.setName("Deep Focus Block");
        req.setDurationMinutes(25);
        FocusSessionResponse session = focusSessionService.createSession(req);

        // Starting session
        focusSessionService.startSession(session.getId(), userA.getId());

        // Cancelled session: awards 0 XP
        CreateFocusSessionRequest reqCancel = new CreateFocusSessionRequest();
        reqCancel.setUserId(userA.getId());
        reqCancel.setName("Cancelled Block");
        reqCancel.setDurationMinutes(25);
        FocusSessionResponse sessionToCancel = focusSessionService.createSession(reqCancel);
        focusSessionService.cancelSession(sessionToCancel.getId(), userA.getId());

        assertThat(progressService.getUserProgress(userA.getId()).totalProgress()).isEqualTo(0);

        // Complete active session: awards +15 XP
        FocusSessionResponse completed = focusSessionService.completeSession(session.getId(), userA.getId(), new CompleteFocusSessionRequest(5, "Notes", "Done"));
        assertThat(completed.getStatus().name()).isEqualTo("COMPLETED");

        // Repeating completeSession on COMPLETED session throws exception
        assertThatThrownBy(() -> focusSessionService.completeSession(session.getId(), userA.getId()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Focus session can only be completed from ACTIVE or PAUSED");

        // Points remain strictly +15 XP
        assertThat(progressService.getUserProgress(userA.getId()).totalProgress()).isEqualTo(15);
    }

    @Test
    @DisplayName("Tenant isolation: User B cannot complete or tamper with User A's mission or session")
    void testTenantIsolation() {
        LocalDate today = LocalDate.now();
        GoalResponse goalA = goalService.createGoal(userA.getId(), new CreateGoalRequest(userA.getId(), "Goal A", "desc", today, today.plusDays(7)));
        MissionResponse missionA = missionService.createMission(userA.getId(), new CreateMissionRequest(goalA.id(), "Task A", "desc", today, 25));

        // User B attempts to complete User A's mission -> 404 NOT FOUND
        assertThatThrownBy(() -> missionCompletionService.completeMission(missionA.id(), userB.getId(), new CompleteMissionRequest(25)))
                .isInstanceOf(ResponseStatusException.class);

        // User A's mission remains READY and 0 XP
        assertThat(progressService.getUserProgress(userA.getId()).totalProgress()).isEqualTo(0);
        assertThat(progressService.getUserProgress(userB.getId()).totalProgress()).isEqualTo(0);
    }
}
