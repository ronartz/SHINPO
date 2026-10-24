package com.shinpo.service;

import com.shinpo.dto.ContextualFocusDtos.*;
import com.shinpo.entity.*;
import com.shinpo.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class ContextualFocusPolicyServiceTests {

    @Autowired private ContextualFocusPolicyService policyService;
    @Autowired private ContextualFocusResourceRepository resourceRepository;
    @Autowired private ContextualPolicyAuditEventRepository auditRepository;
    @Autowired private FocusSessionEnforcementExceptionRepository processExceptionRepository;
    @Autowired private SentinelPolicyRuleRepository sentinelPolicyRuleRepository;
    @Autowired private ContextualEnforcementDecisionService processDecisionService;
    @Autowired private SentinelEnforcementService sentinelEnforcementService;
    @Autowired private FocusSessionRepository sessionRepository;
    @Autowired private GoalRepository goalRepository;
    @Autowired private MissionRepository missionRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    private User user1;
    private User user2;
    private Mission task1;
    private FocusSession activeSession1;
    private FocusSession activeSession2;

    @BeforeEach
    void setUp() {
        long suffix = System.nanoTime();
        user1 = userRepository.save(new User(
                "context_user_1_" + suffix,
                "context1_" + suffix + "@shinpo.test",
                passwordEncoder.encode("StrongPass123!"),
                Instant.now()
        ));
        user2 = userRepository.save(new User(
                "context_user_2_" + suffix,
                "context2_" + suffix + "@shinpo.test",
                passwordEncoder.encode("StrongPass123!"),
                Instant.now()
        ));

        Goal goal1 = goalRepository.save(new Goal(
                "Learn Spring Security",
                "Authentication study",
                LocalDate.now(),
                LocalDate.now().plusDays(14),
                user1
        ));
        task1 = missionRepository.save(new Mission(
                "Learn Spring Boot Authentication",
                "Complete an authentication tutorial",
                LocalDate.now(),
                45,
                goal1
        ));

        activeSession1 = session(user1, task1, FocusSessionStatus.ACTIVE, "Authentication study");
        activeSession2 = session(user2, null, FocusSessionStatus.ACTIVE, "Other user study");
    }

    @Test
    @DisplayName("A specific approved YouTube video outranks a broader blocked domain")
    void approvedVideoOutranksBroadDomainBlock() {
        ResourceResponse broadBlock = createTaskResource(
                ContextualResourceType.WEBSITE,
                ContextualResourceMatchType.DOMAIN,
                ContextualResourceDisposition.BLOCKED,
                "youtube.com"
        );
        ResourceResponse videoApproval = createTaskResource(
                ContextualResourceType.YOUTUBE_VIDEO,
                ContextualResourceMatchType.EXACT,
                ContextualResourceDisposition.APPROVED,
                "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        );

        PolicyEvaluationResponse approved = policyService.evaluate(
                user1.getId(),
                activeSession1.getId(),
                new EvaluateResourceRequest("https://m.youtube.com/watch?v=dQw4w9WgXcQ", null)
        );
        PolicyEvaluationResponse otherVideo = policyService.evaluate(
                user1.getId(),
                activeSession1.getId(),
                new EvaluateResourceRequest("https://youtube.com/watch?v=9bZkp7q19f0", null)
        );
        PolicyEvaluationResponse lookalike = policyService.evaluate(
                user1.getId(),
                activeSession1.getId(),
                new EvaluateResourceRequest("https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ", null)
        );

        assertEquals(ContextualPolicyDecision.ALLOW, approved.decision());
        assertEquals(videoApproval.id(), approved.matchedResourceId());
        assertEquals(ContextualPolicyDecision.RESTRICT, otherVideo.decision());
        assertEquals(broadBlock.id(), otherVideo.matchedResourceId());
        assertEquals(ContextualPolicyDecision.UNCERTAIN, lookalike.decision());
    }

    @Test
    @DisplayName("Exact restrictions outrank domain approvals and equal-specificity blocks win")
    void exactBlocksWinAtExplicitPrecedenceBoundaries() {
        createSessionResource(
                ContextualResourceType.WEBSITE,
                ContextualResourceMatchType.DOMAIN,
                ContextualResourceDisposition.APPROVED,
                "docs.example.com",
                null
        );
        ResourceResponse exactBlock = createSessionResource(
                ContextualResourceType.WEBSITE,
                ContextualResourceMatchType.EXACT,
                ContextualResourceDisposition.BLOCKED,
                "https://docs.example.com/off-topic?b=2&a=1",
                null
        );
        createSessionResource(
                ContextualResourceType.WEBSITE,
                ContextualResourceMatchType.EXACT,
                ContextualResourceDisposition.APPROVED,
                "https://docs.example.com/off-topic?a=1&b=2",
                null
        );

        PolicyEvaluationResponse decision = policyService.evaluate(
                user1.getId(),
                activeSession1.getId(),
                new EvaluateResourceRequest("https://DOCS.example.com:443/off-topic?b=2&a=1#section", null)
        );

        assertEquals(ContextualPolicyDecision.RESTRICT, decision.decision());
        assertEquals(exactBlock.id(), decision.matchedResourceId());
    }

    @Test
    @DisplayName("Guided mode warns for explicit blocks but leaves unmatched browsing available")
    void guidedModeIsPredictableAndSeparateFromNativeMode() {
        createSessionResource(
                ContextualResourceType.WEBSITE,
                ContextualResourceMatchType.DOMAIN,
                ContextualResourceDisposition.BLOCKED,
                "instagram.com",
                null
        );
        long previousRevision = activeSession1.getContextPolicyRevision();
        policyService.updateMode(user1.getId(), activeSession1.getId(), ContextualFocusMode.GUIDED);

        PolicyEvaluationResponse blocked = policyService.evaluate(
                user1.getId(),
                activeSession1.getId(),
                new EvaluateResourceRequest("https://www.instagram.com/reels/", null)
        );
        PolicyEvaluationResponse unknown = policyService.evaluate(
                user1.getId(),
                activeSession1.getId(),
                new EvaluateResourceRequest("https://docs.spring.io/", null)
        );

        assertEquals(ContextualPolicyDecision.WARN, blocked.decision());
        assertEquals(ContextualPolicyDecision.ALLOW, unknown.decision());
        assertEquals("STRICT", userRepository.findById(user1.getId()).orElseThrow().getEnforcementMode());
        assertTrue(sessionRepository.findById(activeSession1.getId()).orElseThrow().getContextPolicyRevision() > previousRevision);
    }

    @Test
    @DisplayName("Temporary exceptions override a block only until their exact expiry")
    void temporaryExceptionExpiresDeterministically() {
        String destination = "https://example.com/specific/article?part=1";
        createSessionResource(
                ContextualResourceType.WEBSITE,
                ContextualResourceMatchType.EXACT,
                ContextualResourceDisposition.BLOCKED,
                destination,
                null
        );
        Instant expiry = Instant.now().plusSeconds(120);
        ResourceResponse temporary = createSessionResource(
                ContextualResourceType.TEMPORARY_SITE,
                ContextualResourceMatchType.EXACT,
                ContextualResourceDisposition.APPROVED,
                destination,
                expiry
        );

        PolicyEvaluationResponse before = policyService.evaluateAt(
                user1.getId(), activeSession1.getId(), destination, expiry.minusSeconds(1)
        );
        PolicyEvaluationResponse atExpiry = policyService.evaluateAt(
                user1.getId(), activeSession1.getId(), destination, expiry
        );

        assertEquals(ContextualPolicyDecision.ALLOW, before.decision());
        assertEquals(temporary.id(), before.matchedResourceId());
        assertEquals(ContextualPolicyDecision.RESTRICT, atExpiry.decision());
    }

    @Test
    @DisplayName("Paused/completed sessions publish an immediately expired, rule-free policy")
    void inactiveLifecycleCannotLeaveStaleRestrictions() {
        activeSession1.setStatus(FocusSessionStatus.PAUSED);
        activeSession1.setPausedAt(Instant.now());
        sessionRepository.saveAndFlush(activeSession1);

        PolicyEvaluationResponse evaluation = policyService.evaluate(
                user1.getId(),
                activeSession1.getId(),
                new EvaluateResourceRequest("https://example.com", null)
        );
        PolicySnapshotResponse snapshot = policyService.getPolicy(user1.getId(), activeSession1.getId());

        assertEquals(ContextualPolicyDecision.INACTIVE, evaluation.decision());
        assertEquals(FocusSessionStatus.PAUSED, snapshot.status());
        assertEquals(0L, snapshot.leaseSeconds());
        assertTrue(snapshot.resources().isEmpty());
        assertEquals(snapshot.issuedAt(), snapshot.leaseExpiresAt());
    }

    @Test
    @DisplayName("Policy snapshots are versioned, bounded, task-aware, and omit expired resources")
    void snapshotHasBoundedLeaseAndMonotonicRevision() {
        long initialRevision = activeSession1.getContextPolicyRevision();
        ResourceResponse approved = createTaskResource(
                ContextualResourceType.WEBSITE,
                ContextualResourceMatchType.EXACT,
                ContextualResourceDisposition.APPROVED,
                "https://docs.spring.io/spring-security/reference/"
        );
        createSessionResource(
                ContextualResourceType.TEMPORARY_SITE,
                ContextualResourceMatchType.EXACT,
                ContextualResourceDisposition.APPROVED,
                "https://example.com/expired",
                Instant.now().plusMillis(100)
        );

        PolicySnapshotResponse snapshot = policyService.getActivePolicy(user1.getId());

        assertEquals(activeSession1.getId(), snapshot.sessionId());
        assertEquals(task1.getId(), snapshot.taskId());
        assertEquals(task1.getTitle(), snapshot.taskTitle());
        assertEquals(SessionIntervalType.FOCUS, snapshot.currentPhase());
        assertTrue(snapshot.phaseRemainingSeconds() <= 45L * 60L);
        assertNotNull(snapshot.phaseDeadlineAt());
        assertTrue(snapshot.policyVersion() > initialRevision);
        assertEquals(60L, snapshot.leaseSeconds());
        assertEquals(Duration.ofSeconds(60), Duration.between(snapshot.issuedAt(), snapshot.leaseExpiresAt()));
        assertTrue(snapshot.resources().stream().anyMatch(resource -> resource.id().equals(approved.id())));
        assertEquals("https://docs.spring.io/spring-security/reference/", snapshot.returnUrl());
    }

    @Test
    @DisplayName("Break and grace policy allows approved resources and restricts unlisted sites")
    void breakPolicyRequiresExplicitlyApprovedResources() {
        activeSession1.setCurrentPhase(SessionIntervalType.LONG_BREAK);
        sessionRepository.saveAndFlush(activeSession1);
        createSessionResource(ContextualResourceType.WEBSITE, ContextualResourceMatchType.DOMAIN,
                ContextualResourceDisposition.APPROVED, "https://game.example", null);
        policyService.createResource(user1.getId(), new CreateResourceRequest(
                null, activeSession1.getId(), ContextualResourceType.WEBSITE,
                ContextualResourceMatchType.DOMAIN, ContextualResourceDisposition.APPROVED,
                "https://break-game.example", null, null, true
        ));

        assertEquals(ContextualPolicyDecision.RESTRICT, policyService.evaluate(user1.getId(), activeSession1.getId(),
                new EvaluateResourceRequest("https://game.example/play", null)).decision());
        assertEquals(ContextualPolicyDecision.ALLOW, policyService.evaluate(user1.getId(), activeSession1.getId(),
                new EvaluateResourceRequest("https://break-game.example/play", null)).decision());
        assertEquals(ContextualPolicyDecision.RESTRICT, policyService.evaluate(user1.getId(), activeSession1.getId(),
                new EvaluateResourceRequest("https://unlisted.example", null)).decision());

        activeSession1.setCurrentPhase(SessionIntervalType.GRACE);
        sessionRepository.saveAndFlush(activeSession1);
        assertEquals(ContextualPolicyDecision.ALLOW, policyService.evaluate(user1.getId(), activeSession1.getId(),
                new EvaluateResourceRequest("https://break-game.example/play", null)).decision());

        activeSession1.setCurrentPhase(SessionIntervalType.RETURN_REQUIRED);
        sessionRepository.saveAndFlush(activeSession1);
        assertEquals(ContextualPolicyDecision.RESTRICT, policyService.evaluate(user1.getId(), activeSession1.getId(),
                new EvaluateResourceRequest("https://break-game.example/play", null)).decision());
    }

    @Test
    @DisplayName("Desktop resources reuse PROCESS exceptions and delete them with the resource")
    void desktopProcessResourcesReuseExistingExceptionPipeline() {
        sentinelPolicyRuleRepository.save(new SentinelPolicyRule(user1, "discord", "BLOCKED"));
        ResourceResponse resource = createSessionResource(
                ContextualResourceType.DESKTOP_PROCESS,
                ContextualResourceMatchType.PROCESS,
                ContextualResourceDisposition.APPROVED,
                "Discord",
                null
        );

        assertNotNull(resource.processExceptionId());
        assertTrue(processExceptionRepository.findById(resource.processExceptionId()).isPresent());
        assertEquals(
                ContextualEnforcementDecisionService.PolicyDecision.ALLOW,
                processDecisionService.evaluateProcess(user1.getId(), "discord")
        );

        policyService.deleteResource(user1.getId(), resource.id());

        assertFalse(processExceptionRepository.findById(resource.processExceptionId()).isPresent());
        assertEquals(
                ContextualEnforcementDecisionService.PolicyDecision.ENFORCE,
                processDecisionService.evaluateProcess(user1.getId(), "discord")
        );
    }

    @Test
    @DisplayName("Break-only desktop applications are allowed only in break phases")
    void breakOnlyDesktopProcessFollowsPersistedSessionPhase() {
        ResourceResponse resource = policyService.createResource(user1.getId(), new CreateResourceRequest(
                null, activeSession1.getId(), ContextualResourceType.DESKTOP_PROCESS,
                ContextualResourceMatchType.PROCESS, ContextualResourceDisposition.APPROVED,
                "test-game", null, null, true
        ));
        sentinelPolicyRuleRepository.save(new SentinelPolicyRule(user1, "test-game", "BLOCKED"));

        assertEquals(ContextualEnforcementDecisionService.PolicyDecision.ENFORCE,
                processDecisionService.evaluateProcess(user1.getId(), "test-game", activeSession1));
        activeSession1.setCurrentPhase(SessionIntervalType.SHORT_BREAK);
        assertEquals(ContextualEnforcementDecisionService.PolicyDecision.ALLOW,
                processDecisionService.evaluateProcess(user1.getId(), "test-game", activeSession1));
        activeSession1.setCurrentPhase(SessionIntervalType.GRACE);
        assertEquals(ContextualEnforcementDecisionService.PolicyDecision.ALLOW,
                processDecisionService.evaluateProcess(user1.getId(), "test-game", activeSession1));
        activeSession1.setCurrentPhase(SessionIntervalType.RETURN_REQUIRED);
        assertEquals(ContextualEnforcementDecisionService.PolicyDecision.ENFORCE,
                processDecisionService.evaluateProcess(user1.getId(), "test-game", activeSession1));

        policyService.deleteResource(user1.getId(), resource.id());
        assertEquals(ContextualEnforcementDecisionService.PolicyDecision.ENFORCE,
                processDecisionService.evaluateProcess(user1.getId(), "test-game", activeSession1));
    }

    @Test
    @DisplayName("Native Shield sync advertises break-only apps only in Break and Grace")
    void nativeShieldSyncUsesBreakPhaseAllowlist() {
        policyService.createResource(user1.getId(), new CreateResourceRequest(
                null, activeSession1.getId(), ContextualResourceType.DESKTOP_PROCESS,
                ContextualResourceMatchType.PROCESS, ContextualResourceDisposition.APPROVED,
                "test-game", null, null, true
        ));
        sentinelPolicyRuleRepository.save(new SentinelPolicyRule(user1, "test-game", "BLOCKED"));
        sentinelPolicyRuleRepository.save(new SentinelPolicyRule(user1, "test", "ALLOWED"));

        var focusSync = sentinelEnforcementService.getDaemonSyncState(user1.getId());
        assertTrue(focusSync.blockedPatterns().contains("test-game"));
        assertFalse(focusSync.allowedPatterns().contains("test-game"));
        assertFalse(focusSync.allowedPatterns().contains("test"));

        activeSession1.setCurrentPhase(SessionIntervalType.SHORT_BREAK);
        sessionRepository.saveAndFlush(activeSession1);
        var breakSync = sentinelEnforcementService.getDaemonSyncState(user1.getId());
        assertFalse(breakSync.blockedPatterns().contains("test-game"));
        assertTrue(breakSync.allowedPatterns().contains("test-game"));
        assertFalse(breakSync.allowedPatterns().contains("test"));

        activeSession1.setCurrentPhase(SessionIntervalType.RETURN_REQUIRED);
        sessionRepository.saveAndFlush(activeSession1);
        var cutoffSync = sentinelEnforcementService.getDaemonSyncState(user1.getId());
        assertTrue(cutoffSync.blockedPatterns().contains("test-game"));
        assertFalse(cutoffSync.allowedPatterns().contains("test-game"));
    }

    @Test
    @DisplayName("Every task/session lookup and mutation is isolated by authenticated owner")
    void crossUserIsolationCoversReadEvaluateAndDelete() {
        ResourceResponse resource = createSessionResource(
                ContextualResourceType.WEBSITE,
                ContextualResourceMatchType.EXACT,
                ContextualResourceDisposition.APPROVED,
                "https://spring.io/guides",
                null
        );

        assertNotFound(() -> policyService.listResources(user2.getId(), null, activeSession1.getId()));
        assertNotFound(() -> policyService.getPolicy(user2.getId(), activeSession1.getId()));
        assertNotFound(() -> policyService.evaluate(
                user2.getId(),
                activeSession1.getId(),
                new EvaluateResourceRequest("https://spring.io/guides", null)
        ));
        assertNotFound(() -> policyService.deleteResource(user2.getId(), resource.id()));
        assertTrue(resourceRepository.findById(resource.id()).isPresent());
        assertTrue(policyService.listResources(user2.getId(), null, activeSession2.getId()).isEmpty());
    }

    @Test
    @DisplayName("Policy mutation audit stores coarse change metadata, not evaluated destinations")
    void mutationAuditIsCoarseAndUserScoped() {
        ResourceResponse resource = createTaskResource(
                ContextualResourceType.WEBSITE,
                ContextualResourceMatchType.DOMAIN,
                ContextualResourceDisposition.APPROVED,
                "spring.io"
        );
        policyService.updateMode(user1.getId(), activeSession1.getId(), ContextualFocusMode.STRICT);
        policyService.deleteResource(user1.getId(), resource.id());

        List<PolicyAuditResponse> audit = policyService.listAudit(user1.getId(), activeSession1.getId());
        assertTrue(audit.stream().anyMatch(event -> event.changeType().equals("RESOURCE_CREATED")));
        assertTrue(audit.stream().anyMatch(event -> event.changeType().equals("MODE_CHANGED")));
        assertTrue(audit.stream().anyMatch(event -> event.changeType().equals("RESOURCE_DELETED")));
        assertTrue(audit.stream().allMatch(event -> event.sessionId().equals(activeSession1.getId())));
        assertTrue(auditRepository.findAllByUser_IdOrderByCreatedAtDesc(user2.getId()).isEmpty());
    }

    private FocusSession session(User user, Mission task, FocusSessionStatus status, String name) {
        FocusSession session = new FocusSession();
        session.setUser(user);
        session.setMission(task);
        session.setGoal(task != null ? task.getGoal() : null);
        session.setName(name);
        session.setDurationMinutes(45);
        session.setStatus(status);
        session.setStartedAt(status == FocusSessionStatus.ACTIVE ? Instant.now() : null);
        return sessionRepository.save(session);
    }

    private ResourceResponse createTaskResource(
            ContextualResourceType type,
            ContextualResourceMatchType matchType,
            ContextualResourceDisposition disposition,
            String destination
    ) {
        return policyService.createResource(user1.getId(), new CreateResourceRequest(
                task1.getId(), null, type, matchType, disposition, destination, null, null, false
        ));
    }

    private ResourceResponse createSessionResource(
            ContextualResourceType type,
            ContextualResourceMatchType matchType,
            ContextualResourceDisposition disposition,
            String destination,
            Instant expiresAt
    ) {
        return policyService.createResource(user1.getId(), new CreateResourceRequest(
                null,
                activeSession1.getId(),
                type,
                matchType,
                disposition,
                destination,
                null,
                expiresAt,
                false
        ));
    }

    private void assertNotFound(Runnable action) {
        ResponseStatusException exception = assertThrows(ResponseStatusException.class, action::run);
        assertEquals(404, exception.getStatusCode().value());
    }
}
