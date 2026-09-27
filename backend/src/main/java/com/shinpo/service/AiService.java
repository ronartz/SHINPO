package com.shinpo.service;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.shinpo.dto.AiDtos.AiChatRequest;
import com.shinpo.dto.AiDtos.AiChatResponse;
import com.shinpo.dto.AiDtos.DailyPlanItem;
import com.shinpo.dto.AiDtos.DailyPlanResponse;
import com.shinpo.dto.AiDtos.GoalDecompositionResponse;
import com.shinpo.dto.AiDtos.NextActionResponse;
import com.shinpo.dto.AiDtos.ProposedMission;
import com.shinpo.dto.AiDtos.RecoveryOption;
import com.shinpo.dto.AiDtos.RecoveryResponse;
import com.shinpo.entity.AiSuggestion;
import com.shinpo.entity.FocusSession;
import com.shinpo.entity.Goal;
import com.shinpo.entity.Mission;
import com.shinpo.entity.User;
import com.shinpo.repository.AiSuggestionRepository;
import com.shinpo.repository.FocusSessionRepository;
import com.shinpo.repository.GoalRepository;
import com.shinpo.repository.MissionRepository;
import com.shinpo.repository.UserRepository;

@Service
@Transactional
public class AiService {

    private final UserRepository userRepository;
    private final GoalRepository goalRepository;
    private final MissionRepository missionRepository;
    private final FocusSessionRepository focusSessionRepository;
    private final AiSuggestionRepository aiSuggestionRepository;

    public AiService(
            UserRepository userRepository,
            GoalRepository goalRepository,
            MissionRepository missionRepository,
            FocusSessionRepository focusSessionRepository,
            AiSuggestionRepository aiSuggestionRepository) {
        this.userRepository = userRepository;
        this.goalRepository = goalRepository;
        this.missionRepository = missionRepository;
        this.focusSessionRepository = focusSessionRepository;
        this.aiSuggestionRepository = aiSuggestionRepository;
    }

    // -------------------------------------------------------------------------
    // DECOMPOSE GOAL
    // -------------------------------------------------------------------------
    public GoalDecompositionResponse decomposeGoal(Long goalId, Long userId) {
        Goal goal = goalRepository.findById(goalId)
                .orElseThrow(() -> new IllegalArgumentException("Goal not found: " + goalId));

        if (!goal.getUser().getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Goal not found for this user: " + goalId);
        }

        List<ProposedMission> proposed = new ArrayList<>();
        proposed.add(new ProposedMission(
                "Map out core requirements & success criteria",
                "Clarify the outcome boundaries and measurable definition of done.",
                25));
        proposed.add(new ProposedMission(
                "Build foundational prototype & establish MVP boundary",
                "Ship the smallest verifiable slice that proves the concept.",
                50));
        proposed.add(new ProposedMission(
                "Execute deep focus sprint on high-leverage bottlenecks",
                "Target the single highest-friction constraint in the pipeline.",
                45));
        proposed.add(new ProposedMission(
                "Review metrics, verify outcomes & run retrospective",
                "Audit the execution, capture learnings, and close the loop.",
                20));

        GoalDecompositionResponse response = new GoalDecompositionResponse(
                goalId,
                goal.getTitle(),
                "Goal strategically partitioned into high-velocity execution blocks.",
                proposed);

        saveSuggestion(userId, "GOAL_DECOMPOSITION",
                "goalId=" + goalId,
                "Decomposed into " + proposed.size() + " missions for: " + goal.getTitle());

        return response;
    }

    // -------------------------------------------------------------------------
    // NEXT ACTION
    // -------------------------------------------------------------------------
    public NextActionResponse getNextAction(Long userId) {
        List<Mission> pending = missionRepository.findAllByGoal_User_Id(userId).stream()
                .filter(m -> !"COMPLETED".equals(m.getStatus()))
                .toList();

        if (pending.isEmpty()) {
            NextActionResponse empty = new NextActionResponse(
                    null, null, null,
                    "No pending missions — initialize a new mission or decompose an existing goal.",
                    "All pending missions clear. Review goals or plan the next sprint.",
                    15,
                    "Low cognitive load. Ideal time for strategic planning.");
            saveSuggestion(userId, "NEXT_ACTION", "no-pending", "No pending missions found.");
            return empty;
        }

        Mission top = pending.get(0);
        Goal topGoal = top.getGoal();

        NextActionResponse response = new NextActionResponse(
                topGoal != null ? topGoal.getId() : null,
                topGoal != null ? topGoal.getTitle() : null,
                top.getId(),
                top.getTitle(),
                "Execute this mission now — it is the highest-leverage pending item.",
                top.getEstimatedMinutes() != null ? top.getEstimatedMinutes() : 25,
                "Top-of-queue pending mission; earliest created unblocked item.");

        saveSuggestion(userId, "NEXT_ACTION", "userId=" + userId, "Next: " + top.getTitle());
        return response;
    }

    // -------------------------------------------------------------------------
    // DAILY PLAN
    // -------------------------------------------------------------------------
    public DailyPlanResponse getDailyPlan(Long userId) {
        List<Mission> pending = missionRepository.findAllByGoal_User_Id(userId).stream()
                .filter(m -> !"COMPLETED".equals(m.getStatus()))
                .toList();

        List<DailyPlanItem> items = new ArrayList<>();
        int limit = Math.min(pending.size(), 3);

        for (int i = 0; i < limit; i++) {
            Mission m = pending.get(i);
            Goal g = m.getGoal();
            items.add(new DailyPlanItem(
                    m.getId(),
                    m.getTitle(),
                    g != null ? g.getTitle() : "—",
                    m.getEstimatedMinutes() != null ? m.getEstimatedMinutes() : 30,
                    i == 0 ? "HIGH" : (i == 1 ? "MEDIUM" : "NORMAL")));
        }

        if (items.isEmpty()) {
            items.add(new DailyPlanItem(null, "Tactical Planning & Workspace Setup", "—", 20, "HIGH"));
            items.add(new DailyPlanItem(null, "Core High-Value Execution Sprint", "—", 50, "HIGH"));
            items.add(new DailyPlanItem(null, "End-of-day Review & Retrospective", "—", 20, "NORMAL"));
        }

        int totalMins = 0;
        for (DailyPlanItem item : items) {
            Integer mins = item.durationMinutes();
            totalMins += (mins != null) ? mins : 0;
        }

        DailyPlanResponse response = new DailyPlanResponse(
                "Structured " + items.size() + "-block execution day (" + totalMins + " min total)",
                "Prioritizes highest-leverage missions first to maximize momentum.",
                items);

        saveSuggestion(userId, "DAILY_PLAN", "userId=" + userId,
                "Plan generated: " + items.size() + " blocks, " + totalMins + " min.");
        return response;
    }

    // -------------------------------------------------------------------------
    // PROCESS CHAT
    // -------------------------------------------------------------------------
    public AiChatResponse processChat(AiChatRequest request) {
        if (request == null || request.message() == null || request.message().isBlank()) {
            return new AiChatResponse(
                    "SHINPO Tactical Engine online. How would you like to direct your focus today?",
                    "ASSISTANT",
                    null);
        }

        Long userId = request.userId() != null ? request.userId() : 1L;
        String raw = request.message().trim();
        String lower = raw.toLowerCase(Locale.ROOT);

        // 1. GREETINGS
        if (lower.matches("^(hi|hello|hey|greetings|howdy|yo|sup)(\\s.*|[!.?])?$")) {
            DailyPlanResponse plan = getDailyPlan(userId);
            return new AiChatResponse(
                    "Welcome back to SHINPO Cockpit. Systems nominal. Here is your tactical execution schedule for today:",
                    "TACTICAL_ASSISTANT",
                    plan);
        }

        // 2. GUIDANCE / HELP
        if (lower.contains("guide") || lower.contains("help")
                || lower.contains("what should i do") || lower.contains("how does this work")) {
            NextActionResponse next = getNextAction(userId);
            return new AiChatResponse(
                    "Current execution directive: Execute [" + next.missionTitle() + "]. "
                    + next.rationale() + " Suggested block: " + next.estimatedMinutes() + " minutes.",
                    "NEXT_ACTION",
                    next);
        }

        // 3. DAILY PLAN / SCHEDULE / TODAY
        if (lower.contains("plan") || lower.contains("schedule") || lower.contains("today")) {
            DailyPlanResponse plan = getDailyPlan(userId);
            return new AiChatResponse(
                    "Tactical daily itinerary constructed (" + plan.planItems().size() + " execution blocks):",
                    "PLANNER",
                    plan);
        }

        // 4. GOAL DECOMPOSITION
        if (lower.contains("goal") || lower.contains("decompose")
                || lower.contains("break down") || lower.contains("split")) {
            List<Goal> goals = goalRepository.findAllByUser_Id(userId);
            if (!goals.isEmpty()) {
                GoalDecompositionResponse decomp = decomposeGoal(goals.get(0).getId(), userId);
                return new AiChatResponse(
                        "Deconstructed primary objective [" + decomp.goalTitle() + "]: "
                        + decomp.analysis(),
                        "ARCHITECT",
                        decomp);
            }
            return new AiChatResponse(
                    "No active goals found. Define a high-level goal first, and I will partition it into concrete sprint actions.",
                    "ARCHITECT",
                    null);
        }

        // 5. STUCK / TIRED / RECOVERY
        if (lower.contains("stuck") || lower.contains("tired") || lower.contains("burnout")
                || lower.contains("overwhelm") || lower.contains("break")) {
            List<ProposedMission> recovery = new ArrayList<>();
            recovery.add(new ProposedMission(
                    "Hydrate and physical reset away from screens",
                    "Step back, reset biometrics, return with a clean slate.",
                    10));
            recovery.add(new ProposedMission(
                    "Execute lowest-friction sub-task (micro-win)",
                    "Pick the smallest possible action to regain momentum.",
                    15));
            return new AiChatResponse(
                    "Cognitive friction detected. High-performing execution requires measured recovery, "
                    + "not grinding into fatigue. Recommendation: 10-min physical break, then a micro-sprint.",
                    "RECOVERY_ADVISOR",
                    recovery);
        }

        // 6. DEFAULT — echo and convert to action
        List<ProposedMission> defaultActions = new ArrayList<>();
        defaultActions.add(new ProposedMission(
                "Formalize: " + (raw.length() > 40 ? raw.substring(0, 40) + "..." : raw),
                "Convert this thought into a tracked, time-boxed mission.",
                25));
        defaultActions.add(new ProposedMission(
                "Run quick 15-minute momentum sprint",
                "Low-friction warm-up to build focus before the main block.",
                15));

        return new AiChatResponse(
                "Directive received: \"" + raw + "\". "
                + "Select a focus sprint or convert this into a tactical mission below.",
                "ASSISTANT",
                defaultActions);
    }

    // -------------------------------------------------------------------------
    // SESSION RECOVERY
    // -------------------------------------------------------------------------
    public RecoveryResponse getSessionRecovery(Long sessionId, Long userId) {
        FocusSession session = focusSessionRepository.findByIdAndUser_Id(sessionId, userId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Session not found or unauthorized: " + sessionId));

        Integer durationObj = session.getDurationMinutes();
        int duration = durationObj != null ? durationObj : 25;

        List<RecoveryOption> options = new ArrayList<>();
        options.add(new RecoveryOption(
                "RESCHEDULE",
                "Re-queue remaining block",
                "Re-queue the remaining " + duration + " min block into your next available focus window."));
        options.add(new RecoveryOption(
                "SPLIT",
                "Partition into micro-sprints",
                "Split the remaining workload into two 15-minute focused micro-sprints."));
        options.add(new RecoveryOption(
                "DEBRIEF",
                "Log and close session",
                "Record friction points and close out with partial progress marked."));

        RecoveryResponse response = new RecoveryResponse(
                sessionId,
                session.getName(),
                duration,
                null,
                "Interruption handled. Select a recovery trajectory to preserve your flow rhythm.",
                options);

        saveSuggestion(userId, "SESSION_RECOVERY",
                "sessionId=" + sessionId,
                "Recovery options generated for session: " + session.getName());
        return response;
    }

    // -------------------------------------------------------------------------
    // INTERNAL: persist AI suggestion audit log
    // -------------------------------------------------------------------------
    private void saveSuggestion(Long userId, String type, String inputContext, String outputPayload) {
        try {
            User user = userRepository.getReferenceById(userId);
            AiSuggestion suggestion = new AiSuggestion(user, type, inputContext, outputPayload);
            aiSuggestionRepository.save(suggestion);
        } catch (Exception e) {
            // Fail-open: telemetry logging must never disrupt the primary user workflow
        }
    }
}