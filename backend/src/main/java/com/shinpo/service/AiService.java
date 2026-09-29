package com.shinpo.service;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.shinpo.ai.orchestrator.AiGateway;
import com.shinpo.dto.AiDtos.AiChatRequest;
import com.shinpo.dto.AiDtos.AiChatResponse;
import com.shinpo.dto.AiDtos.DailyPlanResponse;
import com.shinpo.dto.AiDtos.GoalDecompositionResponse;
import com.shinpo.dto.AiDtos.NextActionResponse;
import com.shinpo.dto.AiDtos.RecoveryResponse;
import com.shinpo.entity.FocusSession;
import com.shinpo.entity.Goal;
import com.shinpo.repository.FocusSessionRepository;
import com.shinpo.repository.GoalRepository;

@Service
@Transactional
public class AiService {

    private final GoalRepository goalRepository;
    private final FocusSessionRepository focusSessionRepository;
    private final AiGateway aiGateway;

    public AiService(
            GoalRepository goalRepository,
            FocusSessionRepository focusSessionRepository,
            AiGateway aiGateway) {
        this.goalRepository = goalRepository;
        this.focusSessionRepository = focusSessionRepository;
        this.aiGateway = aiGateway;
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

        return aiGateway.decomposeGoal(goalId, userId, goal.getTitle());
    }

    public NextActionResponse getNextAction(Long userId) {
        return aiGateway.getNextAction(userId);
    }

    public DailyPlanResponse getDailyPlan(Long userId) {
        return aiGateway.getDailyPlan(userId);
    }

    public AiChatResponse processChat(AiChatRequest request) {
        return aiGateway.processChat(request);
    }

    public RecoveryResponse getSessionRecovery(Long sessionId, Long userId) {
        FocusSession session = focusSessionRepository.findByIdAndUser_Id(sessionId, userId)
                .orElseThrow(() -> new IllegalArgumentException("Session not found or unauthorized: " + sessionId));

        long actualMins = session.calculateActiveSeconds(java.time.Instant.now()) / 60;
        return aiGateway.getSessionRecovery(sessionId, userId, session.getName(), session.getDurationMinutes(), actualMins);
    }
}