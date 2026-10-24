package com.shinpo.service;

import com.shinpo.dto.CreateGoalRequest;
import com.shinpo.dto.GoalResponse;
import com.shinpo.dto.ProgressResponse;
import com.shinpo.dto.UpdateGoalRequest;
import com.shinpo.entity.ProgressEvent;
import com.shinpo.entity.User;
import com.shinpo.repository.ProgressEventRepository;
import com.shinpo.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.time.Instant;
import java.time.LocalDate;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@ActiveProfiles("test")
class GoalRewardConcurrencyTests {

    @Autowired private GoalService goalService;
    @Autowired private ProgressService progressService;
    @Autowired private ProgressEventRepository progressEventRepository;
    @Autowired private UserRepository userRepository;

    @Test
    void simultaneousGoalCompletionRequestsReturnWithoutDuplicateReward() throws Exception {
        long stamp = System.nanoTime();
        User user = userRepository.save(new User(
                "goal_race_" + stamp, "goal_race_" + stamp + "@qa.test", "hash", Instant.now()));
        LocalDate today = LocalDate.now();
        GoalResponse goal = goalService.createGoal(user.getId(),
                new CreateGoalRequest(user.getId(), "Concurrent completion", "", today, today.plusDays(1)));
        UpdateGoalRequest completion = new UpdateGoalRequest(
                goal.title(), goal.description(), goal.startDate(), goal.targetDate(), "COMPLETED");
        CountDownLatch start = new CountDownLatch(1);

        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> {
                start.await();
                return goalService.updateGoal(goal.id(), user.getId(), completion);
            });
            var second = executor.submit(() -> {
                start.await();
                return goalService.updateGoal(goal.id(), user.getId(), completion);
            });
            start.countDown();
            assertThat(first.get(10, TimeUnit.SECONDS).status()).isEqualTo("COMPLETED");
            assertThat(second.get(10, TimeUnit.SECONDS).status()).isEqualTo("COMPLETED");
        }

        assertThat(progressService.getUserProgress(user.getId()).totalProgress()).isEqualTo(50);
        assertThat(progressEventRepository.findAll().stream()
                .filter(event -> "GOAL_COMPLETED".equals(event.getEventType()))
                .filter(event -> event.getGoal() != null && goal.id().equals(event.getGoal().getId())))
                .hasSize(1);
    }

    @Test
    void failedGoalUpdateRollsBackItsReward() {
        long stamp = System.nanoTime();
        User user = userRepository.save(new User(
                "goal_rollback_" + stamp, "goal_rollback_" + stamp + "@qa.test", "hash", Instant.now()));
        LocalDate today = LocalDate.now();
        GoalResponse goal = goalService.createGoal(user.getId(),
                new CreateGoalRequest(user.getId(), "Rollback goal", "", today, today.plusDays(1)));
        UpdateGoalRequest invalidCompletion = new UpdateGoalRequest(
                "x".repeat(151), "", today, today.plusDays(1), "COMPLETED");

        assertThatThrownBy(() -> goalService.updateGoal(goal.id(), user.getId(), invalidCompletion))
                .isInstanceOf(RuntimeException.class);

        assertThat(progressService.getUserProgress(user.getId()).totalProgress()).isZero();
        assertThat(goalService.getGoal(goal.id(), user.getId()).status()).isEqualTo("ACTIVE");
    }

    @Test
    void deletingCompletedGoalKeepsRewardButClearsItsGoalReference() {
        long stamp = System.nanoTime();
        User user = userRepository.save(new User(
                "goal_delete_" + stamp, "goal_delete_" + stamp + "@qa.test", "hash", Instant.now()));
        LocalDate today = LocalDate.now();
        GoalResponse goal = goalService.createGoal(user.getId(),
                new CreateGoalRequest(user.getId(), "Delete after reward", "", today, today.plusDays(1)));
        goalService.updateGoal(goal.id(), user.getId(), new UpdateGoalRequest(
                goal.title(), goal.description(), goal.startDate(), goal.targetDate(), "COMPLETED"));

        goalService.deleteGoal(goal.id(), user.getId());

        assertThat(progressService.getUserProgress(user.getId()).totalProgress()).isEqualTo(50);
        assertThat(progressEventRepository.findAll().stream()
                .filter(event -> user.getId().equals(event.getUser().getId()))
                .filter(event -> "GOAL_COMPLETED".equals(event.getEventType())))
                .singleElement()
                .satisfies(event -> assertThat(event.getGoal()).isNull());
    }
}
