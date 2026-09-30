package com.shinpo.controller;

import com.shinpo.ai.tool.AiToolRegistry;
import com.shinpo.ai.tool.ToolDefinition;
import com.shinpo.ai.tool.ToolResult;
import com.shinpo.dto.AiDtos.*;
import com.shinpo.security.UserPrincipal;
import com.shinpo.service.AiService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/ai")
public class AiController {

    private final AiService aiService;
    private final AiToolRegistry toolRegistry;

    @Autowired
    public AiController(AiService aiService, AiToolRegistry toolRegistry) {
        this.aiService = aiService;
        this.toolRegistry = toolRegistry;
    }

    public AiController(AiService aiService) {
        this(aiService, null);
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

    @PostMapping("/suggestions/{suggestionId}/commit")
    public ResponseEntity<SuggestionCommitResponse> commitSuggestion(
            @PathVariable Long suggestionId,
            @RequestBody(required = false) SuggestionCommitRequest request,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        if (principal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        return ResponseEntity.ok(aiService.commitSuggestion(suggestionId, principal.getUserId(), request));
    }

    @GetMapping("/profile")
    public ResponseEntity<UserExecutionProfileDto> getUserExecutionProfile(
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        if (principal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        return ResponseEntity.ok(aiService.getUserExecutionProfile(principal.getUserId()));
    }

    @GetMapping("/tools")
    public ResponseEntity<List<ToolDefinition>> getAvailableTools(
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        if (principal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        if (toolRegistry == null) {
            return ResponseEntity.ok(List.of());
        }
        return ResponseEntity.ok(toolRegistry.getToolDefinitions());
    }

    @PostMapping("/tools/{toolName}/execute")
    public ResponseEntity<ToolResult> executeTool(
            @PathVariable String toolName,
            @RequestBody(required = false) Map<String, Object> parameters,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        if (principal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        if (toolRegistry == null) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Tool registry unavailable");
        }
        ToolResult result = toolRegistry.executeTool(
                toolName,
                principal.getUserId(),
                parameters != null ? parameters : Map.of()
        );
        if (!result.success() && result.errorMessage() != null && result.errorMessage().contains("access denied")) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(result);
        }
        return ResponseEntity.ok(result);
    }
}