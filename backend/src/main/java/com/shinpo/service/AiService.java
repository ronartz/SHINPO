package com.shinpo.service;

import com.shinpo.ai.orchestrator.AiGateway;
import com.shinpo.dto.AiDtos.*;
import com.shinpo.entity.*;
import com.shinpo.repository.*;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.*;

@Service
@Transactional
public class AiService {

    private static final Logger log = LoggerFactory.getLogger(AiService.class);

    private final GoalRepository goalRepository;
    private final FocusSessionRepository focusSessionRepository;
    private final AiGateway aiGateway;
    private final ConversationRepository conversationRepository;
    private final ConversationMessageRepository conversationMessageRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    public AiService(
            GoalRepository goalRepository,
            FocusSessionRepository focusSessionRepository,
            AiGateway aiGateway,
            ConversationRepository conversationRepository,
            ConversationMessageRepository conversationMessageRepository,
            UserRepository userRepository,
            ObjectMapper objectMapper) {
        this.goalRepository = goalRepository;
        this.focusSessionRepository = focusSessionRepository;
        this.aiGateway = aiGateway;
        this.conversationRepository = conversationRepository;
        this.conversationMessageRepository = conversationMessageRepository;
        this.userRepository = userRepository;
        this.objectMapper = objectMapper;
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

    // -------------------------------------------------------------------------
    // CONVERSATION CONTINUITY & PERSISTENCE (PHASE B)
    // -------------------------------------------------------------------------

    public ConversationDto getActiveConversation(Long userId) {
        Conversation conv = getOrCreateActiveConversationEntity(userId);
        return mapToConversationDto(conv);
    }

    public ConversationDto clearActiveConversation(Long userId) {
        conversationRepository.findFirstByUser_IdAndStatusOrderByUpdatedAtDesc(userId, "ACTIVE")
                .ifPresent(conv -> {
                    conv.setStatus("ARCHIVED");
                    conv.setUpdatedAt(Instant.now());
                    conversationRepository.save(conv);
                });
        Conversation fresh = getOrCreateActiveConversationEntity(userId);
        return mapToConversationDto(fresh);
    }

    public AiChatResponse processChat(AiChatRequest request) {
        if (request == null || request.userId() == null) {
            throw new IllegalArgumentException("Authenticated userId is required to process chat");
        }
        Long userId = request.userId();
        if (!userRepository.existsById(userId)) {
            throw new IllegalArgumentException("User not found: " + userId);
        }

        Conversation conversation;
        if (request.conversationId() != null && !request.conversationId().isBlank()) {
            conversation = conversationRepository.findByConversationUuidAndUser_Id(request.conversationId(), userId)
                    .orElseGet(() -> getOrCreateActiveConversationEntity(userId));
        } else {
            conversation = getOrCreateActiveConversationEntity(userId);
        }

        // 1. Persist user message
        String userRaw = request.message() != null ? request.message().trim() : "";
        ConversationMessage userMsg = new ConversationMessage(conversation, "USER", userRaw, null, null);
        conversationMessageRepository.save(userMsg);
        conversation.setUpdatedAt(Instant.now());
        conversationRepository.save(conversation);

        // 2. Fetch bounded recent history (12-20 turns)
        List<ConversationMessage> recentDesc = conversationMessageRepository.findTop20ByConversation_IdOrderByCreatedAtDesc(conversation.getId());
        List<ConversationMessage> recentAsc = new ArrayList<>(recentDesc);
        Collections.reverse(recentAsc);

        List<Map<String, String>> historyList = new ArrayList<>();
        for (ConversationMessage m : recentAsc) {
            historyList.add(Map.of(
                    "role", m.getRole().toLowerCase(Locale.ROOT),
                    "content", m.getContent()
            ));
        }

        // 3. Process through Gateway
        AiChatResponse response = aiGateway.processChat(request, historyList);

        // 4. Persist assistant reply with metadata
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

        ConversationMessage assistantMsg = new ConversationMessage(
                conversation,
                "ASSISTANT",
                response.reply(),
                response.suggestionType(),
                metadataJson
        );
        conversationMessageRepository.save(assistantMsg);
        conversation.setUpdatedAt(Instant.now());
        conversationRepository.save(conversation);

        return response.withConversationId(conversation.getConversationUuid());
    }

    private Conversation getOrCreateActiveConversationEntity(Long userId) {
        return conversationRepository.findFirstByUser_IdAndStatusOrderByUpdatedAtDesc(userId, "ACTIVE")
                .orElseGet(() -> {
                    User user = userRepository.findById(userId)
                            .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));
                    Conversation newConv = new Conversation(
                            UUID.randomUUID().toString(),
                            user,
                            "EONPAI Session " + java.time.LocalDate.now()
                    );
                    return conversationRepository.save(newConv);
                });
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