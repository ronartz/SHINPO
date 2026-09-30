package com.shinpo.ai.tool;

import com.shinpo.dto.TaskManagerDtos.DeviceSystemInfo;
import com.shinpo.entity.FocusSession;
import com.shinpo.entity.Goal;
import com.shinpo.entity.Mission;
import com.shinpo.repository.FocusSessionRepository;
import com.shinpo.repository.GoalRepository;
import com.shinpo.repository.MissionRepository;
import com.shinpo.repository.UserRepository;
import com.shinpo.service.SentinelEnforcementService;
import com.shinpo.service.TaskManagerService;
import com.shinpo.service.UserExecutionProfileService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.*;

/**
 * Controlled READ-ONLY SHINPO tools registry for the AI layer.
 * All tools enforce authenticated user isolation and return only compact,
 * non-sensitive DTOs (no passwords, tokens, or raw database entities).
 */
@Component
public class AiToolRegistry {

    private final UserRepository userRepository;
    private final GoalRepository goalRepository;
    private final MissionRepository missionRepository;
    private final FocusSessionRepository focusSessionRepository;
    private final TaskManagerService taskManagerService;
    private final UserExecutionProfileService userExecutionProfileService;
    private final SentinelEnforcementService sentinelEnforcementService;

    private final Map<String, AiTool> toolMap = new LinkedHashMap<>();

    @Autowired
    public AiToolRegistry(
            UserRepository userRepository,
            GoalRepository goalRepository,
            MissionRepository missionRepository,
            FocusSessionRepository focusSessionRepository,
            TaskManagerService taskManagerService,
            UserExecutionProfileService userExecutionProfileService,
            @Autowired(required = false) SentinelEnforcementService sentinelEnforcementService
    ) {
        this(userRepository, goalRepository, missionRepository, focusSessionRepository, taskManagerService, userExecutionProfileService, sentinelEnforcementService, List.of());
    }

    public AiToolRegistry(
            UserRepository userRepository,
            GoalRepository goalRepository,
            MissionRepository missionRepository,
            FocusSessionRepository focusSessionRepository,
            TaskManagerService taskManagerService,
            UserExecutionProfileService userExecutionProfileService
    ) {
        this(userRepository, goalRepository, missionRepository, focusSessionRepository, taskManagerService, userExecutionProfileService, null, List.of());
    }

    public AiToolRegistry(
            UserRepository userRepository,
            GoalRepository goalRepository,
            MissionRepository missionRepository,
            FocusSessionRepository focusSessionRepository,
            TaskManagerService taskManagerService
    ) {
        this(userRepository, goalRepository, missionRepository, focusSessionRepository, taskManagerService, null, null, List.of());
    }

    public AiToolRegistry(
            UserRepository userRepository,
            GoalRepository goalRepository,
            MissionRepository missionRepository,
            FocusSessionRepository focusSessionRepository,
            TaskManagerService taskManagerService,
            UserExecutionProfileService userExecutionProfileService,
            SentinelEnforcementService sentinelEnforcementService,
            List<AiTool> customTools
    ) {
        this.userRepository = userRepository;
        this.goalRepository = goalRepository;
        this.missionRepository = missionRepository;
        this.focusSessionRepository = focusSessionRepository;
        this.taskManagerService = taskManagerService;
        this.userExecutionProfileService = userExecutionProfileService;
        this.sentinelEnforcementService = sentinelEnforcementService;

        registerBuiltInTools();
        if (customTools != null) {
            for (AiTool tool : customTools) {
                registerTool(tool);
            }
        }
    }

    public void registerTool(AiTool tool) {
        if (tool == null) return;
        toolMap.put(normalizeToolName(tool.getName()), tool);
    }

    public Optional<AiTool> getTool(String name) {
        if (name == null) return Optional.empty();
        return Optional.ofNullable(toolMap.get(normalizeToolName(name)));
    }

    public boolean hasTool(String name) {
        if (name == null) return false;
        return toolMap.containsKey(normalizeToolName(name));
    }

    public List<ToolDefinition> getToolDefinitions() {
        Set<AiTool> uniqueTools = new LinkedHashSet<>(toolMap.values());
        return uniqueTools.stream().map(tool -> tool.getDefinition()).toList();
    }

    public Collection<AiTool> getTools() {
        return Collections.unmodifiableCollection(new LinkedHashSet<>(toolMap.values()));
    }

    /**
     * Executes a tool with strict caller user verification and IDOR prevention.
     */
    public ToolResult executeTool(String toolName, Long authenticatedUserId, Map<String, Object> parameters) {
        if (toolName == null || toolName.isBlank()) {
            return ToolResult.error("unknown", "Tool name cannot be blank");
        }
        if (authenticatedUserId == null) {
            return ToolResult.error(toolName, "Unauthenticated: userId is required for tool execution");
        }
        AiTool tool = getTool(toolName).orElse(null);
        if (tool == null) {
            return ToolResult.error(toolName, "Tool not found: " + toolName);
        }

        Map<String, Object> safeParams = parameters != null ? new HashMap<>(parameters) : new HashMap<>();
        // Defend against caller-spoofed user parameters; security principal is strictly authoritative
        safeParams.remove("userId");
        safeParams.remove("user_id");

        return tool.execute(authenticatedUserId, safeParams);
    }

    private void registerBuiltInTools() {
        registerToolWithAliases(new GetCurrentUserTool());
        registerToolWithAliases(new GetCurrentGoalTool());
        registerToolWithAliases(new GetTodaysScheduleTool());
        registerToolWithAliases(new GetActiveFocusSessionTool());
        registerToolWithAliases(new GetNextMissionTool());
        registerToolWithAliases(new GetTodaysMissionsTool());
        registerToolWithAliases(new GetProgressSummaryTool());
        registerToolWithAliases(new GetDeviceStatusTool());
        registerToolWithAliases(new GetEnforcementStateTool());
        registerToolWithAliases(new GetRecentSessionEventsTool());
        registerToolWithAliases(new GetEnforcementExplanationTool());
        registerToolWithAliases(new GetSanitizedDiagnosticsTool());
        registerToolWithAliases(new GetUserExecutionProfileTool());
    }

    private void registerToolWithAliases(AiTool tool) {
        toolMap.put(normalizeToolName(tool.getName()), tool);
        // Also register camelCase / alternate variants
        String snake = tool.getName();
        String camel = toCamelCase(snake);
        toolMap.put(normalizeToolName(camel), tool);
    }

    private String normalizeToolName(String name) {
        return name.toLowerCase(Locale.ROOT).replace("_", "").replace("-", "");
    }

    private String toCamelCase(String snake) {
        StringBuilder sb = new StringBuilder();
        boolean capitalizeNext = false;
        for (char c : snake.toCharArray()) {
            if (c == '_' || c == '-') {
                capitalizeNext = true;
            } else if (capitalizeNext) {
                sb.append(Character.toUpperCase(c));
                capitalizeNext = false;
            } else {
                sb.append(c);
            }
        }
        return sb.toString();
    }

    private Long parseLong(Object obj) {
        if (obj == null) return null;
        if (obj instanceof Number n) return n.longValue();
        try {
            return Long.parseLong(obj.toString().trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private int parseInteger(Object obj, int defaultValue) {
        if (obj == null) return defaultValue;
        if (obj instanceof Number n) return n.intValue();
        try {
            return Integer.parseInt(obj.toString().trim());
        } catch (NumberFormatException e) {
            return defaultValue;
        }
    }

    // =========================================================================
    // BUILT-IN TOOL IMPLEMENTATIONS
    // =========================================================================

    private class GetCurrentUserTool implements AiTool {
        @Override
        public String getName() {
            return "get_current_user";
        }

        @Override
        public String getDescription() {
            return "Returns non-sensitive profile information (id, username, email) for the authenticated user.";
        }

        @Override
        public Map<String, ToolParameter> getParameters() {
            return Map.of();
        }

        @Override
        public ToolResult execute(Long authenticatedUserId, Map<String, Object> parameters) {
            return userRepository.findById(authenticatedUserId)
                    .map(u -> {
                        Map<String, Object> m = new LinkedHashMap<>();
                        m.put("userId", u.getId());
                        m.put("username", u.getUsername());
                        m.put("email", u.getEmail());
                        return ToolResult.ok(getName(), m);
                    })
                    .orElseGet(() -> ToolResult.ok(getName(), Map.of("userId", authenticatedUserId, "status", "anonymous")));
        }
    }

    private class GetCurrentGoalTool implements AiTool {
        @Override
        public String getName() {
            return "get_current_goal";
        }

        @Override
        public String getDescription() {
            return "Retrieves the user's active goal or a specific goal owned by the user. Enforces strict ownership checks against IDOR attacks.";
        }

        @Override
        public Map<String, ToolParameter> getParameters() {
            return Map.of("goalId", new ToolParameter("goalId", "integer", "Optional goal ID to inspect", false));
        }

        @Override
        public ToolResult execute(Long authenticatedUserId, Map<String, Object> parameters) {
            Long goalId = parseLong(parameters.get("goalId"));
            if (goalId == null) {
                List<Goal> goals = goalRepository.findAllByUser_Id(authenticatedUserId);
                if (goals.isEmpty()) {
                    return ToolResult.ok(getName(), Map.of("hasGoals", false));
                }
                return ToolResult.ok(getName(), formatGoal(goals.get(0)));
            }

            Optional<Goal> goalOpt = goalRepository.findByIdAndUser_Id(goalId, authenticatedUserId);
            if (goalOpt.isEmpty()) {
                return ToolResult.error(getName(), "Goal not found or access denied for ID: " + goalId);
            }
            return ToolResult.ok(getName(), formatGoal(goalOpt.get()));
        }
    }

    private class GetTodaysScheduleTool implements AiTool {
        @Override
        public String getName() {
            return "get_todays_schedule";
        }

        @Override
        public String getDescription() {
            return "Retrieves the list of scheduled focus sessions for today owned by the authenticated user.";
        }

        @Override
        public Map<String, ToolParameter> getParameters() {
            return Map.of();
        }

        @Override
        public ToolResult execute(Long authenticatedUserId, Map<String, Object> parameters) {
            LocalDate today = LocalDate.now();
            Instant start = today.atStartOfDay(ZoneOffset.UTC).toInstant();
            Instant end = today.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
            Instant now = Instant.now();

            List<FocusSession> sessions = focusSessionRepository.findSessionsForUserBetween(authenticatedUserId, start, end);
            List<Map<String, Object>> result = sessions.stream().map(s -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("id", s.getId());
                m.put("name", s.getName());
                m.put("intention", s.getIntention());
                m.put("status", s.getStatus().name());
                m.put("durationMinutes", s.getDurationMinutes());
                m.put("remainingSeconds", s.calculateRemainingSeconds(now));
                m.put("scheduledAt", s.getScheduledAt() != null ? s.getScheduledAt().toString() : null);
                return m;
            }).toList();

            return ToolResult.ok(getName(), result);
        }
    }

    private class GetActiveFocusSessionTool implements AiTool {
        @Override
        public String getName() {
            return "get_active_focus_session";
        }

        @Override
        public String getDescription() {
            return "Retrieves the currently running or paused focus sprint for the authenticated user.";
        }

        @Override
        public Map<String, ToolParameter> getParameters() {
            return Map.of();
        }

        @Override
        public ToolResult execute(Long authenticatedUserId, Map<String, Object> parameters) {
            List<FocusSession> sessions = focusSessionRepository.findAllByUser_IdOrderByCreatedAtDesc(authenticatedUserId);
            Instant now = Instant.now();
            Map<String, Object> active = sessions.stream()
                    .filter(s -> s.getStatus().name().equals("ACTIVE") || s.getStatus().name().equals("PAUSED"))
                    .findFirst()
                    .map(s -> {
                        Map<String, Object> m = new LinkedHashMap<>();
                        m.put("hasActiveSession", true);
                        m.put("id", s.getId());
                        m.put("name", s.getName());
                        m.put("intention", s.getIntention());
                        m.put("status", s.getStatus().name());
                        m.put("durationMinutes", s.getDurationMinutes());
                        m.put("remainingSeconds", s.calculateRemainingSeconds(now));
                        return m;
                    })
                    .orElse(Map.of("hasActiveSession", false));

            return ToolResult.ok(getName(), active);
        }
    }

    private class GetNextMissionTool implements AiTool {
        @Override
        public String getName() {
            return "get_next_mission";
        }

        @Override
        public String getDescription() {
            return "Retrieves the highest-priority incomplete mission belonging to the authenticated user's active goals.";
        }

        @Override
        public Map<String, ToolParameter> getParameters() {
            return Map.of();
        }

        @Override
        public ToolResult execute(Long authenticatedUserId, Map<String, Object> parameters) {
            List<Mission> missions = missionRepository.findAllByGoal_User_IdOrderByCreatedAtDesc(authenticatedUserId);
            Map<String, Object> next = missions.stream()
                    .filter(m -> !"COMPLETED".equalsIgnoreCase(m.getStatus()))
                    .findFirst()
                    .map(m -> {
                        Map<String, Object> map = new LinkedHashMap<>();
                        map.put("id", m.getId());
                        map.put("title", m.getTitle());
                        map.put("description", m.getDescription());
                        map.put("estimatedMinutes", m.getEstimatedMinutes());
                        map.put("goalTitle", m.getGoal() != null ? m.getGoal().getTitle() : null);
                        return map;
                    })
                    .orElse(Map.of("hasNextMission", false));

            return ToolResult.ok(getName(), next);
        }
    }

    private class GetTodaysMissionsTool implements AiTool {
        @Override
        public String getName() {
            return "get_todays_missions";
        }

        @Override
        public String getDescription() {
            return "Lists all tactical missions associated with goals owned by the authenticated user.";
        }

        @Override
        public Map<String, ToolParameter> getParameters() {
            return Map.of();
        }

        @Override
        public ToolResult execute(Long authenticatedUserId, Map<String, Object> parameters) {
            List<Mission> missions = missionRepository.findAllByGoal_User_IdOrderByCreatedAtDesc(authenticatedUserId);
            List<Map<String, Object>> list = missions.stream().map(m -> {
                Map<String, Object> map = new LinkedHashMap<>();
                map.put("id", m.getId());
                map.put("title", m.getTitle());
                map.put("description", m.getDescription());
                map.put("status", m.getStatus());
                map.put("estimatedMinutes", m.getEstimatedMinutes());
                map.put("goalId", m.getGoal() != null ? m.getGoal().getId() : null);
                map.put("goalTitle", m.getGoal() != null ? m.getGoal().getTitle() : null);
                return map;
            }).toList();

            return ToolResult.ok(getName(), list);
        }
    }

    private class GetProgressSummaryTool implements AiTool {
        @Override
        public String getName() {
            return "get_progress_summary";
        }

        @Override
        public String getDescription() {
            return "Computes real aggregate execution metrics (goals, missions, focus sprints) for the authenticated user.";
        }

        @Override
        public Map<String, ToolParameter> getParameters() {
            return Map.of();
        }

        @Override
        public ToolResult execute(Long authenticatedUserId, Map<String, Object> parameters) {
            List<Goal> goals = goalRepository.findAllByUser_Id(authenticatedUserId);
            List<Mission> missions = missionRepository.findAllByGoal_User_IdOrderByCreatedAtDesc(authenticatedUserId);
            List<FocusSession> sessions = focusSessionRepository.findAllByUser_IdOrderByCreatedAtDesc(authenticatedUserId);

            long completedSessions = sessions.stream().filter(s -> "COMPLETED".equals(s.getStatus().name())).count();
            long completedMissions = missions.stream().filter(m -> "COMPLETED".equalsIgnoreCase(m.getStatus())).count();

            Map<String, Object> map = new LinkedHashMap<>();
            map.put("totalGoals", goals.size());
            map.put("totalMissions", missions.size());
            map.put("completedMissions", completedMissions);
            map.put("totalFocusSessions", sessions.size());
            map.put("completedFocusSessions", completedSessions);

            return ToolResult.ok(getName(), map);
        }
    }

    private class GetDeviceStatusTool implements AiTool {
        @Override
        public String getName() {
            return "get_device_status";
        }

        @Override
        public String getDescription() {
            return "Retrieves sanitized host telemetry (OS name, arch, memory usage, process count) without sensitive paths or credentials.";
        }

        @Override
        public Map<String, ToolParameter> getParameters() {
            return Map.of();
        }

        @Override
        public ToolResult execute(Long authenticatedUserId, Map<String, Object> parameters) {
            try {
                DeviceSystemInfo info = taskManagerService.getSystemInfo();
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("os", info.osName() + " (" + info.osArch() + ")");
                m.put("totalMemoryGB", String.format("%.1f", (double) info.totalMemoryBytes() / (1024 * 1024 * 1024)));
                m.put("freeMemoryGB", String.format("%.1f", (double) info.freeMemoryBytes() / (1024 * 1024 * 1024)));
                m.put("activeProcessCount", taskManagerService.getProcesses(null, null).size());
                return ToolResult.ok(getName(), m);
            } catch (Exception e) {
                return ToolResult.ok(getName(), Map.of("status", "System telemetry unavailable"));
            }
        }
    }

    private class GetEnforcementStateTool implements AiTool {
        @Override
        public String getName() {
            return "get_enforcement_state";
        }

        @Override
        public String getDescription() {
            return "Evaluates current Sentinel Shield status and restriction level for the authenticated user.";
        }

        @Override
        public Map<String, ToolParameter> getParameters() {
            return Map.of();
        }

        @Override
        public ToolResult execute(Long authenticatedUserId, Map<String, Object> parameters) {
            Map<String, Object> map = new LinkedHashMap<>();
            if (sentinelEnforcementService != null) {
                var status = sentinelEnforcementService.getSentinelStatus(authenticatedUserId);
                boolean shieldEngaged = "ACTIVE_DEFENSE".equalsIgnoreCase(status.status());
                map.put("status", status.status());
                map.put("shieldEngaged", shieldEngaged);
                map.put("enforcementMode", status.enforcementMode());
                map.put("totalInterceptedToday", status.totalInterceptedToday());
                map.put("activeFocusSessionId", status.activeFocusSessionId());
                map.put("activeFocusSessionName", status.activeFocusSessionName());
                map.put("activePolicyRulesCount", status.activePolicyRulesCount());
                map.put("lastSweepAt", status.lastSweepAt() != null ? status.lastSweepAt().toString() : null);
            } else {
                Map<String, Object> activeSession = getActiveFocusSession(authenticatedUserId);
                boolean shieldEngaged = Boolean.TRUE.equals(activeSession.get("hasActiveSession"))
                        || activeSession.containsKey("id");
                map.put("status", shieldEngaged ? "ACTIVE_DEFENSE" : "IDLE");
                map.put("shieldEngaged", shieldEngaged);
                map.put("enforcementMode", "STRICT");
                map.put("enforcementLevel", shieldEngaged ? "LEVEL_1_PROCESS_RESTRICTION" : "LEVEL_0_OBSERVATIONAL");
            }
            return ToolResult.ok(getName(), map);
        }
    }

    private class GetRecentSessionEventsTool implements AiTool {
        @Override
        public String getName() {
            return "get_recent_session_events";
        }

        @Override
        public String getDescription() {
            return "Retrieves recent focus sprint history entries for the authenticated user.";
        }

        @Override
        public Map<String, ToolParameter> getParameters() {
            return Map.of("limit", new ToolParameter("limit", "integer", "Number of sessions to retrieve (1-20, default 5)", false));
        }

        @Override
        public ToolResult execute(Long authenticatedUserId, Map<String, Object> parameters) {
            int limit = Math.max(1, Math.min(20, parseInteger(parameters.get("limit"), 5)));
            List<FocusSession> sessions = focusSessionRepository.findAllByUser_IdOrderByCreatedAtDesc(authenticatedUserId);
            List<Map<String, Object>> list = sessions.stream().limit(limit).map(s -> {
                Map<String, Object> map = new LinkedHashMap<>();
                map.put("id", s.getId());
                map.put("name", s.getName());
                map.put("status", s.getStatus().name());
                map.put("durationMinutes", s.getDurationMinutes());
                map.put("startedAt", s.getStartedAt() != null ? s.getStartedAt().toString() : null);
                map.put("endedAt", s.getEndedAt() != null ? s.getEndedAt().toString() : null);
                map.put("completionQuality", s.getCompletionQuality());
                return map;
            }).toList();

            return ToolResult.ok(getName(), list);
        }
    }

    private class GetEnforcementExplanationTool implements AiTool {
        @Override
        public String getName() {
            return "get_enforcement_explanation";
        }

        @Override
        public String getDescription() {
            return "Explains why Sentinel process blocks are currently active or inactive based on actual focus session state.";
        }

        @Override
        public Map<String, ToolParameter> getParameters() {
            return Map.of("query", new ToolParameter("query", "string", "Optional user question or target app name", false));
        }

        @Override
        public ToolResult execute(Long authenticatedUserId, Map<String, Object> parameters) {
            Map<String, Object> result = new LinkedHashMap<>();
            if (sentinelEnforcementService != null) {
                var status = sentinelEnforcementService.getSentinelStatus(authenticatedUserId);
                boolean hasActive = "ACTIVE_DEFENSE".equalsIgnoreCase(status.status());
                result.put("activeBlockPresent", hasActive);
                result.put("status", status.status());
                result.put("enforcementMode", status.enforcementMode());
                result.put("totalInterceptedToday", status.totalInterceptedToday());
                if (hasActive) {
                    result.put("sessionName", status.activeFocusSessionName());
                    result.put("sessionId", status.activeFocusSessionId());
                    result.put("reason", "A focus sprint is actively in progress ('" + status.activeFocusSessionName()
                            + "'). Sentinel active defense is engaged (" + status.enforcementMode()
                            + " mode) to quarantine distraction apps and protect flow state.");
                } else if ("STANDBY".equalsIgnoreCase(status.status())) {
                    result.put("reason", "No focus session currently active. Sentinel is on STANDBY for an upcoming scheduled sprint.");
                } else {
                    result.put("reason", "No focus sprint is currently active. Distraction quarantines are disengaged and processes run unrestricted.");
                }
                result.put("recentQuarantinesCount", status.recentQuarantines().size());
            } else {
                Map<String, Object> activeSession = getActiveFocusSession(authenticatedUserId);
                boolean hasActive = Boolean.TRUE.equals(activeSession.get("hasActiveSession")) || activeSession.containsKey("id");
                result.put("activeBlockPresent", hasActive);
                if (hasActive) {
                    result.put("sessionName", activeSession.get("name"));
                    result.put("remainingSeconds", activeSession.get("remainingSeconds"));
                    result.put("reason", "A focus session is actively running ('" + activeSession.get("name") + "'). Distraction processes and sites are blocked by Sentinel to preserve deep work.");
                } else {
                    result.put("activeBlockPresent", false);
                    List<Map<String, Object>> recent = getRecentSessionEvents(authenticatedUserId);
                    if (!recent.isEmpty()) {
                        Map<String, Object> last = recent.get(0);
                        result.put("lastSessionStatus", last.get("status"));
                        result.put("lastSessionName", last.get("name"));
                        result.put("reason", "No focus session is currently active. The most recent session '" + last.get("name") + "' ended with status " + last.get("status") + ".");
                    } else {
                        result.put("reason", "No focus session is currently active, and no Sentinel block is engaged. SHINPO did not terminate or block this process.");
                    }
                }
            }

            return ToolResult.ok(getName(), result);
        }
    }

    private class GetSanitizedDiagnosticsTool implements AiTool {
        @Override
        public String getName() {
            return "get_sanitized_diagnostics";
        }

        @Override
        public String getDescription() {
            return "Returns sanitized application and runtime diagnostics without exposing secrets, tokens, or environment keys.";
        }

        @Override
        public Map<String, ToolParameter> getParameters() {
            return Map.of("feature", new ToolParameter("feature", "string", "Target feature area for diagnostic scoping", false));
        }

        @Override
        public ToolResult execute(Long authenticatedUserId, Map<String, Object> parameters) {
            String feature = parameters.get("feature") instanceof String f ? f : "GENERAL";
            Map<String, Object> diag = new LinkedHashMap<>();
            diag.put("appVersion", "SHINPO v1.0.0-PROD");
            diag.put("feature", feature != null && !feature.isBlank() ? feature : "GENERAL");
            diag.put("os", System.getProperty("os.name") + " " + System.getProperty("os.version") + " (" + System.getProperty("os.arch") + ")");
            diag.put("javaVersion", System.getProperty("java.version"));
            diag.put("availableProcessors", Runtime.getRuntime().availableProcessors());
            diag.put("maxMemoryMB", Runtime.getRuntime().maxMemory() / (1024 * 1024));
            diag.put("freeMemoryMB", Runtime.getRuntime().freeMemory() / (1024 * 1024));
            diag.put("activeFocusSession", getActiveFocusSession(authenticatedUserId));
            diag.put("timestamp", Instant.now().toString());

            return ToolResult.ok(getName(), diag);
        }
    }

    private class GetUserExecutionProfileTool implements AiTool {
        @Override
        public String getName() {
            return "get_user_execution_profile";
        }

        @Override
        public String getDescription() {
            return "Returns the user's calibrated historical execution profile, tracking completed sprint count, average focus duration, and empirical estimation bias percentage without fabrication.";
        }

        @Override
        public Map<String, ToolParameter> getParameters() {
            return Map.of();
        }

        @Override
        public ToolResult execute(Long authenticatedUserId, Map<String, Object> parameters) {
            if (userExecutionProfileService == null) {
                Map<String, Object> fallback = new LinkedHashMap<>();
                fallback.put("userId", authenticatedUserId);
                fallback.put("hasSufficientData", false);
                fallback.put("completedSessionsCount", 0);
                fallback.put("totalMissionsCompleted", 0);
                fallback.put("totalFocusMinutes", 0L);
                fallback.put("averageFocusMinutes", null);
                fallback.put("estimationBiasPercentage", null);
                fallback.put("estimationAccuracyCategory", "INSUFFICIENT_DATA");
                fallback.put("confidenceLevel", "NONE");
                fallback.put("completionVelocityPerDay", null);
                fallback.put("statusMessage", "Profile service unavailable");
                return ToolResult.ok(getName(), fallback);
            }
            return ToolResult.ok(getName(), userExecutionProfileService.getUserExecutionProfileMap(authenticatedUserId));
        }
    }

    // =========================================================================
    // BACKWARDS-COMPATIBLE TYPED HELPER ACCESSORS
    // =========================================================================

    public Map<String, Object> getCurrentUser(Long userId) {
        ToolResult res = executeTool("get_current_user", userId, Map.of());
        if (res.success() && res.data() instanceof Map<?, ?> m) {
            @SuppressWarnings("unchecked")
            Map<String, Object> map = (Map<String, Object>) m;
            return map;
        }
        return Map.of("userId", userId != null ? userId : -1L, "status", "anonymous");
    }

    public Map<String, Object> getCurrentGoal(Long userId, Long goalId) {
        Map<String, Object> params = goalId != null ? Map.of("goalId", goalId) : Map.of();
        ToolResult res = executeTool("get_current_goal", userId, params);
        if (res.success() && res.data() instanceof Map<?, ?> m) {
            @SuppressWarnings("unchecked")
            Map<String, Object> map = (Map<String, Object>) m;
            return map;
        }
        return Map.of("hasGoals", false, "notFoundId", goalId != null ? goalId : 0L);
    }

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> getTodaysSchedule(Long userId) {
        ToolResult res = executeTool("get_todays_schedule", userId, Map.of());
        if (res.success() && res.data() instanceof List<?> l) {
            return (List<Map<String, Object>>) l;
        }
        return List.of();
    }

    public Map<String, Object> getActiveFocusSession(Long userId) {
        ToolResult res = executeTool("get_active_focus_session", userId, Map.of());
        if (res.success() && res.data() instanceof Map<?, ?> m) {
            @SuppressWarnings("unchecked")
            Map<String, Object> map = (Map<String, Object>) m;
            return map;
        }
        return Map.of("hasActiveSession", false);
    }

    public Map<String, Object> getNextMission(Long userId) {
        ToolResult res = executeTool("get_next_mission", userId, Map.of());
        if (res.success() && res.data() instanceof Map<?, ?> m) {
            @SuppressWarnings("unchecked")
            Map<String, Object> map = (Map<String, Object>) m;
            return map;
        }
        return Map.of("hasNextMission", false);
    }

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> getTodaysMissions(Long userId) {
        ToolResult res = executeTool("get_todays_missions", userId, Map.of());
        if (res.success() && res.data() instanceof List<?> l) {
            return (List<Map<String, Object>>) l;
        }
        return List.of();
    }

    public Map<String, Object> getProgressSummary(Long userId) {
        ToolResult res = executeTool("get_progress_summary", userId, Map.of());
        if (res.success() && res.data() instanceof Map<?, ?> m) {
            @SuppressWarnings("unchecked")
            Map<String, Object> map = (Map<String, Object>) m;
            return map;
        }
        return Map.of("totalGoals", 0, "totalMissions", 0, "completedMissions", 0L);
    }

    public Map<String, Object> getDeviceStatus(Long userId) {
        ToolResult res = executeTool("get_device_status", userId, Map.of());
        if (res.success() && res.data() instanceof Map<?, ?> m) {
            @SuppressWarnings("unchecked")
            Map<String, Object> map = (Map<String, Object>) m;
            return map;
        }
        return Map.of("status", "System telemetry unavailable");
    }

    public Map<String, Object> getEnforcementState(Long userId) {
        ToolResult res = executeTool("get_enforcement_state", userId, Map.of());
        if (res.success() && res.data() instanceof Map<?, ?> m) {
            @SuppressWarnings("unchecked")
            Map<String, Object> map = (Map<String, Object>) m;
            return map;
        }
        return Map.of("shieldEngaged", false, "enforcementLevel", "LEVEL_0_OBSERVATIONAL");
    }


    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> getRecentSessionEvents(Long userId) {
        ToolResult res = executeTool("get_recent_session_events", userId, Map.of());
        if (res.success() && res.data() instanceof List<?> l) {
            return (List<Map<String, Object>>) l;
        }
        return List.of();
    }

    public Map<String, Object> getEnforcementExplanation(Long userId, String query) {
        Map<String, Object> params = query != null ? Map.of("query", query) : Map.of();
        ToolResult res = executeTool("get_enforcement_explanation", userId, params);
        if (res.success() && res.data() instanceof Map<?, ?> m) {
            @SuppressWarnings("unchecked")
            Map<String, Object> map = (Map<String, Object>) m;
            return map;
        }
        return Map.of("reason", "No enforcement state available");
    }

    public Map<String, Object> getSanitizedDiagnostics(Long userId, String feature) {
        Map<String, Object> params = feature != null ? Map.of("feature", feature) : Map.of();
        ToolResult res = executeTool("get_sanitized_diagnostics", userId, params);
        if (res.success() && res.data() instanceof Map<?, ?> m) {
            @SuppressWarnings("unchecked")
            Map<String, Object> map = (Map<String, Object>) m;
            return map;
        }
        return Map.of("appVersion", "SHINPO v1.0.0-PROD");
    }

    public Map<String, Object> getUserExecutionProfile(Long userId) {
        ToolResult res = executeTool("get_user_execution_profile", userId, Map.of());
        if (res.success() && res.data() instanceof Map<?, ?> m) {
            @SuppressWarnings("unchecked")
            Map<String, Object> map = (Map<String, Object>) m;
            return map;
        }
        return Map.of("hasSufficientData", false, "statusMessage", "Insufficient data");
    }

    public Map<String, Object> assembleFullContext(Long userId, Long contextualGoalId, Long contextualMissionId, Long contextualSessionId) {
        Map<String, Object> ctx = new LinkedHashMap<>();
        ctx.put("user", getCurrentUser(userId));
        ctx.put("currentGoal", getCurrentGoal(userId, contextualGoalId));
        ctx.put("nextMission", getNextMission(userId));
        ctx.put("activeSession", getActiveFocusSession(userId));
        ctx.put("todaysSchedule", getTodaysSchedule(userId));
        ctx.put("progress", getProgressSummary(userId));
        ctx.put("enforcement", getEnforcementState(userId));
        ctx.put("device", getDeviceStatus(userId));
        ctx.put("executionProfile", getUserExecutionProfile(userId));
        return ctx;
    }

    private Map<String, Object> formatGoal(Goal g) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", g.getId());
        m.put("title", g.getTitle());
        m.put("description", g.getDescription());
        m.put("priority", "NORMAL");
        m.put("status", g.getStatus() != null ? g.getStatus() : "ACTIVE");
        m.put("targetDate", g.getTargetDate() != null ? g.getTargetDate().toString() : null);
        return m;
    }
}
