package com.shinpo.ai.actions.dto;

public record UpdateTaskPayload(
                Long taskId,
                String title,
                String description,
                Integer estimatedMinutes) {
}
