package com.shinpo.dto;

public record UserResponse(
        Long id,
        String username,
        String email,
        String role
) {
    public UserResponse(Long id, String username, String email) {
        this(id, username, email, "ROLE_USER");
    }
}