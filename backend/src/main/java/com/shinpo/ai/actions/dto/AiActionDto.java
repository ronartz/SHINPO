package com.shinpo.ai.actions.dto;

import java.time.Instant;

public record AiActionDto(
                String actionId,
                String actionType,
                String riskLevel,
                String status,
                String description,
                String payload,
                String resultSummary,
                String errorMessage,
                Instant createdAt,
                Instant confirmedAt,
                Instant executedAt,
                Instant expiresAt) {
}
