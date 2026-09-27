package com.shinpo.controller;

import com.shinpo.dto.AiDtos.*;
import com.shinpo.service.AiService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/ai")
public class AiController {

    private final AiService aiService;

    public AiController(AiService aiService) {
        this.aiService = aiService;
    }

    @PostMapping("/chat")
    public ResponseEntity<AiChatResponse> chat(@RequestBody AiChatRequest request) {
        return ResponseEntity.ok(aiService.processChat(request));
    }

    @PostMapping("/decompose-goal/{goalId}")
    public ResponseEntity<GoalDecompositionResponse> decomposeGoal(
            @PathVariable Long goalId,
            @RequestParam Long userId
    ) {
        return ResponseEntity.ok(aiService.decomposeGoal(goalId, userId));
    }

    @GetMapping("/next-action")
    public ResponseEntity<NextActionResponse> getNextAction(@RequestParam Long userId) {
        return ResponseEntity.ok(aiService.getNextAction(userId));
    }

    @GetMapping("/daily-plan")
    public ResponseEntity<DailyPlanResponse> getDailyPlan(@RequestParam Long userId) {
        return ResponseEntity.ok(aiService.getDailyPlan(userId));
    }

    @GetMapping("/recovery/{sessionId}")
    public ResponseEntity<RecoveryResponse> getSessionRecovery(
            @PathVariable Long sessionId,
            @RequestParam Long userId
    ) {
        return ResponseEntity.ok(aiService.getSessionRecovery(sessionId, userId));
    }
}