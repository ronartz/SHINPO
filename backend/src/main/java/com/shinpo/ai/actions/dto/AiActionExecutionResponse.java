package com.shinpo.ai.actions.dto;

import java.time.Instant;
import java.util.List;

public record AiActionExecutionResponse(
        String actionId,
        String status,
        String resultSummary,
        String errorMessage,
        Instant executedAt,
        List<String> partialCompletedItems,
        List<String> partialFailedItems) {
    public static AiActionExecutionResponse success(String actionId, String resultSummary, Instant executedAt) {
        return new AiActionExecutionResponse(actionId, "COMPLETED", resultSummary, null, executedAt, List.of(),
                List.of());
    }

    public static AiActionExecutionResponse failure(String actionId, String errorMessage) {
        return new AiActionExecutionResponse(actionId, "FAILED", null, errorMessage, Instant.now(), List.of(),
                List.of());
    }

    public static AiActionExecutionResponse partial(String actionId, String summary, List<String> completed,
            List<String> failed) {
        String status = failed.isEmpty() ? "COMPLETED" : (completed.isEmpty() ? "FAILED" : "PARTIALLY_COMPLETED");
        return new AiActionExecutionResponse(actionId, status, summary, null, Instant.now(), completed, failed);
    }
}
