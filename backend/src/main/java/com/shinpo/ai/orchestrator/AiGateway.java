package com.shinpo.ai.orchestrator;

import tools.jackson.databind.ObjectMapper;
import com.shinpo.ai.actions.AiActionService;
import com.shinpo.ai.config.AiProperties;
import com.shinpo.ai.context.ContextEngine;
import com.shinpo.ai.context.ContextSynthesisService;
import com.shinpo.ai.context.ExecutionIntelligenceContext;
import com.shinpo.ai.debrief.SessionDebriefService;
import com.shinpo.ai.planning.DailyPlanningService;
import com.shinpo.ai.planning.GoalDecompositionService;
import com.shinpo.ai.prompt.PromptEngineeringService;
import com.shinpo.ai.provider.AIProvider;
import com.shinpo.ai.provider.AIProviderRegistry;
import com.shinpo.ai.provider.AiProviderRequest;
import com.shinpo.ai.provider.AiProviderResponse;
import com.shinpo.ai.tool.AiToolRegistry;
import com.shinpo.dto.AiDtos.*;
import com.shinpo.entity.AiSuggestion;
import com.shinpo.entity.BugReport;
import com.shinpo.entity.User;
import com.shinpo.repository.AiSuggestionRepository;
import com.shinpo.repository.BugReportRepository;
import com.shinpo.repository.FocusSessionRepository;
import com.shinpo.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.*;

@Service
public class AiGateway {

    private static final Logger log = LoggerFactory.getLogger(AiGateway.class);

    private final AIProviderRegistry providerRegistry;
    private final AiProperties aiProperties;
    private final AiToolRegistry toolRegistry;
    private final ContextEngine contextEngine;
    private final AiSuggestionRepository aiSuggestionRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;
    private final BugReportRepository bugReportRepository;
    private final GoalDecompositionService goalDecompositionService;
    private final DailyPlanningService dailyPlanningService;
    private final SessionDebriefService sessionDebriefService;


    @Autowired
    public AiGateway(
            AIProviderRegistry providerRegistry,
            AiProperties aiProperties,
            AiToolRegistry toolRegistry,
            ContextEngine contextEngine,
            AiSuggestionRepository aiSuggestionRepository,
            UserRepository userRepository,
            ObjectMapper objectMapper,
            @Autowired(required = false) BugReportRepository bugReportRepository,
            @Autowired(required = false) FocusSessionRepository focusSessionRepository,
            @Autowired(required = false) ContextSynthesisService contextSynthesisService,
            @Autowired(required = false) PromptEngineeringService promptEngineeringService,
            @Autowired(required = false) GoalDecompositionService goalDecompositionService,
            @Autowired(required = false) DailyPlanningService dailyPlanningService,
            @Autowired(required = false) SessionDebriefService sessionDebriefService,
            @Autowired(required = false) AiActionService aiActionService
    ) {
        this.providerRegistry = providerRegistry;
        this.aiProperties = aiProperties;
        this.toolRegistry = toolRegistry;
        this.contextEngine = contextEngine;
        this.aiSuggestionRepository = aiSuggestionRepository;
        this.userRepository = userRepository;
        this.objectMapper = objectMapper;
        this.bugReportRepository = bugReportRepository;
        this.goalDecompositionService = goalDecompositionService != null ? goalDecompositionService :
                new GoalDecompositionService(providerRegistry, aiProperties, toolRegistry, aiSuggestionRepository, userRepository, objectMapper, aiActionService);

        this.dailyPlanningService = dailyPlanningService != null ? dailyPlanningService :
                new DailyPlanningService(toolRegistry, aiSuggestionRepository, userRepository, objectMapper, aiActionService);
        this.sessionDebriefService = sessionDebriefService != null ? sessionDebriefService :
                new SessionDebriefService(providerRegistry, aiProperties, focusSessionRepository, objectMapper);
    }

    public AiGateway(
            AIProviderRegistry providerRegistry,
            AiProperties aiProperties,
            AiToolRegistry toolRegistry,
            ContextEngine contextEngine,
            AiSuggestionRepository aiSuggestionRepository,
            UserRepository userRepository,
            ObjectMapper objectMapper,
            BugReportRepository bugReportRepository,
            FocusSessionRepository focusSessionRepository
    ) {
        this(providerRegistry, aiProperties, toolRegistry, contextEngine, aiSuggestionRepository, userRepository, objectMapper, bugReportRepository, focusSessionRepository, null, null, null, null, null, null);
    }

    public AiGateway(
            AIProviderRegistry providerRegistry,
            AiProperties aiProperties,
            AiToolRegistry toolRegistry,
            ContextEngine contextEngine,
            AiSuggestionRepository aiSuggestionRepository,
            UserRepository userRepository,
            ObjectMapper objectMapper,
            BugReportRepository bugReportRepository
    ) {
        this(providerRegistry, aiProperties, toolRegistry, contextEngine, aiSuggestionRepository, userRepository, objectMapper, bugReportRepository, null);
    }

    public AiGateway(
            AIProviderRegistry providerRegistry,
            AiProperties aiProperties,
            AiToolRegistry toolRegistry,
            AiSuggestionRepository aiSuggestionRepository,
            UserRepository userRepository,
            ObjectMapper objectMapper,
            BugReportRepository bugReportRepository
    ) {
        this(providerRegistry, aiProperties, toolRegistry, new ContextEngine(toolRegistry), aiSuggestionRepository, userRepository, objectMapper, bugReportRepository, null);
    }

    public AiGateway(
            List<AIProvider> providers,
            AiProperties aiProperties,
            AiToolRegistry toolRegistry,
            AiSuggestionRepository aiSuggestionRepository,
            UserRepository userRepository,
            ObjectMapper objectMapper,
            BugReportRepository bugReportRepository
    ) {
        this(new AIProviderRegistry(providers, aiProperties), aiProperties, toolRegistry, new ContextEngine(toolRegistry), aiSuggestionRepository, userRepository, objectMapper, bugReportRepository, null);
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
        return providerRegistry != null ? providerRegistry.getActiveProvider() : null;
    }

    public boolean isAiEnabled() {
        return aiProperties != null && aiProperties.isEnabled();
    }

    /**
     * Process general chat message through AI Gateway with tools & fallback.
     */
    public AiChatResponse processChat(AiChatRequest request) {
        return processChat(request, List.of(), ZoneOffset.UTC);
    }

    /**
     * Process general chat message through AI Gateway with conversation continuity history.
     */
    public AiChatResponse processChat(AiChatRequest request, List<Map<String, String>> conversationHistory) {
        return processChat(request, conversationHistory, ZoneOffset.UTC);
    }

    public AiChatResponse processChat(
            AiChatRequest request,
            List<Map<String, String>> conversationHistory,
            ZoneId zoneId
    ) {
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
            if (isVagueBugReport(rawMsg)) {
                return buildBugReportDraftResponse(userId, rawMsg);
            }
            return buildBugReportResponse(userId, rawMsg);
        }

        // 5.5 EXECUTION PROFILE INTENT
        if (isProfileIntent(msgLower)) {
            Map<String, Object> prof = toolRegistry.getUserExecutionProfile(userId);
            String statusMsg = prof.get("statusMessage") instanceof String s ? s : "Personal execution profile unavailable.";
            String reply = "📊 **Personal Execution Profile:**\n\n" + statusMsg;
            logSuggestion(userId, "PROFILE", rawMsg, reply);
            return new AiChatResponse(reply, "PROFILE", prof);
        }

        // 5.6 SESSION DEBRIEF ANALYSIS INTENT
        if (isDebriefIntent(msgLower)) {
            SessionDebriefAnalysisResponse debrief = analyzeSessionDebrief(request.contextualSessionId(), userId);
            String reply = "📊 **Sprint Debrief Analysis:** " + debrief.sessionName() + " (" + debrief.velocityAssessment() + ")\n\n"
                    + debrief.tacticalCritique() + "\n\n"
                    + "⚡ **Next Recommendation:** " + debrief.nextSprintRecommendation();
            logSuggestion(userId, "DEBRIEF_ANALYSIS", rawMsg, reply);
            return new AiChatResponse(reply, "DEBRIEF_ANALYSIS", debrief);
        }

        // 5.7 COGNITIVE RECOVERY WORKFLOW INTENT
        if (isRecoveryIntent(msgLower)) {
            RecoveryResponse recovery = getSessionRecovery(request.contextualSessionId(), userId, null, null, null);
            String reply = "🧘 **Cognitive Recovery Protocol:**\n\n"
                    + recovery.diagnosticMessage() + "\n\n"
                    + "Select a recovery strategy below to recharge your cognitive reserves without losing momentum.";
            logSuggestion(userId, "SESSION_RECOVERY", rawMsg, reply);
            return new AiChatResponse(reply, "SESSION_RECOVERY", recovery);
        }

        // 6. EXPLICIT PLANNING / GOALS / NEXT ACTION INTENTS
        if (isPlanIntent(msgLower)) {
            Map<String, Object> activeSession = toolRegistry.getActiveFocusSession(userId);
            if (activeSession != null && Boolean.TRUE.equals(activeSession.get("hasActiveSession"))
                    && "ACTIVE".equalsIgnoreCase((String) activeSession.get("status"))) {
                String sessionName = (String) activeSession.get("name");
                Long remainingSecs = activeSession.get("remainingSeconds") instanceof Number n ? n.longValue() : 0L;
                long remainingMins = Math.max(0, remainingSecs / 60);
                String reply = "🛡️ **Focus sprint in progress:** \"" + sessionName + "\" (" + remainingMins + "m remaining).\n\n"
                        + "Please complete or pause this sprint before scheduling new blocks to protect your cognitive flow.";
                logSuggestion(userId, "SILENCE_ENGINE", rawMsg, reply);
                return AiChatResponse.conversational(reply, "FOCUS_ASSISTANT");
            }
            DailyPlanResponse plan = getDailyPlan(userId, zoneId);
            String reply = "Tactical daily itinerary assembled: " + plan.headline() + ". " + plan.rationale();
            logSuggestion(userId, "PLANNER", rawMsg, reply);
            return new AiChatResponse(reply, "PLANNER", plan);
        }

        if (isGoalIntent(msgLower)) {
            Map<String, Object> activeSession = toolRegistry.getActiveFocusSession(userId);
            if (activeSession != null && Boolean.TRUE.equals(activeSession.get("hasActiveSession"))
                    && "ACTIVE".equalsIgnoreCase((String) activeSession.get("status"))) {
                String sessionName = (String) activeSession.get("name");
                Long remainingSecs = activeSession.get("remainingSeconds") instanceof Number n ? n.longValue() : 0L;
                long remainingMins = Math.max(0, remainingSecs / 60);
                String reply = "🛡️ **Focus sprint in progress:** \"" + sessionName + "\" (" + remainingMins + "m remaining).\n\n"
                        + "Avoid task switching during an active sprint. Focus on completing your current mission before decomposing new strategic goals.";
                logSuggestion(userId, "SILENCE_ENGINE", rawMsg, reply);
                return AiChatResponse.conversational(reply, "FOCUS_ASSISTANT");
            }
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

        // 7. GENERAL QUERY: MODEL GENERATION WITH FALLBACK (SANITIZED VIA CONTEXT ENGINE)
        ExecutionIntelligenceContext intelContext = contextEngine.assembleContext(
                userId,
                request.contextualGoalId(),
                request.contextualMissionId(),
                request.contextualSessionId(),
                conversationHistory
        );
        Map<String, Object> safeContext = contextEngine.toSafeContextMap(intelContext);

        AIProvider provider = getActiveProvider();
        // Let the provider perform the request and report failure; a separate health probe
        // on every chat adds latency and can reject a working generation endpoint.
        if (aiProperties.isEnabled() && provider != null) {
            String silenceDirective = intelContext.isSilenceModeActive()
                    ? "SILENCE MODE ACTIVE: User is in an active focus sprint. Keep replies extremely calm, brief, and directly relevant to the user's specific request. Do NOT introduce new tasks, planning rabbit holes, or conversational tangents. Preserve flow state.\n"
                    : "";

            String systemPrompt = """
                    You are EONPAI (also known as SHINPAI), the Personal Strategic Execution AI Companion for SHINPO (SYSTEM: ARISE).
                    Philosophy: Execution > Planning Theater. Real Data > Vanity Metrics.
                    Role: You analyze the user's current goals, missions, and schedule to provide crisp, concrete, actionable guidance.
                    Robustness: Deduce user intent intelligently even if the user has typos, informal shorthand, or misspellings.
                    """ + silenceDirective + """
                    CRITICAL: You are an advisory companion. You NEVER directly modify databases or execute processes.
                    You MUST respond strictly in valid JSON matching this schema:
                    {
                      "reply": "Your clear, inspiring, and concise tactical message to the user",
                      "suggestionType": "TACTICAL_ASSISTANT" | "PLANNER" | "ARCHITECT" | "COACH" | "FOCUS_ASSISTANT",
                      "structuredCard": null
                    }
                    Do not echo application context. Return ONLY the JSON object. Do not include Markdown code fences.
                    """;

            String isolatedPrompt = contextEngine.buildIsolatedPrompt(systemPrompt, intelContext, rawMsg);
            AiProviderRequest req = AiProviderRequest.of(systemPrompt, isolatedPrompt, safeContext);
            AiProviderResponse res = provider.generate(req);

            if (res.successful() && res.content() != null && !res.content().isBlank()) {
                String rawContent = cleanJson(res.content());
                try {
                    AiChatResponse parsed = objectMapper.readValue(rawContent, AiChatResponse.class);
                    if (parsed != null && parsed.reply() != null && !parsed.reply().isBlank()) {
                        logSuggestion(userId, "CHAT", rawMsg, res.content());
                        return parsed;
                    }
                } catch (Exception ignored) {
                }
                String cleanContent = extractReplyOrClean(rawContent);
                String suggestionType = extractSuggestionType(rawContent);
                logSuggestion(userId, "CHAT", rawMsg, cleanContent);
                return AiChatResponse.conversational(cleanContent, suggestionType);
            } else {
                log.warn("Active provider {} failed: {}. Falling back to deterministic engine.",
                        provider.getProviderName(), res.errorMessage());
            }
        }

        return deterministicConversationalFallback(rawMsg, userId);
    }

    /**
     * Decompose Goal into actionable missions via GoalDecompositionService.
     */
    public GoalDecompositionResponse decomposeGoal(Long goalId, Long userId, String goalTitle) {
        return goalDecompositionService.decomposeGoal(goalId, userId, goalTitle);
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
     * Generate adaptive daily execution plan with circadian energy windows via DailyPlanningService.
     */
    public DailyPlanResponse getDailyPlan(Long userId) {
        return getDailyPlan(userId, ZoneOffset.UTC);
    }

    public DailyPlanResponse getDailyPlan(Long userId, ZoneId zoneId) {
        return dailyPlanningService.generateDailyPlan(userId, zoneId);
    }

    /**
     * Analyze a focus session's debrief and generate tactical critique & next sprint recommendation via SessionDebriefService.
     */
    public SessionDebriefAnalysisResponse analyzeSessionDebrief(Long sessionId, Long userId) {
        return sessionDebriefService.analyzeSessionDebrief(sessionId, userId);
    }

    /**
     * Provide session recovery options via SessionDebriefService.
     */
    public RecoveryResponse getSessionRecovery(Long sessionId, Long userId, String sessionName, Integer plannedMinutes, Long actualMinutes) {
        return sessionDebriefService.getSessionRecovery(sessionId, userId, sessionName, plannedMinutes, actualMinutes);
    }

        public void acceptSuggestion(Long suggestionId, Long userId) {
        aiSuggestionRepository.findById(suggestionId).ifPresent(s -> {
            if (s.getUser().getId().equals(userId)) {
                s.setAccepted(true);
                aiSuggestionRepository.save(s);
            }
        });
    }
    
    private AiSuggestion logSuggestion(Long userId, String type, String context, String payload) {
        try {
            if (userRepository == null || aiSuggestionRepository == null) return null;
            return userRepository.findById(userId).map(user -> {
                AiSuggestion s = new AiSuggestion(user, type, context, payload);
                return aiSuggestionRepository.save(s);
            }).orElse(null);
        } catch (Exception e) {
            log.error("Failed to log AI suggestion audit: {}", e.getMessage());
            return null;
        }
    }

    private String cleanJson(String raw) {
        if (raw == null) return "{}";
        String s = raw.trim();
        if (s.contains("</think>")) {
            s = s.substring(s.lastIndexOf("</think>") + 8).trim();
        }
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

    private String extractReplyOrClean(String raw) {
        if (raw == null || raw.isBlank()) return "I am EONPAI, ready to assist your execution. What are we tackling?";
        try {
            java.util.regex.Pattern p = java.util.regex.Pattern.compile("\"reply\"\\s*:\\s*\"((?:[^\"\\\\]|\\\\.)*)\"");
            java.util.regex.Matcher m = p.matcher(raw);
            if (m.find()) {
                String reply = m.group(1);
                return reply.replace("\\\"", "\"").replace("\\n", "\n").replace("\\t", "\t").replace("\\\\", "\\");
            }
        } catch (Exception ignored) {}

        String trimmed = raw.trim();
        // If the model echoed raw context JSON without a reply field, present a clean companion response
        if (trimmed.contains("\"userId\":") || trimmed.contains("\"username\":") || trimmed.contains("USER PRODUCTIVITY STATUS:") || (trimmed.startsWith("{") && trimmed.endsWith("}"))) {
            return "I am EONPAI, your Personal Strategic Execution AI Companion. I am tracking your active goals and missions. How can I help you execute right now?";
        }
        return raw;
    }

    private String extractSuggestionType(String raw) {
        if (raw == null) return "TACTICAL_ASSISTANT";
        try {
            java.util.regex.Pattern p = java.util.regex.Pattern.compile("\"suggestionType\"\\s*:\\s*\"([A-Z_]+)\"");
            java.util.regex.Matcher m = p.matcher(raw);
            if (m.find()) {
                return m.group(1);
            }
        } catch (Exception ignored) {}
        return "TACTICAL_ASSISTANT";
    }

    public static int levenshteinDistance(String a, String b) {
        if (a == null || b == null) return Integer.MAX_VALUE;
        int[] costs = new int[b.length() + 1];
        for (int j = 0; j < costs.length; j++) costs[j] = j;
        for (int i = 1; i <= a.length(); i++) {
            costs[0] = i;
            int nw = i - 1;
            for (int j = 1; j <= b.length(); j++) {
                int cj = Math.min(1 + Math.min(costs[j], costs[j - 1]),
                        a.charAt(i - 1) == b.charAt(j - 1) ? nw : nw + 1);
                nw = costs[j];
                costs[j] = cj;
            }
        }
        return costs[b.length()];
    }

    public static boolean fuzzyWordMatch(String word, String target) {
        if (word == null || target == null) return false;
        if (word.equalsIgnoreCase(target)) return true;
        int maxDist = target.length() <= 3 ? 1 : 2;
        return Math.abs(word.length() - target.length()) <= maxDist
                && levenshteinDistance(word.toLowerCase(Locale.ROOT), target.toLowerCase(Locale.ROOT)) <= maxDist;
    }

    public static boolean containsFuzzyWord(String text, String target) {
        if (text == null || target == null) return false;
        String[] words = text.toLowerCase(Locale.ROOT).split("[^a-zA-Z0-9]+");
        for (String w : words) {
            if (fuzzyWordMatch(w, target)) return true;
        }
        return false;
    }

    private boolean isGreeting(String msg) {
        String clean = msg.replaceAll("[!?,.]", "").trim().toLowerCase(Locale.ROOT);
        return clean.equals("hi") || clean.startsWith("hi ")
                || clean.equals("hello") || clean.startsWith("hello ")
                || clean.equals("helo") || clean.startsWith("helo ")
                || clean.equals("hey") || clean.startsWith("hey ")
                || clean.equals("hy") || clean.startsWith("hy ")
                || clean.equals("hlo") || clean.startsWith("hlo ")
                || clean.equals("yo") || clean.startsWith("yo ")
                || clean.equals("sup") || clean.startsWith("sup ")
                || clean.equals("morning") || clean.startsWith("good morning")
                || clean.startsWith("good afternoon") || clean.startsWith("good evening")
                || clean.equals("greetings") || clean.startsWith("greetings ")
                || fuzzyWordMatch(clean, "hello") || fuzzyWordMatch(clean, "greetings");
    }

    private boolean isIdentityQuery(String msg) {
        String clean = msg.replaceAll("[!?,.]", "").trim().toLowerCase(Locale.ROOT);
        if (clean.equals("who are u") || clean.equals("who r u") || clean.equals("who are you") || clean.equals("what are you")
                || clean.equals("hu r u") || clean.equals("wat r u") || clean.equals("what r u") || clean.equals("who is this")) {
            return true;
        }
        boolean hasWhoOrWhat = containsFuzzyWord(msg, "who") || containsFuzzyWord(msg, "what") || msg.contains("wat");
        boolean hasIdentityTarget = containsFuzzyWord(msg, "you") || containsFuzzyWord(msg, "eonpai")
                || containsFuzzyWord(msg, "shinpai") || msg.contains(" u ") || msg.endsWith(" u") || msg.contains(" r u");
        if (hasWhoOrWhat && hasIdentityTarget) {
            return true;
        }
        return containsFuzzyWord(msg, "introduce") || msg.contains("what can you do") || msg.contains("what can u do")
                || msg.contains("what is eonpai") || msg.contains("about eonpai");
    }

    private boolean isTutorialIntent(String msg) {
        String m = msg.toLowerCase(Locale.ROOT);
        if (containsFuzzyWord(m, "tutorial") || containsFuzzyWord(m, "walkthrough") || containsFuzzyWord(m, "onboarding") || m.contains("walkthru")) {
            return true;
        }
        boolean hasHow = m.contains("how do i") || m.contains("how to") || m.contains("how 2") || m.contains("how does") || m.contains("teach me") || m.contains("guide me") || m.contains("show me");
        boolean hasSubject = containsFuzzyWord(m, "use") || containsFuzzyWord(m, "work") || containsFuzzyWord(m, "shinpo") || containsFuzzyWord(m, "start") || containsFuzzyWord(m, "begin");
        return hasHow && hasSubject;
    }

    private boolean isEnforcementQuery(String msg) {
        String m = msg.toLowerCase(Locale.ROOT);
        boolean isWhy = m.contains("why") || m.startsWith("y ") || m.contains(" y ");
        boolean isEnforceTerm = containsFuzzyWord(m, "blocked") || containsFuzzyWord(m, "block")
                || containsFuzzyWord(m, "terminated") || containsFuzzyWord(m, "terminate")
                || containsFuzzyWord(m, "closed") || containsFuzzyWord(m, "killed")
                || m.contains("cant i") || m.contains("can't i") || m.contains("session end")
                || m.contains("my session") || m.contains("youtube");
        return isWhy && isEnforceTerm;
    }

    private boolean isBugReportIntent(String msg) {
        String m = msg.toLowerCase(Locale.ROOT);
        boolean hasBugTerm = containsFuzzyWord(m, "bug") || containsFuzzyWord(m, "error") || containsFuzzyWord(m, "eror")
                || containsFuzzyWord(m, "crash") || containsFuzzyWord(m, "crashed") || containsFuzzyWord(m, "broken") || containsFuzzyWord(m, "problem");
        boolean hasAction = containsFuzzyWord(m, "found") || containsFuzzyWord(m, "report") || containsFuzzyWord(m, "fix")
                || m.contains("there is") || m.contains("not working") || m.contains("is broken");
        return hasBugTerm && hasAction;
    }

    private boolean isVagueBugReport(String msg) {
        String m = msg.trim().toLowerCase(Locale.ROOT);
        if (m.startsWith("submit bug report:") || m.startsWith("submit issue:") || m.startsWith("bug report:")) {
            return false;
        }
        return m.equals("report an issue or bug")
                || m.equals("report issue")
                || m.equals("report a bug")
                || m.equals("report bug")
                || m.equals("bug report")
                || m.equals("i want to report a bug")
                || m.equals("found a bug")
                || (m.startsWith("report") && m.length() < 24)
                || m.length() < 12;
    }

    private boolean isPlanIntent(String msg) {
        String m = msg.toLowerCase(Locale.ROOT);
        if (m.contains("plan my day") || m.contains("daily plan") || m.equals("plan") || m.equals("plann")
                || m.contains("schedule today") || m.contains("plan today") || m.contains("plan the day")
                || m.contains("daily agenda") || m.contains("daily schedule") || m.contains("today agenda")
                || m.contains("organize my day") || m.contains("what should my day") || m.contains("structure my day")
                || m.contains("scheudle") || m.contains("my agenda") || m.contains("todays agenda")) {
            return true;
        }
        boolean hasPlanTerm = containsFuzzyWord(m, "plan") || containsFuzzyWord(m, "schedule")
                || containsFuzzyWord(m, "scheudle") || containsFuzzyWord(m, "itinerary")
                || containsFuzzyWord(m, "agenda") || containsFuzzyWord(m, "agends")
                || containsFuzzyWord(m, "routine") || containsFuzzyWord(m, "calender")
                || containsFuzzyWord(m, "calendar");
        boolean hasTimeTerm = containsFuzzyWord(m, "day") || containsFuzzyWord(m, "today")
                || containsFuzzyWord(m, "daily") || containsFuzzyWord(m, "tomorrow")
                || containsFuzzyWord(m, "morning") || containsFuzzyWord(m, "afternoon");
        return hasPlanTerm && hasTimeTerm;
    }

    private boolean isGoalIntent(String msg) {
        String m = msg.toLowerCase(Locale.ROOT);
        if (m.contains("break down") || m.contains("breakdown") || m.contains("actionable steps")
                || m.contains("decompose") || m.contains("partition goal") || m.contains("split goal") || m.contains("steps to achieve")) {
            return true;
        }
        boolean hasAction = containsFuzzyWord(m, "break") || containsFuzzyWord(m, "decompose")
                || containsFuzzyWord(m, "partition") || containsFuzzyWord(m, "split") || containsFuzzyWord(m, "steps");
        boolean hasTarget = containsFuzzyWord(m, "goal") || containsFuzzyWord(m, "objective") || containsFuzzyWord(m, "target") || containsFuzzyWord(m, "milestone");
        return hasAction && hasTarget;
    }

    private boolean isProfileIntent(String msg) {
        String m = msg.toLowerCase(Locale.ROOT);
        return m.contains("execution profile")
                || m.contains("my profile")
                || m.contains("my velocity")
                || m.contains("estimation bias")
                || m.contains("estimation accuracy")
                || m.contains("how is my velocity")
                || m.contains("am i estimating well")
                || m.contains("show my stats")
                || m.contains("my stats");
    }

    private boolean isDebriefIntent(String msg) {
        String m = msg.toLowerCase(Locale.ROOT);
        if (m.contains("debrief") || m.contains("debreif") || m.contains("de-brief") || m.contains("retrospective") || m.contains("retro")) {
            return true;
        }
        boolean hasReview = containsFuzzyWord(m, "review") || containsFuzzyWord(m, "analyze") || containsFuzzyWord(m, "how") || containsFuzzyWord(m, "reflect") || containsFuzzyWord(m, "evaluate");
        boolean hasTarget = containsFuzzyWord(m, "session") || containsFuzzyWord(m, "sprint") || containsFuzzyWord(m, "focus") || m.contains("did i do") || m.contains("was my") || m.contains("performance");
        return hasReview && hasTarget;
    }

    private boolean isRecoveryIntent(String msg) {
        String m = msg.toLowerCase(Locale.ROOT);
        if (containsFuzzyWord(m, "recovery") || containsFuzzyWord(m, "recover") || containsFuzzyWord(m, "recess")
                || containsFuzzyWord(m, "burnout") || containsFuzzyWord(m, "fatigue")) {
            return true;
        }
        boolean hasFatigue = m.contains("tired") || m.contains("exhausted") || m.contains("stuck") || m.contains("overwhelmed")
                || m.contains("need a break") || m.contains("take a break") || m.contains("cant focus") || m.contains("can't focus")
                || m.contains("lost focus") || m.contains("distracted");
        return hasFatigue;
    }

    private boolean isNextActionIntent(String msg) {
        String m = msg.toLowerCase(Locale.ROOT);
        if (m.contains("what should") || m.contains("wat should") || m.contains("what shud")
                || m.contains("next action") || m.contains("nxt action")
                || m.contains("what to do") || m.contains("wat to do")
                || m.contains("what next") || m.contains("wat next") || m.contains("whats next")
                || m.contains("what should i work on") || m.contains("highest priority") || m.contains("top priority")) {
            return true;
        }
        boolean hasWhat = containsFuzzyWord(m, "what") || m.contains("wat");
        boolean hasNext = containsFuzzyWord(m, "next") || containsFuzzyWord(m, "priority") || containsFuzzyWord(m, "action") || containsFuzzyWord(m, "work") || containsFuzzyWord(m, "focus");
        return hasWhat && hasNext;
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
        if (activeSession != null && Boolean.TRUE.equals(activeSession.get("hasActiveSession"))
                && "ACTIVE".equalsIgnoreCase((String) activeSession.get("status"))) {
            String sessionName = (String) activeSession.get("name");
            Long remainingSecs = activeSession.get("remainingSeconds") instanceof Number n ? n.longValue() : 0L;
            long remainingMins = Math.max(0, remainingSecs / 60);
            String reply = timeOfDay + nameClause + ". Focus sprint **\"" + sessionName + "\"** is in progress (" + remainingMins + "m remaining). Shield active. What quick assistance do you need to stay in flow?";
            logSuggestion(userId, "SILENCE_ENGINE", rawMsg, reply);
            return AiChatResponse.conversational(reply, "FOCUS_ASSISTANT");
        }

        String sessionNote = "";
        if (activeSession != null && (Boolean.TRUE.equals(activeSession.get("hasActiveSession")) || activeSession.containsKey("name"))) {
            sessionNote = "\n\n*Active focus session:* **" + activeSession.get("name") + "** is currently active.";
        }

        String reply = timeOfDay + nameClause + ". I'm **EONPAI**, your personal execution assistant.\n\n"
                + "How can I support your focus today? Available actions:\n"
                + "• `Plan my day` — generate a structured focus itinerary\n"
                + "• `What should I work on now?` — identify your immediate priority task\n"
                + "• `How do I use SHINPO?` — interactive feature walkthrough\n"
                + "• `Why is YouTube blocked?` — check Sentinel focus protection status"
                + sessionNote;

        logSuggestion(userId, "GREETING", rawMsg, reply);
        return AiChatResponse.conversational(reply, "GREETING");
    }

    private AiChatResponse buildIdentityResponse(Long userId, String rawMsg) {
        String reply = "I am **EONPAI**, the embedded execution assistant for SHINPO.\n\n"
                + "I integrate directly with your local tasks, focus sessions, and Sentinel protection policies:\n\n"
                + "• **Goal Deconstruction**: Break broad strategic objectives into 25–45 minute actionable tasks.\n"
                + "• **Tactical Priority**: Recommend high-impact tasks based on your deadlines and active goals.\n"
                + "• **Sentinel Transparency**: Explain why specific applications or web routes are restricted during sprints.\n"
                + "• **Interactive Walkthroughs**: Guide you through onboarding and core workflows.\n"
                + "• **Verified Bug Reporting**: Collect and submit non-sensitive host diagnostics for technical issues.\n\n"
                + "How can I assist your workflow today?";
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
        String reply = "I will guide you through the initial setup.\n\nLet's start by defining your first goal.";
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
            sb.append("**Sentinel Enforcement Active**\n\n");
            sb.append("You currently have an active focus session (**").append(explanation.get("sessionName")).append("**)");
            sb.append(" with approximately **").append(remMin).append(" minutes** remaining.\n\n");
            sb.append("SHINPO applies process and URL restrictions during active sessions to minimize distractions. When the session concludes or is paused, standard access resumes.");
        } else {
            sb.append("**Sentinel System Status**\n\n");
            sb.append(reason).append("\n\n");
            sb.append("*Note: Sentinel enforcement is only engaged during active focus sessions. If an external application closed outside a session, Sentinel was not responsible.*");
        }

        logSuggestion(userId, "ENFORCEMENT_EXPLANATION", rawMsg, sb.toString());
        return AiChatResponse.conversational(sb.toString(), "ENFORCEMENT_EXPLANATION");
    }

    private AiChatResponse buildBugReportDraftResponse(Long userId, String rawMsg) {
        String feature = extractFeature(rawMsg.toLowerCase(Locale.ROOT));
        Map<String, Object> diag = toolRegistry.getSanitizedDiagnostics(userId, feature);
        String diagJson = "{}";
        try {
            diagJson = objectMapper.writeValueAsString(diag);
        } catch (Exception ignored) {}

        Map<String, Object> draft = new LinkedHashMap<>();
        draft.put("feature", feature);
        draft.put("summary", "");
        draft.put("diagnosticsJson", diagJson);
        draft.put("diagnosticSummary", Map.of(
                "os", String.valueOf(diag.getOrDefault("os", "Linux / Windows")),
                "jvm", String.valueOf(diag.getOrDefault("javaVersion", "JVM 21")),
                "memory", diag.getOrDefault("freeMemoryMB", "0") + "MB free of " + diag.getOrDefault("maxMemoryMB", "0") + "MB",
                "session", String.valueOf(diag.getOrDefault("activeFocusSession", "None"))
        ));

        String reply = "**Bug Report Draft**\n\n"
                + "Please provide a specific description of the issue and verify the target feature area. "
                + "You can review the attached host diagnostics below before confirming submission.";

        logSuggestion(userId, "BUG_REPORT_DRAFT", rawMsg, reply);
        return new AiChatResponse(reply, "BUG_REPORT_DRAFT", draft);
    }

    private AiChatResponse buildBugReportResponse(Long userId, String rawMsg) {
        String feature = "FOCUS_ENGINE";
        String description = rawMsg.trim();

        if (description.startsWith("Submit bug report:") || description.startsWith("Submit issue:") || description.startsWith("Bug report:")) {
            String content = description.substring(description.indexOf(':') + 1).trim();
            if (content.startsWith("[") && content.contains("]")) {
                int endBracket = content.indexOf(']');
                feature = content.substring(1, endBracket).trim();
                description = content.substring(endBracket + 1).trim();
            } else {
                description = content;
            }
        } else {
            feature = extractFeature(rawMsg.toLowerCase(Locale.ROOT));
        }

        if (description.isBlank()) {
            description = "Issue reported in " + feature;
        }

        String bugId = "BUG-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        Map<String, Object> diag = toolRegistry.getSanitizedDiagnostics(userId, feature);
        String diagJson = "{}";
        try {
            diagJson = objectMapper.writeValueAsString(diag);
        } catch (Exception ignored) {}

        if (bugReportRepository != null) {
            User user = userRepository.findById(userId).orElse(null);
            BugReport entity = new BugReport(bugId, user, description, feature, diagJson);
            bugReportRepository.save(entity);
        }

        BugReportInfo info = new BugReportInfo(bugId, description, feature, "OPEN", diagJson);
        String reply = "**Bug Report Filed** (`" + bugId + "`)\n\n"
                + "• **Feature Area:** `" + feature + "`\n"
                + "• **Summary:** " + description + "\n"
                + "• **Status:** Received\n\n"
                + "Non-sensitive runtime telemetry (OS, memory, session status) was attached to this report.";

        logSuggestion(userId, "BUG_REPORT", rawMsg, reply);
        return AiChatResponse.withBugReport(reply, info);
    }

    private AiChatResponse deterministicConversationalFallback(String rawMsg, Long userId) {
        Map<String, Object> activeSession = toolRegistry.getActiveFocusSession(userId);
        if (activeSession != null && Boolean.TRUE.equals(activeSession.get("hasActiveSession"))
                && "ACTIVE".equalsIgnoreCase((String) activeSession.get("status"))) {
            String sessionName = (String) activeSession.get("name");
            Long remainingSecs = activeSession.get("remainingSeconds") instanceof Number n ? n.longValue() : 0L;
            long remainingMins = Math.max(0, remainingSecs / 60);
            String reply = "Focus sprint **\"" + sessionName + "\"** is in progress (" + remainingMins + "m remaining).\n\n"
                    + "I am keeping interruptions minimal to protect your deep work. You can pause or complete your sprint from the Focus view when ready.";
            logSuggestion(userId, "SILENCE_ENGINE", rawMsg, reply);
            return AiChatResponse.conversational(reply, "FOCUS_ASSISTANT");
        }

        StringBuilder sb = new StringBuilder();
        sb.append("**EONPAI Execution Assistant**\n\n")
          .append("I can assist with your workflow, goal decomposition, and focus management.\n\n")
          .append("I’m using SHINPO’s built-in guidance right now; generated AI may be temporarily unavailable.\n\n");

        sb.append("Here is how I can assist you directly:\n")
          .append("• **Focus Planning**: Request a structured daily focus itinerary based on your active goals.\n")
          .append("• **Tactical Priority**: Identify the immediate high-impact task to work on next.\n")
          .append("• **Goal Decomposition**: Break broad strategic objectives into actionable 25–45 minute tasks.\n")
          .append("• **Sentinel Protection**: Inspect active application shields or study resource access rules.\n")
          .append("• **Issue Reporting**: File a verified defect report with non-sensitive runtime diagnostics.\n\n")
          .append("Connect a cloud AI provider in the server configuration to enable generated conversational responses.");

        String reply = sb.toString();
        logSuggestion(userId, "COACH", rawMsg, reply);
        return AiChatResponse.conversational(reply, "TACTICAL_ASSISTANT");
    }
}

