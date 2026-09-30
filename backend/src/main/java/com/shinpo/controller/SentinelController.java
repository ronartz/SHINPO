package com.shinpo.controller;

import com.shinpo.dto.SentinelDtos.*;
import com.shinpo.security.UserPrincipal;
import com.shinpo.service.SentinelEnforcementService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/device/sentinel")
public class SentinelController {

    private final SentinelEnforcementService sentinelService;

    public SentinelController(SentinelEnforcementService sentinelService) {
        this.sentinelService = sentinelService;
    }

    @GetMapping("/status")
    public ResponseEntity<SentinelStatusResponse> getSentinelStatus(
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(sentinelService.getSentinelStatus(principal.getUserId()));
    }

    @PostMapping("/sweep")
    public ResponseEntity<SentinelSweepResponse> triggerSweep(
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(sentinelService.triggerSweep(principal.getUserId()));
    }

    @GetMapping("/quarantines")
    public ResponseEntity<List<SentinelQuarantineItem>> getQuarantines(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(value = "sessionId", required = false) Long sessionId
    ) {
        if (sessionId != null) {
            return ResponseEntity.ok(sentinelService.getQuarantinesForSession(principal.getUserId(), sessionId));
        }
        return ResponseEntity.ok(sentinelService.getSentinelStatus(principal.getUserId()).recentQuarantines());
    }

    @GetMapping("/rules")
    public ResponseEntity<List<PolicyRuleResponse>> listRules(
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(sentinelService.listPolicyRules(principal.getUserId()));
    }

    @PostMapping("/rules")
    public ResponseEntity<PolicyRuleResponse> addRule(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestBody AddPolicyRuleRequest request
    ) {
        return ResponseEntity.ok(sentinelService.addPolicyRule(principal.getUserId(), request));
    }

    @DeleteMapping("/rules/{ruleId}")
    public ResponseEntity<Void> deleteRule(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long ruleId
    ) {
        sentinelService.deletePolicyRule(principal.getUserId(), ruleId);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/mode")
    public ResponseEntity<SentinelStatusResponse> updateMode(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestBody UpdateEnforcementModeRequest request
    ) {
        sentinelService.setEnforcementMode(principal.getUserId(), request.enforcementMode());
        return ResponseEntity.ok(sentinelService.getSentinelStatus(principal.getUserId()));
    }

    @PostMapping("/emergency-override")
    public ResponseEntity<EmergencyOverrideResponse> emergencyOverride(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestBody EmergencyOverrideRequest request
    ) {
        return ResponseEntity.ok(sentinelService.emergencyOverride(principal.getUserId(), request));
    }

    @GetMapping("/tamper-events")
    public ResponseEntity<List<SentinelTamperEventItem>> listTamperEvents(
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(sentinelService.listTamperEvents(principal.getUserId()));
    }
}
