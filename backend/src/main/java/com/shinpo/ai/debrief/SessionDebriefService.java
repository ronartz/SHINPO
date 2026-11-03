package com.shinpo.ai.debrief;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import com.shinpo.ai.config.AiProperties;
import com.shinpo.ai.provider.AIProvider;
import com.shinpo.ai.provider.AIProviderRegistry;
import com.shinpo.ai.provider.AiProviderRequest;
import com.shinpo.ai.provider.AiProviderResponse;
import com.shinpo.dto.AiDtos.RecoveryOption;
import com.shinpo.dto.AiDtos.RecoveryResponse;
import com.shinpo.dto.AiDtos.SessionDebriefAnalysisResponse;
import com.shinpo.entity.FocusSession;
import com.shinpo.entity.FocusSessionStatus;
import com.shinpo.repository.FocusSessionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

@Service
public class SessionDebriefService {

    private static final Logger log = LoggerFactory.getLogger(SessionDebriefService.class);

    private final AIProviderRegistry providerRegistry;
    private final AiProperties aiProperties;
    private final FocusSessionRepository focusSessionRepository;
    private final ObjectMapper objectMapper;

    @Autowired
    public SessionDebriefService(
            AIProviderRegistry providerRegistry,
            AiProperties aiProperties,
            @Autowired(required = false) FocusSessionRepository focusSessionRepository,
            ObjectMapper objectMapper
    ) {
        this.providerRegistry = providerRegistry;
        this.aiProperties = aiProperties;
        this.focusSessionRepository = focusSessionRepository;
        this.objectMapper = objectMapper;
    }

    public SessionDebriefAnalysisResponse analyzeSessionDebrief(Long sessionId, Long userId) {
        FocusSession session = null;
        if (focusSessionRepository != null) {
            if (sessionId != null && sessionId > 0) {
                session = focusSessionRepository.findByIdAndUser_Id(sessionId, userId).orElse(null);
            }
            if (session == null) {
                session = focusSessionRepository.findFirstByUser_IdAndStatusOrderByCreatedAtDesc(userId, FocusSessionStatus.COMPLETED)
                        .orElseGet(() -> focusSessionRepository.findFirstByUser_IdOrderByCreatedAtDesc(userId).orElse(null));
            }
        }

        List<RecoveryOption> defaultSteps = List.of(
                new RecoveryOption("RECESS_RESTORE", "Take a short break", "Step away from screens and stretch before your next task."),
                new RecoveryOption("NEXT_MISSION", "Start the next task", "Continue with the next scheduled task."),
                new RecoveryOption("CALIBRATE_SCOPE", "Review time estimates", "Use this session to refine future task estimates.")
        );

        if (session == null) {
            return new SessionDebriefAnalysisResponse(
                    null,
                    "No Recorded Sessions",
                    "No completed focus sessions found in database.",
                    "Complete a focus session and add a reflection to review your progress.",
                    "INITIALIZING",
                    25,
                    0L,
                    0.0,
                    "CALIBRATION_BASELINE",
                    "No session reviews are available yet. Start a focus session on a priority task to begin.",
                    "Choose a task and start a focus session to get started.",
                    defaultSteps
            );
        }

        String sessionName = session.getName() != null ? session.getName() : "Focus Session";
        String accomplishment = session.getAccomplishment() != null ? session.getAccomplishment() : "No accomplishment logged";
        String reflectionNote = session.getReflectionNote() != null ? session.getReflectionNote() : "No reflection notes logged";
        String quality = session.getCompletionQuality() != null ? String.valueOf(session.getCompletionQuality()) : "NORMAL";
        int plannedMins = session.getDurationMinutes() != null && session.getDurationMinutes() > 0 ? session.getDurationMinutes() : 25;

        long actualMins = session.calculateActiveSeconds(Instant.now()) / 60;
        if (actualMins <= 0 && session.getStartedAt() != null && session.getEndedAt() != null) {
            actualMins = Math.max(1, Duration.between(session.getStartedAt(), session.getEndedAt()).toMinutes());
        } else if (actualMins <= 0) {
            actualMins = plannedMins;
        }

        double diff = (double) (actualMins - plannedMins);
        double accuracyPct = (diff / plannedMins) * 100.0;
        accuracyPct = Math.round(accuracyPct * 10.0) / 10.0;

        String velocityAssessment;
        if ("DISTRACTED".equalsIgnoreCase(quality) || "LOW".equalsIgnoreCase(quality)) {
            velocityAssessment = "COGNITIVE_RECOVERY_REQUIRED";
        } else if (accuracyPct > 25.0) {
            velocityAssessment = "PACING_CALIBRATION_NEEDED";
        } else if (Math.abs(accuracyPct) <= 15.0) {
            velocityAssessment = "PEAK_EXECUTION_FLOW";
        } else {
            velocityAssessment = "STABLE_MOMENTUM";
        }

        AIProvider provider = providerRegistry != null ? providerRegistry.getActiveProvider() : null;
        if (aiProperties != null && aiProperties.isEnabled() && provider != null) {
            try {
                String systemPrompt = """
                        You are EONPAI, Strategic Execution Companion for SHINPO.
                        Review the user's completed focus session.
                        Provide a concise, constructive summary and one practical recommendation for their next session.
                        Use professional, plain language. Avoid role-play, military, and game terminology.
                        Respond strictly in valid JSON matching:
                        {
                          "tacticalCritique": "<2 sentences evaluating accomplishment, cognitive effort, and time discipline>",
                          "nextSprintRecommendation": "<1 actionable, concrete sentence guiding the user's immediate next step>"
                        }
                        """;

                String userPrompt = String.format(
                        "Session: %s\nPlanned: %d min | Actual: %d min (Variance: %+.1f%%)\nQuality: %s\nAccomplishment: %s\nReflection: %s",
                        sessionName, plannedMins, actualMins, accuracyPct, quality, accomplishment, reflectionNote
                );

                AiProviderRequest req = AiProviderRequest.of(systemPrompt, userPrompt);
                AiProviderResponse res = provider.generate(req);

                if (res.successful() && res.content() != null) {
                    JsonNode node = objectMapper.readTree(cleanJson(res.content()));
                    String critique = node.has("tacticalCritique") ? node.get("tacticalCritique").asString() : null;
                    String recommendation = node.has("nextSprintRecommendation") ? node.get("nextSprintRecommendation").asString() : null;


                    if (critique != null && recommendation != null) {
                        return new SessionDebriefAnalysisResponse(
                                session.getId(),
                                sessionName,
                                accomplishment,
                                reflectionNote,
                                quality,
                                plannedMins,
                                actualMins,
                                accuracyPct,
                                velocityAssessment,
                                critique,
                                recommendation,
                                defaultSteps
                        );
                    }
                }
            } catch (Exception e) {
                log.warn("EONPAI LLM debrief generation failed: {}. Falling back to heuristic analysis.", e.getMessage());
            }
        }

        // Heuristic fallback
        String heuristicCritique;
        String heuristicRecommendation;
        if ("EXCELLENT".equalsIgnoreCase(quality) || "HIGH".equalsIgnoreCase(quality)) {
            heuristicCritique = "Focus session completed. The recorded work supports your stated goal.";
            heuristicRecommendation = "Take a short break before starting your next focus session.";
        } else if ("DISTRACTED".equalsIgnoreCase(quality)) {
            heuristicCritique = "Distractions interrupted this focus session.";
            heuristicRecommendation = "Review your focus protection settings before your next session.";
        } else {
            heuristicCritique = "Focus session recorded.";
            heuristicRecommendation = "Review your task list and choose a next step.";
        }

        return new SessionDebriefAnalysisResponse(
                session.getId(),
                sessionName,
                accomplishment,
                reflectionNote,
                quality,
                plannedMins,
                actualMins,
                accuracyPct,
                velocityAssessment,
                heuristicCritique,
                heuristicRecommendation,
                defaultSteps
        );
    }

    public RecoveryResponse getSessionRecovery(Long sessionId, Long userId, String sessionName, Integer plannedMinutes, Long actualMinutes) {
        String name = sessionName != null ? sessionName : "Recent Focus Session";
        int planned = plannedMinutes != null ? plannedMinutes : 25;
        long actual = actualMinutes != null ? actualMinutes : 25;

        List<RecoveryOption> options = List.of(
                new RecoveryOption("RECESS_RESTORE", "Take 10m Restoration Break", "Step away from all terminals, hydrate, and allow neural fatigue to dissipate."),
                new RecoveryOption("SPLIT_SCOPE", "Split the task", "Break the remaining work into smaller steps."),
                new RecoveryOption("ABORT_RECALIBRATE", "Conclude Work Block & Review Backlog", "Do not force diminished returns. Log reflection notes and plan tomorrow's trajectory.")
        );

        String message = String.format("Focus session '%s' ended (planned: %dm, recorded: %dm). Choose how you would like to continue.",
                name, planned, actual);

        return new RecoveryResponse(
                sessionId != null ? sessionId : 1L,
                name,
                planned,
                actual,
                message,
                options
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
}

