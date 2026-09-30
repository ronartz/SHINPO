package com.shinpo.ai.context;

import com.shinpo.ai.context.ExecutionIntelligenceContext.*;
import com.shinpo.ai.tool.AiToolRegistry;
import org.springframework.stereotype.Component;

import java.util.*;

@Component
public class ContextEngine {

    private final AiToolRegistry toolRegistry;

    public ContextEngine(AiToolRegistry toolRegistry) {
        this.toolRegistry = toolRegistry;
    }

    public ExecutionIntelligenceContext assembleContext(
            Long userId,
            Long contextualGoalId,
            Long contextualMissionId,
            Long contextualSessionId,
            List<Map<String, String>> history
    ) {
        Map<String, Object> fullContext = null;
        if (toolRegistry != null) {
            try {
                fullContext = toolRegistry.assembleFullContext(userId, contextualGoalId, contextualMissionId, contextualSessionId);
            } catch (Exception ignored) {}
        }
        if (fullContext == null) {
            fullContext = Map.of();
        }

        // User Summary
        Object rawUser = fullContext.get("user");
        Map<?, ?> uMap = (rawUser instanceof Map<?, ?> m) ? m : (toolRegistry != null ? toolRegistry.getCurrentUser(userId) : null);
        UserSummary user = null;
        if (uMap != null) {
            user = new UserSummary(
                    uMap.get("userId") instanceof Long uid ? uid : userId,
                    uMap.get("username") instanceof String un ? un : "User",
                    uMap.get("email") instanceof String em ? em : null
            );
        } else {
            user = new UserSummary(userId, "User", null);
        }

        // Goal Summary
        Object rawGoal = fullContext.get("currentGoal");
        Map<?, ?> gMap = (rawGoal instanceof Map<?, ?> m) ? m : (toolRegistry != null ? toolRegistry.getCurrentGoal(userId, contextualGoalId) : null);
        GoalSummary goal = null;
        if (gMap != null && gMap.containsKey("title")) {
            goal = new GoalSummary(
                    gMap.get("id") instanceof Long gid ? gid : null,
                    (String) gMap.get("title"),
                    (String) gMap.get("description"),
                    (String) gMap.get("status"),
                    (String) gMap.get("targetDate")
            );
        }

        // Mission Summary
        Object rawMission = fullContext.get("nextMission");
        Map<?, ?> mMap = (rawMission instanceof Map<?, ?> m) ? m : (toolRegistry != null ? toolRegistry.getNextMission(userId) : null);
        MissionSummary mission = null;
        if (mMap != null && mMap.containsKey("title")) {
            mission = new MissionSummary(
                    mMap.get("id") instanceof Long mid ? mid : null,
                    (String) mMap.get("title"),
                    (String) mMap.get("description"),
                    mMap.get("estimatedMinutes") instanceof Integer em ? em : null,
                    (String) mMap.get("goalTitle")
            );
        }

        // Active Session Summary
        Object rawSession = fullContext.get("activeSession");
        Map<?, ?> sMap = (rawSession instanceof Map<?, ?> m) ? m : (toolRegistry != null ? toolRegistry.getActiveFocusSession(userId) : null);
        SessionSummary session = null;
        if (sMap != null && Boolean.TRUE.equals(sMap.get("hasActiveSession"))) {
            session = new SessionSummary(
                    sMap.get("id") instanceof Long sid ? sid : null,
                    (String) sMap.get("name"),
                    (String) sMap.get("status"),
                    sMap.get("durationMinutes") instanceof Integer dm ? dm : null,
                    sMap.get("remainingSeconds") instanceof Long rs ? rs : null
            );
        }

        // Progress Summary
        Object rawProgress = fullContext.get("progress");
        Map<?, ?> pMap = (rawProgress instanceof Map<?, ?> m) ? m : (toolRegistry != null ? toolRegistry.getProgressSummary(userId) : null);
        ProgressSummary progress = new ProgressSummary(
                (pMap != null && pMap.get("totalGoals") instanceof Integer tg) ? tg : 0,
                (pMap != null && pMap.get("totalMissions") instanceof Integer tm) ? tm : 0,
                (pMap != null && pMap.get("completedMissions") instanceof Long cm) ? cm : 0L,
                (pMap != null && pMap.get("totalFocusSessions") instanceof Integer tfs) ? tfs : 0,
                (pMap != null && pMap.get("completedFocusSessions") instanceof Long cfs) ? cfs : 0L
        );

        // Enforcement Summary
        Object rawEnforcement = fullContext.get("enforcement");
        Map<?, ?> eMap = (rawEnforcement instanceof Map<?, ?> m) ? m : (toolRegistry != null ? toolRegistry.getEnforcementState(userId) : null);
        EnforcementSummary enforcement = new EnforcementSummary(
                eMap != null && Boolean.TRUE.equals(eMap.get("shieldEngaged")),
                (eMap != null && eMap.get("enforcementLevel") instanceof String el) ? el : "LEVEL_0_OBSERVATIONAL",
                (eMap != null && eMap.get("sentinelMode") instanceof String sm) ? sm : "ACTIVE_DEFENSE"
        );

        // Device Summary
        Object rawDevice = fullContext.get("device");
        Map<?, ?> dMap = (rawDevice instanceof Map<?, ?> m) ? m : (toolRegistry != null ? toolRegistry.getDeviceStatus(userId) : null);
        DeviceSummary device = new DeviceSummary(
                (dMap != null && dMap.get("os") instanceof String os) ? os : "Unknown OS",
                (dMap != null && dMap.get("totalMemoryGB") instanceof String tg) ? tg : "0.0",
                (dMap != null && dMap.get("freeMemoryGB") instanceof String fg) ? fg : "0.0",
                (dMap != null && dMap.get("activeProcessCount") instanceof Integer apc) ? apc : 0
        );

        // Schedule
        Object rawScheduleObj = fullContext.get("todaysSchedule");
        List<?> rawSchedule = (rawScheduleObj instanceof List<?> l) ? l : (toolRegistry != null ? toolRegistry.getTodaysSchedule(userId) : List.of());
        List<ScheduleItem> schedule = new ArrayList<>();
        if (rawSchedule != null) {
            for (Object obj : rawSchedule) {
                if (obj instanceof Map<?, ?> s) {
                    schedule.add(new ScheduleItem(
                            s.get("id") instanceof Long sid ? sid : null,
                            s.get("name") instanceof String sn ? sn : null,
                            s.get("durationMinutes") instanceof Integer dm ? dm : null,
                            s.get("status") instanceof String st ? st : null
                    ));
                }
            }
        }

        // Conversation History (sanitized)
        List<Map<String, String>> cleanHistory = new ArrayList<>();
        if (history != null) {
            for (Map<String, String> entry : history) {
                if (entry != null && entry.containsKey("role") && entry.containsKey("content")) {
                    cleanHistory.add(Map.of(
                            "role", defangInjection(entry.get("role")),
                            "content", defangInjection(entry.get("content"))
                    ));
                }
            }
        }

        return new ExecutionIntelligenceContext(
                user, goal, mission, session, progress, enforcement, device, schedule, cleanHistory
        );
    }

    public String buildIsolatedPrompt(String systemPrompt, ExecutionIntelligenceContext context, String userInput) {
        StringBuilder sb = new StringBuilder();

        // 1. System Prompt Isolation
        sb.append("<system_prompt>\n")
                .append(systemPrompt != null ? systemPrompt.trim() : "")
                .append("\n</system_prompt>\n\n");

        // 2. Structured Context Isolation (Guaranteed zero credentials/tokens)
        sb.append("<context>\n");
        if (context != null) {
            if (context.user() != null) {
                sb.append("USER: ").append(context.user().username()).append("\n");
            }
            if (context.currentGoal() != null) {
                sb.append("ACTIVE GOAL: ").append(context.currentGoal().title()).append(" (Status: ").append(context.currentGoal().status()).append(")\n");
            }
            if (context.nextMission() != null) {
                sb.append("NEXT MISSION: ").append(context.nextMission().title())
                        .append(" [").append(context.nextMission().estimatedMinutes()).append(" min]\n");
            }
            if (context.activeSession() != null) {
                sb.append("ACTIVE FOCUS SESSION: ").append(context.activeSession().name())
                        .append(" (Remaining: ").append(context.activeSession().remainingSeconds() != null ? context.activeSession().remainingSeconds() / 60 : 0).append(" min)\n");
            }
            if (context.progress() != null) {
                sb.append("PROGRESS: ").append(context.progress().completedMissions()).append("/").append(context.progress().totalMissions())
                        .append(" missions, ").append(context.progress().completedSessions()).append(" focus sessions completed\n");
            }
            if (context.enforcement() != null) {
                sb.append("ENFORCEMENT: Shield=").append(context.enforcement().shieldEngaged() ? "ENGAGED" : "OBSERVATIONAL")
                        .append(", Mode=").append(context.enforcement().sentinelMode()).append("\n");
            }
            if (context.device() != null) {
                sb.append("DEVICE TELEMETRY: OS=").append(context.device().os()).append(", ActiveProcesses=").append(context.device().activeProcessCount()).append("\n");
            }
        }
        sb.append("</context>\n\n");

        // 3. User Input Isolation (Defanged against prompt injection)
        sb.append("<user_input>\n")
                .append(defangInjection(userInput))
                .append("\n</user_input>");

        return sb.toString();
    }

    public static String defangInjection(String input) {
        if (input == null) return "";
        // Defang XML tag breakouts and system delimiter impersonation
        return input
                .replace("</user_input>", "&lt;/user_input&gt;")
                .replace("<user_input>", "&lt;user_input&gt;")
                .replace("</context>", "&lt;/context&gt;")
                .replace("<context>", "&lt;context&gt;")
                .replace("</system_prompt>", "&lt;/system_prompt&gt;")
                .replace("<system_prompt>", "&lt;system_prompt&gt;")
                .trim();
    }

    public Map<String, Object> toSafeContextMap(ExecutionIntelligenceContext context) {
        Map<String, Object> map = new LinkedHashMap<>();
        if (context == null) return map;

        if (context.user() != null) {
            map.put("user", Map.of("userId", context.user().userId(), "username", context.user().username()));
        }
        if (context.currentGoal() != null) {
            map.put("currentGoal", Map.of("title", context.currentGoal().title(), "status", context.currentGoal().status()));
        }
        if (context.nextMission() != null) {
            map.put("nextMission", Map.of("title", context.nextMission().title(), "estimatedMinutes", context.nextMission().estimatedMinutes()));
        }
        if (context.progress() != null) {
            map.put("progress", Map.of("completedMissions", context.progress().completedMissions(), "totalMissions", context.progress().totalMissions()));
        }
        if (context.enforcement() != null) {
            map.put("enforcement", Map.of("shieldEngaged", context.enforcement().shieldEngaged(), "status", context.enforcement().sentinelMode()));
        }
        if (context.device() != null) {
            map.put("device", Map.of("os", context.device().os(), "activeProcessCount", context.device().activeProcessCount()));
        }
        return map;
    }
}
