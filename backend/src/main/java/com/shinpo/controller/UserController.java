package com.shinpo.controller;

import com.shinpo.dto.CreateUserRequest;
import com.shinpo.dto.UserResponse;
import com.shinpo.security.UserPrincipal;
import com.shinpo.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public UserResponse createUser(
            @Valid @RequestBody CreateUserRequest request
    ) {
        return userService.createUser(request);
    }

    @GetMapping("/me")
    public UserResponse getCurrentUser(@AuthenticationPrincipal UserPrincipal principal) {
        return new UserResponse(
                principal.getUserId(),
                principal.getUsername(),
                principal.getEmail()
        );
    }

    @GetMapping("/default")
    public UserResponse getDefaultUser() {
        return userService.getOrCreateDefaultUser();
    }
}