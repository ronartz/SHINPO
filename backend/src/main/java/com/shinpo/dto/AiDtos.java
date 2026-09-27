package com.shinpo.dto;

import java.util.List;

public class AiDtos {

    public record AiChatRequest(
            Long userId,
            String message,
            Long contextualGoalId,
            Long contextualMissionId,
            Long contextualSessionId
    ) {}

    public record ProposedMission(
            String title,
            String description,
            Integer estimatedMinutes
    ) {}

    public record GoalDecompositionResponse(
            Long goalId,
            String goalTitle,
            String analysis,
            List<ProposedMission> proposedMissions
    ) {}

    public record NextActionResponse(
            Long goalId,
            String goalTitle,
            Long missionId,
            String missionTitle,
            String recommendedAction,
            Integer estimatedMinutes,
            String rationale
    ) {}

    public record DailyPlanItem(
            Long missionId,
            String missionTitle,
            String goalTitle,
            Integer durationMinutes,
            String priority
    ) {}

    public record DailyPlanResponse(
            String headline,
            String rationale,
            List<DailyPlanItem> planItems
    ) {}

    public record RecoveryOption(
            String code,
            String label,
            String suggestedAction
    ) {}

    public record RecoveryResponse(
            Long sessionId,
            String sessionName,
            Integer plannedMinutes,
            Long actualMinutes,
            String diagnosticMessage,
            List<RecoveryOption> recoveryOptions
    ) {}

    public record AiChatResponse(
            String reply,
            String suggestionType,
            Object structuredCard
    ) {}
}