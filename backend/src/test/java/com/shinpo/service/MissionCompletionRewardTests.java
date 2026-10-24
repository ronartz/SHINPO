package com.shinpo.service;

import com.shinpo.dto.CompleteMissionRequest;
import com.shinpo.entity.Goal;
import com.shinpo.entity.Mission;
import com.shinpo.entity.MissionCompletion;
import com.shinpo.entity.User;
import com.shinpo.repository.GoalRepository;
import com.shinpo.repository.MissionCompletionRepository;
import com.shinpo.repository.MissionRepository;
import com.shinpo.repository.ProgressEventRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MissionCompletionRewardTests {

    @Mock private MissionRepository missionRepository;
    @Mock private MissionCompletionRepository completionRepository;
    @Mock private ProgressEventRepository progressEventRepository;
    @Mock private GoalRepository goalRepository;

    @Test
    void finalTaskCompletionRecordsGoalRewardAgainstThatGoal() {
        User user = mock(User.class);
        when(user.getId()).thenReturn(7L);
        Goal goal = new Goal("Goal", "", LocalDate.now(), null, user);
        Mission mission = new Mission("Task", "", LocalDate.now(), 25, goal);
        when(missionRepository.findById(null)).thenReturn(Optional.of(mission));
        when(missionRepository.findAllByGoal_Id(null)).thenReturn(List.of(mission));
        when(completionRepository.save(any(MissionCompletion.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(progressEventRepository.insertGoalCompletionReward(7L, null, 50))
                .thenReturn(1);
        when(goalRepository.save(goal)).thenReturn(goal);

        MissionCompletionService service = new MissionCompletionService(
                missionRepository, completionRepository, progressEventRepository, goalRepository);
        service.completeMission(null, 7L, new CompleteMissionRequest(25));

        verify(progressEventRepository).insertGoalCompletionReward(7L, null, 50);
        verify(progressEventRepository).save(argThat(event ->
                "MISSION_COMPLETED".equals(event.getEventType())));
    }

    @Test
    void automaticGoalCompletionSkipsRewardAlreadyIssuedByManualCompletion() {
        User user = mock(User.class);
        when(user.getId()).thenReturn(7L);
        Goal goal = new Goal("Goal", "", LocalDate.now(), null, user);
        Mission mission = new Mission("Task", "", LocalDate.now(), 25, goal);
        when(missionRepository.findById(null)).thenReturn(Optional.of(mission));
        when(missionRepository.findAllByGoal_Id(null)).thenReturn(List.of(mission));
        when(completionRepository.save(any(MissionCompletion.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(progressEventRepository.insertGoalCompletionReward(7L, null, 50))
                .thenReturn(0);

        MissionCompletionService service = new MissionCompletionService(
                missionRepository, completionRepository, progressEventRepository, goalRepository);
        service.completeMission(null, 7L, new CompleteMissionRequest(25));

        verify(progressEventRepository).insertGoalCompletionReward(7L, null, 50);
        verify(progressEventRepository).save(argThat(event ->
                "MISSION_COMPLETED".equals(event.getEventType())));
    }
}
