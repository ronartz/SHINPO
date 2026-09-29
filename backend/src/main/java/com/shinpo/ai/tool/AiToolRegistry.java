package com.shinpo.ai.tool;

import com.shinpo.dto.TaskManagerDtos.DeviceSystemInfo;
import com.shinpo.entity.FocusSession;
import com.shinpo.entity.Goal;
import com.shinpo.entity.Mission;
import com.shinpo.repository.FocusSessionRepository;
import com.shinpo.repository.GoalRepository;
import com.shinpo.repository.MissionRepository;
import com.shinpo.repository.UserRepository;
import com.shinpo.service.TaskManagerService;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.*;

/**
 * Controlled READ-ONLY SHINPO tools for the AI layer.
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

    public AiToolRegistry(
            UserRepository userRepository,
            GoalRepository goalRepository,
            MissionRepository missionRepository,
            FocusSessionRepository focusSessionRepository,
            TaskManagerService taskManagerService
    ) {
        this.userRepository = userRepository;
        this.goalRepository = goalRepository;
        this.missionRepository = missionRepository;
        this.focusSessionRepository = focusSessionRepository;
        this.taskManagerService = taskManagerService;
    }

    public Map<String, Object> getCurrentUser(Long userId) {
        return userRepository.findById(userId)
                .map(u -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("userId", u.getId());
                    m.put("username", u.getUsername());
                    m.put("email", u.getEmail());
                    return m;
                })
                .orElse(Map.of("userId", userId, "status", "anonymous"));
    }

    public Map<String, Object> getCurrentGoal(Long userId, Long goalId) {
        if (goalId == null) {
            List<Goal> goals = goalRepository.findAllByUser_Id(userId);
            if (goals.isEmpty()) return Map.of("hasGoals", false);
            Goal g = goals.get(0);
            return formatGoal(g);
        }
        return goalRepository.findById(goalId)
                .filter(g -> g.getUser().getId().equals(userId))
                .map(this::formatGoal)
                .orElse(Map.of("hasGoals", false, "notFoundId", goalId));
    }

    public List<Map<String, Object>> getTodaysSchedule(Long userId) {
        LocalDate today = LocalDate.now();
        Instant start = today.atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant end = today.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant now = Instant.now();

        List<FocusSession> sessions = focusSessionRepository.findSessionsForUserBetween(userId, start, end);
        return sessions.stream().map(s -> {
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
    }

    public Map<String, Object> getActiveFocusSession(Long userId) {
        List<FocusSession> sessions = focusSessionRepository.findAllByUser_IdOrderByCreatedAtDesc(userId);
        Instant now = Instant.now();
        return sessions.stream()
                .filter(s -> s.getStatus().name().equals("ACTIVE") || s.getStatus().name().equals("PAUSED"))
                .findFirst()
                .map(s -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id", s.getId());
                    m.put("name", s.getName());
                    m.put("intention", s.getIntention());
                    m.put("status", s.getStatus().name());
                    m.put("durationMinutes", s.getDurationMinutes());
                    m.put("remainingSeconds", s.calculateRemainingSeconds(now));
                    return m;
                })
                .orElse(Map.of("hasActiveSession", false));
    }

    public Map<String, Object> getNextMission(Long userId) {
        List<Mission> missions = missionRepository.findAllByGoal_User_IdOrderByCreatedAtDesc(userId);
        return missions.stream()
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
    }

    public Map<String, Object> getProgressSummary(Long userId) {
        List<Goal> goals = goalRepository.findAllByUser_Id(userId);
        List<Mission> missions = missionRepository.findAllByGoal_User_IdOrderByCreatedAtDesc(userId);
        List<FocusSession> sessions = focusSessionRepository.findAllByUser_IdOrderByCreatedAtDesc(userId);

        long completedSessions = sessions.stream().filter(s -> "COMPLETED".equals(s.getStatus().name())).count();
        long completedMissions = missions.stream().filter(m -> "COMPLETED".equalsIgnoreCase(m.getStatus())).count();

        Map<String, Object> map = new LinkedHashMap<>();
        map.put("totalGoals", goals.size());
        map.put("totalMissions", missions.size());
        map.put("completedMissions", completedMissions);
        map.put("totalFocusSessions", sessions.size());
        map.put("completedFocusSessions", completedSessions);
        return map;
    }

    public Map<String, Object> getDeviceStatus(Long userId) {
        try {
            DeviceSystemInfo info = taskManagerService.getSystemInfo();
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("os", info.osName() + " (" + info.osArch() + ")");
            m.put("totalMemoryGB", String.format("%.1f", (double) info.totalMemoryBytes() / (1024 * 1024 * 1024)));
            m.put("freeMemoryGB", String.format("%.1f", (double) info.freeMemoryBytes() / (1024 * 1024 * 1024)));
            m.put("activeProcessCount", taskManagerService.getProcesses(null, null).size());
            return m;
        } catch (Exception e) {
            return Map.of("status", "System telemetry unavailable");
        }
    }

    public Map<String, Object> getEnforcementState(Long userId) {
        Map<String, Object> activeSession = getActiveFocusSession(userId);
        boolean shieldEngaged = Boolean.TRUE.equals(activeSession.get("hasActiveSession"))
                || activeSession.containsKey("id");

        Map<String, Object> map = new LinkedHashMap<>();
        map.put("shieldEngaged", shieldEngaged);
        map.put("enforcementLevel", shieldEngaged ? "LEVEL_1_PROCESS_RESTRICTION" : "LEVEL_0_OBSERVATIONAL");
        map.put("sentinelMode", "ACTIVE_DEFENSE");
        return map;
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
