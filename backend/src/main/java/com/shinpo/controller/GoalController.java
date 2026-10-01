package com.shinpo.controller;

import com.shinpo.dto.CreateGoalRequest;
import com.shinpo.dto.GoalResponse;
import com.shinpo.dto.UpdateGoalRequest;
import com.shinpo.security.UserPrincipal;
import com.shinpo.service.GoalService;
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
@RequestMapping("/api/goals")
public class GoalController {

    private final GoalService goalService;

    public GoalController(GoalService goalService) {
        this.goalService = goalService;
    }

    @GetMapping
    public List<GoalResponse> getAllGoals(@AuthenticationPrincipal UserPrincipal principal) {
        return goalService.getGoalsForUser(principal.getUserId());
    }

    @GetMapping("/{id}")
    public GoalResponse getGoalById(
            @PathVariable Long id,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return goalService.getGoal(id, principal.getUserId());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public GoalResponse createGoal(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody CreateGoalRequest request
    ) {
        return goalService.createGoal(principal.getUserId(), request);
    }

    @PutMapping("/{id}")
    public GoalResponse updateGoal(
            @PathVariable Long id,
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody UpdateGoalRequest request
    ) {
        return goalService.updateGoal(id, principal.getUserId(), request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteGoal(
            @PathVariable Long id,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        goalService.deleteGoal(id, principal.getUserId());
    }
}