package com.shinpo.controller;

import com.shinpo.ai.actions.AiActionService;
import com.shinpo.ai.actions.dto.AiActionDto;
import com.shinpo.ai.actions.dto.AiActionExecutionResponse;
import com.shinpo.security.UserPrincipal;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/ai/actions")
public class AiActionController {

    private final AiActionService aiActionService;

    public AiActionController(AiActionService aiActionService) {
        this.aiActionService = aiActionService;
    }

    public record ProposeActionRequest(
            String actionType,
            String description,
            Map<String, Object> payload
    ) {}

    @PostMapping("/propose")
    public ResponseEntity<AiActionDto> proposeAction(
            @RequestBody ProposeActionRequest request,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        if (principal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        if (request == null || request.actionType() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "actionType is required");
        }
        try {
            AiActionDto proposed = aiActionService.proposeAction(
                    principal.getUserId(),
                    request.actionType(),
                    request.description(),
                    request.payload()
            );
            return ResponseEntity.status(HttpStatus.CREATED).body(proposed);
        } catch (SecurityException se) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, se.getMessage());
        } catch (IllegalArgumentException iae) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, iae.getMessage());
        }
    }

    @PostMapping("/{actionId}/confirm")
    public ResponseEntity<AiActionExecutionResponse> confirmAction(
            @PathVariable String actionId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        if (principal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        try {
            AiActionExecutionResponse res = aiActionService.confirmAndExecute(actionId, principal.getUserId());
            return ResponseEntity.ok(res);
        } catch (SecurityException se) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, se.getMessage());
        } catch (IllegalStateException ise) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, ise.getMessage());
        } catch (IllegalArgumentException iae) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, iae.getMessage());
        }
    }

    @PostMapping("/{actionId}/reject")
    public ResponseEntity<AiActionDto> rejectAction(
            @PathVariable String actionId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        if (principal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        try {
            AiActionDto res = aiActionService.rejectAction(actionId, principal.getUserId());
            return ResponseEntity.ok(res);
        } catch (SecurityException se) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, se.getMessage());
        } catch (IllegalStateException ise) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, ise.getMessage());
        } catch (IllegalArgumentException iae) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, iae.getMessage());
        }
    }

    @GetMapping("/pending")
    public ResponseEntity<List<AiActionDto>> getPendingActions(
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        if (principal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        return ResponseEntity.ok(aiActionService.getPendingActions(principal.getUserId()));
    }

    @GetMapping("/recent")
    public ResponseEntity<List<AiActionDto>> getRecentActions(
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        if (principal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        return ResponseEntity.ok(aiActionService.getRecentActions(principal.getUserId()));
    }

    @GetMapping("/{actionId}")
    public ResponseEntity<AiActionDto> getAction(
            @PathVariable String actionId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        if (principal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        try {
            return ResponseEntity.ok(aiActionService.getAction(actionId, principal.getUserId()));
        } catch (SecurityException se) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, se.getMessage());
        } catch (IllegalArgumentException iae) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, iae.getMessage());
        }
    }
}

