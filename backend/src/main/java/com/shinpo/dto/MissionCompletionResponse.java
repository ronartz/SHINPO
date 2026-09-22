package com.shinpo.dto;

import java.time.Instant;

public record MissionCompletionResponse(
        Long id,
        Long missionId,
        Instant startedAt,
        Instant completedAt,
        Integer actualMinutes,
        String result,
        Integer earnedProgress
) {
}