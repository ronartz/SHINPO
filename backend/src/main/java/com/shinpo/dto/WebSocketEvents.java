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
            Instant timestamp,
            String mode,
            boolean isLocked
    ) {
        public SentinelStatusEvent(Long userId, String enforcementMode, boolean policyLocked, int blockedCount, int allowedCount, Instant timestamp) {
            this(userId, enforcementMode, policyLocked, blockedCount, allowedCount, timestamp, enforcementMode, policyLocked);
        }
    }

    public record FocusSessionEvent(
            Long sessionId,
            Long userId,
            String sessionName,
            String status,
            Integer durationMinutes,
            String intention,
            Instant startedAt,
            Instant endedAt,
            Instant timestamp,
            Long id,
            Integer plannedDurationMinutes
    ) {
        public FocusSessionEvent(
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
            this(sessionId, userId, sessionName, status, durationMinutes, intention, startedAt, endedAt, timestamp, sessionId, durationMinutes);
        }

        public static FocusSessionEvent from(FocusSession session) {
            Long sid = session.getId();
            Integer dur = session.getDurationMinutes();
            return new FocusSessionEvent(
                    sid,
                    session.getUser() != null ? session.getUser().getId() : null,
                    session.getName(),
                    session.getStatus() != null ? session.getStatus().name() : "UNKNOWN",
                    dur,
                    session.getIntention(),
                    session.getStartedAt(),
                    session.getEndedAt(),
                    Instant.now(),
                    sid,
                    dur
            );
        }
    }
}
