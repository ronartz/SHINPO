package com.shinpo.controller;

import com.shinpo.dto.ContextualFocusDtos.*;
import com.shinpo.security.UserPrincipal;
import com.shinpo.service.BrowserCompanionConnectionService;
import com.shinpo.service.ContextualFocusPolicyService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/contextual-focus")
public class ContextualFocusController {

    private final ContextualFocusPolicyService policyService;
    private final BrowserCompanionConnectionService connectionService;

    public ContextualFocusController(
            ContextualFocusPolicyService policyService,
            BrowserCompanionConnectionService connectionService
    ) {
        this.policyService = policyService;
        this.connectionService = connectionService;
    }

    @PostMapping("/resources")
    public ResponseEntity<ResourceResponse> createResource(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody CreateResourceRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(policyService.createResource(principal.getUserId(), request));
    }

    @GetMapping("/resources")
    public ResponseEntity<List<ResourceResponse>> listResources(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(required = false) Long missionId,
            @RequestParam(required = false) Long sessionId
    ) {
        return ResponseEntity.ok(policyService.listResources(principal.getUserId(), missionId, sessionId));
    }

    @DeleteMapping("/resources/{resourceId}")
    public ResponseEntity<Void> deleteResource(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long resourceId
    ) {
        policyService.deleteResource(principal.getUserId(), resourceId);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/sessions/{sessionId}/mode")
    public ResponseEntity<ContextualFocusStatusResponse> updateMode(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long sessionId,
            @Valid @RequestBody UpdateModeRequest request
    ) {
        policyService.updateMode(principal.getUserId(), sessionId, request.mode());
        return ResponseEntity.ok(policyService.getStatus(principal.getUserId(), sessionId));
    }

    @PatchMapping("/sessions/{sessionId}/settings")
    public ResponseEntity<SessionPolicySettingsResponse> updateAdapterSettings(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long sessionId,
            @Valid @RequestBody UpdateAdapterSettingsRequest request
    ) {
        return ResponseEntity.ok(policyService.updateAdapterSettings(
                principal.getUserId(),
                sessionId,
                request
        ));
    }

    @GetMapping({"/policy", "/policy/active"})
    public ResponseEntity<PolicySnapshotResponse> getActivePolicy(
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(policyService.getActivePolicy(principal.getUserId()));
    }

    @GetMapping("/sessions/{sessionId}/policy")
    public ResponseEntity<PolicySnapshotResponse> getSessionPolicy(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long sessionId
    ) {
        return ResponseEntity.ok(policyService.getPolicy(principal.getUserId(), sessionId));
    }

    @PostMapping("/sessions/{sessionId}/evaluate")
    public ResponseEntity<PolicyEvaluationResponse> evaluate(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long sessionId,
            @Valid @RequestBody EvaluateResourceRequest request
    ) {
        return ResponseEntity.ok(policyService.evaluate(principal.getUserId(), sessionId, request));
    }

    @PostMapping("/sessions/{sessionId}/temporary-exceptions")
    public ResponseEntity<PolicySnapshotResponse> createSessionTemporaryException(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long sessionId,
            @Valid @RequestBody TemporaryExceptionRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(
                policyService.createTemporaryException(principal.getUserId(), sessionId, request)
        );
    }

    @PostMapping("/exceptions")
    public ResponseEntity<PolicySnapshotResponse> createTemporaryException(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody TemporaryExceptionRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(
                policyService.createTemporaryException(principal.getUserId(), null, request)
        );
    }

    @GetMapping("/restrictions")
    public ResponseEntity<List<ResourceResponse>> listRestrictions(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam Long sessionId
    ) {
        return ResponseEntity.ok(policyService.listRestrictions(principal.getUserId(), sessionId));
    }

    @GetMapping("/status")
    public ResponseEntity<ContextualFocusStatusResponse> getStatus(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(required = false) Long sessionId
    ) {
        return ResponseEntity.ok(policyService.getStatus(principal.getUserId(), sessionId));
    }

    @GetMapping("/audit")
    public ResponseEntity<List<PolicyAuditResponse>> listAudit(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(required = false) Long sessionId
    ) {
        return ResponseEntity.ok(policyService.listAudit(principal.getUserId(), sessionId));
    }

    @PostMapping("/companion/heartbeat")
    public ResponseEntity<CompanionConnectionResponse> heartbeat(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody CompanionHeartbeatRequest request
    ) {
        return ResponseEntity.ok(connectionService.heartbeat(principal.getUserId(), request));
    }

    @DeleteMapping("/companion/connection")
    public ResponseEntity<Void> disconnect(
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        connectionService.disconnect(principal.getUserId());
        return ResponseEntity.noContent().build();
    }
}
