package com.shinpo.ai.planning;

import tools.jackson.databind.ObjectMapper;
import com.shinpo.ai.actions.AiActionService;
import com.shinpo.ai.config.AiProperties;
import com.shinpo.ai.provider.AIProvider;
import com.shinpo.ai.provider.AIProviderRegistry;
import com.shinpo.ai.provider.AiProviderRequest;
import com.shinpo.ai.provider.AiProviderResponse;
import com.shinpo.ai.tool.AiToolRegistry;
import com.shinpo.dto.AiDtos.GoalDecompositionResponse;
import com.shinpo.dto.AiDtos.ProposedMission;
import com.shinpo.entity.AiSuggestion;
import com.shinpo.repository.AiSuggestionRepository;
import com.shinpo.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class GoalDecompositionService {

    private static final Logger log = LoggerFactory.getLogger(GoalDecompositionService.class);

    private final AIProviderRegistry providerRegistry;
    private final AiProperties aiProperties;
    private final AiToolRegistry toolRegistry;
    private final AiSuggestionRepository aiSuggestionRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;
    @SuppressWarnings("unused")
    private final AiActionService aiActionService;

    public GoalDecompositionService(
            AIProviderRegistry providerRegistry,
            AiProperties aiProperties,
            AiToolRegistry toolRegistry,
            AiSuggestionRepository aiSuggestionRepository,
            UserRepository userRepository,
            ObjectMapper objectMapper,
            AiActionService aiActionService
    ) {
        this.providerRegistry = providerRegistry;
        this.aiProperties = aiProperties;
        this.toolRegistry = toolRegistry;
        this.aiSuggestionRepository = aiSuggestionRepository;
        this.userRepository = userRepository;
        this.objectMapper = objectMapper;
        this.aiActionService = aiActionService;
    }

    public GoalDecompositionResponse decomposeGoal(Long goalId, Long userId, String goalTitle) {
        Map<String, Object> goalCtx = toolRegistry != null ? toolRegistry.getCurrentGoal(userId, goalId) : Map.of();

        AIProvider provider = providerRegistry != null ? providerRegistry.getActiveProvider() : null;
        if (aiProperties != null && aiProperties.isEnabled() && provider != null && provider.isAvailable()) {
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
                    AiSuggestion s = logSuggestion(userId, "GOAL_DECOMPOSITION", "goalId=" + goalId, res.content());
                    return new GoalDecompositionResponse(
                            parsed.goalId(),
                            parsed.goalTitle(),
                            parsed.analysis(),
                            parsed.proposedMissions(),
                            s != null ? s.getId() : null
                    );
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
        String payloadJson = "{}";
        try {
            payloadJson = objectMapper.writeValueAsString(fallbackMissions);
        } catch (Exception ignored) {}

        AiSuggestion s = logSuggestion(userId, "GOAL_DECOMPOSITION", "goalId=" + goalId, payloadJson);
        return new GoalDecompositionResponse(
                goalId,
                goalTitle,
                "Goal strategically partitioned into high-velocity execution blocks (Deterministic Safe Engine).",
                fallbackMissions,
                s != null ? s.getId() : null
        );
    }

    private String cleanJson(String raw) {
        if (raw == null) return "";
        String s = raw.trim();
        if (s.startsWith("```json")) s = s.substring(7);
        else if (s.startsWith("```")) s = s.substring(3);
        if (s.endsWith("```")) s = s.substring(0, s.length() - 3);
        return s.trim();
    }

    private AiSuggestion logSuggestion(Long userId, String type, String context, String payload) {
        if (aiSuggestionRepository == null || userRepository == null) return null;
        try {
            var user = userRepository.findById(userId).orElse(null);
            if (user != null) {
                AiSuggestion s = new AiSuggestion(user, type, context, payload);
                return aiSuggestionRepository.save(s);
            }
        } catch (Exception e) {
            log.warn("Failed to persist suggestion: {}", e.getMessage());
        }
        return null;
    }
}

