package com.shinpo.service;

import com.shinpo.dto.WebSocketEvents.*;
import com.shinpo.entity.FocusSession;
import com.shinpo.entity.SentinelQuarantineRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

/**
 * Service for broadcasting real-time events over the Spring STOMP WebSocket broker.
 */
@Service
public class WebSocketEventService {

    private static final Logger log = LoggerFactory.getLogger(WebSocketEventService.class);

    private final SimpMessagingTemplate messagingTemplate;

    public WebSocketEventService(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    public void broadcastQuarantine(Long userId, SentinelQuarantineRecord record) {
        if (record == null) {
            return;
        }
        try {
            SentinelQuarantineEvent event = SentinelQuarantineEvent.from(record);
            if (userId != null) {
                messagingTemplate.convertAndSend("/topic/users/" + userId + "/sentinel/quarantine", event);
            }
            messagingTemplate.convertAndSend("/topic/sentinel/quarantine", event);
            log.debug("WEBSOCKET_QUARANTINE_BROADCAST: user={} pid={} proc={}", userId, record.getPid(), record.getProcessName());
        } catch (Exception e) {
            log.warn("WEBSOCKET_BROADCAST_ERROR: Could not broadcast quarantine event: {}", e.getMessage());
        }
    }

    public void broadcastQuarantines(Long userId, List<SentinelQuarantineRecord> records) {
        if (records == null || records.isEmpty()) {
            return;
        }
        for (SentinelQuarantineRecord record : records) {
            broadcastQuarantine(userId, record);
        }
    }

    public void broadcastSentinelStatus(Long userId, String mode, boolean isLocked, int blockedCount, int allowedCount) {
        try {
            SentinelStatusEvent event = new SentinelStatusEvent(
                    userId,
                    mode,
                    isLocked,
                    blockedCount,
                    allowedCount,
                    Instant.now()
            );
            if (userId != null) {
                messagingTemplate.convertAndSend("/topic/users/" + userId + "/sentinel/status", event);
            }
            log.debug("WEBSOCKET_STATUS_BROADCAST: user={} mode={} locked={}", userId, mode, isLocked);
        } catch (Exception e) {
            log.warn("WEBSOCKET_BROADCAST_ERROR: Could not broadcast status event: {}", e.getMessage());
        }
    }

    public void broadcastFocusSession(Long userId, FocusSession session) {
        if (session == null) {
            return;
        }
        try {
            FocusSessionEvent event = FocusSessionEvent.from(session);
            if (userId != null) {
                messagingTemplate.convertAndSend("/topic/users/" + userId + "/focus-session", event);
            }
            messagingTemplate.convertAndSend("/topic/focus-session", event);
            log.debug("WEBSOCKET_SESSION_BROADCAST: user={} session={} status={}",
                    userId, session.getId(), session.getStatus());
        } catch (Exception e) {
            log.warn("WEBSOCKET_BROADCAST_ERROR: Could not broadcast focus session event: {}", e.getMessage());
        }
    }
}
