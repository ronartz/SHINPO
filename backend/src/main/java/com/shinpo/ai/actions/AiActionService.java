package com.shinpo.ai.actions;

import tools.jackson.databind.ObjectMapper;
import com.shinpo.ai.actions.dto.AiActionDto;
import com.shinpo.ai.actions.dto.AiActionExecutionResponse;
import com.shinpo.entity.AiAction;
import com.shinpo.entity.User;
import com.shinpo.repository.AiActionRepository;
import com.shinpo.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@Transactional
public class AiActionService {

    private static final Logger log = LoggerFactory.getLogger(AiActionService.class);
    private static final Duration DEFAULT_EXPIRATION = Duration.ofMinutes(30);

    private final AiActionRepository actionRepository;
    private final UserRepository userRepository;
    private final AiActionValidator validator;
    private final AiActionExecutor executor;
    private final ObjectMapper objectMapper;

    public AiActionService(
            AiActionRepository actionRepository,
            UserRepository userRepository,
            AiActionValidator validator,
            AiActionExecutor executor,
            ObjectMapper objectMapper
    ) {
        this.actionRepository = actionRepository;
        this.userRepository = userRepository;
        this.validator = validator;
        this.executor = executor;
        this.objectMapper = objectMapper;
    }

    public AiActionDto proposeAction(Long userId, String actionType, String description, Object payload) {
        if (userId == null) {
            throw new SecurityException("Authenticated user identity required to propose action");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

        validator.validateActionType(actionType);

        String payloadJson;
        try {
            payloadJson = (payload instanceof String s) ? s : objectMapper.writeValueAsString(payload);
        } catch (Exception e) {
            throw new IllegalArgumentException("Failed to serialize action payload: " + e.getMessage(), e);
        }

        validator.validatePayload(userId, actionType, payloadJson);

        String riskLevel = determineRiskLevel(actionType);
        String actionId = "act_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        Instant expiresAt = Instant.now().plus(DEFAULT_EXPIRATION);

        AiAction action = new AiAction(
                actionId,
                user,
                actionType.toUpperCase(),
                riskLevel,
                "PROPOSED",
                description != null ? description : "Proposed action: " + actionType,
                payloadJson,
                expiresAt
        );

        AiAction saved = actionRepository.save(action);
        log.info("EONPAI_ACTION_PROPOSED: actionId={} type={} user={}", actionId, actionType, userId);
        return toDto(saved);
    }

    public AiActionExecutionResponse confirmAndExecute(String actionId, Long userId) {
        if (actionId == null || userId == null) {
            throw new IllegalArgumentException("actionId and userId are required");
        }

        AiAction action = actionRepository.findByActionIdForUpdate(actionId)
                .orElseThrow(() -> new IllegalArgumentException("Action not found: " + actionId));

        if (!action.getUser().getId().equals(userId)) {
            throw new SecurityException("Ownership violation: Action " + actionId + " does not belong to authenticated user: " + userId);
        }

        if ("COMPLETED".equals(action.getStatus())) {
            log.info("EONPAI_ACTION_ALREADY_COMPLETED: actionId={} returning cached result", action.getActionId());
            return AiActionExecutionResponse.success(action.getActionId(), action.getResultSummary(), action.getExecutedAt());
        }

        if ("FAILED".equals(action.getStatus())) {
            return AiActionExecutionResponse.failure(action.getActionId(), action.getErrorMessage());
        }

        if ("REJECTED".equals(action.getStatus())) {
            throw new IllegalStateException("Cannot execute rejected action: " + actionId);
        }

        if ("EXECUTING".equals(action.getStatus()) || "APPROVED".equals(action.getStatus())) {
            throw new IllegalStateException("Action is already executing: " + actionId);
        }

        if (action.getExpiresAt() != null && Instant.now().isAfter(action.getExpiresAt())) {
            action.setStatus("EXPIRED");
            actionRepository.save(action);
            throw new IllegalStateException("Action proposal has expired: " + actionId);
        }

        action.setConfirmedAt(Instant.now());
        action.setStatus("APPROVED");
        actionRepository.save(action);

        return executor.executeAction(action, userId);
    }

    public AiActionDto rejectAction(String actionId, Long userId) {
        if (actionId == null || userId == null) {
            throw new IllegalArgumentException("actionId and userId are required");
        }

        AiAction action = actionRepository.findByActionIdForUpdate(actionId)
                .orElseThrow(() -> new IllegalArgumentException("Action not found: " + actionId));

        if (!action.getUser().getId().equals(userId)) {
            throw new SecurityException("Ownership violation: Action " + actionId + " does not belong to authenticated user: " + userId);
        }

        if ("COMPLETED".equals(action.getStatus())) {
            throw new IllegalStateException("Cannot reject an already completed action: " + actionId);
        }

        if ("REJECTED".equals(action.getStatus())) {
            return toDto(action);
        }

        if ("EXECUTING".equals(action.getStatus()) || "APPROVED".equals(action.getStatus())) {
            throw new IllegalStateException("Cannot reject an action currently executing: " + actionId);
        }

        action.setStatus("REJECTED");
        AiAction saved = actionRepository.save(action);
        log.info("EONPAI_ACTION_REJECTED: actionId={} user={}", actionId, userId);
        return toDto(saved);
    }

    @Transactional(readOnly = true)
    public List<AiActionDto> getPendingActions(Long userId) {
        Instant now = Instant.now();
        return actionRepository.findAllByUser_IdAndStatusOrderByCreatedAtDesc(userId, "PROPOSED")
                .stream()
                .filter(a -> a.getExpiresAt() == null || a.getExpiresAt().isAfter(now))
                .map(this::toDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<AiActionDto> getRecentActions(Long userId) {
        return actionRepository.findTop10ByUser_IdOrderByCreatedAtDesc(userId)
                .stream()
                .map(this::toDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public AiActionDto getAction(String actionId, Long userId) {
        AiAction action = actionRepository.findByActionId(actionId)
                .orElseThrow(() -> new IllegalArgumentException("Action not found: " + actionId));
        if (!action.getUser().getId().equals(userId)) {
            throw new SecurityException("Ownership violation: Action " + actionId + " does not belong to user: " + userId);
        }
        return toDto(action);
    }

    private String determineRiskLevel(String actionType) {
        String upper = actionType.toUpperCase();
        if (upper.startsWith("GET_") || upper.startsWith("SUMMARIZE_") || upper.startsWith("ANALYZE_")) {
            return "READ_ONLY";
        }
        return "LOW_RISK_MUTATION";
    }

    public AiActionDto toDto(AiAction a) {
        return new AiActionDto(
                a.getActionId(),
                a.getActionType(),
                a.getRiskLevel(),
                a.getStatus(),
                a.getDescription(),
                a.getPayload(),
                a.getResultSummary(),
                a.getErrorMessage(),
                a.getCreatedAt(),
                a.getConfirmedAt(),
                a.getExecutedAt(),
                a.getExpiresAt()
        );
    }
}
