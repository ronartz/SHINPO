package com.shinpo.ai.orchestrator;

import tools.jackson.databind.ObjectMapper;
import com.shinpo.ai.config.AiProperties;
import com.shinpo.ai.provider.AIProvider;
import com.shinpo.ai.provider.AiProviderRequest;
import com.shinpo.ai.provider.AiProviderResponse;
import com.shinpo.ai.tool.AiToolRegistry;
import com.shinpo.dto.AiDtos.*;
import com.shinpo.entity.AiSuggestion;
import com.shinpo.entity.BugReport;
import com.shinpo.entity.User;
import com.shinpo.repository.AiSuggestionRepository;
import com.shinpo.repository.BugReportRepository;
import com.shinpo.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
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
    private final BugReportRepository bugReportRepository;

    @Autowired
    public AiGateway(
            List<AIProvider> providers,
            AiProperties aiProperties,
            AiToolRegistry toolRegistry,
            AiSuggestionRepository aiSuggestionRepository,
            UserRepository userRepository,
            ObjectMapper objectMapper,
            @Autowired(required = false) BugReportRepository bugReportRepository
    ) {
        this.providers = providers;
        this.aiProperties = aiProperties;
        this.toolRegistry = toolRegistry;
        this.aiSuggestionRepository = aiSuggestionRepository;
        this.userRepository = userRepository;
        this.objectMapper = objectMapper;
        this.bugReportRepository = bugReportRepository;
    }

    public AiGateway(
            List<AIProvider> providers,
            AiProperties aiProperties,
            AiToolRegistry toolRegistry,
            AiSuggestionRepository aiSuggestionRepository,
            UserRepository userRepository,
            ObjectMapper objectMapper
    ) {
        this(providers, aiProperties, toolRegistry, aiSuggestionRepository, userRepository, objectMapper, null);
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
        return processChat(request, List.of());
    }

    /**
     * Process general chat message through AI Gateway with conversation continuity history.
     */
    public AiChatResponse processChat(AiChatRequest request, List<Map<String, String>> conversationHistory) {
        if (request == null || request.userId() == null) {
            throw new IllegalArgumentException("Authenticated userId is required to process chat");
        }
        Long userId = request.userId();
        String rawMsg = request.message() != null ? request.message().trim() : "";
        String msgLower = rawMsg.toLowerCase(Locale.ROOT);

        // 1. GREETING INTENT
        if (isGreeting(msgLower)) {
            return buildGreetingResponse(userId, rawMsg);
        }

        // 2. IDENTITY & CAPABILITIES INTENT
        if (isIdentityQuery(msgLower)) {
            return buildIdentityResponse(userId, rawMsg);
        }

        // 3. TUTORIAL & ONBOARDING INTENT
        if (isTutorialIntent(msgLower)) {
            return buildTutorialResponse(userId, rawMsg);
        }

        // 4. WHY DID THIS HAPPEN / ENFORCEMENT EXPLANATION INTENT
        if (isEnforcementQuery(msgLower)) {
            return buildEnforcementResponse(userId, rawMsg);
        }

        // 5. BUG REPORT INTENT
        if (isBugReportIntent(msgLower)) {
            return buildBugReportResponse(userId, rawMsg);
        }

        // 6. EXPLICIT PLANNING / GOALS / NEXT ACTION INTENTS
        if (isPlanIntent(msgLower)) {
            DailyPlanResponse plan = getDailyPlan(userId);
            String reply = "📅 Tactical daily itinerary assembled (" + plan.planItems().size() + " execution blocks):";
            logSuggestion(userId, "PLANNER", rawMsg, reply);
            return new AiChatResponse(reply, "PLANNER", plan);
        }

        if (isGoalIntent(msgLower)) {
            Map<String, Object> currentGoal = toolRegistry.getCurrentGoal(userId, request.contextualGoalId());
            Long goalId = currentGoal.get("id") instanceof Long gid ? gid : null;
            String goalTitle = currentGoal.get("title") instanceof String gt ? gt : "Primary Objective";
            GoalDecompositionResponse decomp = decomposeGoal(goalId, userId, goalTitle);
            String reply = "🎯 Deconstructed primary objective [" + decomp.goalTitle() + "]: " + decomp.analysis();
            logSuggestion(userId, "ARCHITECT", rawMsg, reply);
            return new AiChatResponse(reply, "ARCHITECT", decomp);
        }

        if (isNextActionIntent(msgLower)) {
            NextActionResponse next = getNextAction(userId);
            String reply = "EONPAI Operational Directive: Execute [" + next.missionTitle() + "]. " + next.rationale();
            logSuggestion(userId, "NEXT_ACTION", rawMsg, reply);
            return new AiChatResponse(reply, "NEXT_ACTION", next);
        }

        // 7. GENERAL QUERY: MODEL GENERATION WITH FALLBACK
        Map<String, Object> context = toolRegistry.assembleFullContext(
                userId,
                request.contextualGoalId(),
                request.contextualMissionId(),
                request.contextualSessionId()
        );
        if (conversationHistory != null && !conversationHistory.isEmpty()) {
            context.put("recentConversationHistory", conversationHistory);
        }

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

            AiProviderRequest req = AiProviderRequest.of(systemPrompt, rawMsg, context);
            AiProviderResponse res = provider.generate(req);

            if (res.successful() && res.content() != null && !res.content().isBlank()) {
                try {
                    AiChatResponse parsed = objectMapper.readValue(cleanJson(res.content()), AiChatResponse.class);
                    logSuggestion(userId, "CHAT", rawMsg, res.content());
                    return parsed;
                } catch (Exception e) {
                    String cleanContent = cleanJson(res.content());
                    logSuggestion(userId, "CHAT", rawMsg, cleanContent);
                    return AiChatResponse.conversational(cleanContent, "TACTICAL_ASSISTANT");
                }
            } else {
                log.warn("Active provider {} failed: {}. Falling back to deterministic engine.",
                        provider.getProviderName(), res.errorMessage());
            }
        }

        return deterministicConversationalFallback(rawMsg, userId);
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
    
        public void acceptSuggestion(Long suggestionId, Long userId) {
        aiSuggestionRepository.findById(suggestionId).ifPresent(s -> {
            if (s.getUser().getId().equals(userId)) {
                s.setAccepted(true);
                aiSuggestionRepository.save(s);
            }
        });
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

    private boolean isGreeting(String msg) {
        String clean = msg.replaceAll("[!?,.]", "").trim();
        return clean.equals("hi") || clean.equals("hello") || clean.equals("hey")
                || clean.equals("yo") || clean.equals("sup") || clean.equals("morning")
                || clean.startsWith("good morning") || clean.startsWith("good afternoon")
                || clean.startsWith("good evening") || clean.equals("greetings");
    }

    private boolean isIdentityQuery(String msg) {
        return msg.contains("who are you") || msg.contains("what are you")
                || msg.contains("introduce yourself") || msg.contains("what can you do")
                || msg.contains("what is eonpai") || msg.contains("about eonpai");
    }

    private boolean isTutorialIntent(String msg) {
        return msg.contains("tutorial") || msg.contains("how do i use") || msg.contains("teach me")
                || msg.contains("walk me through") || msg.contains("show me around") || msg.contains("guide me")
                || msg.contains("how does shinpo work");
    }

    private boolean isEnforcementQuery(String msg) {
        return msg.contains("why can't i") || msg.contains("why cant i")
                || msg.contains("blocked") || msg.contains("terminated")
                || msg.contains("closed") || msg.contains("session end")
                || msg.contains("why did my session") || msg.contains("youtube");
    }

    private boolean isBugReportIntent(String msg) {
        return (msg.contains("bug") || msg.contains("error") || msg.contains("crash") || msg.contains("broken") || msg.contains("issue"))
                && (msg.contains("found") || msg.contains("report") || msg.contains("fix") || msg.contains("there is") || msg.contains("problem"));
    }

    private boolean isPlanIntent(String msg) {
        return msg.contains("plan my day") || msg.contains("daily plan") || msg.equals("plan")
                || msg.contains("schedule today") || msg.contains("plan today");
    }

    private boolean isGoalIntent(String msg) {
        return msg.contains("break down goal") || msg.contains("decompose goal")
                || msg.contains("decompose") || msg.contains("partition goal");
    }

    private boolean isNextActionIntent(String msg) {
        return msg.contains("what should") || msg.contains("next action")
                || msg.contains("what to do") || msg.contains("what next");
    }

    private String extractFeature(String msg) {
        if (msg.contains("focus") || msg.contains("session") || msg.contains("timer")) return "FOCUS_ENGINE";
        if (msg.contains("goal") || msg.contains("mission")) return "GOALS_AND_MISSIONS";
        if (msg.contains("task") || msg.contains("process")) return "TASK_MANAGER";
        if (msg.contains("schedule") || msg.contains("calendar")) return "SCHEDULE";
        if (msg.contains("ai") || msg.contains("eonpai") || msg.contains("chat")) return "AI_ASSISTANT";
        return "GENERAL";
    }

    private AiChatResponse buildGreetingResponse(Long userId, String rawMsg) {
        int hour = java.time.LocalTime.now().getHour();
        String timeOfDay = (hour < 12) ? "Good morning" : (hour < 17) ? "Good afternoon" : "Good evening";
        Map<String, Object> userMap = toolRegistry.getCurrentUser(userId);
        String username = (userMap.get("username") != null && !"anonymous".equals(userMap.get("status")))
                ? (String) userMap.get("username")
                : "";
        String nameClause = username.isBlank() ? "" : ", " + username;

        Map<String, Object> activeSession = toolRegistry.getActiveFocusSession(userId);
        String sessionNote = "";
        if (Boolean.TRUE.equals(activeSession.get("hasActiveSession")) || activeSession.containsKey("name")) {
            sessionNote = "\n\n💡 *Active focus session:* **" + activeSession.get("name") + "** is currently active.";
        }

        String reply = timeOfDay + nameClause + "! 👋 I'm **EONPAI**, your personal execution companion.\n\n"
                + "How can I support your focus today? Feel free to ask me:\n"
                + "• `Plan my day` — structured focus itinerary\n"
                + "• `What should I work on now?` — immediate tactical priority\n"
                + "• `How do I use SHINPO?` — interactive walkthrough\n"
                + "• `Why is YouTube blocked?` — inspect Sentinel enforcement status"
                + sessionNote;

        logSuggestion(userId, "GREETING", rawMsg, reply);
        return AiChatResponse.conversational(reply, "GREETING");
    }

    private AiChatResponse buildIdentityResponse(Long userId, String rawMsg) {
        String reply = "I am **EONPAI** (SHINPO Personal AI) — your JARVIS-like execution companion.\n\n"
                + "Unlike generic chatbots, I live inside SHINPO and observe your actual productivity ecosystem in real-time:\n\n"
                + "🎯 **Strategic Goal Deconstruction**: Turn broad objectives into 25-50 minute focus sprints.\n"
                + "🛡️ **Sentinel Enforcement Explanations**: Explain why distraction apps/sites are restricted.\n"
                + "🗺️ **Interactive Walkthroughs**: Guide you through onboarding and features.\n"
                + "🛠️ **Sanitized Bug Reporting**: Directly log diagnostics to the development team without leaking secrets.\n"
                + "⚡ **Execution Next Action**: Tell you the single highest ROI task to do right now.\n\n"
                + "What would you like to execute?";
        logSuggestion(userId, "IDENTITY", rawMsg, reply);
        return AiChatResponse.conversational(reply, "IDENTITY");
    }

    private AiChatResponse buildTutorialResponse(Long userId, String rawMsg) {
        TutorialStep step = new TutorialStep(
                "SHINPO_ONBOARDING",
                1,
                "goals",
                "Let's start with your first goal. Click '+ New Strategic Goal' to establish your objective boundary.",
                "GOAL_CREATED"
        );
        String reply = "Sure. I'll walk you through it.\n\nLet's start with your first goal.";
        logSuggestion(userId, "TUTORIAL", rawMsg, reply);
        return AiChatResponse.withTutorial(reply, step);
    }

    private AiChatResponse buildEnforcementResponse(Long userId, String rawMsg) {
        Map<String, Object> explanation = toolRegistry.getEnforcementExplanation(userId, rawMsg);
        String reason = (String) explanation.get("reason");
        boolean activeBlock = Boolean.TRUE.equals(explanation.get("activeBlockPresent"));

        StringBuilder sb = new StringBuilder();
        if (activeBlock) {
            Long remSec = (Long) explanation.get("remainingSeconds");
            long remMin = remSec != null ? remSec / 60 : 0;
            sb.append("🛡️ **Sentinel Enforcement Active**\n\n");
            sb.append("You currently have an active focus session (**").append(explanation.get("sessionName")).append("**)");
            sb.append(" with approximately **").append(remMin).append(" minutes** remaining.\n\n");
            sb.append("SHINPO enforces process restrictions during active sprints to safeguard cognitive flow. Once the timer reaches 0 or you explicitly pause/complete the sprint, restrictions will release.");
        } else {
            sb.append("ℹ️ **Sentinel System Status**\n\n");
            sb.append(reason).append("\n\n");
            sb.append("*Note: EONPAI never fabricates enforcement events. If an external application closed unexpectedly outside an active session, SHINPO Sentinel was not responsible.*");
        }

        logSuggestion(userId, "ENFORCEMENT_EXPLANATION", rawMsg, sb.toString());
        return AiChatResponse.conversational(sb.toString(), "ENFORCEMENT_EXPLANATION");
    }

    private AiChatResponse buildBugReportResponse(Long userId, String rawMsg) {
        String feature = extractFeature(rawMsg.toLowerCase(Locale.ROOT));
        String bugId = "BUG-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        Map<String, Object> diag = toolRegistry.getSanitizedDiagnostics(userId, feature);
        String diagJson = "{}";
        try {
            diagJson = objectMapper.writeValueAsString(diag);
        } catch (Exception ignored) {}

        if (bugReportRepository != null) {
            User user = userRepository.findById(userId).orElse(null);
            BugReport entity = new BugReport(bugId, user, rawMsg, feature, diagJson);
            bugReportRepository.save(entity);
        }

        BugReportInfo info = new BugReportInfo(bugId, rawMsg, feature, "OPEN", diagJson);
        String reply = "✅ **Bug Report Filed Successfully** (`" + bugId + "`)\n\n"
                + "• **Feature Area:** `" + feature + "`\n"
                + "• **Summary:** " + rawMsg + "\n"
                + "• **Diagnostics:** Host telemetry attached (OS, JVM, active session, memory status).\n"
                + "• **Security:** Tokens, passwords, and sensitive keys were strictly scrubbed.\n\n"
                + "The engineering log has received this report.";

        logSuggestion(userId, "BUG_REPORT", rawMsg, reply);
        return AiChatResponse.withBugReport(reply, info);
    }

    private AiChatResponse deterministicConversationalFallback(String rawMsg, Long userId) {
        String reply = "I understand you're asking about: \"" + rawMsg + "\".\n\n"
                + "I am continuously monitoring your execution loop. You can ask me to:\n"
                + "• **`Plan my day`** — generate a structured sprint block itinerary\n"
                + "• **`What should I work on now?`** — get immediate tactical recommendation\n"
                + "• **`How do I use SHINPO?`** — start the guided tutorial walkthrough\n"
                + "• **`Why is YouTube blocked?`** — query real Sentinel enforcement status";
        logSuggestion(userId, "COACH", rawMsg, reply);
        return AiChatResponse.conversational(reply, "TACTICAL_ASSISTANT");
    }
}
