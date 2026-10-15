package com.shinpo.ai.planning;

import tools.jackson.databind.ObjectMapper;
import com.shinpo.ai.actions.AiActionService;
import com.shinpo.ai.actions.dto.AiActionDto;
import com.shinpo.ai.actions.dto.ApplyDailyPlanPayload;
import com.shinpo.ai.actions.dto.ApplyDailyPlanPayload.DailyPlanItemAction;
import com.shinpo.ai.tool.AiToolRegistry;
import com.shinpo.dto.AiDtos.DailyPlanItem;
import com.shinpo.dto.AiDtos.DailyPlanResponse;
import com.shinpo.entity.AiSuggestion;
import com.shinpo.repository.AiSuggestionRepository;
import com.shinpo.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class DailyPlanningService {

    private static final Logger log = LoggerFactory.getLogger(DailyPlanningService.class);

    private final AiToolRegistry toolRegistry;
    private final AiSuggestionRepository aiSuggestionRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;
    private final AiActionService aiActionService;

    public DailyPlanningService(
            AiToolRegistry toolRegistry,
            AiSuggestionRepository aiSuggestionRepository,
            UserRepository userRepository,
            ObjectMapper objectMapper,
            AiActionService aiActionService
    ) {
        this.toolRegistry = toolRegistry;
        this.aiSuggestionRepository = aiSuggestionRepository;
        this.userRepository = userRepository;
        this.objectMapper = objectMapper;
        this.aiActionService = aiActionService;
    }

    public DailyPlanResponse generateDailyPlan(Long userId, ZoneId zoneId) {
        ZoneId effectiveZone = zoneId != null ? zoneId : ZoneOffset.UTC;

        // 1. Fetch user execution profile & estimation bias
        Map<String, Object> profile = toolRegistry.getUserExecutionProfile(userId);
        Double biasPct = 0.0;
        double biasFactor = 1.0;
        if (profile != null && Boolean.TRUE.equals(profile.get("hasSufficientData"))
                && profile.get("estimationBiasPercentage") instanceof Number n) {
            biasPct = n.doubleValue();
            biasFactor = Math.max(0.6, Math.min(2.0, 1.0 + (biasPct / 100.0)));
        }

        // 2. Fetch existing schedule for today to detect conflicts
        List<Map<String, Object>> existingSchedule = toolRegistry.getTodaysSchedule(userId, effectiveZone);
        Map<String, Object> activeSession = toolRegistry.getActiveFocusSession(userId);

        // 3. Fetch active missions from backlog
        List<Map<String, Object>> allMissions = toolRegistry.getTodaysMissions(userId);
        List<Map<String, Object>> pendingMissions = allMissions.stream()
                .filter(m -> !"COMPLETED".equalsIgnoreCase((String) m.get("status")))
                .toList();

        List<DailyPlanItem> items = new ArrayList<>();
        boolean hasConflictsResolved = false;

        // 4. Determine base reference time (LocalTime)
        LocalTime now = LocalTime.now(effectiveZone);
        LocalTime cursor;
        if (now.isBefore(LocalTime.of(8, 30))) {
            cursor = LocalTime.of(9, 0);
        } else if (now.isAfter(LocalTime.of(19, 0))) {
            cursor = LocalTime.of(9, 0);
        } else {
            int rem = now.getMinute() % 15;
            cursor = now.plusMinutes(15 - rem).withSecond(0).withNano(0);
        }

        // 5. Handle Active Session if currently running
        if (activeSession != null && Boolean.TRUE.equals(activeSession.get("hasActiveSession"))
                && "ACTIVE".equalsIgnoreCase((String) activeSession.get("status"))) {
            String activeName = (String) activeSession.get("name");
            Long remSecs = activeSession.get("remainingSeconds") instanceof Number n ? n.longValue() : 1500L;
            int remMins = Math.max(5, (int) Math.round(remSecs / 60.0));
            LocalTime activeEnd = now.plusMinutes(remMins);

            items.add(new DailyPlanItem(
                    activeSession.get("id") instanceof Number n ? n.longValue() : null,
                    activeName != null ? activeName : "Current Active Sprint",
                    "Active Sprint (Shield Engaged)",
                    remMins,
                    "HIGH",
                    "NOW",
                    activeEnd.format(DateTimeFormatter.ofPattern("HH:mm")),
                    "DEEP_FOCUS",
                    remMins,
                    1.0,
                    false,
                    null
            ));

            cursor = activeEnd.plusMinutes(10);
            items.add(new DailyPlanItem(
                    null,
                    "☕ 10m Attention Restoration Recess",
                    "Cognitive Recovery",
                    10,
                    "NORMAL",
                    activeEnd.format(DateTimeFormatter.ofPattern("HH:mm")),
                    cursor.format(DateTimeFormatter.ofPattern("HH:mm")),
                    "COGNITIVE_RECOVERY",
                    10,
                    1.0,
                    true,
                    null
            ));
        }

        // 6. Assemble candidate tasks
        List<Map<String, Object>> candidateTasks = new ArrayList<>();
        if (!pendingMissions.isEmpty()) {
            candidateTasks.addAll(pendingMissions.stream().limit(4).toList());
        } else {
            candidateTasks.add(Map.of(
                    "title", "Architectural Core Execution & Bottleneck Delivery",
                    "goalTitle", "Core Strategic Delivery",
                    "estimatedMinutes", 45
            ));
            candidateTasks.add(Map.of(
                    "title", "Module Verification & Integration Testing",
                    "goalTitle", "Quality Assurance",
                    "estimatedMinutes", 30
            ));
            candidateTasks.add(Map.of(
                    "title", "Operational Debrief & Seed Retrospective",
                    "goalTitle", "Continuous Calibration",
                    "estimatedMinutes", 20
            ));
        }

        // 7. Schedule each candidate task into circadian windows
        int taskIndex = items.isEmpty() ? 0 : 1;
        for (int i = 0; i < candidateTasks.size(); i++) {
            Map<String, Object> task = candidateTasks.get(i);
            String title = (String) task.get("title");
            String goalTitle = task.get("goalTitle") instanceof String s ? s : "Strategic Goal";
            Long missionId = task.get("id") instanceof Number n ? n.longValue() : null;
            Long goalId = task.get("goalId") instanceof Number n ? n.longValue() : null;

            int origMins = task.get("estimatedMinutes") instanceof Number n ? n.intValue() : 25;
            int calibratedMins = (int) Math.round(origMins * biasFactor);
            int rem5 = calibratedMins % 5;
            if (rem5 >= 3) calibratedMins += (5 - rem5);
            else calibratedMins -= rem5;
            calibratedMins = Math.max(15, Math.min(90, calibratedMins));

            String energyWindow;
            String priority;
            if (taskIndex == 0) {
                energyWindow = "DEEP_FOCUS";
                priority = "HIGH";
            } else if (i == candidateTasks.size() - 1) {
                energyWindow = "STRATEGIC_REVIEW";
                priority = "NORMAL";
            } else {
                energyWindow = "TACTICAL_SPRINT";
                priority = "HIGH";
            }

            LocalTime candidateEnd = cursor.plusMinutes(calibratedMins);
            for (Map<String, Object> existing : existingSchedule) {
                String schedAtStr = (String) existing.get("scheduledAt");
                if (schedAtStr != null) {
                    try {
                        Instant inst = Instant.parse(schedAtStr);
                        LocalTime exStart = inst.atZone(effectiveZone).toLocalTime();
                        int exDuration = existing.get("durationMinutes") instanceof Number n ? n.intValue() : 25;
                        LocalTime exEnd = exStart.plusMinutes(exDuration);

                        if (cursor.isBefore(exEnd) && candidateEnd.isAfter(exStart)) {
                            hasConflictsResolved = true;
                            cursor = exEnd.plusMinutes(10);
                            candidateEnd = cursor.plusMinutes(calibratedMins);
                        }
                    } catch (Exception ignored) {}
                }
            }

            items.add(new DailyPlanItem(
                    missionId,
                    title,
                    goalTitle,
                    calibratedMins,
                    priority,
                    cursor.format(DateTimeFormatter.ofPattern("HH:mm")),
                    candidateEnd.format(DateTimeFormatter.ofPattern("HH:mm")),
                    energyWindow,
                    origMins,
                    biasFactor,
                    false,
                    goalId
            ));

            cursor = candidateEnd.plusMinutes(10);
            taskIndex++;

            if (i < candidateTasks.size() - 1) {
                LocalTime breakEnd = cursor.plusMinutes(10);
                items.add(new DailyPlanItem(
                        null,
                        "🌿 10m Neural Reset & Hydration",
                        "Cognitive Recovery",
                        10,
                        "LOW",
                        cursor.format(DateTimeFormatter.ofPattern("HH:mm")),
                        breakEnd.format(DateTimeFormatter.ofPattern("HH:mm")),
                        "COGNITIVE_RECOVERY",
                        10,
                        1.0,
                        true,
                        null
                ));
                cursor = breakEnd;
            }
        }

        int totalPlanned = items.stream().mapToInt(it -> it != null ? it.durationMinutes() : 0).sum();
        int focusMinutes = items.stream().filter(it -> it != null && !Boolean.TRUE.equals(it.isRestorativeBreak())).mapToInt(it -> it != null ? it.durationMinutes() : 0).sum();

        int breakMinutes = totalPlanned - focusMinutes;

        String pacingStrategy = focusMinutes > 150 ? "ULTRADIAN_HIGH_THROUGHPUT" : "TACTICAL_LIGHT";
        String headline = "Autonomous Circadian Daily Plan (" + focusMinutes + "m Focus, " + breakMinutes + "m Recovery)";
        String rationale = "Synthesized from your active backlog with real-time schedule conflict resolution.";

        String payloadJson = "{}";
        try {
            payloadJson = objectMapper.writeValueAsString(items);
        } catch (Exception ignored) {}

        AiSuggestion s = logSuggestion(userId, "DAILY_PLAN", "userId=" + userId, payloadJson);

        // Also create a structured AiAction proposal if requested
        return new DailyPlanResponse(
                headline,
                rationale,
                items,
                totalPlanned,
                focusMinutes,
                breakMinutes,
                pacingStrategy,
                biasPct,
                hasConflictsResolved,
                s != null ? s.getId() : null
        );
    }

    public AiActionDto proposeDailyPlanAction(Long userId, ZoneId zoneId) {
        DailyPlanResponse plan = generateDailyPlan(userId, zoneId);
        List<DailyPlanItemAction> actions = new ArrayList<>();
        LocalDate today = LocalDate.now(zoneId != null ? zoneId : ZoneOffset.UTC);

        for (DailyPlanItem item : plan.planItems()) {
            if (Boolean.TRUE.equals(item.isRestorativeBreak())) {
                continue;
            }
            actions.add(new DailyPlanItemAction(
                    "SCHEDULE_SESSION",
                    item.missionTitle(),
                    item.goalTitle() != null ? item.goalTitle() : "Daily Plan Focus",
                    item.durationMinutes(),
                    item.goalId(),
                    item.missionId(),
                    item.scheduledStartTime(),
                    today.toString()
            ));
        }

        ApplyDailyPlanPayload payload = new ApplyDailyPlanPayload(actions);
        String desc = "Schedule " + actions.size() + " focus sessions for today's agenda (" + plan.totalFocusMinutes() + "m total)";
        return aiActionService.proposeAction(userId, "APPLY_DAILY_PLAN", desc, payload);
    }

    private AiSuggestion logSuggestion(Long userId, String type, String context, String payload) {
        if (aiSuggestionRepository == null || userRepository == null) return null;
        try {
            var user = userRepository.findById(userId).orElse(null);
            if (user != null) {
                AiSuggestion s = new AiSuggestion(user, type, context, payload);
                return aiSuggestionRepository.save(s);
            }
        } catch (Exception e) {
            log.warn("Failed to persist suggestion: {}", e.getMessage());
        }
        return null;
    }
}

