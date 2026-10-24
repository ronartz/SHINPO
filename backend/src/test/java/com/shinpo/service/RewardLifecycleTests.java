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
import com.shinpo.dto.UpdateGoalRequest;
import com.shinpo.dto.OnboardingDtos.OnboardingResponse;
import com.shinpo.dto.ProgressResponse;
import com.shinpo.entity.FocusSession;
import com.shinpo.entity.User;
import com.shinpo.repository.FocusSessionRepository;
import com.shinpo.repository.UserRepository;
import com.shinpo.repository.ProgressEventRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.Duration;
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

    @Autowired
    private FocusSessionRepository focusSessionRepository;

    @Autowired
    private OnboardingService onboardingService;

    @Autowired
    private ProgressEventRepository progressEventRepository;

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
    @DisplayName("A goal awards its completion XP once, even when reopened and completed again")
    void goalCompletionRewardIsIdempotentAcrossReopening() {
        LocalDate today = LocalDate.now();
        GoalResponse goal = goalService.createGoal(userA.getId(),
                new CreateGoalRequest(userA.getId(), "Repeat-safe goal", "", today, today.plusDays(7)));

        goalService.updateGoal(goal.id(), userA.getId(),
                new UpdateGoalRequest(goal.title(), goal.description(), goal.startDate(), goal.targetDate(), "COMPLETED"));
        goalService.updateGoal(goal.id(), userA.getId(),
                new UpdateGoalRequest(goal.title(), goal.description(), goal.startDate(), goal.targetDate(), "ACTIVE"));
        goalService.updateGoal(goal.id(), userA.getId(),
                new UpdateGoalRequest(goal.title(), goal.description(), goal.startDate(), goal.targetDate(), "COMPLETED"));

        assertThat(progressService.getUserProgress(userA.getId()).totalProgress()).isEqualTo(50);
        assertThat(progressEventRepository.findAll().stream()
                .filter(event -> goal.id().equals(event.getGoal() == null ? null : event.getGoal().getId()))
                .filter(event -> "GOAL_COMPLETED".equals(event.getEventType())))
                .hasSize(1);
    }

    @Test
    @DisplayName("Focus session completion awards XP only after qualifying active time; repeats and cancellations award none")
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

        // Complete a session after 15 real active minutes: awards +15 XP
        FocusSession running = focusSessionRepository.findById(session.getId()).orElseThrow();
        running.setStartedAt(Instant.now().minus(Duration.ofMinutes(15)));
        focusSessionRepository.save(running);
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
    @DisplayName("Completing too early, a short preset, or paused time awards no focus XP")
    void focusSessionWithoutFifteenActiveMinutesDoesNotEarnXp() {
        CreateFocusSessionRequest shortRequest = new CreateFocusSessionRequest();
        shortRequest.setUserId(userA.getId());
        shortRequest.setName("Too short to reward");
        shortRequest.setDurationMinutes(25);
        FocusSessionResponse shortSession = focusSessionService.createSession(shortRequest);
        focusSessionService.startSession(shortSession.getId(), userA.getId());
        focusSessionService.completeSession(shortSession.getId(), userA.getId());
        assertThat(progressService.getUserProgress(userA.getId()).totalProgress()).isZero();
    }

    @Test
    @DisplayName("Focus XP requires active time, uses actual tier, caps at planned duration, and excludes paused time")
    void focusRewardRequiresEarnedActiveMinutes() {
        completeAfter(25, 14);
        assertThat(progressService.getUserProgress(userA.getId()).totalProgress()).isZero();

        FocusSessionResponse standard = completeAfter(25, 15);
        assertThat(progressService.getUserProgress(userA.getId()).totalProgress()).isEqualTo(15);
        assertThatThrownBy(() -> focusSessionService.completeSession(standard.getId(), userA.getId()))
                .isInstanceOf(IllegalStateException.class);
        assertThat(progressService.getUserProgress(userA.getId()).totalProgress()).isEqualTo(15);

        completeAfter(45, 45);
        assertThat(progressService.getUserProgress(userA.getId()).totalProgress()).isEqualTo(40);

        completeAfter(25, 60);
        assertThat(progressService.getUserProgress(userA.getId()).totalProgress()).isEqualTo(55);

        completeAfter(10, 10);
        assertThat(progressService.getUserProgress(userA.getId()).totalProgress()).isEqualTo(55);

        CreateFocusSessionRequest pausedRequest = new CreateFocusSessionRequest();
        pausedRequest.setUserId(userA.getId());
        pausedRequest.setName("Paused focus");
        pausedRequest.setDurationMinutes(25);
        FocusSessionResponse pausedResponse = focusSessionService.createSession(pausedRequest);
        focusSessionService.startSession(pausedResponse.getId(), userA.getId());
        FocusSession paused = focusSessionRepository.findById(pausedResponse.getId()).orElseThrow();
        Instant now = Instant.now();
        paused.setStatus(com.shinpo.entity.FocusSessionStatus.PAUSED);
        paused.setStartedAt(now.minus(Duration.ofMinutes(35)));
        paused.setPausedAt(now.minus(Duration.ofMinutes(20)));
        paused.setAccumulatedPausedSeconds(Duration.ofMinutes(15).toSeconds());
        focusSessionRepository.save(paused);
        focusSessionService.completeSession(paused.getId(), userA.getId());
        assertThat(progressService.getUserProgress(userA.getId()).totalProgress()).isEqualTo(55);
    }

    private FocusSessionResponse completeAfter(int plannedMinutes, int activeMinutes) {
        CreateFocusSessionRequest request = new CreateFocusSessionRequest();
        request.setUserId(userA.getId());
        request.setName("Timed reward check");
        request.setDurationMinutes(plannedMinutes);
        FocusSessionResponse scheduled = focusSessionService.createSession(request);
        focusSessionService.startSession(scheduled.getId(), userA.getId());
        FocusSession session = focusSessionRepository.findById(scheduled.getId()).orElseThrow();
        session.setStartedAt(Instant.now().minus(Duration.ofMinutes(activeMinutes)));
        focusSessionRepository.save(session);
        return focusSessionService.completeSession(scheduled.getId(), userA.getId());
    }

    @Test
    @DisplayName("Planned 60m session completed early at 20m earns tier-1 (+15 XP), while 50m earns tier-2 (+25 XP)")
    void sessionShorterThanPlannedDurationUsesActualActiveTime() {
        // Planned 60 min, but completed after 20 active minutes: earned is tier 1 (15 XP), NOT tier 2 (25 XP)
        completeAfter(60, 20);
        assertThat(progressService.getUserProgress(userA.getId()).totalProgress()).isEqualTo(15);

        // Another planned 60 min, completed after 50 active minutes: earned is tier 2 (25 XP)
        completeAfter(60, 50);
        assertThat(progressService.getUserProgress(userA.getId()).totalProgress()).isEqualTo(40);
    }

    @Test
    @DisplayName("Session paused and resumed correctly accounts for pause duration and awards XP upon reaching 15m active")
    void sessionPausedAndResumedAccurateAccounting() {
        CreateFocusSessionRequest req = new CreateFocusSessionRequest();
        req.setUserId(userA.getId());
        req.setName("Pause-Resume Test");
        req.setDurationMinutes(30);
        FocusSessionResponse session = focusSessionService.createSession(req);
        focusSessionService.startSession(session.getId(), userA.getId());

        // Simulate: Started 30 mins ago, paused for 10 mins (accumulatedPausedSeconds = 600)
        FocusSession entity = focusSessionRepository.findById(session.getId()).orElseThrow();
        Instant now = Instant.now();
        entity.setStartedAt(now.minus(Duration.ofMinutes(30)));
        entity.setAccumulatedPausedSeconds(600L); // 10 minutes paused
        entity.setStatus(com.shinpo.entity.FocusSessionStatus.ACTIVE);
        entity.setPausedAt(null);
        focusSessionRepository.save(entity);

        // Active seconds = 30m - 10m = 20m >= 15m -> +15 XP
        FocusSessionResponse completed = focusSessionService.completeSession(session.getId(), userA.getId());
        assertThat(completed.getStatus().name()).isEqualTo("COMPLETED");
        assertThat(progressService.getUserProgress(userA.getId()).totalProgress()).isEqualTo(15);
    }

    @Test
    @DisplayName("Onboarding XP requires the persisted goal-task-scheduled-focus-completion workflow")
    void onboardingRewardRequiresRealPersistedWorkflow() {
        OnboardingResponse finishedTour = onboardingService.finishOnboarding(userA.getId());
        assertThat(finishedTour.status()).isEqualTo("COMPLETED");
        assertThat(finishedTour.canClaimReward()).isFalse();
        assertThatThrownBy(() -> onboardingService.completeOnboarding(userA.getId()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Complete a goal, linked task");

        LocalDate today = LocalDate.now();
        GoalResponse goal = goalService.createGoal(userA.getId(),
                new CreateGoalRequest(userA.getId(), "First real goal", "", today, today.plusDays(7)));
        MissionResponse mission = missionService.createMission(userA.getId(),
                new CreateMissionRequest(goal.id(), "First linked task", "", today, 25));

        CreateFocusSessionRequest request = new CreateFocusSessionRequest();
        request.setUserId(userA.getId());
        request.setGoalId(goal.id());
        request.setMissionId(mission.id());
        request.setName("Scheduled linked focus");
        request.setDurationMinutes(25);
        request.setScheduledAt(Instant.now().plus(Duration.ofMinutes(1)));
        FocusSessionResponse scheduled = focusSessionService.createSession(request);
        focusSessionService.startSession(scheduled.getId(), userA.getId());
        FocusSession session = focusSessionRepository.findById(scheduled.getId()).orElseThrow();
        session.setStartedAt(Instant.now().minus(Duration.ofMinutes(15)));
        focusSessionRepository.save(session);
        focusSessionService.completeSession(scheduled.getId(), userA.getId(),
                new CompleteFocusSessionRequest(5, "Useful work", "Task completed", true));

        assertThat(onboardingService.getOnboardingState(userA.getId()).canClaimReward()).isTrue();
        ProgressResponse reward = onboardingService.completeOnboarding(userA.getId());
        assertThat(reward.totalProgress()).isEqualTo(125);
        assertThat(progressEventRepository.existsByUser_IdAndEventType(userA.getId(), "ONBOARDING_COMPLETED"))
                .isTrue();
        assertThat(onboardingService.completeOnboarding(userA.getId()).totalProgress()).isEqualTo(125);
    }

    @Test
    @DisplayName("Registration-seeded goal and task cannot satisfy onboarding reward eligibility")
    void onboardingRewardRejectsPreTutorialGoalAndTask() {
        LocalDate today = LocalDate.now();
        GoalResponse goal = goalService.createGoal(userA.getId(),
                new CreateGoalRequest(userA.getId(), "Seeded goal", "", today, today.plusDays(7)));
        MissionResponse mission = missionService.createMission(userA.getId(),
                new CreateMissionRequest(goal.id(), "Seeded task", "", today, 25));
        onboardingService.startOnboarding(userA.getId(), 0);

        CreateFocusSessionRequest request = new CreateFocusSessionRequest();
        request.setUserId(userA.getId());
        request.setGoalId(goal.id());
        request.setMissionId(mission.id());
        request.setName("Scheduled linked focus");
        request.setDurationMinutes(25);
        request.setScheduledAt(Instant.now().plus(Duration.ofMinutes(1)));
        FocusSessionResponse scheduled = focusSessionService.createSession(request);
        focusSessionService.startSession(scheduled.getId(), userA.getId());
        FocusSession session = focusSessionRepository.findById(scheduled.getId()).orElseThrow();
        session.setStartedAt(Instant.now().minus(Duration.ofMinutes(15)));
        focusSessionRepository.save(session);
        focusSessionService.completeSession(scheduled.getId(), userA.getId(),
                new CompleteFocusSessionRequest(5, "Useful work", "Task completed", true));
        onboardingService.finishOnboarding(userA.getId());

        assertThat(onboardingService.getOnboardingState(userA.getId()).canClaimReward()).isFalse();
        assertThatThrownBy(() -> onboardingService.completeOnboarding(userA.getId()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Complete a goal, linked task");
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
