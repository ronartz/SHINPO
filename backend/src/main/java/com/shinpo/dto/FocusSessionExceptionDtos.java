package com.shinpo.dto;

import com.shinpo.entity.FocusSessionActivityType;
import com.shinpo.entity.FocusSessionEnforcementException;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.Instant;

public class FocusSessionExceptionDtos {

    public record CreateFocusSessionExceptionRequest(
            @NotBlank
            @Size(max = 150)
            String activityPattern,

            FocusSessionActivityType activityType
    ) {}

    public record FocusSessionExceptionResponse(
            Long id,
            Long focusSessionId,
            String activityPattern,
            FocusSessionActivityType activityType,
            Instant createdAt
    ) {
        public static FocusSessionExceptionResponse from(FocusSessionEnforcementException entity) {
            return new FocusSessionExceptionResponse(
                    entity.getId(),
                    entity.getFocusSession() != null ? entity.getFocusSession().getId() : null,
                    entity.getActivityPattern(),
                    entity.getActivityType(),
                    entity.getCreatedAt()
            );
        }
    }
}
