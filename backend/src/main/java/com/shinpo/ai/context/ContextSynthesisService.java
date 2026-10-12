package com.shinpo.ai.context;

import com.shinpo.dto.FocusSessionResponse;
import com.shinpo.dto.GoalResponse;
import com.shinpo.dto.MissionResponse;
import com.shinpo.service.FocusSessionService;
import com.shinpo.service.GoalService;
import com.shinpo.service.MissionService;
import com.shinpo.entity.FocusSessionStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
@Transactional(readOnly = true)
public class ContextSynthesisService {

    public static final int MAX_ACTIVE_GOALS = 5;
    public static final int MAX_OPEN_TASKS = 10;
    public static final int MAX_RECENT_SESSIONS = 3;

    private final GoalService goalService;
    private final MissionService missionService;
    private final FocusSessionService focusSessionService;

    public ContextSynthesisService(
            GoalService goalService,
            MissionService missionService,
            FocusSessionService focusSessionService
    ) {
        this.goalService = goalService;
        this.missionService = missionService;
        this.focusSessionService = focusSessionService;
    }

    public record BoundedEonpaiContext(
            String currentTimestamp,
            String userTimezone,
            List<GoalResponse> activeGoals,
            List<MissionResponse> openTasks,
            List<FocusSessionResponse> todaySessions,
            FocusSessionResponse activeSession,
            List<FocusSessionResponse> recentCompletedSessions
    ) {
        public String toPromptSummary() {
            StringBuilder sb = new StringBuilder();
            sb.append("Current Time: ").append(currentTimestamp).append(" (").append(userTimezone).append(")\n");

            if (activeSession != null) {
                sb.append("ACTIVE FOCUS SESSION: \"").append(activeSession.getName())
                  .append("\" (Duration: ").append(activeSession.getDurationMinutes()).append("m, ID: ")
                  .append(activeSession.getId()).append(")\n");
            } else {
                sb.append("ACTIVE FOCUS SESSION: None\n");
            }

            sb.append("\nActive Goals (up to ").append(MAX_ACTIVE_GOALS).append("):\n");
            if (activeGoals.isEmpty()) {
                sb.append("  (None)\n");
            } else {
                for (GoalResponse g : activeGoals) {
                    sb.append("  - [ID: ").append(g.id()).append("] ").append(g.title())
                      .append(g.targetDate() != null ? " (Target: " + g.targetDate() + ")" : "")
                      .append("\n");
                }
            }

            sb.append("\nOpen Tasks (up to ").append(MAX_OPEN_TASKS).append("):\n");
            if (openTasks.isEmpty()) {
                sb.append("  (None)\n");
            } else {
                for (MissionResponse m : openTasks) {
                    sb.append("  - [ID: ").append(m.id()).append(", GoalId: ").append(m.goalId()).append("] ")
                      .append(m.title()).append(" (~").append(m.estimatedMinutes()).append("m, Sched: ")
                      .append(m.scheduledDate()).append(")\n");
                }
            }

            sb.append("\nToday's Scheduled Sessions:\n");
            if (todaySessions.isEmpty()) {
                sb.append("  (None scheduled)\n");
            } else {
                for (FocusSessionResponse s : todaySessions) {
                    sb.append("  - [ID: ").append(s.getId()).append("] ").append(s.getName())
                      .append(" (Status: ").append(s.getStatus()).append(", ").append(s.getDurationMinutes()).append("m)\n");
                }
            }

            return sb.toString();
        }
    }

    public BoundedEonpaiContext synthesizeContext(Long userId, ZoneId zoneId) {
        ZoneId effectiveZone = zoneId != null ? zoneId : ZoneId.of("UTC");
        ZonedDateTime now = ZonedDateTime.now(effectiveZone);
        String formattedNow = now.format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));

        // 1. Bounded Active Goals
        List<GoalResponse> activeGoals = goalService.getGoalsForUser(userId)
                .stream()
                .filter(g -> "ACTIVE".equalsIgnoreCase(g.status()) || g.status() == null)
                .limit(MAX_ACTIVE_GOALS)
                .toList();

        // 2. Bounded Open Tasks
        List<MissionResponse> openTasks = missionService.getMissionsForUser(userId)
                .stream()
                .filter(m -> !"COMPLETED".equalsIgnoreCase(m.status()))
                .limit(MAX_OPEN_TASKS)
                .toList();

        // 3. Today's sessions & Active session
        LocalDate today = now.toLocalDate();
        List<FocusSessionResponse> todaySessions = focusSessionService.getSessionsByDate(userId, today, effectiveZone);

        FocusSessionResponse activeSession = todaySessions.stream()
                .filter(s -> s.getStatus() == FocusSessionStatus.ACTIVE)
                .findFirst()
                .orElse(null);

        // 4. Recent completed sessions
        List<FocusSessionResponse> recentCompleted = focusSessionService.getSessionsForUser(userId)
                .stream()
                .filter(s -> s.getStatus() == FocusSessionStatus.COMPLETED)
                .limit(MAX_RECENT_SESSIONS)
                .toList();

        return new BoundedEonpaiContext(
                formattedNow,
                effectiveZone.getId(),
                activeGoals,
                openTasks,
                todaySessions,
                activeSession,
                recentCompleted
        );
    }
}
