package com.shinpo.controller;

import com.shinpo.dto.CreateMissionRequest;
import com.shinpo.dto.MissionResponse;
import com.shinpo.service.MissionService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
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
    public List<MissionResponse> getAllMissions() {
        return missionService.getAllMissions();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public MissionResponse createMission(
            @Valid @RequestBody CreateMissionRequest request
    ) {
        return missionService.createMission(request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteMission(@PathVariable Long id) {
        missionService.deleteMission(id);
    }
}