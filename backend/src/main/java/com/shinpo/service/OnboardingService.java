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
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class OnboardingService {

    public static final int TOTAL_REQUIRED_STEPS = 12;
    public static final int ONBOARDING_COMPLETION_XP = 50;

    private final UserOnboardingRepository onboardingRepository;
    private final UserRepository userRepository;
    private final ProgressEventRepository progressEventRepository;
    private final ProgressService progressService;

    public OnboardingService(
            UserOnboardingRepository onboardingRepository,
            UserRepository userRepository,
            ProgressEventRepository progressEventRepository,
            ProgressService progressService
    ) {
        this.onboardingRepository = onboardingRepository;
        this.userRepository = userRepository;
        this.progressEventRepository = progressEventRepository;
        this.progressService = progressService;
    }

    @Transactional
    public UserOnboarding getOrCreateEntity(Long userId) {
        return onboardingRepository.findByUserId(userId).orElseGet(() -> {
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
            UserOnboarding newOnboarding = new UserOnboarding(user);
            return onboardingRepository.save(newOnboarding);
        });
    }

    @Transactional(readOnly = true)
    public OnboardingResponse getOnboardingState(Long userId) {
        UserOnboarding entity = onboardingRepository.findByUserId(userId)
                .orElse(null);

        if (entity == null) {
            return new OnboardingResponse(
                    userId,
                    OnboardingStatus.NOT_STARTED.name(),
                    0,
                    0,
                    "",
                    null,
                    false,
                    false
            );
        }

        boolean canClaimReward = entity.getStatus() != OnboardingStatus.SKIPPED
                && entity.getCompletedStepsCount() >= TOTAL_REQUIRED_STEPS
                && !progressEventRepository.existsByUser_IdAndEventType(userId, "ONBOARDING_COMPLETED");

        return toDto(entity, canClaimReward);
    }

    @Transactional
    public OnboardingResponse startOnboarding(Long userId, Integer fromStep) {
        UserOnboarding onboarding = getOrCreateEntity(userId);

        if (onboarding.getStatus() != OnboardingStatus.COMPLETED) {
            onboarding.setStatus(OnboardingStatus.IN_PROGRESS);
        }
        int step = (fromStep != null && fromStep >= 0 && fromStep < TOTAL_REQUIRED_STEPS) ? fromStep : 0;
        onboarding.setCurrentStep(step);
        onboarding.setUpdatedAt(Instant.now());
        UserOnboarding saved = onboardingRepository.save(onboarding);

        return toDto(saved, false);
    }

    @Transactional
    public OnboardingResponse recordStepProgress(Long userId, int stepIndex, boolean actionVerified) {
        UserOnboarding onboarding = getOrCreateEntity(userId);

        if (onboarding.getStatus() == OnboardingStatus.NOT_STARTED || onboarding.getStatus() == OnboardingStatus.PAUSED) {
            onboarding.setStatus(OnboardingStatus.IN_PROGRESS);
        }

        onboarding.setCurrentStep(Math.min(TOTAL_REQUIRED_STEPS, Math.max(0, stepIndex)));

        if (actionVerified) {
            Set<String> steps = parseVerifiedSteps(onboarding.getVerifiedSteps());
            steps.add(String.valueOf(stepIndex));
            onboarding.setVerifiedSteps(String.join(",", steps));
            onboarding.setCompletedStepsCount(steps.size());
        }

        onboarding.setUpdatedAt(Instant.now());
        UserOnboarding saved = onboardingRepository.save(onboarding);

        boolean canClaim = saved.getStatus() != OnboardingStatus.SKIPPED
                && saved.getCompletedStepsCount() >= TOTAL_REQUIRED_STEPS
                && !progressEventRepository.existsByUser_IdAndEventType(userId, "ONBOARDING_COMPLETED");

        return toDto(saved, canClaim);
    }

    @Transactional
    public OnboardingResponse pauseOnboarding(Long userId, int stepIndex) {
        UserOnboarding onboarding = getOrCreateEntity(userId);

        if (onboarding.getStatus() != OnboardingStatus.COMPLETED) {
            onboarding.setStatus(OnboardingStatus.PAUSED);
        }
        onboarding.setCurrentStep(Math.min(TOTAL_REQUIRED_STEPS, Math.max(0, stepIndex)));
        onboarding.setUpdatedAt(Instant.now());
        UserOnboarding saved = onboardingRepository.save(onboarding);

        return toDto(saved, false);
    }

    @Transactional
    public OnboardingResponse skipOnboarding(Long userId) {
        UserOnboarding onboarding = getOrCreateEntity(userId);

        // Crucial security & fairness rule: Skipping the tour NEVER awards completion points!
        if (onboarding.getStatus() != OnboardingStatus.COMPLETED) {
            onboarding.setStatus(OnboardingStatus.SKIPPED);
        }
        onboarding.setUpdatedAt(Instant.now());
        UserOnboarding saved = onboardingRepository.save(onboarding);

        return toDto(saved, false);
    }

    @Transactional
    public ProgressResponse completeOnboarding(Long userId) {
        UserOnboarding onboarding = getOrCreateEntity(userId);

        if (onboarding.getStatus() == OnboardingStatus.SKIPPED) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Cannot claim onboarding reward: onboarding journey was skipped. All 12 steps must be completed."
            );
        }

        if (onboarding.getCompletedStepsCount() < TOTAL_REQUIRED_STEPS) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Cannot claim onboarding reward: incomplete journey. Verified "
                            + onboarding.getCompletedStepsCount() + " of " + TOTAL_REQUIRED_STEPS + " steps."
            );
        }

        // Idempotent points ledger entry: award +50 XP exactly once per user
        boolean alreadyAwarded = progressEventRepository.existsByUser_IdAndEventType(userId, "ONBOARDING_COMPLETED");
        if (!alreadyAwarded) {
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
            ProgressEvent event = new ProgressEvent(user, "ONBOARDING_COMPLETED", ONBOARDING_COMPLETION_XP);
            progressEventRepository.save(event);
        }

        onboarding.setStatus(OnboardingStatus.COMPLETED);
        onboarding.setCompletedAt(Instant.now());
        onboarding.setUpdatedAt(Instant.now());
        onboardingRepository.save(onboarding);

        return progressService.getUserProgress(userId);
    }

    private Set<String> parseVerifiedSteps(String verifiedSteps) {
        if (verifiedSteps == null || verifiedSteps.isBlank()) {
            return new HashSet<>();
        }
        return Arrays.stream(verifiedSteps.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toSet());
    }

    private OnboardingResponse toDto(UserOnboarding entity, boolean canClaimReward) {
        return new OnboardingResponse(
                entity.getUserId(),
                entity.getStatus().name(),
                entity.getCurrentStep(),
                entity.getCompletedStepsCount(),
                entity.getVerifiedSteps(),
                entity.getCompletedAt(),
                entity.getStatus() == OnboardingStatus.COMPLETED,
                canClaimReward
        );
    }
}

