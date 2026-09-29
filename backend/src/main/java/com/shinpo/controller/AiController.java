package com.shinpo.controller;

import com.shinpo.dto.AiDtos.*;
import com.shinpo.security.UserPrincipal;
import com.shinpo.service.AiService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/ai")
public class AiController {

    private final AiService aiService;

    public AiController(AiService aiService) {
        this.aiService = aiService;
    }

    @PostMapping("/chat")
    public ResponseEntity<AiChatResponse> chat(
            @RequestBody AiChatRequest request,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        if (principal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        Long userId = principal.getUserId();
        AiChatRequest boundRequest = new AiChatRequest(
                userId,
                request != null ? request.message() : "",
                request != null ? request.contextualGoalId() : null,
                request != null ? request.contextualMissionId() : null,
                request != null ? request.contextualSessionId() : null,
                request != null ? request.conversationId() : null
        );
        return ResponseEntity.ok(aiService.processChat(boundRequest));
    }

    @GetMapping("/conversation/active")
    public ResponseEntity<ConversationDto> getActiveConversation(
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        if (principal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        return ResponseEntity.ok(aiService.getActiveConversation(principal.getUserId()));
    }

    @DeleteMapping("/conversation/active")
    public ResponseEntity<ConversationDto> clearActiveConversation(
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        if (principal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        return ResponseEntity.ok(aiService.clearActiveConversation(principal.getUserId()));
    }

    @PostMapping("/decompose-goal/{goalId}")
    public ResponseEntity<GoalDecompositionResponse> decomposeGoal(
            @PathVariable Long goalId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        if (principal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        return ResponseEntity.ok(aiService.decomposeGoal(goalId, principal.getUserId()));
    }

    @GetMapping("/next-action")
    public ResponseEntity<NextActionResponse> getNextAction(
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        if (principal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        return ResponseEntity.ok(aiService.getNextAction(principal.getUserId()));
    }

    @GetMapping("/daily-plan")
    public ResponseEntity<DailyPlanResponse> getDailyPlan(
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        if (principal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        return ResponseEntity.ok(aiService.getDailyPlan(principal.getUserId()));
    }

    @GetMapping("/recovery/{sessionId}")
    public ResponseEntity<RecoveryResponse> getSessionRecovery(
            @PathVariable Long sessionId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        if (principal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        return ResponseEntity.ok(aiService.getSessionRecovery(sessionId, principal.getUserId()));
    }

    @PostMapping("/suggestions/{suggestionId}/accept")
    public ResponseEntity<Void> acceptSuggestion(
            @PathVariable Long suggestionId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        if (principal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        aiService.acceptSuggestion(suggestionId, principal.getUserId());
        return ResponseEntity.noContent().build();
    }
}