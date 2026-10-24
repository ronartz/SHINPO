package com.shinpo.service;

import com.shinpo.entity.ContextualFocusResource;
import com.shinpo.entity.ContextualResourceDisposition;
import com.shinpo.entity.ContextualResourceType;
import com.shinpo.entity.FocusSession;
import com.shinpo.entity.SessionIntervalType;
import com.shinpo.entity.SentinelPolicyRule;
import com.shinpo.repository.ContextualFocusResourceRepository;
import com.shinpo.repository.SentinelPolicyRuleRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.time.Instant;

@Service
public class ContextualEnforcementDecisionService {

    public enum PolicyDecision {
        ALLOW,
        ENFORCE
    }

    private final FocusSessionEnforcementExceptionService exceptionService;
    private final SentinelPolicyRuleRepository policyRuleRepository;
    private final ContextualFocusResourceRepository resourceRepository;

    public ContextualEnforcementDecisionService(
            FocusSessionEnforcementExceptionService exceptionService,
            SentinelPolicyRuleRepository policyRuleRepository,
            ContextualFocusResourceRepository resourceRepository
    ) {
        this.exceptionService = exceptionService;
        this.policyRuleRepository = policyRuleRepository;
        this.resourceRepository = resourceRepository;
    }

    /**
     * Contextual decision pipeline adhering to the priority order:
     * 1. protected process/activity -> ALLOW
     * 2. active FocusSession exception -> ALLOW
     * 3. user global ALLOWED rule -> ALLOW
     * 4. user/default BLOCKED rule -> ENFORCE
     * 5. otherwise -> ALLOW
     */
    @Transactional(readOnly = true)
    public PolicyDecision evaluateProcess(Long userId, String processName) {
        return evaluateProcess(userId, processName, null);
    }

    @Transactional(readOnly = true)
    public PolicyDecision evaluateProcess(Long userId, String processName, FocusSession session) {
        if (processName == null || processName.isBlank()) {
            return PolicyDecision.ALLOW;
        }

        String lowerName = processName.trim().toLowerCase();

        // 1. Protected process/activity -> ALLOW
        if (SentinelEnforcementService.PROTECTED_PROCESSES.contains(lowerName) || lowerName.contains("shinpo")) {
            return PolicyDecision.ALLOW;
        }

        if (session != null) {
            List<ContextualFocusResource> resources = new java.util.ArrayList<>(
                    resourceRepository.findAllByUser_IdAndFocusSession_IdOrderByCreatedAtDesc(userId, session.getId()));
            if (session.getMission() != null) {
                resources.addAll(resourceRepository.findAllByUser_IdAndMission_IdOrderByCreatedAtDesc(
                        userId, session.getMission().getId()));
            }
            List<ContextualFocusResource> matchingBreakRules = resources.stream()
                    .filter(ContextualFocusResource::isBreakOnly)
                    .filter(resource -> resource.getResourceType() == ContextualResourceType.DESKTOP_PROCESS)
                    .filter(resource -> resource.getProcessException() != null)
                    .filter(resource -> {
                        String pattern = resource.getProcessException().getActivityPattern().trim().toLowerCase();
                        return lowerName.contains(pattern) || pattern.contains(lowerName);
                    })
                    .toList();
            if (!matchingBreakRules.isEmpty()) {
                boolean inBreak = session.getCurrentPhase() == SessionIntervalType.SHORT_BREAK
                        || session.getCurrentPhase() == SessionIntervalType.LONG_BREAK
                        || session.getCurrentPhase() == SessionIntervalType.GRACE;
                boolean approvedAndActive = matchingBreakRules.stream().anyMatch(resource -> resource.isEnabled()
                        && (resource.getExpiresAt() == null || resource.getExpiresAt().isAfter(Instant.now()))
                        && resource.getDisposition() == ContextualResourceDisposition.APPROVED);
                return inBreak && approvedAndActive ? PolicyDecision.ALLOW : PolicyDecision.ENFORCE;
            }
        }

        // 2. Active FocusSession exception -> ALLOW
        if (userId != null && exceptionService.isActivityPermittedByActiveSessionException(userId, lowerName)) {
            return PolicyDecision.ALLOW;
        }

        // 3. User global ALLOWED rule -> ALLOW
        // 4. User/default BLOCKED rule -> ENFORCE
        if (userId != null) {
            List<SentinelPolicyRule> rules = policyRuleRepository.findAllByUser_IdOrderByCreatedAtDesc(userId);

            // Check explicit ALLOWED first
            boolean isGloballyAllowed = rules.stream()
                    .filter(r -> "ALLOWED".equalsIgnoreCase(r.getPolicyType()))
                    .anyMatch(r -> lowerName.contains(r.getProcessNamePattern().toLowerCase().trim()));
            if (isGloballyAllowed) {
                return PolicyDecision.ALLOW;
            }

            // Check explicit BLOCKED
            boolean isGloballyBlocked = rules.stream()
                    .filter(r -> "BLOCKED".equalsIgnoreCase(r.getPolicyType()))
                    .anyMatch(r -> lowerName.contains(r.getProcessNamePattern().toLowerCase().trim()));
            if (isGloballyBlocked) {
                return PolicyDecision.ENFORCE;
            }
        }

        // Check default distraction blacklist
        boolean isDefaultDistraction = SentinelEnforcementService.DEFAULT_DISTRACTIONS.stream()
                .anyMatch(lowerName::contains);
        if (isDefaultDistraction) {
            return PolicyDecision.ENFORCE;
        }

        // 5. Otherwise -> ALLOW
        return PolicyDecision.ALLOW;
    }
}
