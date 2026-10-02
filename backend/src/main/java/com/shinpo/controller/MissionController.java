package com.shinpo.controller;

import com.shinpo.dto.CreateMissionRequest;
import com.shinpo.dto.MissionResponse;
import com.shinpo.dto.UpdateMissionRequest;
import com.shinpo.security.UserPrincipal;
import com.shinpo.service.MissionService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/missions")
public class MissionController {

    private final MissionService missionService;

    public MissionController(MissionService missionService) {
        this.missionService = missionService;
    }

    @GetMapping
    public List<MissionResponse> getAllMissions(@AuthenticationPrincipal UserPrincipal principal) {
        return missionService.getMissionsForUser(principal.getUserId());
    }

    @GetMapping("/{id}")
    public MissionResponse getMissionById(
            @PathVariable Long id,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return missionService.getMission(id, principal.getUserId());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public MissionResponse createMission(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody CreateMissionRequest request
    ) {
        return missionService.createMission(principal.getUserId(), request);
    }

    @PutMapping("/{id}")
    public MissionResponse updateMission(
            @PathVariable Long id,
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody UpdateMissionRequest request
    ) {
        return missionService.updateMission(id, principal.getUserId(), request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteMission(
            @PathVariable Long id,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        missionService.deleteMission(id, principal.getUserId());
    }

    @DeleteMapping("/all")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteAllMissions(@AuthenticationPrincipal UserPrincipal principal) {
        missionService.deleteAllMissionsForUser(principal.getUserId());
    }
}