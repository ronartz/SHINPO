package com.shinpo.dto;

import com.shinpo.entity.SentinelPolicyRule;
import com.shinpo.entity.SentinelQuarantineRecord;
import com.shinpo.entity.SentinelTamperEvent;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;

public class SentinelDtos {

    public record SentinelStatusResponse(
            String status,
            Long activeFocusSessionId,
            String activeFocusSessionName,
            String enforcementMode,
            long totalInterceptedToday,
            long activePolicyRulesCount,
            long tamperEventsCount,
            boolean isPolicyLocked,
            List<SentinelQuarantineItem> recentQuarantines,
            Instant lastSweepAt
    ) {}

    public record SentinelQuarantineItem(
            Long id,
            Long focusSessionId,
            Long pid,
            String processName,
            String commandLine,
            String policyAction,
            String enforcementMode,
            String reason,
            Instant detectedAt
    ) {
        public static SentinelQuarantineItem from(SentinelQuarantineRecord record) {
            return new SentinelQuarantineItem(
                    record.getId(),
                    record.getFocusSession() != null ? record.getFocusSession().getId() : null,
                    record.getPid(),
                    record.getProcessName(),
                    record.getCommandLine(),
                    record.getPolicyAction(),
                    record.getEnforcementMode(),
                    record.getReason(),
                    record.getDetectedAt()
            );
        }
    }

    public record SentinelTamperEventItem(
            Long id,
            Long focusSessionId,
            String eventType,
            String severity,
            String enforcementMode,
            String justification,
            String details,
            Instant createdAt
    ) {
        public static SentinelTamperEventItem from(SentinelTamperEvent event) {
            return new SentinelTamperEventItem(
                    event.getId(),
                    event.getFocusSession() != null ? event.getFocusSession().getId() : null,
                    event.getEventType(),
                    event.getSeverity(),
                    event.getEnforcementMode(),
                    event.getJustification(),
                    event.getDetails(),
                    event.getCreatedAt()
            );
        }
    }

    public record SentinelSweepResponse(
            int scannedProcessCount,
            int interceptedCount,
            List<Long> interceptedPids,
            List<String> interceptedNames,
            String message,
            Instant timestamp
    ) {}

    public record AddPolicyRuleRequest(
            String processNamePattern,
            String policyType
    ) {}

    public record PolicyRuleResponse(
            Long id,
            String processNamePattern,
            String policyType,
            boolean isCustom,
            Instant createdAt
    ) {
        public static PolicyRuleResponse from(SentinelPolicyRule rule) {
            return new PolicyRuleResponse(
                    rule.getId(),
                    rule.getProcessNamePattern(),
                    rule.getPolicyType(),
                    Boolean.TRUE.equals(rule.getIsCustom()),
                    rule.getCreatedAt()
            );
        }
    }

    public record UpdateEnforcementModeRequest(
            String enforcementMode
    ) {}

    public record EmergencyOverrideRequest(
            @NotBlank
            String password,
            @NotBlank
            @Size(min = 15)
            String reason,
            String targetMode
    ) {}

    public record EmergencyOverrideResponse(
            boolean success,
            String message,
            String newMode,
            Instant timestamp
    ) {}

    public record RecordQuarantineRequest(
            Long pid,
            @NotBlank
            String processName,
            String commandLine,
            @NotBlank
            String policyAction,
            String enforcementMode,
            String reason
    ) {}

    public record SentinelDaemonSyncResponse(
            boolean hasActiveSession,
            Long activeSessionId,
            String activeSessionName,
            Integer durationMinutes,
            String intention,
            String enforcementMode,
            boolean isPolicyLocked,
            List<String> blockedPatterns,
            List<String> allowedPatterns,
            List<String> protectedProcesses,
            Instant serverTime
    ) {}

    public record BatchQuarantineRequest(
            List<RecordQuarantineRequest> records
    ) {}

    public record BatchQuarantineResponse(
            int processedCount,
            int savedCount,
            String message,
            Instant timestamp
    ) {}
}
