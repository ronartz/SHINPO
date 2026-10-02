package com.shinpo.dto;

import com.shinpo.entity.SentinelEnforcementWarning;
import com.shinpo.entity.SentinelGraceWindow;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

import java.time.Instant;
import java.util.UUID;

public class SentinelWarningDtos {

    public record IssueWarningRequest(
            Long focusSessionId,
            @NotBlank
            String processName,
            String commandLine
    ) {}

    public record RespondWarningRequest(
            @NotBlank
            @Pattern(regexp = "GRANT_GRACE|TERMINATE_NOW", message = "Action must be GRANT_GRACE or TERMINATE_NOW")
            String action,
            Integer graceMinutes
    ) {}

    public record SentinelWarningResponse(
            UUID warningId,
            Long sessionId,
            String processName,
            String commandLine,
            Instant issuedAt,
            Instant decisionDeadline,
            String status,
            Instant graceExpiresAt,
            Integer effectiveGraceMinutes
    ) {
        public static SentinelWarningResponse from(SentinelEnforcementWarning warning) {
            return from(warning, null);
        }

        public static SentinelWarningResponse from(SentinelEnforcementWarning warning, SentinelGraceWindow grace) {
            return new SentinelWarningResponse(
                    warning.getWarningId(),
                    warning.getFocusSession() != null ? warning.getFocusSession().getId() : null,
                    warning.getProcessName(),
                    warning.getCommandLine(),
                    warning.getIssuedAt(),
                    warning.getDecisionDeadline(),
                    warning.getStatus().name(),
                    grace != null ? grace.getExpiresAt() : null,
                    grace != null ? grace.getDurationMinutes() : null
            );
        }
    }

    public record CandidateProcessRequest(
            @NotBlank
            String processName,
            String commandLine,
            Long pid
    ) {}

    public record CandidateProcessResponse(
            String decision,
            UUID warningId,
            Instant decisionDeadline,
            Instant graceExpiresAt,
            String reason
    ) {}
}
