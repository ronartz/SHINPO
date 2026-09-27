package com.shinpo.controller;

import com.shinpo.dto.CompleteMissionRequest;
import com.shinpo.dto.MissionCompletionResponse;
import com.shinpo.service.MissionCompletionService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

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
            @Valid @RequestBody CompleteMissionRequest request
    ) {
        return completionService.completeMission(missionId, request);
    }
}