package com.shinpo.controller;

import com.shinpo.dto.CompleteFocusSessionRequest;
import com.shinpo.dto.CreateFocusSessionRequest;
import com.shinpo.dto.FocusSessionResponse;
import com.shinpo.security.UserPrincipal;
import com.shinpo.service.FocusSessionService;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
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
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody CreateFocusSessionRequest request
    ) {
        request.setUserId(principal.getUserId());
        FocusSessionResponse response = focusSessionService.createSession(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<List<FocusSessionResponse>> getSessions(
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(focusSessionService.getSessionsForUser(principal.getUserId()));
    }

    @GetMapping("/by-date")
    public ResponseEntity<List<FocusSessionResponse>> getSessionsByDate(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(focusSessionService.getSessionsByDate(principal.getUserId(), date));
    }

    @GetMapping("/agenda")
    public ResponseEntity<List<FocusSessionResponse>> getAgenda(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(focusSessionService.getAgenda(principal.getUserId(), startDate, endDate));
    }

    @GetMapping("/{sessionId}")
    public ResponseEntity<FocusSessionResponse> getSession(
            @PathVariable Long sessionId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(focusSessionService.getSession(sessionId, principal.getUserId()));
    }

    @PostMapping("/{sessionId}/start")
    public ResponseEntity<FocusSessionResponse> startSession(
            @PathVariable Long sessionId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(focusSessionService.startSession(sessionId, principal.getUserId()));
    }

    @PostMapping("/{sessionId}/pause")
    public ResponseEntity<FocusSessionResponse> pauseSession(
            @PathVariable Long sessionId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(focusSessionService.pauseSession(sessionId, principal.getUserId()));
    }

    @PostMapping("/{sessionId}/resume")
    public ResponseEntity<FocusSessionResponse> resumeSession(
            @PathVariable Long sessionId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(focusSessionService.resumeSession(sessionId, principal.getUserId()));
    }

    @PostMapping("/{sessionId}/complete")
    public ResponseEntity<FocusSessionResponse> completeSession(
            @PathVariable Long sessionId,
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestBody(required = false) CompleteFocusSessionRequest request
    ) {
        return ResponseEntity.ok(focusSessionService.completeSession(sessionId, principal.getUserId(), request));
    }

    @PostMapping("/{sessionId}/cancel")
    public ResponseEntity<FocusSessionResponse> cancelSession(
            @PathVariable Long sessionId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(focusSessionService.cancelSession(sessionId, principal.getUserId()));
    }

    @DeleteMapping("/{sessionId}")
    public ResponseEntity<Void> deleteSession(
            @PathVariable Long sessionId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        focusSessionService.deleteSession(sessionId, principal.getUserId());
        return ResponseEntity.noContent().build();
    }
}