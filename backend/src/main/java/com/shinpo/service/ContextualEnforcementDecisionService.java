package com.shinpo.service;

import com.shinpo.entity.SentinelPolicyRule;
import com.shinpo.repository.SentinelPolicyRuleRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class ContextualEnforcementDecisionService {

    public enum PolicyDecision {
        ALLOW,
        ENFORCE
    }

    private final FocusSessionEnforcementExceptionService exceptionService;
    private final SentinelPolicyRuleRepository policyRuleRepository;

    public ContextualEnforcementDecisionService(
            FocusSessionEnforcementExceptionService exceptionService,
            SentinelPolicyRuleRepository policyRuleRepository
    ) {
        this.exceptionService = exceptionService;
        this.policyRuleRepository = policyRuleRepository;
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
        if (processName == null || processName.isBlank()) {
            return PolicyDecision.ALLOW;
        }

        String lowerName = processName.trim().toLowerCase();

        // 1. Protected process/activity -> ALLOW
        if (SentinelEnforcementService.PROTECTED_PROCESSES.contains(lowerName) || lowerName.contains("shinpo")) {
            return PolicyDecision.ALLOW;
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
