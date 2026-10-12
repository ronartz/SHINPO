package com.shinpo.ai.actions.dto;

import java.util.List;

public record ApplyDailyPlanPayload(
        List<DailyPlanItemAction> items
) {
    public record DailyPlanItemAction(
            String actionType,
            String title,
            String description,
            Integer estimatedMinutes,
            Long goalId,
            Long taskId,
            String scheduledTime,
            String scheduledDate
    ) {}
}

