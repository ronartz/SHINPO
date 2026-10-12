package com.shinpo.ai.actions.dto;

import java.time.LocalDate;

public record RescheduleTaskPayload(
                Long taskId,
                LocalDate scheduledDate) {
}
