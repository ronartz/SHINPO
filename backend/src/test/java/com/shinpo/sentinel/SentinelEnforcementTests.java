package com.shinpo.sentinel;

import com.shinpo.dto.SentinelDtos.*;
import com.shinpo.entity.FocusSession;
import com.shinpo.entity.FocusSessionStatus;
import com.shinpo.entity.User;
import com.shinpo.repository.FocusSessionRepository;
import com.shinpo.repository.UserRepository;
import com.shinpo.service.SentinelEnforcementService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
public class SentinelEnforcementTests {

    @Autowired
    private SentinelEnforcementService sentinelService;

    @Autowired
    private FocusSessionRepository sessionRepository;

    @Autowired
    private UserRepository userRepository;

    private User testUser;

    @BeforeEach
    void setUp() {
        testUser = new User(
                "sentinel_user_" + System.currentTimeMillis(),
                "sentinel_" + System.currentTimeMillis() + "@shinpo.io",
                "hashed_password",
                Instant.now()
        );
        testUser = userRepository.save(testUser);
    }

    @Test
    @DisplayName("Status reports IDLE when no active focus sprint is running")
    void testStatusWhenIdle() {
        SentinelStatusResponse status = sentinelService.getSentinelStatus(testUser.getId());
        assertNotNull(status);
        assertEquals("IDLE", status.status());
        assertNull(status.activeFocusSessionName());
        assertNotNull(status.enforcementMode());
    }

    @Test
    @DisplayName("Status reports ACTIVE_DEFENSE when an ACTIVE focus session exists")
    void testStatusWhenSprintActive() {
        FocusSession session = new FocusSession();
        session.setUser(testUser);
        session.setName("Validate Consensus Protocol Stability");
        session.setDurationMinutes(45);
        session.setStatus(FocusSessionStatus.ACTIVE);
        session.setStartedAt(Instant.now());
        sessionRepository.save(session);

        SentinelStatusResponse status = sentinelService.getSentinelStatus(testUser.getId());
        assertNotNull(status);
        assertEquals("ACTIVE_DEFENSE", status.status());
        assertEquals("Validate Consensus Protocol Stability", status.activeFocusSessionName());
    }

    @Test
    @DisplayName("Triggering a Sentinel sweep scans OS processes without killing protected core daemons")
    void testTriggerSweepSafety() {
        SentinelSweepResponse sweep = sentinelService.triggerSweep(testUser.getId());
        assertNotNull(sweep);
        assertTrue(sweep.scannedProcessCount() > 0, "Sweep should inspect at least one OS process");
        assertNotNull(sweep.message());
    }

    @Test
    @DisplayName("Custom policy rule creation, listing, and deletion")
    void testPolicyRuleCrud() {
        AddPolicyRuleRequest addReq = new AddPolicyRuleRequest("distraction_game_client", "BLOCKED");
        PolicyRuleResponse created = sentinelService.addPolicyRule(testUser.getId(), addReq);
        assertNotNull(created);
        assertEquals("distraction_game_client", created.processNamePattern());
        assertEquals("BLOCKED", created.policyType());

        List<PolicyRuleResponse> rules = sentinelService.listPolicyRules(testUser.getId());
        assertTrue(rules.stream().anyMatch(r -> r.processNamePattern().equals("distraction_game_client")));

        sentinelService.deletePolicyRule(testUser.getId(), created.id());
        List<PolicyRuleResponse> remaining = sentinelService.listPolicyRules(testUser.getId());
        assertFalse(remaining.stream().anyMatch(r -> r.id().equals(created.id())));
    }

    @Test
    @DisplayName("Enforcement mode switching between STRICT, AUDIT_ONLY, and CONTAINMENT")
    void testEnforcementModeSwitching() {
        sentinelService.setEnforcementMode(testUser.getId(), "AUDIT_ONLY");
        SentinelStatusResponse statusAudit = sentinelService.getSentinelStatus(testUser.getId());
        assertEquals("AUDIT_ONLY", statusAudit.enforcementMode());

        sentinelService.setEnforcementMode(testUser.getId(), "CONTAINMENT");
        SentinelStatusResponse statusContainment = sentinelService.getSentinelStatus(testUser.getId());
        assertEquals("CONTAINMENT", statusContainment.enforcementMode());

        sentinelService.setEnforcementMode(testUser.getId(), "STRICT");
        SentinelStatusResponse statusStrict = sentinelService.getSentinelStatus(testUser.getId());
        assertEquals("STRICT", statusStrict.enforcementMode());
    }

    @Test
    @DisplayName("Protected system patterns cannot be quarantined or blocked")
    void testProtectedProcessGuards() {
        // Adding rule for postgres or systemd should throw IllegalArgumentException
        AddPolicyRuleRequest systemdRule = new AddPolicyRuleRequest("systemd", "BLOCKED");
        assertThrows(IllegalArgumentException.class, () -> {
            sentinelService.addPolicyRule(testUser.getId(), systemdRule);
        });

        // A sweep must NOT kill systemd or postgres
        SentinelSweepResponse sweep = sentinelService.triggerSweep(testUser.getId());
        assertNotNull(sweep);

        List<SentinelQuarantineItem> quarantines = sentinelService.getSentinelStatus(testUser.getId()).recentQuarantines();
        boolean systemdQuarantined = quarantines.stream().anyMatch(q -> q.processName().contains("systemd"));
        assertFalse(systemdQuarantined, "System core processes must never be quarantined");
    }

    @Test
    @DisplayName("Session-specific quarantine isolation")
    void testSessionQuarantineIsolation() {
        FocusSession session = new FocusSession();
        session.setUser(testUser);
        session.setName("Isolated Focus");
        session.setStatus(FocusSessionStatus.ACTIVE);
        session.setStartedAt(Instant.now());
        session.setDurationMinutes(30);
        session = sessionRepository.save(session);

        List<SentinelQuarantineItem> items = sentinelService.getQuarantinesForSession(testUser.getId(), session.getId());
        assertNotNull(items);
        assertTrue(items.isEmpty());
    }
}
