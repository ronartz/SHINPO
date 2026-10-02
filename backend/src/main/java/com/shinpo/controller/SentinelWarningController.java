package com.shinpo.controller;

import com.shinpo.dto.SentinelWarningDtos.*;
import com.shinpo.security.UserPrincipal;
import com.shinpo.service.SentinelWarningService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/device/sentinel/warnings")
public class SentinelWarningController {

    private final SentinelWarningService warningService;

    public SentinelWarningController(SentinelWarningService warningService) {
        this.warningService = warningService;
    }

    @GetMapping
    public ResponseEntity<List<SentinelWarningResponse>> getActiveWarnings(
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(warningService.getActiveWarningsForUser(principal.getUserId()));
    }

    @PostMapping
    public ResponseEntity<SentinelWarningResponse> issueWarning(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody IssueWarningRequest request
    ) {
        SentinelWarningResponse response = warningService.issueWarning(principal.getUserId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/{warningId}/respond")
    public ResponseEntity<SentinelWarningResponse> respondToWarning(
            @PathVariable UUID warningId,
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody RespondWarningRequest request
    ) {
        return ResponseEntity.ok(warningService.respondToWarning(principal.getUserId(), warningId, request));
    }
}
