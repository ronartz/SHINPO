package com.shinpo.websocket;

import com.shinpo.dto.SentinelDtos.RecordQuarantineRequest;
import com.shinpo.dto.WebSocketEvents.*;
import com.shinpo.entity.FocusSession;
import com.shinpo.entity.FocusSessionStatus;
import com.shinpo.entity.SentinelQuarantineRecord;
import com.shinpo.entity.User;
import com.shinpo.repository.FocusSessionRepository;
import com.shinpo.repository.SentinelQuarantineRepository;
import com.shinpo.repository.UserRepository;
import com.shinpo.service.SentinelEnforcementService;
import com.shinpo.service.WebSocketEventService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@SpringBootTest
@ActiveProfiles("test")
class WebSocketBroadcastingTests {

    @Autowired
    private WebSocketEventService webSocketEventService;

    @Autowired
    private SentinelEnforcementService sentinelService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private FocusSessionRepository sessionRepository;

    @Autowired
    private SentinelQuarantineRepository quarantineRepository;

    @MockitoBean
    private SimpMessagingTemplate messagingTemplate;

    private User testUser;

    @BeforeEach
    void setup() {
        testUser = new User(
                "ws_tester_" + System.currentTimeMillis(),
                "ws_" + System.currentTimeMillis() + "@shinpo.local",
                "$2a$10$abcdefghijklmnopqrstuvwxyzABCDEF",
                Instant.now()
        );
        testUser = userRepository.save(testUser);
    }

    @AfterEach
    void tearDown() {
        quarantineRepository.deleteAll(quarantineRepository.findAllByUser_IdOrderByDetectedAtDesc(testUser.getId()));
        sessionRepository.deleteAll(sessionRepository.findAllByUser_IdOrderByCreatedAtDesc(testUser.getId()));
        userRepository.deleteById(testUser.getId());
    }

    @Test
    @DisplayName("WebSocket: broadcastQuarantine dispatches to user topic and global sentinel topic")
    void testBroadcastQuarantine_dispatchesCorrectTopics() {
        SentinelQuarantineRecord record = new SentinelQuarantineRecord(
                testUser,
                null,
                11223L,
                "vlc",
                "/usr/bin/vlc",
                "TERMINATED",
                "STRICT",
                "Distraction active"
        );

        webSocketEventService.broadcastQuarantine(testUser.getId(), record);

        ArgumentCaptor<SentinelQuarantineEvent> captor = ArgumentCaptor.forClass(SentinelQuarantineEvent.class);

        verify(messagingTemplate).convertAndSend(
                eq("/topic/users/" + testUser.getId() + "/sentinel/quarantine"),
                captor.capture()
        );
        verify(messagingTemplate).convertAndSend(
                eq("/topic/sentinel/quarantine"),
                captor.capture()
        );

        SentinelQuarantineEvent captured = captor.getValue();
        assertEquals(11223L, captured.pid());
        assertEquals("vlc", captured.processName());
        assertEquals("TERMINATED", captured.policyAction());
        assertEquals("STRICT", captured.enforcementMode());
    }

    @Test
    @DisplayName("WebSocket: broadcastSentinelStatus dispatches status event to user channel")
    void testBroadcastSentinelStatus() {
        webSocketEventService.broadcastSentinelStatus(testUser.getId(), "STRICT", true, 5, 2);

        ArgumentCaptor<SentinelStatusEvent> captor = ArgumentCaptor.forClass(SentinelStatusEvent.class);
        verify(messagingTemplate).convertAndSend(
                eq("/topic/users/" + testUser.getId() + "/sentinel/status"),
                captor.capture()
        );

        SentinelStatusEvent status = captor.getValue();
        assertEquals(testUser.getId(), status.userId());
        assertEquals("STRICT", status.enforcementMode());
        assertTrue(status.policyLocked());
        assertEquals(5, status.blockedCount());
        assertEquals(2, status.allowedCount());
    }

    @Test
    @DisplayName("WebSocket: broadcastFocusSession dispatches session state transition")
    void testBroadcastFocusSession() {
        FocusSession session = new FocusSession();
        session.setUser(testUser);
        session.setName("WebSocket Live Sprint");
        session.setStatus(FocusSessionStatus.ACTIVE);
        session.setStartedAt(Instant.now());
        session.setDurationMinutes(35);
        session.setIntention("Zero Distraction Coding");
        session = sessionRepository.save(session);

        webSocketEventService.broadcastFocusSession(testUser.getId(), session);

        ArgumentCaptor<FocusSessionEvent> captor = ArgumentCaptor.forClass(FocusSessionEvent.class);
        verify(messagingTemplate).convertAndSend(
                eq("/topic/users/" + testUser.getId() + "/focus-session"),
                captor.capture()
        );

        FocusSessionEvent event = captor.getValue();
        assertEquals(session.getId(), event.sessionId());
        assertEquals(testUser.getId(), event.userId());
        assertEquals("WebSocket Live Sprint", event.sessionName());
        assertEquals("ACTIVE", event.status());
        assertEquals(35, event.durationMinutes());
    }

    @Test
    @DisplayName("Integration: SentinelEnforcementService triggers WebSocket event on external quarantine")
    void testSentinelService_triggersQuarantineWebSocketBroadcast() {
        RecordQuarantineRequest req = new RecordQuarantineRequest(
                99112L,
                "discord",
                "/usr/bin/discord",
                "TERMINATED",
                "STRICT",
                "Enforced by native Rust shield daemon"
        );

        sentinelService.recordExternalQuarantine(testUser.getId(), req);

        verify(messagingTemplate, atLeastOnce()).convertAndSend(
                eq("/topic/users/" + testUser.getId() + "/sentinel/quarantine"),
                any(SentinelQuarantineEvent.class)
        );
    }
}
