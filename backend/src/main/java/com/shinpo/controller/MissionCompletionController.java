package com.shinpo.controller;

import com.shinpo.dto.CompleteMissionRequest;
import com.shinpo.dto.MissionCompletionResponse;
import com.shinpo.security.UserPrincipal;
import com.shinpo.service.MissionCompletionService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/missions")
public class MissionCompletionController {

    private final MissionCompletionService completionService;

    public MissionCompletionController(
            MissionCompletionService completionService
    ) {
        this.completionService = completionService;
    }

    @PostMapping("/{missionId}/complete")
    @ResponseStatus(HttpStatus.CREATED)
    public MissionCompletionResponse completeMission(
            @PathVariable Long missionId,
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody CompleteMissionRequest request
    ) {
        return completionService.completeMission(missionId, principal.getUserId(), request);
    }
}