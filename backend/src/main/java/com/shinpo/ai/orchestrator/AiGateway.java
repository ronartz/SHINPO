package com.shinpo.ai.orchestrator;

import tools.jackson.databind.ObjectMapper;
import com.shinpo.ai.config.AiProperties;
import com.shinpo.ai.provider.AIProvider;
import com.shinpo.ai.provider.AiProviderRequest;
import com.shinpo.ai.provider.AiProviderResponse;
import com.shinpo.ai.tool.AiToolRegistry;
import com.shinpo.dto.AiDtos.*;
import com.shinpo.entity.AiSuggestion;
import com.shinpo.repository.AiSuggestionRepository;
import com.shinpo.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class AiGateway {

    private static final Logger log = LoggerFactory.getLogger(AiGateway.class);

    private final List<AIProvider> providers;
    private final AiProperties aiProperties;
    private final AiToolRegistry toolRegistry;
    private final AiSuggestionRepository aiSuggestionRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    public AiGateway(
            List<AIProvider> providers,
            AiProperties aiProperties,
            AiToolRegistry toolRegistry,
            AiSuggestionRepository aiSuggestionRepository,
            UserRepository userRepository,
            ObjectMapper objectMapper
    ) {
        this.providers = providers;
        this.aiProperties = aiProperties;
        this.toolRegistry = toolRegistry;
        this.aiSuggestionRepository = aiSuggestionRepository;
        this.userRepository = userRepository;
        this.objectMapper = objectMapper;
    }

    public AIProvider getActiveProvider() {
        String target = aiProperties.getProvider();
        return providers.stream()
                .filter(p -> p.getProviderName().equalsIgnoreCase(target))
                .findFirst()
                .orElse(providers.isEmpty() ? null : providers.get(0));
    }

    /**
     * Process general chat message through AI Gateway with tools & fallback.
     */
    public AiChatResponse processChat(AiChatRequest request) {
        Long userId = request.userId() != null ? request.userId() : 1L;
        Map<String, Object> context = toolRegistry.assembleFullContext(
                userId,
                request.contextualGoalId(),
                request.contextualMissionId(),
                request.contextualSessionId()
        );

        AIProvider provider = getActiveProvider();
        if (aiProperties.isEnabled() && provider != null && provider.isAvailable()) {
            String systemPrompt = """
                    You are EONPAI (also known as SHINPAI), the Personal Strategic Execution AI Companion for SHINPO (SYSTEM: ARISE).
                    Philosophy: Execution > Planning Theater. Real Data > Vanity Metrics.
                    Role: You analyze the user's current goals, missions, and schedule to provide crisp, concrete, actionable guidance.
                    CRITICAL: You are an advisory companion. You NEVER directly modify databases or execute processes.
                    You MUST respond strictly in valid JSON matching this schema:
                    {
                      "reply": "Your clear, inspiring, and concise tactical message to the user",
                      "suggestionType": "TACTICAL_ASSISTANT" | "PLANNER" | "ARCHITECT" | "COACH",
                      "structuredCard": null
                    }
                    Do not include Markdown backticks or any preamble before or after the JSON.
                    """;

            AiProviderRequest req = AiProviderRequest.of(systemPrompt, request.message(), context);
            AiProviderResponse res = provider.generate(req);

            if (res.successful() && res.content() != null) {
                try {
                    AiChatResponse parsed = objectMapper.readValue(cleanJson(res.content()), AiChatResponse.class);
                    logSuggestion(userId, "CHAT", request.message(), res.content());
                    return parsed;
                } catch (Exception e) {
                    log.warn("Failed to parse model JSON output: {}. Raw: {}", e.getMessage(), res.content());
                }
            } else {
                log.warn("Active provider {} failed: {}. Falling back to deterministic engine.",
                        provider.getProviderName(), res.errorMessage());
            }
        }

        // Deterministic Fail-Safe Fallback
        return deterministicChatFallback(request, context, userId);
    }

    /**
     * Decompose Goal into actionable missions.
     */
    public GoalDecompositionResponse decomposeGoal(Long goalId, Long userId, String goalTitle) {
        Map<String, Object> goalCtx = toolRegistry.getCurrentGoal(userId, goalId);

        AIProvider provider = getActiveProvider();
        if (aiProperties.isEnabled() && provider != null && provider.isAvailable()) {
            String systemPrompt = """
                    You are EONPAI, Strategic Architect for SHINPO.
                    Partition the user's high-level goal into 3 to 4 sequential, concrete focus sprint missions.
                    Respond strictly in valid JSON matching:
                    {
                      "goalId": <number>,
                      "goalTitle": "<string>",
                      "analysis": "<string explaining strategic approach>",
                      "proposedMissions": [
                        {
                          "title": "<string>",
                          "description": "<string>",
                          "estimatedMinutes": <integer between 15 and 90>
                        }
                      ]
                    }
                    """;

            String userPrompt = "Goal Title: " + goalTitle + "\nContext: " + goalCtx;
            AiProviderRequest req = AiProviderRequest.of(systemPrompt, userPrompt);
            AiProviderResponse res = provider.generate(req);

            if (res.successful() && res.content() != null) {
                try {
                    GoalDecompositionResponse parsed = objectMapper.readValue(cleanJson(res.content()), GoalDecompositionResponse.class);
                    logSuggestion(userId, "GOAL_DECOMPOSITION", "goalId=" + goalId, res.content());
                    return parsed;
                } catch (Exception e) {
                    log.warn("Failed to parse decomposition JSON output: {}", e.getMessage());
                }
            }
        }

        // Deterministic Fallback
        List<ProposedMission> fallbackMissions = List.of(
                new ProposedMission("Map out core requirements & outcome boundaries", "Clarify definition of done.", 25),
                new ProposedMission("Build foundational prototype & establish MVP boundary", "Ship the smallest verifiable slice.", 50),
                new ProposedMission("Execute deep focus sprint on critical bottleneck", "Eliminate the single highest constraint.", 45),
                new ProposedMission("Audit execution metrics & review outcomes", "Measure results and close loop.", 20)
        );
        GoalDecompositionResponse fallback = new GoalDecompositionResponse(
                goalId,
                goalTitle,
                "Goal strategically partitioned into high-velocity execution blocks (Deterministic Safe Engine).",
                fallbackMissions
        );
        logSuggestion(userId, "GOAL_DECOMPOSITION", "goalId=" + goalId, "Deterministic fallback used");
        return fallback;
    }

    /**
     * Determine immediate Next Action based on real application state.
     */
    public NextActionResponse getNextAction(Long userId) {
        Map<String, Object> nextMission = toolRegistry.getNextMission(userId);
        Map<String, Object> currentGoal = toolRegistry.getCurrentGoal(userId, null);

        Long goalId = (Long) currentGoal.get("id");
        String goalTitle = (String) currentGoal.get("title");
        Long missionId = (Long) nextMission.get("id");
        String missionTitle = (String) nextMission.get("title");
        Integer duration = (Integer) nextMission.get("estimatedMinutes");

        if (missionTitle == null) {
            missionTitle = "Define High-Leverage Strategic Goal";
            duration = 25;
        }

        NextActionResponse response = new NextActionResponse(
                goalId != null ? goalId : 1L,
                goalTitle != null ? goalTitle : "Execution Foundation",
                missionId != null ? missionId : 1L,
                missionTitle,
                "Initialize a 25-45 minute focus sprint on [" + missionTitle + "]. Lock all non-essential distraction processes.",
                duration != null ? duration : 30,
                "Highest ROI immediate action derived from current backlog and schedule window."
        );

        logSuggestion(userId, "NEXT_ACTION", "userId=" + userId, "Next action: " + missionTitle);
        return response;
    }

    /**
     * Generate daily execution plan.
     */
    public DailyPlanResponse getDailyPlan(Long userId) {
        List<Map<String, Object>> schedule = toolRegistry.getTodaysSchedule(userId);
        List<DailyPlanItem> items = new ArrayList<>();

        int index = 0;
        for (Map<String, Object> s : schedule) {
            items.add(new DailyPlanItem(
                    (Long) s.get("id"),
                    (String) s.get("name"),
                    "Scheduled Sprint",
                    (Integer) s.get("durationMinutes"),
                    index++ == 0 ? "HIGH" : "NORMAL"
            ));
        }

        if (items.isEmpty()) {
            items.add(new DailyPlanItem(null, "Tactical Planning & Workspace Setup", "System Setup", 20, "HIGH"));
            items.add(new DailyPlanItem(null, "Core High-Value Execution Sprint", "Deep Work", 50, "HIGH"));
            items.add(new DailyPlanItem(null, "End-of-day Review & Retrospective", "Debrief", 20, "NORMAL"));
        }

        int totalMins = items.stream().mapToInt(i -> i.durationMinutes() != null ? i.durationMinutes() : 0).sum();
        DailyPlanResponse response = new DailyPlanResponse(
                "Structured " + items.size() + "-block execution day (" + totalMins + " min total)",
                "Prioritizes highest-leverage missions first to maximize momentum and recovery.",
                items
        );

        logSuggestion(userId, "DAILY_PLAN", "userId=" + userId, "Plan: " + items.size() + " blocks");
        return response;
    }

    /**
     * Provide session recovery options.
     */
    public RecoveryResponse getSessionRecovery(Long sessionId, Long userId, String sessionName, Integer plannedMinutes, Long actualMinutes) {
        List<RecoveryOption> options = List.of(
                new RecoveryOption("MICRO_RECOVERY", "15m Micro-Sprint", "Resume with a lightweight 15-minute re-entry block."),
                new RecoveryOption("RECESS_RESTORE", "Step Away & Recess", "Take a restorative 10-minute break away from screens."),
                new RecoveryOption("SPLIT_MISSION", "Divide Intention", "Split remaining tasks into 2 sub-components.")
        );

        RecoveryResponse response = new RecoveryResponse(
                sessionId,
                sessionName,
                plannedMinutes,
                actualMinutes,
                "Sprint was interrupted before full completion. Select an intentional recovery strategy to maintain momentum without shame.",
                options
        );

        logSuggestion(userId, "SESSION_RECOVERY", "sessionId=" + sessionId, "Recovery suggested for " + sessionName);
        return response;
    }

    private void logSuggestion(Long userId, String type, String context, String payload) {
        try {
            userRepository.findById(userId).ifPresent(user -> {
                AiSuggestion s = new AiSuggestion(user, type, context, payload);
                aiSuggestionRepository.save(s);
            });
        } catch (Exception e) {
            log.error("Failed to log AI suggestion audit: {}", e.getMessage());
        }
    }

    private String cleanJson(String raw) {
        if (raw == null) return "{}";
        String s = raw.trim();
        if (s.startsWith("```json")) {
            s = s.substring(7);
        } else if (s.startsWith("```")) {
            s = s.substring(3);
        }
        if (s.endsWith("```")) {
            s = s.substring(0, s.length() - 3);
        }
        return s.trim();
    }

    private AiChatResponse deterministicChatFallback(AiChatRequest request, Map<String, Object> context, Long userId) {
        String msg = request.message() != null ? request.message().toLowerCase(Locale.ROOT) : "";

        if (msg.contains("plan") || msg.contains("schedule") || msg.contains("today")) {
            DailyPlanResponse plan = getDailyPlan(userId);
            return new AiChatResponse(
                    "Tactical daily itinerary assembled (" + plan.planItems().size() + " execution blocks):",
                    "PLANNER",
                    plan
            );
        }

        if (msg.contains("goal") || msg.contains("decompose") || msg.contains("break down")) {
            GoalDecompositionResponse decomp = decomposeGoal(1L, userId, "Primary Objective");
            return new AiChatResponse(
                    "Deconstructed primary objective [" + decomp.goalTitle() + "]: " + decomp.analysis(),
                    "ARCHITECT",
                    decomp
            );
        }

        if (msg.contains("next") || msg.contains("action") || msg.contains("what should")) {
            NextActionResponse next = getNextAction(userId);
            return new AiChatResponse(
                    "EONPAI Operational Directive: Execute [" + next.missionTitle() + "]. " + next.rationale(),
                    "NEXT_ACTION",
                    next
            );
        }

        NextActionResponse next = getNextAction(userId);
        return new AiChatResponse(
                "EONPAI Operational Directive: Execute [" + next.missionTitle() + "]. " + next.rationale(),
                "COACH",
                next
        );
    }
}
