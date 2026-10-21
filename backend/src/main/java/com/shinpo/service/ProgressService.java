package com.shinpo.service;

import com.shinpo.dto.ProgressResponse;
import com.shinpo.entity.ProgressEvent;
import com.shinpo.entity.User;
import com.shinpo.repository.ProgressEventRepository;
import com.shinpo.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class ProgressService {

    private final ProgressEventRepository progressEventRepository;
    private final UserRepository userRepository;

    public ProgressService(
            ProgressEventRepository progressEventRepository,
            UserRepository userRepository
    ) {
        this.progressEventRepository = progressEventRepository;
        this.userRepository = userRepository;
    }

    public ProgressResponse getUserProgress(Long userId) {
        Integer rawTotal = progressEventRepository.getTotalProgressByUserId(userId);
        int totalXp = rawTotal != null ? rawTotal : 0;

        List<ProgressEvent> events = progressEventRepository.findTop10ByUser_IdOrderByCreatedAtDesc(userId);
        List<ProgressResponse.ProgressEventDto> dtoList = events.stream()
                .map(e -> new ProgressResponse.ProgressEventDto(
                        e.getId(),
                        e.getEventType(),
                        e.getAmount(),
                        e.getCreatedAt() != null ? e.getCreatedAt().toString() : null
                ))
                .toList();

        int level = ProgressResponse.calculateLevel(totalXp);
        String levelTitle = ProgressResponse.calculateLevelTitle(level);
        int currentLevelXp = ProgressResponse.calculateCurrentLevelXp(totalXp);
        int nextThreshold = ProgressResponse.calculateNextLevelThreshold(level);
        double progressPercent = ProgressResponse.calculateProgressPercent(totalXp);

        return new ProgressResponse(
                userId,
                totalXp,
                level,
                levelTitle,
                currentLevelXp,
                nextThreshold,
                progressPercent,
                dtoList
        );
    }

    @Transactional
    public ProgressResponse recordOnboardingCompletion(Long userId) {
        boolean alreadyAwarded = progressEventRepository.existsByUser_IdAndEventType(userId, "ONBOARDING_COMPLETED");
        if (!alreadyAwarded) {
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
            ProgressEvent event = new ProgressEvent(user, "ONBOARDING_COMPLETED", 50);
            progressEventRepository.save(event);
        }
        return getUserProgress(userId);
    }
}
