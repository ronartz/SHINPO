package com.shinpo.dto;

import java.time.Instant;
import java.util.List;

public class AiDtos {

    public record AiChatRequest(
            Long userId,
            String message,
            Long contextualGoalId,
            Long contextualMissionId,
            Long contextualSessionId,
            String conversationId
    ) {
        public AiChatRequest(Long userId, String message, Long contextualGoalId, Long contextualMissionId, Long contextualSessionId) {
            this(userId, message, contextualGoalId, contextualMissionId, contextualSessionId, null);
        }
    }

    public record ProposedMission(
            String title,
            String description,
            Integer estimatedMinutes
    ) {}

    public record GoalDecompositionResponse(
            Long goalId,
            String goalTitle,
            String analysis,
            List<ProposedMission> proposedMissions,
            Long suggestionId
    ) {
        public GoalDecompositionResponse(Long goalId, String goalTitle, String analysis, List<ProposedMission> proposedMissions) {
            this(goalId, goalTitle, analysis, proposedMissions, null);
        }
    }

    public record SuggestionCommitRequest(
            Long targetGoalId,
            List<ProposedMission> selectedMissions
    ) {}

    public record SuggestionCommitResponse(
            Long suggestionId,
            Long goalId,
            int committedMissionsCount,
            List<com.shinpo.dto.MissionResponse> committedMissions
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

    public record UserExecutionProfileDto(
            Long userId,
            boolean hasSufficientData,
            int completedSessionsCount,
            int totalMissionsCompleted,
            long totalFocusMinutes,
            Double averageFocusMinutes,
            Double estimationBiasPercentage,
            String estimationAccuracyCategory,
            String confidenceLevel,
            Double completionVelocityPerDay,
            String statusMessage
    ) {}

    public record TutorialStep(
            String tutorialId,
            int stepId,
            String targetTab,
            String instruction,
            String completionCondition
    ) {}

    public record BugReportInfo(
            String bugId,
            String summary,
            String feature,
            String status,
            String diagnostics
    ) {}

    public record ConversationMessageDto(
            Long id,
            String role,
            String content,
            String suggestionType,
            Object structuredCard,
            TutorialStep tutorial,
            BugReportInfo bugReport,
            Instant createdAt
    ) {}

    public record ConversationDto(
            String conversationId,
            String title,
            String status,
            List<ConversationMessageDto> messages,
            Instant updatedAt
    ) {}

    public record AiChatResponse(
            String reply,
            String suggestionType,
            Object structuredCard,
            TutorialStep tutorial,
            BugReportInfo bugReport,
            String conversationId
    ) {
        public AiChatResponse(String reply, String suggestionType, Object structuredCard, TutorialStep tutorial, BugReportInfo bugReport) {
            this(reply, suggestionType, structuredCard, tutorial, bugReport, null);
        }

        public AiChatResponse(String reply, String suggestionType, Object structuredCard) {
            this(reply, suggestionType, structuredCard, null, null, null);
        }

        public static AiChatResponse conversational(String reply, String suggestionType) {
            return new AiChatResponse(reply, suggestionType, null, null, null, null);
        }

        public static AiChatResponse withTutorial(String reply, TutorialStep tutorial) {
            return new AiChatResponse(reply, "TUTORIAL", null, tutorial, null, null);
        }

        public static AiChatResponse withBugReport(String reply, BugReportInfo bugReport) {
            return new AiChatResponse(reply, "BUG_REPORT", null, null, bugReport, null);
        }

        public AiChatResponse withConversationId(String conversationId) {
            return new AiChatResponse(reply, suggestionType, structuredCard, tutorial, bugReport, conversationId);
        }
    }
}