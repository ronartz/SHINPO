package com.shinpo.dto;

import com.shinpo.entity.SentinelPolicyRule;
import com.shinpo.entity.SentinelQuarantineRecord;

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
}
