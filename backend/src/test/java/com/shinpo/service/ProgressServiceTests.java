package com.shinpo.service;

import com.shinpo.dto.ProgressResponse;
import com.shinpo.entity.ProgressEvent;
import com.shinpo.entity.User;
import com.shinpo.repository.ProgressEventRepository;
import com.shinpo.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProgressServiceTests {

    @Mock
    private ProgressEventRepository progressEventRepository;

    @Mock
    private UserRepository userRepository;

    private ProgressService progressService;

    @BeforeEach
    void setUp() {
        progressService = new ProgressService(progressEventRepository, userRepository);
    }

    @Test
    @DisplayName("Should return Level 1 Focus Initiate for new user with 0 XP")
    void testNewUserLevel1() {
        when(progressEventRepository.getTotalProgressByUserId(1L)).thenReturn(0);
        when(progressEventRepository.findTop10ByUser_IdOrderByCreatedAtDesc(1L)).thenReturn(List.of());

        ProgressResponse response = progressService.getUserProgress(1L);

        assertThat(response.userId()).isEqualTo(1L);
        assertThat(response.totalProgress()).isEqualTo(0);
        assertThat(response.level()).isEqualTo(1);
        assertThat(response.levelTitle()).isEqualTo("Focus Initiate");
        assertThat(response.currentLevelXp()).isEqualTo(0);
        assertThat(response.nextLevelThreshold()).isEqualTo(100);
        assertThat(response.progressPercent()).isEqualTo(0.0);
        assertThat(response.recentEvents()).isEmpty();
    }

    @Test
    @DisplayName("Should correctly transition to Level 2 Disciplined Practitioner at 100 XP")
    void testLevel2Transition() {
        when(progressEventRepository.getTotalProgressByUserId(2L)).thenReturn(145);
        when(progressEventRepository.findTop10ByUser_IdOrderByCreatedAtDesc(2L)).thenReturn(List.of());

        ProgressResponse response = progressService.getUserProgress(2L);

        assertThat(response.level()).isEqualTo(2);
        assertThat(response.levelTitle()).isEqualTo("Disciplined Practitioner");
        assertThat(response.currentLevelXp()).isEqualTo(45);
        assertThat(response.nextLevelThreshold()).isEqualTo(150);
        assertThat(response.progressPercent()).isEqualTo(30.0);
    }

    @Test
    @DisplayName("Should correctly calculate Level 3, 4, and 5 tiers")
    void testHigherLevelCalculations() {
        assertThat(ProgressResponse.calculateLevel(250)).isEqualTo(3);
        assertThat(ProgressResponse.calculateLevelTitle(3)).isEqualTo("Execution Specialist");

        assertThat(ProgressResponse.calculateLevel(500)).isEqualTo(4);
        assertThat(ProgressResponse.calculateLevelTitle(4)).isEqualTo("High-Flow Architect");

        assertThat(ProgressResponse.calculateLevel(1000)).isEqualTo(5);
        assertThat(ProgressResponse.calculateLevelTitle(5)).isEqualTo("Master of Flow");
    }

    @Test
    @DisplayName("Should include formatted recent progress events")
    void testRecentEventsMapping() {
        User user = new User("tester", "tester@shinpo.dev", "hash", java.time.Instant.now());
        ProgressEvent event1 = new ProgressEvent(user, null, "FOCUS_SESSION_COMPLETED", 15);
        ProgressEvent event2 = new ProgressEvent(user, null, "MISSION_COMPLETED", 10);

        when(progressEventRepository.getTotalProgressByUserId(3L)).thenReturn(25);
        when(progressEventRepository.findTop10ByUser_IdOrderByCreatedAtDesc(3L)).thenReturn(List.of(event1, event2));

        ProgressResponse response = progressService.getUserProgress(3L);

        assertThat(response.totalProgress()).isEqualTo(25);
        assertThat(response.recentEvents()).hasSize(2);
        assertThat(response.recentEvents().get(0).eventType()).isEqualTo("FOCUS_SESSION_COMPLETED");
        assertThat(response.recentEvents().get(0).amount()).isEqualTo(15);
        assertThat(response.recentEvents().get(1).eventType()).isEqualTo("MISSION_COMPLETED");
        assertThat(response.recentEvents().get(1).amount()).isEqualTo(10);
    }

    @Test
    @DisplayName("Should award +50 XP for onboarding completion once and maintain idempotency")
    void testRecordOnboardingCompletion() {
        User user = new User("tester", "tester@shinpo.dev", "hash", java.time.Instant.now());

        // First attempt: not already awarded
        when(progressEventRepository.existsByUser_IdAndEventType(4L, "ONBOARDING_COMPLETED")).thenReturn(false);
        when(userRepository.findById(4L)).thenReturn(Optional.of(user));
        when(progressEventRepository.getTotalProgressByUserId(4L)).thenReturn(50);
        when(progressEventRepository.findTop10ByUser_IdOrderByCreatedAtDesc(4L)).thenReturn(List.of(
                new ProgressEvent(user, "ONBOARDING_COMPLETED", 50)
        ));

        ProgressResponse response = progressService.recordOnboardingCompletion(4L);

        verify(progressEventRepository).save(any(ProgressEvent.class));
        assertThat(response.totalProgress()).isEqualTo(50);
        assertThat(response.level()).isEqualTo(1);
        assertThat(response.currentLevelXp()).isEqualTo(50);

        // Second attempt: already awarded -> save is NEVER called again
        when(progressEventRepository.existsByUser_IdAndEventType(4L, "ONBOARDING_COMPLETED")).thenReturn(true);
        progressService.recordOnboardingCompletion(4L);
        verify(userRepository, never()).findById(999L);
    }
}
