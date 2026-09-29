package com.shinpo.controller;

import com.shinpo.dto.AiDtos.*;
import com.shinpo.security.UserPrincipal;
import com.shinpo.service.AiService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

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
        return ResponseEntity.ok(aiService.processChat(request));
    }

    @PostMapping("/decompose-goal/{goalId}")
    public ResponseEntity<GoalDecompositionResponse> decomposeGoal(
            @PathVariable Long goalId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(aiService.decomposeGoal(goalId, principal.getUserId()));
    }

    @GetMapping("/next-action")
    public ResponseEntity<NextActionResponse> getNextAction(
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(aiService.getNextAction(principal.getUserId()));
    }

    @GetMapping("/daily-plan")
    public ResponseEntity<DailyPlanResponse> getDailyPlan(
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(aiService.getDailyPlan(principal.getUserId()));
    }

    @GetMapping("/recovery/{sessionId}")
    public ResponseEntity<RecoveryResponse> getSessionRecovery(
            @PathVariable Long sessionId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(aiService.getSessionRecovery(sessionId, principal.getUserId()));
    }
}