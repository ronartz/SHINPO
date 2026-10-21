package com.shinpo.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class AuthDtos {

    public record RegisterRequest(
            @NotBlank(message = "Username is required")
            @Size(min = 3, max = 50, message = "Username must be between 3 and 50 characters")
            String username,

            @NotBlank(message = "Email is required")
            @Email(message = "Invalid email format")
            String email,

            @NotBlank(message = "Password is required")
            @Size(min = 6, max = 100, message = "Password must be at least 6 characters")
            String password
    ) {}

    public record LoginRequest(
            @NotBlank(message = "Username or email is required")
            @Size(max = 100, message = "Username or email cannot exceed 100 characters")
            String usernameOrEmail,

            @NotBlank(message = "Password is required")
            @Size(max = 128, message = "Password cannot exceed 128 characters")
            String password
    ) {}

    public record RefreshTokenRequest(
            @NotBlank(message = "Refresh token is required")
            String refreshToken
    ) {}

    public record AuthResponse(
            String accessToken,
            String refreshToken,
            String tokenType,
            Long expiresInSeconds,
            UserResponse user
    ) {
        public static AuthResponse of(String accessToken, String refreshToken, UserResponse user) {
            return new AuthResponse(accessToken, refreshToken, "Bearer", 3600L, user);
        }
    }

    public record ChangePasswordRequest(
            @NotBlank(message = "Current password is required")
            @Size(max = 128, message = "Current password cannot exceed 128 characters")
            String currentPassword,

            @NotBlank(message = "New password is required")
            @Size(min = 6, max = 100, message = "New password must be at least 6 characters")
            String newPassword
    ) {}

    public record UpdateUsernameRequest(
            @NotBlank(message = "Username is required")
            @Size(min = 3, max = 50, message = "Username must be between 3 and 50 characters")
            String username
    ) {}
}
