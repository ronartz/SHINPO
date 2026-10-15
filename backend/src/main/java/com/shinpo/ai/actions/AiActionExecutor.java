package com.shinpo.ai.actions;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import com.shinpo.ai.actions.dto.*;
import com.shinpo.dto.*;
import com.shinpo.entity.AiAction;
import com.shinpo.repository.AiActionRepository;
import com.shinpo.service.FocusSessionService;
import com.shinpo.service.GoalService;
import com.shinpo.service.MissionCompletionService;
import com.shinpo.service.MissionService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Component
public class AiActionExecutor {

    private static final Logger log = LoggerFactory.getLogger(AiActionExecutor.class);

    private final GoalService goalService;
    private final MissionService missionService;
    private final MissionCompletionService missionCompletionService;
    private final FocusSessionService focusSessionService;
    private final AiActionRepository actionRepository;
    private final ObjectMapper objectMapper;

    public AiActionExecutor(
            GoalService goalService,
            MissionService missionService,
            MissionCompletionService missionCompletionService,
            FocusSessionService focusSessionService,
            AiActionRepository actionRepository,
            ObjectMapper objectMapper
    ) {
        this.goalService = goalService;
        this.missionService = missionService;
        this.missionCompletionService = missionCompletionService;
        this.focusSessionService = focusSessionService;
        this.actionRepository = actionRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public AiActionExecutionResponse executeAction(AiAction action, Long userId) {
        if (!action.getUser().getId().equals(userId)) {
            throw new SecurityException("Security violation: Action does not belong to authenticated user: " + userId);
        }

        // Idempotency check: if already completed, return cached result
        if ("COMPLETED".equals(action.getStatus())) {
            log.info("EONPAI_ACTION_ALREADY_COMPLETED: actionId={} returning cached result", action.getActionId());
            return AiActionExecutionResponse.success(action.getActionId(), action.getResultSummary(), action.getExecutedAt());
        }

        if ("REJECTED".equals(action.getStatus())) {
            throw new IllegalStateException("Cannot execute a rejected action: " + action.getActionId());
        }

        if (action.getExpiresAt() != null && Instant.now().isAfter(action.getExpiresAt())) {
            action.setStatus("EXPIRED");
            actionRepository.save(action);
            throw new IllegalStateException("Action proposal has expired: " + action.getActionId());
        }

        action.setStatus("EXECUTING");
        actionRepository.save(action);

        try {
            JsonNode payload = objectMapper.readTree(action.getPayload());
            String actionType = action.getActionType().toUpperCase();
            String summary;
            List<String> completedItems = new ArrayList<>();
            List<String> failedItems = new ArrayList<>();

            switch (actionType) {
                case "CREATE_GOAL" -> {
                    String title = payload.path("title").asString();
                    String description = payload.path("description").asString(null);
                    LocalDate targetDate = payload.has("targetDate") && !payload.path("targetDate").isNull()
                            ? LocalDate.parse(payload.path("targetDate").asString())
                            : null;
                    GoalResponse created = goalService.createGoal(userId, new CreateGoalRequest(userId, title, description, LocalDate.now(), targetDate));
                    summary = "Successfully created goal \"" + created.title() + "\" (ID: " + created.id() + ").";
                }
                case "CREATE_TASK" -> {
                    Long goalId = payload.path("goalId").asLong();
                    String title = payload.path("title").asString();
                    String description = payload.path("description").asString("");
                    LocalDate schedDate = payload.has("scheduledDate") && !payload.path("scheduledDate").isNull()
                            ? LocalDate.parse(payload.path("scheduledDate").asString())
                            : LocalDate.now();
                    Integer estMinutes = payload.has("estimatedMinutes") && !payload.path("estimatedMinutes").isNull()
                            ? payload.path("estimatedMinutes").asInt()
                            : 30;
                    MissionResponse created = missionService.createMission(userId, new CreateMissionRequest(goalId, title, description, schedDate, estMinutes));
                    summary = "Successfully created task \"" + created.title() + "\" (ID: " + created.id() + ") for " + schedDate + ".";
                }
                case "UPDATE_TASK" -> {
                    Long taskId = payload.path("taskId").asLong();
                    MissionResponse existing = missionService.getMission(taskId, userId);
                    String title = payload.has("title") ? payload.path("title").asString() : existing.title();
                    String description = payload.has("description") ? payload.path("description").asString() : existing.description();
                    Integer estMinutes = payload.has("estimatedMinutes") ? payload.path("estimatedMinutes").asInt() : existing.estimatedMinutes();
                    LocalDate schedDate = payload.has("scheduledDate") ? LocalDate.parse(payload.path("scheduledDate").asString()) : existing.scheduledDate();
                    String status = payload.has("status") ? payload.path("status").asString() : existing.status();

                    MissionResponse updated = missionService.updateMission(taskId, userId,
                            new UpdateMissionRequest(existing.goalId(), title, description, schedDate, estMinutes, status));
                    summary = "Successfully updated task \"" + updated.title() + "\" (ID: " + updated.id() + ").";
                }
                case "COMPLETE_TASK" -> {
                    Long taskId = payload.path("taskId").asLong();
                    int actualMinutes = payload.has("actualMinutes") ? payload.path("actualMinutes").asInt(30) : 30;
                    MissionCompletionResponse completion = missionCompletionService.completeMission(taskId, userId, new CompleteMissionRequest(actualMinutes));
                    summary = "Successfully marked task " + taskId + " as completed (Mission completion ID: " + completion.id() + ").";
                }
                case "RESCHEDULE_TASK" -> {
                    Long taskId = payload.path("taskId").asLong();
                    LocalDate newDate = LocalDate.parse(payload.path("scheduledDate").asString());
                    MissionResponse existing = missionService.getMission(taskId, userId);
                    MissionResponse updated = missionService.updateMission(taskId, userId,
                            new UpdateMissionRequest(existing.goalId(), existing.title(), existing.description(), newDate, existing.estimatedMinutes(), existing.status()));
                    summary = "Successfully rescheduled task \"" + updated.title() + "\" from " + existing.scheduledDate() + " to " + newDate + ".";
                }
                case "START_FOCUS_SESSION" -> {
                    String name = payload.path("name").asString("Focus Sprint");
                    int duration = payload.path("durationMinutes").asInt(25);
                    Long taskId = payload.has("taskId") && !payload.path("taskId").isNull() ? payload.path("taskId").asLong() : null;
                    Long goalId = payload.has("goalId") && !payload.path("goalId").isNull() ? payload.path("goalId").asLong() : null;

                    CreateFocusSessionRequest req = new CreateFocusSessionRequest();
                    req.setUserId(userId);
                    req.setName(name);
                    req.setDurationMinutes(duration);
                    req.setGoalId(goalId);
                    req.setMissionId(taskId);
                    req.setScheduledAt(Instant.now());

                    FocusSessionResponse created = focusSessionService.createSession(req);
                    FocusSessionResponse started = focusSessionService.startSession(created.getId(), userId);
                    summary = "Started active focus session \"" + started.getName() + "\" (" + started.getDurationMinutes() + " minutes, ID: " + started.getId() + ").";
                }
                case "SCHEDULE_FOCUS_SESSION" -> {
                    String name = payload.path("name").asString("Scheduled Focus");
                    int duration = payload.path("durationMinutes").asInt(25);
                    Instant scheduledAt = Instant.parse(payload.path("scheduledAt").asString());
                    Long taskId = payload.has("taskId") && !payload.path("taskId").isNull() ? payload.path("taskId").asLong() : null;
                    Long goalId = payload.has("goalId") && !payload.path("goalId").isNull() ? payload.path("goalId").asLong() : null;

                    CreateFocusSessionRequest req = new CreateFocusSessionRequest();
                    req.setUserId(userId);
                    req.setName(name);
                    req.setDurationMinutes(duration);
                    req.setGoalId(goalId);
                    req.setMissionId(taskId);
                    req.setScheduledAt(scheduledAt);

                    FocusSessionResponse created = focusSessionService.createSession(req);
                    summary = "Scheduled focus session \"" + created.getName() + "\" for " + scheduledAt + " (ID: " + created.getId() + ").";
                }
                case "APPLY_DAILY_PLAN" -> {
                    JsonNode items = payload.path("items");
                    int total = items.size();
                    for (JsonNode item : items) {
                        String itemTitle = item.path("title").asString("Plan Item");
                        try {
                            String itemActionType = item.path("actionType").asString("SCHEDULE_SESSION");
                            if ("CREATE_TASK".equalsIgnoreCase(itemActionType)) {
                                Long goalId = item.has("goalId") ? item.path("goalId").asLong() : null;
                                String desc = item.path("description").asString("");
                                Integer est = item.has("estimatedMinutes") ? item.path("estimatedMinutes").asInt(30) : 30;
                                LocalDate sDate = item.has("scheduledDate") ? LocalDate.parse(item.path("scheduledDate").asString()) : LocalDate.now();
                                if (goalId != null) {
                                    missionService.createMission(userId, new CreateMissionRequest(goalId, itemTitle, desc, sDate, est));
                                    completedItems.add("Created task: " + itemTitle);
                                } else {
                                    failedItems.add("Task \"" + itemTitle + "\" missing goalId");
                                }
                            } else {
                                // Default: schedule focus session
                                Integer est = item.has("estimatedMinutes") ? item.path("estimatedMinutes").asInt(25) : 25;
                                Long taskId = item.has("taskId") ? item.path("taskId").asLong() : null;
                                Long goalId = item.has("goalId") ? item.path("goalId").asLong() : null;
                                Instant scheduledAt = item.has("scheduledAt")
                                        ? Instant.parse(item.path("scheduledAt").asString())
                                        : Instant.now().plusSeconds(300);


                                CreateFocusSessionRequest req = new CreateFocusSessionRequest();
                                req.setUserId(userId);
                                req.setName(itemTitle);
                                req.setDurationMinutes(est);
                                req.setGoalId(goalId);
                                req.setMissionId(taskId);
                                req.setScheduledAt(scheduledAt);
                                FocusSessionResponse created = focusSessionService.createSession(req);
                                completedItems.add("Scheduled session: \"" + itemTitle + "\" (" + est + "m, ID: " + created.getId() + ")");
                            }
                        } catch (Exception ex) {
                            log.warn("EONPAI_PLAN_ITEM_FAILED: item='{}' error={}", itemTitle, ex.getMessage());
                            failedItems.add("\"" + itemTitle + "\": " + ex.getMessage());
                        }
                    }

                    if (failedItems.isEmpty()) {
                        summary = "Successfully applied daily plan: all " + completedItems.size() + " items scheduled.";
                    } else if (completedItems.isEmpty()) {
                        summary = "Failed to apply daily plan: all " + failedItems.size() + " items failed.";
                    } else {
                        summary = "Applied " + completedItems.size() + " of " + total + " plan items. (" + failedItems.size() + " failed)";
                    }
                }
                default -> throw new IllegalArgumentException("Unsupported action type: " + actionType);
            }

            Instant executedAt = Instant.now();
            boolean isPartial = !failedItems.isEmpty() && !completedItems.isEmpty();
            boolean isAllFailed = completedItems.isEmpty() && !failedItems.isEmpty();

            action.setStatus(isAllFailed ? "FAILED" : (isPartial ? "PARTIALLY_COMPLETED" : "COMPLETED"));
            action.setResultSummary(summary);
            action.setExecutedAt(executedAt);
            actionRepository.save(action);

            log.info("EONPAI_ACTION_EXECUTED: actionId={} type={} status={} user={}",
                    action.getActionId(), actionType, action.getStatus(), userId);

            if (isPartial || isAllFailed) {
                return AiActionExecutionResponse.partial(action.getActionId(), summary, completedItems, failedItems);
            }

            return AiActionExecutionResponse.success(action.getActionId(), summary, executedAt);

        } catch (Exception e) {
            log.error("EONPAI_ACTION_EXECUTION_FAILED: actionId={} error={}", action.getActionId(), e.getMessage(), e);
            action.setStatus("FAILED");
            action.setErrorMessage(e.getMessage());
            actionRepository.save(action);
            return AiActionExecutionResponse.failure(action.getActionId(), e.getMessage());
        }
    }
}
