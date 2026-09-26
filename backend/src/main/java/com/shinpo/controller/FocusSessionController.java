package com.shinpo.controller;

import com.shinpo.dto.CreateFocusSessionRequest;
import com.shinpo.dto.FocusSessionResponse;
import com.shinpo.service.FocusSessionService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/focus-sessions")
public class FocusSessionController {

    private final FocusSessionService focusSessionService;

    public FocusSessionController(FocusSessionService focusSessionService) {
        this.focusSessionService = focusSessionService;
    }

    @PostMapping
    public ResponseEntity<FocusSessionResponse> createSession(
            @Valid @RequestBody CreateFocusSessionRequest request
    ) {
        FocusSessionResponse response =
                focusSessionService.createSession(request);

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(response);
    }

    @GetMapping
    public ResponseEntity<List<FocusSessionResponse>> getSessions(
            @RequestParam Long userId
    ) {
        return ResponseEntity.ok(
                focusSessionService.getSessionsForUser(userId)
        );
    }

    @GetMapping("/{sessionId}")
    public ResponseEntity<FocusSessionResponse> getSession(
            @PathVariable Long sessionId,
            @RequestParam Long userId
    ) {
        return ResponseEntity.ok(
                focusSessionService.getSession(sessionId, userId)
        );
    }

    @PostMapping("/{sessionId}/start")
    public ResponseEntity<FocusSessionResponse> startSession(
            @PathVariable Long sessionId,
            @RequestParam Long userId
    ) {
        return ResponseEntity.ok(
                focusSessionService.startSession(sessionId, userId)
        );
    }

    @PostMapping("/{sessionId}/pause")
    public ResponseEntity<FocusSessionResponse> pauseSession(
            @PathVariable Long sessionId,
            @RequestParam Long userId
    ) {
        return ResponseEntity.ok(
                focusSessionService.pauseSession(sessionId, userId)
        );
    }

    @PostMapping("/{sessionId}/resume")
    public ResponseEntity<FocusSessionResponse> resumeSession(
            @PathVariable Long sessionId,
            @RequestParam Long userId
    ) {
        return ResponseEntity.ok(
                focusSessionService.resumeSession(sessionId, userId)
        );
    }

    @PostMapping("/{sessionId}/complete")
    public ResponseEntity<FocusSessionResponse> completeSession(
            @PathVariable Long sessionId,
            @RequestParam Long userId
    ) {
        return ResponseEntity.ok(
                focusSessionService.completeSession(sessionId, userId)
        );
    }

    @PostMapping("/{sessionId}/cancel")
    public ResponseEntity<FocusSessionResponse> cancelSession(
            @PathVariable Long sessionId,
            @RequestParam Long userId
    ) {
        return ResponseEntity.ok(
                focusSessionService.cancelSession(sessionId, userId)
        );
    }
}