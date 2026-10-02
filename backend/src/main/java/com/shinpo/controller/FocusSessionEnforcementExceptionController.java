package com.shinpo.controller;

import com.shinpo.dto.FocusSessionExceptionDtos.CreateFocusSessionExceptionRequest;
import com.shinpo.dto.FocusSessionExceptionDtos.FocusSessionExceptionResponse;
import com.shinpo.security.UserPrincipal;
import com.shinpo.service.FocusSessionEnforcementExceptionService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/focus-sessions/{focusSessionId}/enforcement-exceptions")
public class FocusSessionEnforcementExceptionController {

    private final FocusSessionEnforcementExceptionService exceptionService;

    public FocusSessionEnforcementExceptionController(FocusSessionEnforcementExceptionService exceptionService) {
        this.exceptionService = exceptionService;
    }

    @PostMapping
    public ResponseEntity<FocusSessionExceptionResponse> createException(
            @PathVariable Long focusSessionId,
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody CreateFocusSessionExceptionRequest request
    ) {
        FocusSessionExceptionResponse response = exceptionService.createException(
                principal.getUserId(),
                focusSessionId,
                request
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<List<FocusSessionExceptionResponse>> listExceptions(
            @PathVariable Long focusSessionId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(exceptionService.listExceptions(principal.getUserId(), focusSessionId));
    }

    @DeleteMapping("/{exceptionId}")
    public ResponseEntity<Void> deleteException(
            @PathVariable Long focusSessionId,
            @PathVariable Long exceptionId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        exceptionService.deleteException(principal.getUserId(), focusSessionId, exceptionId);
        return ResponseEntity.noContent().build();
    }
}
