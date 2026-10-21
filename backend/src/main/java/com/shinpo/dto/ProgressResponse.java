package com.shinpo.dto;

import java.util.List;

public record ProgressResponse(
        Long userId,
        Integer totalProgress,
        Integer level,
        String levelTitle,
        Integer currentLevelXp,
        Integer nextLevelThreshold,
        Double progressPercent,
        List<ProgressEventDto> recentEvents
) {
    public ProgressResponse(Long userId, Integer totalProgress) {
        this(
                userId,
                totalProgress != null ? totalProgress : 0,
                calculateLevel(totalProgress != null ? totalProgress : 0),
                calculateLevelTitle(calculateLevel(totalProgress != null ? totalProgress : 0)),
                calculateCurrentLevelXp(totalProgress != null ? totalProgress : 0),
                calculateNextLevelThreshold(calculateLevel(totalProgress != null ? totalProgress : 0)),
                calculateProgressPercent(totalProgress != null ? totalProgress : 0),
                List.of()
        );
    }

    public static int calculateLevel(int totalXp) {
        if (totalXp >= 1000) return 5;
        if (totalXp >= 500) return 4;
        if (totalXp >= 250) return 3;
        if (totalXp >= 100) return 2;
        return 1;
    }

    public static String calculateLevelTitle(int level) {
        return switch (level) {
            case 5 -> "Master of Flow";
            case 4 -> "High-Flow Architect";
            case 3 -> "Execution Specialist";
            case 2 -> "Disciplined Practitioner";
            default -> "Focus Initiate";
        };
    }

    public static int calculateCurrentLevelXp(int totalXp) {
        if (totalXp >= 1000) return totalXp - 1000;
        if (totalXp >= 500) return totalXp - 500;
        if (totalXp >= 250) return totalXp - 250;
        if (totalXp >= 100) return totalXp - 100;
        return totalXp;
    }

    public static int calculateNextLevelThreshold(int level) {
        return switch (level) {
            case 4 -> 500; // 500 to 1000 = 500
            case 3 -> 250; // 250 to 500 = 250
            case 2 -> 150; // 100 to 250 = 150
            case 1 -> 100; // 0 to 100 = 100
            default -> 1000; // level 5 milestone step
        };
    }

    public static double calculateProgressPercent(int totalXp) {
        int level = calculateLevel(totalXp);
        int currentXp = calculateCurrentLevelXp(totalXp);
        int threshold = calculateNextLevelThreshold(level);
        if (threshold <= 0) return 100.0;
        double pct = (double) currentXp / (double) threshold * 100.0;
        return Math.min(100.0, Math.max(0.0, Math.round(pct * 10.0) / 10.0));
    }

    public record ProgressEventDto(
            Long id,
            String eventType,
            Integer amount,
            String createdAt
    ) {}
}
