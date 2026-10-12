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
                new RecoveryOption("RECESS_RESTORE", "5m Cognitive Recess", "Step away from screens and stretch to restore attention capacity."),
                new RecoveryOption("NEXT_MISSION", "Arm Next Mission", "Proceed immediately to the next scheduled backlog item."),
                new RecoveryOption("CALIBRATE_SCOPE", "Scope Calibration", "Adjust future sprint estimation based on observed time variance.")
        );

        if (session == null) {
            return new SessionDebriefAnalysisResponse(
                    null,
                    "No Recorded Sessions",
                    "No completed focus sessions found in database.",
                    "Complete a focus sprint and log your reflection to generate deep performance analytics.",
                    "INITIALIZING",
                    25,
                    0L,
                    0.0,
                    "CALIBRATION_BASELINE",
                    "No past session debriefs are available yet. To begin the behavioral execution loop, start a 25-minute sprint on your top priority mission.",
                    "Arm your first tactical mission and run an uninterrupted focus block with the Sentinel shield.",
                    defaultSteps
            );
        }

        String sessionName = session.getName() != null ? session.getName() : "Focus Sprint";
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
        if (aiProperties != null && aiProperties.isEnabled() && provider != null && provider.isAvailable()) {
            try {
                String systemPrompt = """
                        You are EONPAI, Strategic Execution Companion for SHINPO.
                        Analyze the user's completed focus sprint debrief.
                        Provide a crisp, constructive tactical critique and actionable recommendation for their next sprint.
                        Philosophy: Execution > Planning Theater. Radical Honesty + Behavioral Encouragement.
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
                    String critique = node.has("tacticalCritique") ? node.get("tacticalCritique").asText() : null;
                    String recommendation = node.has("nextSprintRecommendation") ? node.get("nextSprintRecommendation").asText() : null;

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
            heuristicCritique = "High-leverage sprint completed with disciplined focus. Accomplishment clearly advances tactical objectives.";
            heuristicRecommendation = "Take a 5-minute cognitive reset before locking into your next milestone sprint.";
        } else if ("DISTRACTED".equalsIgnoreCase(quality)) {
            heuristicCritique = "Focus boundary was tested during this sprint. Cognitive friction reduced total depth of work.";
            heuristicRecommendation = "Engage strict Sentinel enforcement on your next block to insulate against recurring distraction patterns.";
        } else {
            heuristicCritique = "Sprint successfully logged. Time variance maintained within acceptable operational tolerances.";
            heuristicRecommendation = "Review your primary backlog mission and initialize the next execution window.";
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
        String name = sessionName != null ? sessionName : "Recent Sprint";
        int planned = plannedMinutes != null ? plannedMinutes : 25;
        long actual = actualMinutes != null ? actualMinutes : 25;

        List<RecoveryOption> options = List.of(
                new RecoveryOption("RECESS_RESTORE", "Take 10m Restoration Break", "Step away from all terminals, hydrate, and allow neural fatigue to dissipate."),
                new RecoveryOption("SPLIT_SCOPE", "Partition Scope into 2x 20m Sprints", "The remaining deliverable is overloaded. Split it into smaller atomic slices."),
                new RecoveryOption("ABORT_RECALIBRATE", "Conclude Work Block & Review Backlog", "Do not force diminished returns. Log reflection notes and plan tomorrow's trajectory.")
        );

        String message = String.format("Sprint [%s] concluded (Planned: %dm, Actual: %dm). Select a calibration strategy to maintain cognitive throughput.",
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

