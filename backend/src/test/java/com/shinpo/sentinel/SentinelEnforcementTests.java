package com.shinpo.sentinel;

import com.shinpo.dto.SentinelDtos.*;
import com.shinpo.entity.FocusSession;
import com.shinpo.entity.FocusSessionStatus;
import com.shinpo.entity.SentinelTamperEvent;
import com.shinpo.entity.User;
import com.shinpo.repository.FocusSessionRepository;
import com.shinpo.repository.SentinelTamperEventRepository;
import com.shinpo.repository.UserRepository;
import com.shinpo.service.SentinelEnforcementService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
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

    @Autowired
    private SentinelTamperEventRepository tamperEventRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private User testUser;

    @BeforeEach
    void setUp() {
        testUser = new User(
                "sentinel_user_" + System.currentTimeMillis(),
                "sentinel_" + System.currentTimeMillis() + "@shinpo.io",
                passwordEncoder.encode("SecretPass123!"),
                Instant.now()
        );
        testUser = userRepository.save(testUser);
        sentinelService.setEnforcementMode(testUser.getId(), "STRICT");
    }

    @Test
    @DisplayName("Status reports IDLE and unlocked when no active focus sprint is running")
    void testStatusWhenIdle() {
        SentinelStatusResponse status = sentinelService.getSentinelStatus(testUser.getId());
        assertNotNull(status);
        assertEquals("IDLE", status.status());
        assertNull(status.activeFocusSessionName());
        assertNotNull(status.enforcementMode());
        assertFalse(status.isPolicyLocked(), "Policy should not be locked when IDLE");
    }

    @Test
    @DisplayName("Status reports ACTIVE_DEFENSE and isPolicyLocked when an ACTIVE focus session exists in STRICT mode")
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
        assertTrue(status.isPolicyLocked(), "Policy must be locked during active STRICT sprint");
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
    @DisplayName("Enforcement mode switching between STRICT, AUDIT_ONLY, and CONTAINMENT when idle")
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
    @DisplayName("Administrative Policy Gate: blocks mode downgrade during active STRICT sprint and logs tamper attempt")
    void testPolicyGateBlocksModeDowngradeDuringActiveStrictSession() {
        FocusSession session = new FocusSession();
        session.setUser(testUser);
        session.setName("Active Sprint Under Siege");
        session.setDurationMinutes(30);
        session.setStatus(FocusSessionStatus.ACTIVE);
        session.setStartedAt(Instant.now());
        sessionRepository.save(session);

        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> {
            sentinelService.setEnforcementMode(testUser.getId(), "AUDIT_ONLY");
        });
        assertTrue(ex.getMessage().contains("Administrative Policy Gate"));

        // Verify tamper audit event was logged
        List<SentinelTamperEvent> tamperEvents = tamperEventRepository.findAllByUser_IdOrderByCreatedAtDesc(testUser.getId());
        assertFalse(tamperEvents.isEmpty());
        assertEquals("UNAUTHORIZED_MODE_CHANGE_ATTEMPT", tamperEvents.get(0).getEventType());
        assertEquals("HIGH", tamperEvents.get(0).getSeverity());
    }

    @Test
    @DisplayName("Administrative Policy Gate: blocks rule deletion during active STRICT sprint and logs tamper attempt")
    void testPolicyGateBlocksRuleDeletionDuringActiveStrictSession() {
        AddPolicyRuleRequest addReq = new AddPolicyRuleRequest("procrastination_app", "BLOCKED");
        PolicyRuleResponse rule = sentinelService.addPolicyRule(testUser.getId(), addReq);

        FocusSession session = new FocusSession();
        session.setUser(testUser);
        session.setName("Locked Execution Sprint");
        session.setDurationMinutes(40);
        session.setStatus(FocusSessionStatus.ACTIVE);
        session.setStartedAt(Instant.now());
        sessionRepository.save(session);

        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> {
            sentinelService.deletePolicyRule(testUser.getId(), rule.id());
        });
        assertTrue(ex.getMessage().contains("Administrative Policy Gate"));

        // Verify tamper audit event was logged
        List<SentinelTamperEvent> tamperEvents = tamperEventRepository.findAllByUser_IdOrderByCreatedAtDesc(testUser.getId());
        assertFalse(tamperEvents.isEmpty());
        assertEquals("UNAUTHORIZED_RULE_DELETION_ATTEMPT", tamperEvents.get(0).getEventType());
    }

    @Test
    @DisplayName("Emergency Override: valid password & 15+ char justification bypasses gate and logs CRITICAL audit")
    void testEmergencyOverrideWithValidPasswordAndReason() {
        FocusSession session = new FocusSession();
        session.setUser(testUser);
        session.setName("Urgent Interruption Session");
        session.setDurationMinutes(50);
        session.setStatus(FocusSessionStatus.ACTIVE);
        session.setStartedAt(Instant.now());
        sessionRepository.save(session);

        EmergencyOverrideRequest req = new EmergencyOverrideRequest(
                "SecretPass123!",
                "Urgent production deployment outage requires incident management tools",
                "AUDIT_ONLY"
        );
        EmergencyOverrideResponse res = sentinelService.emergencyOverride(testUser.getId(), req);

        assertTrue(res.success());
        assertEquals("AUDIT_ONLY", res.newMode());
        assertEquals("AUDIT_ONLY", sentinelService.getEnforcementMode(testUser.getId()));

        List<SentinelTamperEventItem> tamperItems = sentinelService.listTamperEvents(testUser.getId());
        assertFalse(tamperItems.isEmpty());
        assertEquals("EMERGENCY_OVERRIDE", tamperItems.get(0).eventType());
        assertEquals("CRITICAL", tamperItems.get(0).severity());
        assertEquals("Urgent production deployment outage requires incident management tools", tamperItems.get(0).justification());
    }

    @Test
    @DisplayName("Emergency Override: invalid password throws IllegalArgumentException")
    void testEmergencyOverrideRejectsInvalidPassword() {
        EmergencyOverrideRequest req = new EmergencyOverrideRequest(
                "IncorrectPassword!",
                "Valid reason that has plenty of characters to pass length check",
                "AUDIT_ONLY"
        );
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> {
            sentinelService.emergencyOverride(testUser.getId(), req);
        });
        assertTrue(ex.getMessage().contains("Invalid administrative password"));
    }

    @Test
    @DisplayName("Emergency Override: justification shorter than 15 characters is rejected")
    void testEmergencyOverrideRejectsShortReason() {
        EmergencyOverrideRequest req = new EmergencyOverrideRequest(
                "SecretPass123!",
                "Too short",
                "AUDIT_ONLY"
        );
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> {
            sentinelService.emergencyOverride(testUser.getId(), req);
        });
        assertTrue(ex.getMessage().contains("at least 15 characters"));
    }

    @Test
    @DisplayName("Protected system patterns cannot be quarantined or blocked")
    void testProtectedProcessGuards() {
        AddPolicyRuleRequest systemdRule = new AddPolicyRuleRequest("systemd", "BLOCKED");
        assertThrows(IllegalArgumentException.class, () -> {
            sentinelService.addPolicyRule(testUser.getId(), systemdRule);
        });

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
