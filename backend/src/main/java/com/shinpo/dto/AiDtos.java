package com.shinpo.dto;

import java.time.Instant;
import java.util.List;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

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
            @NotBlank
            @Size(max = 150)
            String title,
            String description,
            @Min(1)
            @Max(480)
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
            @Size(max = 50)
            List<@NotNull @Valid ProposedMission> selectedMissions
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
            String priority,
            String scheduledStartTime,
            String scheduledEndTime,
            String energyWindow,
            Integer originalEstimatedMinutes,
            Double biasCorrectionFactor,
            Boolean isRestorativeBreak,
            Long goalId
    ) {
        public DailyPlanItem(Long missionId, String missionTitle, String goalTitle, Integer durationMinutes, String priority) {
            this(missionId, missionTitle, goalTitle, durationMinutes, priority, null, null, "TACTICAL_SPRINT", durationMinutes, 1.0, false, null);
        }

        public Boolean isRestorativeBreak() {
            return isRestorativeBreak != null ? isRestorativeBreak : false;
        }
    }

    public record DailyPlanResponse(
            String headline,
            String rationale,
            List<DailyPlanItem> planItems,
            Integer totalPlannedMinutes,
            Integer totalFocusMinutes,
            Integer totalBreakMinutes,
            String circadianPacingStrategy,
            Double userEstimationBiasPct,
            Boolean hasConflictsResolved,
            Long suggestionId
    ) {
        public DailyPlanResponse(String headline, String rationale, List<DailyPlanItem> planItems) {
            this(headline, rationale, planItems,
                    planItems != null ? planItems.stream().mapToInt(i -> i.durationMinutes() != null ? i.durationMinutes() : 0).sum() : 0,
                    planItems != null ? planItems.stream().filter(i -> !Boolean.TRUE.equals(i.isRestorativeBreak())).mapToInt(i -> i.durationMinutes() != null ? i.durationMinutes() : 0).sum() : 0,
                    planItems != null ? planItems.stream().filter(i -> Boolean.TRUE.equals(i.isRestorativeBreak())).mapToInt(i -> i.durationMinutes() != null ? i.durationMinutes() : 0).sum() : 0,
                    "BALANCED_CIRCADIAN_FLOW", 0.0, false, null);
        }

        public Boolean hasConflictsResolved() {
            return hasConflictsResolved != null ? hasConflictsResolved : false;
        }

        public Integer totalPlannedMinutes() {
            if (totalPlannedMinutes != null && totalPlannedMinutes > 0) return totalPlannedMinutes;
            return planItems != null ? planItems.stream().mapToInt(i -> i.durationMinutes() != null ? i.durationMinutes() : 0).sum() : 0;
        }

        public Integer totalFocusMinutes() {
            if (totalFocusMinutes != null && totalFocusMinutes > 0) return totalFocusMinutes;
            return planItems != null ? planItems.stream().filter(i -> !i.isRestorativeBreak()).mapToInt(i -> i.durationMinutes() != null ? i.durationMinutes() : 0).sum() : 0;
        }

        public Integer totalBreakMinutes() {
            if (totalBreakMinutes != null && totalBreakMinutes > 0) return totalBreakMinutes;
            return planItems != null ? planItems.stream().filter(item -> item != null && Boolean.TRUE.equals(item.isRestorativeBreak())).mapToInt(i -> i.durationMinutes() != null ? i.durationMinutes() : 0).sum() : 0;
        }
    }

    public record CommitDailyPlanRequest(
            Long suggestionId,
            List<DailyPlanItem> selectedItems
    ) {}

    public record CommitDailyPlanResponse(
            int scheduledSessionsCount,
            int totalScheduledMinutes,
            List<Long> createdSessionIds,
            String statusMessage
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

    public record SessionDebriefAnalysisResponse(
            Long sessionId,
            String sessionName,
            String accomplishment,
            String reflectionNote,
            String completionQuality,
            Integer plannedMinutes,
            Long actualMinutes,
            Double estimationAccuracyPct,
            String velocityAssessment,
            String tacticalCritique,
            String nextSprintRecommendation,
            List<RecoveryOption> suggestedNextSteps
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