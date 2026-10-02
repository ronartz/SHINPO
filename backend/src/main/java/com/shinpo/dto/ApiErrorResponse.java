package com.shinpo.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.util.List;

/**
 * Standardized API error response payload across all SHINPO REST failure modes.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiErrorResponse(
        Instant timestamp,
        int status,
        String error,
        String message,
        String path,
        List<ValidationErrorItem> validationErrors
) {
    public ApiErrorResponse(Instant timestamp, int status, String error, String message, String path) {
        this(timestamp, status, error, message, path, null);
    }

    public record ValidationErrorItem(
            String field,
            String message,
            Object rejectedValue
    ) {}
}

