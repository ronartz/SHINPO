package com.shinpo.ai.context;

import java.util.List;
import java.util.Map;

public record ExecutionIntelligenceContext(
        UserSummary user,
        GoalSummary currentGoal,
        MissionSummary nextMission,
        SessionSummary activeSession,
        ProgressSummary progress,
        EnforcementSummary enforcement,
        DeviceSummary device,
        List<ScheduleItem> todaysSchedule,
        List<Map<String, String>> conversationHistory
) {
    public record UserSummary(Long userId, String username, String email) {}

    public record GoalSummary(Long id, String title, String description, String status, String targetDate) {}

    public record MissionSummary(Long id, String title, String description, Integer estimatedMinutes, String goalTitle) {}

    public record SessionSummary(Long id, String name, String status, Integer durationMinutes, Long remainingSeconds) {
        public boolean isActive() {
            return "ACTIVE".equalsIgnoreCase(status);
        }
    }

    public boolean isSilenceModeActive() {
        return activeSession != null && activeSession.isActive();
    }

    public record ProgressSummary(int totalGoals, int totalMissions, long completedMissions, int totalSessions, long completedSessions) {}

    public record EnforcementSummary(boolean shieldEngaged, String enforcementLevel, String sentinelMode) {}

    public record DeviceSummary(String os, String totalMemoryGB, String freeMemoryGB, int activeProcessCount) {}

    public record ScheduleItem(Long id, String name, Integer durationMinutes, String priority) {}
}
