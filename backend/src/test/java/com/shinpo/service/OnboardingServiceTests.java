package com.shinpo.service;

import com.shinpo.dto.OnboardingDtos.OnboardingResponse;
import com.shinpo.dto.ProgressResponse;
import com.shinpo.entity.ProgressEvent;
import com.shinpo.entity.User;
import com.shinpo.entity.UserOnboarding;
import com.shinpo.entity.UserOnboarding.OnboardingStatus;
import com.shinpo.repository.ProgressEventRepository;
import com.shinpo.repository.UserOnboardingRepository;
import com.shinpo.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OnboardingServiceTests {

    @Mock
    private UserOnboardingRepository onboardingRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private ProgressEventRepository progressEventRepository;

    @Mock
    private ProgressService progressService;

    private OnboardingService onboardingService;

    private User testUser;

    @BeforeEach
    void setUp() {
        onboardingService = new OnboardingService(
                onboardingRepository,
                userRepository,
                progressEventRepository,
                progressService
        );
        testUser = new User("alice", "alice@shinpo.dev", "hash", Instant.now());
    }

    @Test
    @DisplayName("Fresh user gets NOT_STARTED status with 0 verified steps")
    void testGetOnboardingStateFresh() {
        when(onboardingRepository.findByUserId(1L)).thenReturn(Optional.empty());

        OnboardingResponse res = onboardingService.getOnboardingState(1L);

        assertThat(res.status()).isEqualTo("NOT_STARTED");
        assertThat(res.currentStep()).isEqualTo(0);
        assertThat(res.completedStepsCount()).isEqualTo(0);
        assertThat(res.canClaimReward()).isFalse();
    }

    @Test
    @DisplayName("startOnboarding transitions state to IN_PROGRESS")
    void testStartOnboarding() {
        UserOnboarding onboarding = new UserOnboarding(testUser);
        when(onboardingRepository.findByUserId(1L)).thenReturn(Optional.of(onboarding));
        when(onboardingRepository.save(any(UserOnboarding.class))).thenAnswer(i -> i.getArgument(0));

        OnboardingResponse res = onboardingService.startOnboarding(1L, 0);

        assertThat(res.status()).isEqualTo("IN_PROGRESS");
        assertThat(res.currentStep()).isEqualTo(0);
    }

    @Test
    @DisplayName("recordStepProgress stores display position but never client verification")
    void testRecordStepProgress() {
        UserOnboarding onboarding = new UserOnboarding(testUser);
        when(onboardingRepository.findByUserId(1L)).thenReturn(Optional.of(onboarding));
        when(onboardingRepository.save(any(UserOnboarding.class))).thenAnswer(i -> i.getArgument(0));

        OnboardingResponse res = onboardingService.recordStepProgress(1L, 1);

        assertThat(res.status()).isEqualTo("IN_PROGRESS");
        assertThat(res.currentStep()).isEqualTo(1);
        assertThat(res.completedStepsCount()).isZero();
        assertThat(res.verifiedSteps()).isEmpty();
        assertThat(onboarding.getVerifiedSteps()).isEmpty();
    }

    @Test
    @DisplayName("recordStepProgress rejects the out-of-range completion sentinel")
    void testRecordStepProgressRejectsOutOfRangeIndex() {
        assertThatThrownBy(() -> onboardingService.recordStepProgress(1L, 6))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Invalid onboarding step index");
        verifyNoInteractions(onboardingRepository, userRepository);
    }

    @Test
    @DisplayName("pauseOnboarding preserves current step and sets status to PAUSED")
    void testPauseOnboarding() {
        UserOnboarding onboarding = new UserOnboarding(testUser);
        onboarding.setStatus(OnboardingStatus.IN_PROGRESS);
        when(onboardingRepository.findByUserId(1L)).thenReturn(Optional.of(onboarding));
        when(onboardingRepository.save(any(UserOnboarding.class))).thenAnswer(i -> i.getArgument(0));

        OnboardingResponse res = onboardingService.pauseOnboarding(1L, 4);

        assertThat(res.status()).isEqualTo("PAUSED");
        assertThat(res.currentStep()).isEqualTo(4);
    }

    @Test
    @DisplayName("skipOnboarding sets status to SKIPPED and awards NO points")
    void testSkipOnboarding() {
        UserOnboarding onboarding = new UserOnboarding(testUser);
        when(onboardingRepository.findByUserId(1L)).thenReturn(Optional.of(onboarding));
        when(onboardingRepository.save(any(UserOnboarding.class))).thenAnswer(i -> i.getArgument(0));

        OnboardingResponse res = onboardingService.skipOnboarding(1L);

        assertThat(res.status()).isEqualTo("SKIPPED");
        verify(progressEventRepository, never()).save(any(ProgressEvent.class));
    }

    @Test
    @DisplayName("completeOnboarding rejects claim when onboarding was skipped")
    void testCompleteOnboardingRejectsSkipped() {
        UserOnboarding onboarding = new UserOnboarding(testUser);
        onboarding.setStatus(OnboardingStatus.SKIPPED);
        when(onboardingRepository.findByUserId(1L)).thenReturn(Optional.of(onboarding));
        when(onboardingRepository.findFirstByUserId(1L)).thenReturn(Optional.of(onboarding));

        assertThatThrownBy(() -> onboardingService.completeOnboarding(1L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Cannot claim onboarding reward: the tutorial was skipped.");
    }

    @Test
    @DisplayName("completeOnboarding rejects claim before tutorial completion")
    void testCompleteOnboardingRejectsIncomplete() {
        UserOnboarding onboarding = new UserOnboarding(testUser);
        onboarding.setStatus(OnboardingStatus.IN_PROGRESS);
        when(onboardingRepository.findByUserId(1L)).thenReturn(Optional.of(onboarding));
        when(onboardingRepository.findFirstByUserId(1L)).thenReturn(Optional.of(onboarding));

        assertThatThrownBy(() -> onboardingService.completeOnboarding(1L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Finish the onboarding tutorial");
    }

    @Test
    @DisplayName("finishing the tutorial without real workflow evidence does not award XP")
    void finishDoesNotAwardWithoutWorkflow() {
        UserOnboarding onboarding = new UserOnboarding(testUser);
        when(onboardingRepository.findByUserId(1L)).thenReturn(Optional.of(onboarding));
        when(onboardingRepository.save(any(UserOnboarding.class))).thenAnswer(i -> i.getArgument(0));
        when(progressEventRepository.hasQualifyingOnboardingWorkflow(1L)).thenReturn(false);

        OnboardingResponse response = onboardingService.finishOnboarding(1L);

        assertThat(response.status()).isEqualTo("COMPLETED");
        assertThat(response.canClaimReward()).isFalse();
        verify(progressEventRepository, never()).save(any(ProgressEvent.class));
    }

    @Test
    @DisplayName("completeOnboarding awards +50 XP after server-verified workflow evidence")
    void testCompleteOnboardingSuccess() {
        UserOnboarding onboarding = new UserOnboarding(testUser);
        onboarding.setStatus(OnboardingStatus.COMPLETED);
        onboarding.setCompletedAt(Instant.now());
        when(onboardingRepository.findByUserId(1L)).thenReturn(Optional.of(onboarding));
        when(onboardingRepository.findFirstByUserId(1L)).thenReturn(Optional.of(onboarding));
        when(progressEventRepository.hasQualifyingOnboardingWorkflow(1L)).thenReturn(true);
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(progressEventRepository.existsByUser_IdAndEventType(1L, "ONBOARDING_COMPLETED")).thenReturn(false);
        when(onboardingRepository.save(any(UserOnboarding.class))).thenAnswer(i -> i.getArgument(0));

        ProgressResponse mockProgress = new ProgressResponse(1L, 50, 1, "Focus Initiate", 50, 100, 50.0, List.of());
        when(progressService.getUserProgress(1L)).thenReturn(mockProgress);

        ProgressResponse res = onboardingService.completeOnboarding(1L);

        verify(progressEventRepository).save(any(ProgressEvent.class));
        assertThat(onboarding.getStatus()).isEqualTo(OnboardingStatus.COMPLETED);
        assertThat(onboarding.getCompletedAt()).isNotNull();
        assertThat(res.totalProgress()).isEqualTo(50);
    }

    @Test
    @DisplayName("completeOnboarding rejects forged tutorial progress without workflow evidence")
    void testCompleteOnboardingRejectsInflatedStepCount() {
        UserOnboarding onboarding = new UserOnboarding(testUser);
        onboarding.setStatus(OnboardingStatus.COMPLETED);
        onboarding.setCompletedStepsCount(12);
        onboarding.setVerifiedSteps("0,1,2,3,4,5,6,7,8,9,10,12,99");
        when(onboardingRepository.findByUserId(1L)).thenReturn(Optional.of(onboarding));
        when(onboardingRepository.findFirstByUserId(1L)).thenReturn(Optional.of(onboarding));
        when(progressEventRepository.hasQualifyingOnboardingWorkflow(1L)).thenReturn(false);

        assertThatThrownBy(() -> onboardingService.completeOnboarding(1L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Complete a goal, linked task");
        verify(progressEventRepository, never()).save(any(ProgressEvent.class));
    }

    @Test
    @DisplayName("completeOnboarding is idempotent: does not duplicate points if called again")
    void testCompleteOnboardingIdempotency() {
        UserOnboarding onboarding = new UserOnboarding(testUser);
        onboarding.setStatus(OnboardingStatus.COMPLETED);
        when(onboardingRepository.findByUserId(1L)).thenReturn(Optional.of(onboarding));
        when(onboardingRepository.findFirstByUserId(1L)).thenReturn(Optional.of(onboarding));
        when(progressEventRepository.hasQualifyingOnboardingWorkflow(1L)).thenReturn(true);
        when(progressEventRepository.existsByUser_IdAndEventType(1L, "ONBOARDING_COMPLETED")).thenReturn(true);
        when(onboardingRepository.save(any(UserOnboarding.class))).thenAnswer(i -> i.getArgument(0));

        ProgressResponse mockProgress = new ProgressResponse(1L, 50, 1, "Focus Initiate", 50, 100, 50.0, List.of());
        when(progressService.getUserProgress(1L)).thenReturn(mockProgress);

        ProgressResponse res = onboardingService.completeOnboarding(1L);

        // Progress event is NOT saved again!
        verify(progressEventRepository, never()).save(any(ProgressEvent.class));
        assertThat(res.totalProgress()).isEqualTo(50);
    }
}

