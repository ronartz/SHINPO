package com.shinpo.service;

import com.shinpo.dto.ProgressResponse;
import com.shinpo.entity.ProgressEvent;
import com.shinpo.repository.ProgressEventRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ProgressService {

    private final ProgressEventRepository progressEventRepository;
    public ProgressService(ProgressEventRepository progressEventRepository) {
        this.progressEventRepository = progressEventRepository;
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

}
