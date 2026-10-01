package com.shinpo.service;

import com.shinpo.ai.orchestrator.AiGateway;
import com.shinpo.dto.AiDtos.*;
import com.shinpo.dto.MissionResponse;
import com.shinpo.dto.CreateFocusSessionRequest;
import com.shinpo.dto.FocusSessionResponse;
import com.shinpo.entity.*;
import com.shinpo.repository.*;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
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

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
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
    private final UserExecutionProfileService userExecutionProfileService;
    private final FocusSessionService focusSessionService;
    private final SentinelQuarantineRepository sentinelQuarantineRepository;
    private final SentinelTamperEventRepository sentinelTamperEventRepository;

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
            PlatformTransactionManager transactionManager,
            UserExecutionProfileService userExecutionProfileService) {
        this(goalRepository, missionRepository, focusSessionRepository, aiGateway, conversationRepository, conversationMessageRepository, userRepository, aiSuggestionRepository, objectMapper, transactionManager, userExecutionProfileService, null, null, null);
    }

    @Autowired
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
            PlatformTransactionManager transactionManager,
            UserExecutionProfileService userExecutionProfileService,
            @Autowired(required = false) FocusSessionService focusSessionService,
            @Autowired(required = false) SentinelQuarantineRepository sentinelQuarantineRepository,
            @Autowired(required = false) SentinelTamperEventRepository sentinelTamperEventRepository) {
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
        this.userExecutionProfileService = userExecutionProfileService;
        this.focusSessionService = focusSessionService;
        this.sentinelQuarantineRepository = sentinelQuarantineRepository;
        this.sentinelTamperEventRepository = sentinelTamperEventRepository;
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

    public SessionDebriefAnalysisResponse analyzeSessionDebrief(Long sessionId, Long userId) {
        if (sessionId != null && sessionId > 0) {
            focusSessionRepository.findByIdAndUser_Id(sessionId, userId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Focus session not found: " + sessionId));
        }
        return aiGateway.analyzeSessionDebrief(sessionId, userId);
    }

    public SessionDebriefAnalysisResponse analyzeLatestSessionDebrief(Long userId) {
        return aiGateway.analyzeSessionDebrief(null, userId);
    }

    public RecoveryResponse getSessionRecovery(Long sessionId, Long userId) {
        if (sessionId != null && sessionId > 0) {
            FocusSession session = focusSessionRepository.findByIdAndUser_Id(sessionId, userId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Session not found or unauthorized: " + sessionId));
            long actualMins = session.calculateActiveSeconds(Instant.now()) / 60;
            return aiGateway.getSessionRecovery(sessionId, userId, session.getName(), session.getDurationMinutes(), actualMins);
        }
        return aiGateway.getSessionRecovery(null, userId, null, null, null);
    }

    public RecoveryResponse getLatestSessionRecovery(Long userId) {
        return aiGateway.getSessionRecovery(null, userId, null, null, null);
    }

    @Transactional(readOnly = true)
    public UserExecutionProfileDto getUserExecutionProfile(Long userId) {
        if (userExecutionProfileService == null) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Execution profile service unavailable");
        }
        return userExecutionProfileService.getUserExecutionProfile(userId);
    }

    public void acceptSuggestion(Long suggestionId, Long userId) {
        aiGateway.acceptSuggestion(suggestionId, userId);
    }

    public SuggestionCommitResponse commitSuggestion(Long suggestionId, Long userId, SuggestionCommitRequest request) {
        if (suggestionId == null || userId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "suggestionId and userId are required");
        }

        AiSuggestion suggestion = aiSuggestionRepository.findByIdAndUser_Id(suggestionId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Suggestion not found: " + suggestionId));

        if (Boolean.TRUE.equals(suggestion.getAccepted())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Suggestion has already been accepted: " + suggestionId);
        }

        if ("DAILY_PLAN".equalsIgnoreCase(suggestion.getSuggestionType())) {
            CommitDailyPlanResponse res = commitDailyPlan(userId, new CommitDailyPlanRequest(suggestionId, null));
            return new SuggestionCommitResponse(
                    suggestionId,
                    null,
                    res.scheduledSessionsCount(),
                    List.of()
            );
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
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "targetGoalId is required to attach proposed missions");
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
                                    mNode.has("title") ? mNode.get("title").asString() : "Tactical Mission",
                                    mNode.has("description") ? mNode.get("description").asString() : "",
                                    mNode.has("estimatedMinutes") ? mNode.get("estimatedMinutes").asInt() : 30
                            ));
                        }
                    } else if (node.isArray()) {
                        for (JsonNode mNode : node) {
                            missionsToCommit.add(new ProposedMission(
                                    mNode.has("title") ? mNode.get("title").asString() : "Tactical Mission",
                                    mNode.has("description") ? mNode.get("description").asString() : "",
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

    @Transactional
    public CommitDailyPlanResponse commitDailyPlan(Long userId, CommitDailyPlanRequest request) {
        if (userId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "User ID is required");
        }

        List<DailyPlanItem> items = null;
        if (request != null && request.selectedItems() != null && !request.selectedItems().isEmpty()) {
            items = request.selectedItems();
        } else if (request != null && request.suggestionId() != null) {
            AiSuggestion suggestion = aiSuggestionRepository.findByIdAndUser_Id(request.suggestionId(), userId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Daily plan suggestion not found: " + request.suggestionId()));
            try {
                JsonNode root = objectMapper.readTree(suggestion.getOutputPayload());
                if (root.isArray()) {
                    List<DailyPlanItem> parsed = new ArrayList<>();
                    for (JsonNode it : root) {
                        parsed.add(objectMapper.treeToValue(it, DailyPlanItem.class));
                    }
                    items = parsed;
                } else if (root.has("planItems") && root.get("planItems").isArray()) {
                    List<DailyPlanItem> parsed = new ArrayList<>();
                    for (JsonNode it : root.get("planItems")) {
                        parsed.add(objectMapper.treeToValue(it, DailyPlanItem.class));
                    }
                    items = parsed;
                }
                suggestion.setAccepted(true);
                aiSuggestionRepository.save(suggestion);
            } catch (Exception e) {
                log.warn("Failed to parse DailyPlanItem list from suggestion payload: {}", e.getMessage());
            }
        }

        if (items == null || items.isEmpty()) {
            DailyPlanResponse freshPlan = aiGateway.getDailyPlan(userId);
            items = freshPlan.planItems();
        }

        List<Long> createdSessionIds = new ArrayList<>();
        int totalMinutes = 0;
        LocalDate today = LocalDate.now();

        for (DailyPlanItem item : items) {
            if (item.isRestorativeBreak()) {
                continue;
            }

            Instant scheduledAt = null;
            if (item.scheduledStartTime() != null && item.scheduledStartTime().contains(":")) {
                try {
                    String[] parts = item.scheduledStartTime().split(":");
                    int hour = Integer.parseInt(parts[0].trim());
                    int minute = Integer.parseInt(parts[1].trim());
                    scheduledAt = today.atTime(hour, minute).atZone(ZoneId.systemDefault()).toInstant();
                } catch (Exception ignored) {}
            }
            if (scheduledAt == null || scheduledAt.isBefore(Instant.now())) {
                scheduledAt = Instant.now().plus(Duration.ofMinutes(15));
            }

            Long validGoalId = null;
            if (item.goalId() != null) {
                Goal g = goalRepository.findById(item.goalId()).orElse(null);
                if (g != null && g.getUser().getId().equals(userId)) {
                    validGoalId = g.getId();
                }
            }

            Long validMissionId = null;
            if (item.missionId() != null) {
                Mission m = missionRepository.findById(item.missionId()).orElse(null);
                if (m != null && m.getGoal() != null && m.getGoal().getUser().getId().equals(userId)) {
                    validMissionId = m.getId();
                    if (validGoalId == null) {
                        validGoalId = m.getGoal().getId();
                    }
                }
            }

            CreateFocusSessionRequest sessionReq = new CreateFocusSessionRequest();
            sessionReq.setUserId(userId);
            sessionReq.setName(item.missionTitle());
            sessionReq.setIntention(item.goalTitle() != null ? item.goalTitle() : "Tactical Sprint Execution");
            sessionReq.setDurationMinutes(item.durationMinutes() != null ? item.durationMinutes() : 25);
            sessionReq.setScheduledAt(scheduledAt);
            sessionReq.setGoalId(validGoalId);
            sessionReq.setMissionId(validMissionId);

            if (focusSessionService != null) {
                FocusSessionResponse created = focusSessionService.createSession(sessionReq);
                createdSessionIds.add(created.getId());
                totalMinutes += (item.durationMinutes() != null ? item.durationMinutes() : 25);
            } else {
                User user = userRepository.findById(userId).orElse(null);
                if (user != null) {
                    FocusSession s = new FocusSession();
                    s.setUser(user);
                    s.setName(item.missionTitle());
                    s.setIntention(item.goalTitle());
                    s.setDurationMinutes(item.durationMinutes() != null ? item.durationMinutes() : 25);
                    s.setScheduledAt(scheduledAt);
                    s.setStatus(FocusSessionStatus.SCHEDULED);
                    s.setAccumulatedPausedSeconds(0L);
                    FocusSession saved = focusSessionRepository.save(s);
                    createdSessionIds.add(saved.getId());
                    totalMinutes += s.getDurationMinutes();
                }
            }
        }

        return new CommitDailyPlanResponse(
                createdSessionIds.size(),
                totalMinutes,
                createdSessionIds,
                String.format("Successfully scheduled %d focus sessions (%d focus minutes) into today's execution agenda.",
                        createdSessionIds.size(), totalMinutes)
        );
    }

    @Transactional(readOnly = true)
    public ExecutiveBriefingResponse generateExecutiveBriefing(Long userId) {
        userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        List<Goal> goals = goalRepository.findAllByUser_Id(userId);
        int activeGoalsCount = (int) goals.stream().filter(g -> "ACTIVE".equalsIgnoreCase(g.getStatus())).count();

        List<Mission> missions = missionRepository.findAllByGoal_User_Id(userId);
        int completedMissionsCount = (int) missions.stream().filter(m -> "COMPLETED".equalsIgnoreCase(m.getStatus())).count();
        int pendingMissionsCount = (int) missions.stream().filter(m -> !"COMPLETED".equalsIgnoreCase(m.getStatus()) && !"CANCELLED".equalsIgnoreCase(m.getStatus())).count();

        // Calculate average goal progress %
        double totalGoalProgress = 0.0;
        int evaluatedGoals = 0;
        for (Goal g : goals) {
            List<Mission> goalMissions = missions.stream().filter(m -> m.getGoal().getId().equals(g.getId())).toList();
            if (!goalMissions.isEmpty()) {
                long done = goalMissions.stream().filter(m -> "COMPLETED".equalsIgnoreCase(m.getStatus())).count();
                totalGoalProgress += ((double) done / goalMissions.size()) * 100.0;
                evaluatedGoals++;
            }
        }
        double avgGoalProgress = evaluatedGoals > 0 ? Math.round(totalGoalProgress / evaluatedGoals) : 0.0;

        // Focus minutes today
        LocalDate today = LocalDate.now();
        Instant startOfDay = today.atStartOfDay(ZoneId.systemDefault()).toInstant();
        List<FocusSession> sessions = focusSessionRepository.findAllByUser_IdOrderByCreatedAtDesc(userId);
        long focusMinutesToday = sessions.stream()
                .filter(s -> s.getStartedAt() != null && s.getStartedAt().isAfter(startOfDay))
                .filter(s -> s.getStatus() == FocusSessionStatus.COMPLETED || s.getStatus() == FocusSessionStatus.ACTIVE)
                .mapToLong(s -> s.getDurationMinutes() != null ? s.getDurationMinutes() : 0)
                .sum();

        // Sentinel metrics
        int quarantinedToday = 0;
        if (sentinelQuarantineRepository != null) {
            quarantinedToday = (int) sentinelQuarantineRepository.countByUser_IdAndDetectedAtAfter(userId, startOfDay);
        }
        long tamperCount = 0;
        if (sentinelTamperEventRepository != null) {
            tamperCount = sentinelTamperEventRepository.countByUser_Id(userId);
        }

        String threatPosture;
        if (tamperCount > 0 || quarantinedToday > 5) {
            threatPosture = "ELEVATED";
        } else if (quarantinedToday > 0) {
            threatPosture = "CONTAINED";
        } else {
            threatPosture = "SECURE";
        }

        // Formulate Key Action Items & Recommendations
        List<String> keyActions = new ArrayList<>();
        Optional<Mission> nextMission = missions.stream()
                .filter(m -> !"COMPLETED".equalsIgnoreCase(m.getStatus()) && !"CANCELLED".equalsIgnoreCase(m.getStatus()))
                .findFirst();

        String primaryRecommendation;
        if (nextMission.isPresent()) {
            primaryRecommendation = "Execute sprint on \"" + nextMission.get().getTitle() + "\" (" + (nextMission.get().getEstimatedMinutes() != null ? nextMission.get().getEstimatedMinutes() : 25) + "m)";
            keyActions.add(primaryRecommendation);
        } else if (activeGoalsCount > 0) {
            primaryRecommendation = "Deconstruct active goals into concrete tactical missions";
            keyActions.add(primaryRecommendation);
        } else {
            primaryRecommendation = "Define your strategic objectives to initialize the execution loop";
            keyActions.add(primaryRecommendation);
        }

        if (quarantinedToday > 0) {
            keyActions.add("Sentinel intercepted " + quarantinedToday + " distraction event(s) today — strict focus policy active");
        } else {
            keyActions.add("Sentinel perimeter intact — zero unauthorized background process interruptions");
        }

        if (completedMissionsCount > 0) {
            keyActions.add("Review velocity and debrief insights for " + completedMissionsCount + " completed mission(s)");
        } else {
            keyActions.add("Schedule high-impact deep work sprint during prime morning circadian window");
        }

        String headline;
        String summary;
        if (focusMinutesToday >= 90) {
            headline = "Executive Velocity: Deep Flow Horizon";
            summary = String.format("You have sustained %d minutes of high-focus execution today with %d completed mission(s). %d tactical mission(s) remain pending.",
                    focusMinutesToday, completedMissionsCount, pendingMissionsCount);
        } else if (focusMinutesToday > 0) {
            headline = "Executive Velocity: Tactical Momentum Building";
            summary = String.format("Active momentum with %d minutes logged today across %d objective(s). %d mission(s) primed for execution.",
                    focusMinutesToday, activeGoalsCount, pendingMissionsCount);
        } else {
            headline = "Executive Velocity: Pre-Flight Operational Readiness";
            summary = String.format("System standing by with %d active goal(s) and %d queued mission(s). Engage Sentinel and begin sprint.",
                    activeGoalsCount, pendingMissionsCount);
        }

        return new ExecutiveBriefingResponse(
                headline,
                summary,
                primaryRecommendation,
                activeGoalsCount,
                pendingMissionsCount,
                completedMissionsCount,
                focusMinutesToday,
                avgGoalProgress,
                threatPosture,
                quarantinedToday,
                keyActions,
                Instant.now()
        );
    }
}