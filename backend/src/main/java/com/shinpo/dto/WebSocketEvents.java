package com.shinpo.dto;

import com.shinpo.entity.FocusSession;
import com.shinpo.entity.SentinelQuarantineRecord;

import java.time.Instant;

/**
 * Real-Time WebSocket Telemetry event payloads pushed across STOMP broker channels.
 */
public class WebSocketEvents {

    public record SentinelQuarantineEvent(
            Long id,
            Long userId,
            Long sessionId,
            Long pid,
            String processName,
            String commandLine,
            String policyAction,
            String enforcementMode,
            String reason,
            Instant detectedAt
    ) {
        public static SentinelQuarantineEvent from(SentinelQuarantineRecord record) {
            return new SentinelQuarantineEvent(
                    record.getId(),
                    record.getUser() != null ? record.getUser().getId() : null,
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

    public record SentinelStatusEvent(
            Long userId,
            String enforcementMode,
            boolean policyLocked,
            int blockedCount,
            int allowedCount,
            Instant timestamp
    ) {}

    public record FocusSessionEvent(
            Long sessionId,
            Long userId,
            String sessionName,
            String status,
            Integer durationMinutes,
            String intention,
            Instant startedAt,
            Instant endedAt,
            Instant timestamp
    ) {
        public static FocusSessionEvent from(FocusSession session) {
            return new FocusSessionEvent(
                    session.getId(),
                    session.getUser() != null ? session.getUser().getId() : null,
                    session.getName(),
                    session.getStatus() != null ? session.getStatus().name() : "UNKNOWN",
                    session.getDurationMinutes(),
                    session.getIntention(),
                    session.getStartedAt(),
                    session.getEndedAt(),
                    Instant.now()
            );
        }
    }
}
