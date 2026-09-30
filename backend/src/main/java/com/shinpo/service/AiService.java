package com.shinpo.service;

import com.shinpo.ai.orchestrator.AiGateway;
import com.shinpo.dto.AiDtos.*;
import com.shinpo.dto.MissionResponse;
import com.shinpo.entity.*;
import com.shinpo.repository.*;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import org.springframework.dao.DataIntegrityViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.LocalDate;
import java.util.*;

@Service
@Transactional
public class AiService {

    private static final Logger log = LoggerFactory.getLogger(AiService.class);

    private final GoalRepository goalRepository;
    private final MissionRepository missionRepository;
    private final FocusSessionRepository focusSessionRepository;
    private final AiGateway aiGateway;
    private final ConversationRepository conversationRepository;
    private final ConversationMessageRepository conversationMessageRepository;
    private final UserRepository userRepository;
    private final AiSuggestionRepository aiSuggestionRepository;
    private final ObjectMapper objectMapper;
    private final TransactionTemplate transactionTemplate;
    private final TransactionTemplate conversationTransactionTemplate;

    public AiService(
            GoalRepository goalRepository,
            MissionRepository missionRepository,
            FocusSessionRepository focusSessionRepository,
            AiGateway aiGateway,
            ConversationRepository conversationRepository,
            ConversationMessageRepository conversationMessageRepository,
            UserRepository userRepository,
            AiSuggestionRepository aiSuggestionRepository,
            ObjectMapper objectMapper,
            PlatformTransactionManager transactionManager) {
        this.goalRepository = goalRepository;
        this.missionRepository = missionRepository;
        this.focusSessionRepository = focusSessionRepository;
        this.aiGateway = aiGateway;
        this.conversationRepository = conversationRepository;
        this.conversationMessageRepository = conversationMessageRepository;
        this.userRepository = userRepository;
        this.aiSuggestionRepository = aiSuggestionRepository;
        this.objectMapper = objectMapper;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
        this.conversationTransactionTemplate = new TransactionTemplate(transactionManager);
        this.conversationTransactionTemplate.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    public GoalDecompositionResponse decomposeGoal(Long goalId, Long userId) {
        Goal goal = goalRepository.findById(goalId)
                .orElseThrow(() -> new IllegalArgumentException("Goal not found: " + goalId));

        if (!goal.getUser().getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Goal not found for this user: " + goalId);
        }

        return aiGateway.decomposeGoal(goalId, userId, goal.getTitle());
    }

    public NextActionResponse getNextAction(Long userId) {
        return aiGateway.getNextAction(userId);
    }

    public DailyPlanResponse getDailyPlan(Long userId) {
        return aiGateway.getDailyPlan(userId);
    }

    public RecoveryResponse getSessionRecovery(Long sessionId, Long userId) {
        FocusSession session = focusSessionRepository.findByIdAndUser_Id(sessionId, userId)
                .orElseThrow(() -> new IllegalArgumentException("Session not found or unauthorized: " + sessionId));

        long actualMins = session.calculateActiveSeconds(Instant.now()) / 60;
        return aiGateway.getSessionRecovery(sessionId, userId, session.getName(), session.getDurationMinutes(), actualMins);
    }

    public void acceptSuggestion(Long suggestionId, Long userId) {
        aiGateway.acceptSuggestion(suggestionId, userId);
    }

    public SuggestionCommitResponse commitSuggestion(Long suggestionId, Long userId, SuggestionCommitRequest request) {
        if (suggestionId == null || userId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "suggestionId and userId are required");
        }

        AiSuggestion suggestion = aiSuggestionRepository.findById(suggestionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Suggestion not found: " + suggestionId));

        if (!suggestion.getUser().getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied: suggestion not owned by authenticated user");
        }

        // 1. Resolve Target Goal
        Long targetGoalId = request != null ? request.targetGoalId() : null;
        if (targetGoalId == null && suggestion.getInputContext() != null && suggestion.getInputContext().contains("goalId=")) {
            String ctx = suggestion.getInputContext();
            int idx = ctx.indexOf("goalId=");
            int end = ctx.indexOf(" ", idx);
            if (end == -1) end = ctx.length();
            try {
                targetGoalId = Long.parseLong(ctx.substring(idx + 7, end).trim());
            } catch (Exception ignored) {}
        }
        if (targetGoalId == null) {
            List<Goal> userGoals = goalRepository.findAllByUser_Id(userId);
            if (!userGoals.isEmpty()) {
                targetGoalId = userGoals.get(0).getId();
            }
        }
        if (targetGoalId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No target goal available to attach proposed missions");
        }

        final Long resolvedGoalId = targetGoalId;
        Goal goal = goalRepository.findByIdAndUser_Id(resolvedGoalId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Target goal " + resolvedGoalId + " not found or unauthorized"));

        // 2. Extract proposed missions
        List<ProposedMission> missionsToCommit = new ArrayList<>();
        if (request != null && request.selectedMissions() != null && !request.selectedMissions().isEmpty()) {
            missionsToCommit.addAll(request.selectedMissions());
        } else {
            String payload = suggestion.getOutputPayload();
            if (payload != null && !payload.isBlank()) {
                try {
                    JsonNode node = objectMapper.readTree(payload);
                    if (node.has("proposedMissions") && node.get("proposedMissions").isArray()) {
                        for (JsonNode mNode : node.get("proposedMissions")) {
                            missionsToCommit.add(new ProposedMission(
                                    mNode.has("title") ? mNode.get("title").asText() : "Tactical Mission",
                                    mNode.has("description") ? mNode.get("description").asText() : "",
                                    mNode.has("estimatedMinutes") ? mNode.get("estimatedMinutes").asInt() : 30
                            ));
                        }
                    } else if (node.isArray()) {
                        for (JsonNode mNode : node) {
                            missionsToCommit.add(new ProposedMission(
                                    mNode.has("title") ? mNode.get("title").asText() : "Tactical Mission",
                                    mNode.has("description") ? mNode.get("description").asText() : "",
                                    mNode.has("estimatedMinutes") ? mNode.get("estimatedMinutes").asInt() : 30
                            ));
                        }
                    }
                } catch (Exception e) {
                    log.warn("Failed to parse suggestion payload: {}", e.getMessage());
                }
            }
        }

        if (missionsToCommit.isEmpty()) {
            missionsToCommit.add(new ProposedMission(
                    "High-Impact Execution Block",
                    "Derived from AI suggestion: " + suggestion.getSuggestionType(),
                    30
            ));
        }

        // 3. Persist Missions
        LocalDate today = LocalDate.now();
        List<MissionResponse> committedList = new ArrayList<>();
        for (ProposedMission proposed : missionsToCommit) {
            Mission m = new Mission(
                    proposed.title(),
                    proposed.description(),
                    today,
                    proposed.estimatedMinutes() != null ? proposed.estimatedMinutes() : 30,
                    goal
            );
            Mission saved = missionRepository.save(m);
            committedList.add(new MissionResponse(
                    saved.getId(),
                    goal.getId(),
                    saved.getTitle(),
                    saved.getDescription(),
                    saved.getScheduledDate(),
                    saved.getEstimatedMinutes(),
                    saved.getStatus(),
                    saved.getCreatedAt()
            ));
        }

        // 4. Update and audit suggestion status
        suggestion.setAccepted(true);
        aiSuggestionRepository.save(suggestion);

        return new SuggestionCommitResponse(suggestion.getId(), goal.getId(), committedList.size(), committedList);
    }

    // -------------------------------------------------------------------------
    // CONVERSATION CONTINUITY & PERSISTENCE (PHASE B)
    // -------------------------------------------------------------------------

    public ConversationDto getActiveConversation(Long userId) {
        Conversation conv = getOrCreateActiveConversationEntity(userId);
        return mapToConversationDto(conv);
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public ConversationDto clearActiveConversation(Long userId) {
        transactionTemplate.executeWithoutResult(status ->
                conversationRepository.findFirstByUser_IdAndStatusOrderByUpdatedAtDesc(userId, "ACTIVE")
                        .ifPresent(conv -> {
                            conv.setStatus("ARCHIVED");
                            conv.setUpdatedAt(Instant.now());
                            conversationRepository.save(conv);
                        })
        );
        Conversation fresh = getOrCreateActiveConversationEntity(userId);
        return mapToConversationDto(fresh);
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public AiChatResponse processChat(AiChatRequest request) {
        if (request == null || request.userId() == null) {
            throw new IllegalArgumentException("Authenticated userId is required to process chat");
        }
        Long userId = request.userId();
        if (!userRepository.existsById(userId)) {
            throw new IllegalArgumentException("User not found: " + userId);
        }

        String userRaw = request.message() != null ? request.message().trim() : "";
        ChatContext chatContext = transactionTemplate.execute(status -> {
            Conversation conversation;
            if (request.conversationId() != null && !request.conversationId().isBlank()) {
                conversation = conversationRepository.findByConversationUuidAndUser_Id(request.conversationId(), userId)
                        .orElseGet(() -> getOrCreateActiveConversationEntity(userId));
            } else {
                conversation = getOrCreateActiveConversationEntity(userId);
            }

            ConversationMessage userMsg = new ConversationMessage(conversation, "USER", userRaw, null, null);
            conversationMessageRepository.save(userMsg);
            conversation.setUpdatedAt(Instant.now());
            conversationRepository.save(conversation);

            List<ConversationMessage> recentDesc = conversationMessageRepository
                    .findTop20ByConversation_IdOrderByCreatedAtDesc(conversation.getId());
            List<ConversationMessage> recentAsc = new ArrayList<>(recentDesc);
            Collections.reverse(recentAsc);

            List<Map<String, String>> historyList = new ArrayList<>();
            for (ConversationMessage message : recentAsc) {
                historyList.add(Map.of(
                        "role", message.getRole().toLowerCase(Locale.ROOT),
                        "content", message.getContent()
                ));
            }

            return new ChatContext(conversation.getId(), conversation.getConversationUuid(), historyList);
        });

        AiChatResponse response = aiGateway.processChat(request, chatContext.history());

        String metadataJson = null;
        try {
            Map<String, Object> meta = new HashMap<>();
            if (response.structuredCard() != null) meta.put("structuredCard", response.structuredCard());
            if (response.tutorial() != null) meta.put("tutorial", response.tutorial());
            if (response.bugReport() != null) meta.put("bugReport", response.bugReport());
            if (!meta.isEmpty()) {
                metadataJson = objectMapper.writeValueAsString(meta);
            }
        } catch (Exception e) {
            log.warn("Failed to serialize message metadata: {}", e.getMessage());
        }

        String replyText = (response.reply() != null && !response.reply().isBlank())
                ? response.reply()
                : "Execution directive acknowledged. Core engine ready.";

        String suggestionType = response.suggestionType();
        if (suggestionType != null && suggestionType.length() > 50) {
            suggestionType = suggestionType.substring(0, 50);
        }

        String normalizedSuggestionType = suggestionType;
        String normalizedMetadataJson = metadataJson;
        transactionTemplate.executeWithoutResult(status -> {
            Conversation conversation = conversationRepository.findById(chatContext.conversationId())
                .orElseThrow(() -> new IllegalArgumentException("Conversation not found: " + chatContext.conversationId()));
            ConversationMessage assistantMsg = new ConversationMessage(
                conversation,
                "ASSISTANT",
                replyText,
                normalizedSuggestionType,
                    normalizedMetadataJson
            );
            conversationMessageRepository.save(assistantMsg);
            conversation.setUpdatedAt(Instant.now());
            conversationRepository.save(conversation);
        });

        return response.withConversationId(chatContext.conversationUuid());
    }

        private record ChatContext(Long conversationId, String conversationUuid, List<Map<String, String>> history) {}

    private Conversation getOrCreateActiveConversationEntity(Long userId) {
        Optional<Conversation> active = conversationRepository.findFirstByUser_IdAndStatusOrderByUpdatedAtDesc(userId, "ACTIVE");
        if (active.isPresent()) return active.get();

        try {
            return conversationTransactionTemplate.execute(status -> {
                    User user = userRepository.findById(userId)
                            .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));
                    Conversation newConv = new Conversation(
                            UUID.randomUUID().toString(),
                            user,
                            "EONPAI Session " + java.time.LocalDate.now()
                    );
                    return conversationRepository.saveAndFlush(newConv);
            });
        } catch (DataIntegrityViolationException e) {
            return conversationTransactionTemplate.execute(status ->
                    conversationRepository.findFirstByUser_IdAndStatusOrderByUpdatedAtDesc(userId, "ACTIVE")
                            .orElseThrow(() -> e)
            );
        }
    }

    private ConversationDto mapToConversationDto(Conversation conv) {
        List<ConversationMessage> recentDesc = conversationMessageRepository.findTop20ByConversation_IdOrderByCreatedAtDesc(conv.getId());
        List<ConversationMessage> recentAsc = new ArrayList<>(recentDesc);
        Collections.reverse(recentAsc);

        List<ConversationMessageDto> dtos = new ArrayList<>();
        for (ConversationMessage msg : recentAsc) {
            Object structuredCard = null;
            TutorialStep tutorial = null;
            BugReportInfo bugReport = null;

            if (msg.getMetadataJson() != null && !msg.getMetadataJson().isBlank()) {
                try {
                    JsonNode node = objectMapper.readTree(msg.getMetadataJson());
                    if (node.has("structuredCard") && !node.get("structuredCard").isNull()) {
                        structuredCard = objectMapper.convertValue(node.get("structuredCard"), Object.class);
                    }
                    if (node.has("tutorial") && !node.get("tutorial").isNull()) {
                        tutorial = objectMapper.treeToValue(node.get("tutorial"), TutorialStep.class);
                    }
                    if (node.has("bugReport") && !node.get("bugReport").isNull()) {
                        bugReport = objectMapper.treeToValue(node.get("bugReport"), BugReportInfo.class);
                    }
                } catch (Exception ignored) {}
            }

            dtos.add(new ConversationMessageDto(
                    msg.getId(),
                    msg.getRole(),
                    msg.getContent(),
                    msg.getSuggestionType(),
                    structuredCard,
                    tutorial,
                    bugReport,
                    msg.getCreatedAt()
            ));
        }

        return new ConversationDto(
                conv.getConversationUuid(),
                conv.getTitle(),
                conv.getStatus(),
                dtos,
                conv.getUpdatedAt()
        );
    }
}