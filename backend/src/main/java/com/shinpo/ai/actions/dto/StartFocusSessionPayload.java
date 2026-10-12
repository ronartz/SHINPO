package com.shinpo.ai.actions.dto;

public record StartFocusSessionPayload(
                String name,
                Integer durationMinutes,
                Long taskId,
                Long goalId) {
}
