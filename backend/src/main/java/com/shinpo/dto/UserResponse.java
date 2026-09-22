package com.shinpo.dto;

public record UserResponse(
        Long id,
        String username,
        String email
) {
}