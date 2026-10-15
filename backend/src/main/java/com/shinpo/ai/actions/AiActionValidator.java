package com.shinpo.ai.actions;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import com.shinpo.entity.Goal;
import com.shinpo.entity.Mission;
import com.shinpo.repository.GoalRepository;
import com.shinpo.repository.MissionRepository;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Set;


@Component
public class AiActionValidator {

    public static final Set<String> ALLOWED_ACTION_TYPES = Set.of(
            "CREATE_GOAL",
            "CREATE_TASK",
            "UPDATE_TASK",
            "COMPLETE_TASK",
            "RESCHEDULE_TASK",
            "START_FOCUS_SESSION",
            "SCHEDULE_FOCUS_SESSION",
            "APPLY_DAILY_PLAN"
    );

    public static final Set<String> PROHIBITED_ACTION_TYPES = Set.of(
            "DELETE_GOAL",
            "DELETE_TASK",
            "DELETE_MISSION",
            "DELETE_FOCUS_SESSION",
            "MODIFY_POLICY",
            "MODIFY_RULES",
            "TERMINATE_PROCESS",
            "OVERRIDE_SECURITY",
            "CHANGE_ENFORCEMENT_MODE",
            "EMERGENCY_OVERRIDE",
            "UPDATE_AUTH",
            "MODIFY_CREDENTIALS"
    );

    private final GoalRepository goalRepository;
    private final MissionRepository missionRepository;
    private final ObjectMapper objectMapper;

    public AiActionValidator(
            GoalRepository goalRepository,
            MissionRepository missionRepository,
            ObjectMapper objectMapper
    ) {
        this.goalRepository = goalRepository;
        this.missionRepository = missionRepository;
        this.objectMapper = objectMapper;
    }

    public void validateActionType(String actionType) {
        if (actionType == null || actionType.isBlank()) {
            throw new IllegalArgumentException("Action type cannot be null or blank");
        }
        String upper = actionType.trim().toUpperCase();
        if (PROHIBITED_ACTION_TYPES.contains(upper)) {
            throw new SecurityException("Prohibited action: EONPAI is strictly prohibited from executing destructive or security actions: " + upper);
        }
        if (!ALLOWED_ACTION_TYPES.contains(upper)) {
            throw new IllegalArgumentException("Unsupported action type: " + upper);
        }
    }

    public void validatePayload(Long userId, String actionType, String payloadJson) {
        if (userId == null) {
            throw new SecurityException("Authenticated user identity is required for action validation");
        }
        validateActionType(actionType);

        if (payloadJson == null || payloadJson.isBlank()) {
            throw new IllegalArgumentException("Action payload cannot be empty");
        }

        try {
            JsonNode root = objectMapper.readTree(payloadJson);
            switch (actionType.toUpperCase()) {
                case "CREATE_GOAL" -> validateCreateGoal(root);
                case "CREATE_TASK" -> validateCreateTask(userId, root);
                case "UPDATE_TASK" -> validateUpdateTask(userId, root);
                case "COMPLETE_TASK" -> validateCompleteTask(userId, root);
                case "RESCHEDULE_TASK" -> validateRescheduleTask(userId, root);
                case "START_FOCUS_SESSION" -> validateStartFocusSession(userId, root);
                case "SCHEDULE_FOCUS_SESSION" -> validateScheduleFocusSession(userId, root);
                case "APPLY_DAILY_PLAN" -> validateApplyDailyPlan(userId, root);
                default -> throw new IllegalArgumentException("Unknown action type: " + actionType);
            }
        } catch (IllegalArgumentException | SecurityException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalArgumentException("Malformed action payload: " + e.getMessage(), e);
        }
    }

    private void validateCreateGoal(JsonNode root) {
        String title = root.path("title").asString(null);
        if (title == null || title.trim().isBlank()) {
            throw new IllegalArgumentException("Goal title is required");
        }
        if (title.length() > 255) {
            throw new IllegalArgumentException("Goal title exceeds maximum length of 255 characters");
        }
    }

    private void validateCreateTask(Long userId, JsonNode root) {
        String title = root.path("title").asString(null);
        if (title == null || title.trim().isBlank()) {
            throw new IllegalArgumentException("Task title is required");
        }
        if (title.length() > 255) {
            throw new IllegalArgumentException("Task title exceeds maximum length of 255 characters");
        }
        if (!root.has("goalId") || root.path("goalId").isNull()) {
            throw new IllegalArgumentException("Target goalId is required to create a task");
        }
        Long goalId = root.path("goalId").asLong();
        validateGoalOwnership(userId, goalId);

        if (root.has("estimatedMinutes") && !root.path("estimatedMinutes").isNull()) {
            int est = root.path("estimatedMinutes").asInt();
            if (est < 1 || est > 720) {
                throw new IllegalArgumentException("Estimated minutes must be between 1 and 720");
            }
        }
    }

    private void validateUpdateTask(Long userId, JsonNode root) {
        if (!root.has("taskId") || root.path("taskId").isNull()) {
            throw new IllegalArgumentException("taskId is required to update task");
        }
        Long taskId = root.path("taskId").asLong();
        validateTaskOwnership(userId, taskId);

        if (root.has("title")) {
            String title = root.path("title").asString();
            if (title != null && title.length() > 255) {
                throw new IllegalArgumentException("Task title exceeds maximum length of 255 characters");
            }
        }
        if (root.has("estimatedMinutes") && !root.path("estimatedMinutes").isNull()) {
            int est = root.path("estimatedMinutes").asInt();
            if (est < 1 || est > 720) {
                throw new IllegalArgumentException("Estimated minutes must be between 1 and 720");
            }
        }
    }

    private void validateCompleteTask(Long userId, JsonNode root) {
        if (!root.has("taskId") || root.path("taskId").isNull()) {
            throw new IllegalArgumentException("taskId is required to complete task");
        }
        Long taskId = root.path("taskId").asLong();
        validateTaskOwnership(userId, taskId);
    }

    private void validateRescheduleTask(Long userId, JsonNode root) {
        if (!root.has("taskId") || root.path("taskId").isNull()) {
            throw new IllegalArgumentException("taskId is required to reschedule task");
        }
        Long taskId = root.path("taskId").asLong();
        validateTaskOwnership(userId, taskId);

        if (!root.has("scheduledDate") || root.path("scheduledDate").asString().isBlank()) {
            throw new IllegalArgumentException("scheduledDate is required to reschedule task");
        }
        LocalDate date = LocalDate.parse(root.path("scheduledDate").asString());
        if (date.isBefore(LocalDate.now())) {
            throw new IllegalArgumentException("Cannot reschedule task into the past: " + date);
        }
    }

    private void validateStartFocusSession(Long userId, JsonNode root) {
        String name = root.path("name").asString(null);
        if (name == null || name.trim().isBlank()) {
            throw new IllegalArgumentException("Focus session name is required");
        }
        int duration = root.path("durationMinutes").asInt(25);
        if (duration < 1 || duration > 720) {
            throw new IllegalArgumentException("Focus session duration must be between 1 and 720 minutes");
        }

        if (root.has("taskId") && !root.path("taskId").isNull()) {
            validateTaskOwnership(userId, root.path("taskId").asLong());
        }
        if (root.has("goalId") && !root.path("goalId").isNull()) {
            validateGoalOwnership(userId, root.path("goalId").asLong());
        }
    }

    private void validateScheduleFocusSession(Long userId, JsonNode root) {
        String name = root.path("name").asString(null);
        if (name == null || name.trim().isBlank()) {
            throw new IllegalArgumentException("Focus session name is required");
        }
        int duration = root.path("durationMinutes").asInt(25);
        if (duration < 1 || duration > 720) {
            throw new IllegalArgumentException("Focus session duration must be between 1 and 720 minutes");
        }

        if (!root.has("scheduledAt") || root.path("scheduledAt").asString().isBlank()) {
            throw new IllegalArgumentException("scheduledAt timestamp is required for scheduled focus session");
        }
        Instant scheduledAt = Instant.parse(root.path("scheduledAt").asString());

        if (scheduledAt.isBefore(Instant.now().minusSeconds(120))) {
            throw new IllegalArgumentException("Cannot schedule focus session in the past");
        }

        if (root.has("taskId") && !root.path("taskId").isNull()) {
            validateTaskOwnership(userId, root.path("taskId").asLong());
        }
        if (root.has("goalId") && !root.path("goalId").isNull()) {
            validateGoalOwnership(userId, root.path("goalId").asLong());
        }
    }

    private void validateApplyDailyPlan(Long userId, JsonNode root) {
        JsonNode items = root.path("items");
        if (!items.isArray() || items.isEmpty()) {
            throw new IllegalArgumentException("Daily plan must contain at least one item");
        }
        for (JsonNode item : items) {
            if (item.has("goalId") && !item.path("goalId").isNull()) {
                validateGoalOwnership(userId, item.path("goalId").asLong());
            }
            if (item.has("taskId") && !item.path("taskId").isNull()) {
                validateTaskOwnership(userId, item.path("taskId").asLong());
            }
        }
    }

    private void validateGoalOwnership(Long userId, Long goalId) {
        Goal goal = goalRepository.findById(goalId)
                .orElseThrow(() -> new IllegalArgumentException("Goal not found: " + goalId));
        if (!goal.getUser().getId().equals(userId)) {
            throw new SecurityException("Ownership violation: Goal " + goalId + " does not belong to authenticated user " + userId);
        }
    }

    private void validateTaskOwnership(Long userId, Long taskId) {
        Mission mission = missionRepository.findById(taskId)
                .orElseThrow(() -> new IllegalArgumentException("Task not found: " + taskId));
        if (!mission.getGoal().getUser().getId().equals(userId)) {
            throw new SecurityException("Ownership violation: Task " + taskId + " does not belong to authenticated user " + userId);
        }
    }
}

