package com.shinpo.service;

import com.shinpo.dto.UpdateGoalRequest;
import com.shinpo.entity.Goal;
import com.shinpo.entity.User;
import com.shinpo.repository.GoalRepository;
import com.shinpo.repository.MissionRepository;
import com.shinpo.repository.ProgressEventRepository;
import com.shinpo.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Optional;

import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class GoalServiceRewardTests {

    @Mock private GoalRepository goalRepository;
    @Mock private MissionRepository missionRepository;
    @Mock private UserRepository userRepository;
    @Mock private ProgressEventRepository progressEventRepository;

    @Test
    void reopeningGoalDoesNotAwardCompletionXpAgain() {
        User user = mock(User.class);
        when(user.getId()).thenReturn(7L);
        LocalDate today = LocalDate.now();
        Goal goal = new Goal("Goal", "", today, today.plusDays(1), user);
        when(goalRepository.findById(null)).thenReturn(Optional.of(goal));
        when(goalRepository.save(goal)).thenReturn(goal);
        when(progressEventRepository.insertGoalCompletionReward(7L, null, 50))
                .thenReturn(1, 0);
        GoalService service = new GoalService(
                goalRepository, missionRepository, userRepository, progressEventRepository);

        service.updateGoal(null, 7L, request("COMPLETED", today));
        service.updateGoal(null, 7L, request("ACTIVE", today));
        service.updateGoal(null, 7L, request("COMPLETED", today));

        verify(progressEventRepository, times(2)).insertGoalCompletionReward(7L, null, 50);
    }

    private static UpdateGoalRequest request(String status, LocalDate today) {
        return new UpdateGoalRequest("Goal", "", today, today.plusDays(1), status);
    }
}
