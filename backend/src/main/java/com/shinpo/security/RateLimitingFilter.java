package com.shinpo.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;

/**
 * Filter that applies rate limiting to sensitive authentication endpoints.
 * Returns HTTP 429 with Retry-After header and structured JSON error response.
 */
@Component
public class RateLimitingFilter extends OncePerRequestFilter {

    private final RateLimitingService rateLimitingService;

    public RateLimitingFilter(RateLimitingService rateLimitingService) {
        this.rateLimitingService = rateLimitingService;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        String path = request.getRequestURI();
        String method = request.getMethod();

        if ("POST".equalsIgnoreCase(method)) {
            String clientIp = rateLimitingService.resolveClientIp(request);

            if (path.endsWith("/api/auth/login")) {
                if (rateLimitingService.isLoginLockedOut(clientIp)) {
                    long retryAfter = rateLimitingService.getRetryAfterSeconds(
                            "login_fail:" + clientIp,
                            RateLimitingService.FAILED_LOGIN_WINDOW
                    );
                    send429Response(response, path, retryAfter,
                            "Too many failed login attempts. Account temporarily locked for " + retryAfter + " seconds.");
                    return;
                }

                if (!rateLimitingService.tryConsume("login_req:" + clientIp,
                        RateLimitingService.MAX_LOGIN_REQUESTS,
                        RateLimitingService.LOGIN_REQUEST_WINDOW)) {
                    long retryAfter = rateLimitingService.getRetryAfterSeconds(
                            "login_req:" + clientIp,
                            RateLimitingService.LOGIN_REQUEST_WINDOW
                    );
                    send429Response(response, path, retryAfter,
                            "Too many login requests. Please try again in " + retryAfter + " seconds.");
                    return;
                }

                filterChain.doFilter(request, response);

                // Track authentication outcomes
                if (response.getStatus() == HttpServletResponse.SC_UNAUTHORIZED) {
                    rateLimitingService.recordFailedLogin(clientIp);
                } else if (response.getStatus() == HttpServletResponse.SC_OK) {
                    rateLimitingService.recordSuccessfulLogin(clientIp);
                }
                return;
            }

            if (path.endsWith("/api/auth/register")) {
                if (!rateLimitingService.tryConsume("reg_req:" + clientIp,
                        RateLimitingService.MAX_REGISTER_REQUESTS,
                        RateLimitingService.REGISTER_REQUEST_WINDOW)) {
                    long retryAfter = rateLimitingService.getRetryAfterSeconds(
                            "reg_req:" + clientIp,
                            RateLimitingService.REGISTER_REQUEST_WINDOW
                    );
                    send429Response(response, path, retryAfter,
                            "Registration rate limit exceeded. Please try again in " + retryAfter + " seconds.");
                    return;
                }
            }

            if (path.endsWith("/api/auth/refresh")) {
                if (!rateLimitingService.tryConsume("refresh_req:" + clientIp,
                        RateLimitingService.MAX_REFRESH_REQUESTS,
                        RateLimitingService.REFRESH_REQUEST_WINDOW)) {
                    long retryAfter = rateLimitingService.getRetryAfterSeconds(
                            "refresh_req:" + clientIp,
                            RateLimitingService.REFRESH_REQUEST_WINDOW
                    );
                    send429Response(response, path, retryAfter,
                            "Token refresh rate limit exceeded. Please try again in " + retryAfter + " seconds.");
                    return;
                }
            }

            if (path.endsWith("/api/auth/change-password")) {
                if (!rateLimitingService.tryConsume("pwchange_req:" + clientIp,
                        RateLimitingService.MAX_PASSWORD_CHANGE_REQUESTS,
                        RateLimitingService.PASSWORD_CHANGE_WINDOW)) {
                    long retryAfter = rateLimitingService.getRetryAfterSeconds(
                            "pwchange_req:" + clientIp,
                            RateLimitingService.PASSWORD_CHANGE_WINDOW
                    );
                    send429Response(response, path, retryAfter,
                            "Password change rate limit exceeded. Please try again in " + retryAfter + " seconds.");
                    return;
                }
            }
        }

        filterChain.doFilter(request, response);
    }

    private void send429Response(
            HttpServletResponse response,
            String path,
            long retryAfterSeconds,
            String message
    ) throws IOException {
        response.setStatus(429);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setHeader("Retry-After", String.valueOf(retryAfterSeconds));

        String body = "{\"timestamp\":\"" + Instant.now().toString()
                + "\",\"status\":429,\"error\":\"TOO_MANY_REQUESTS\",\"message\":\""
                + message + "\",\"path\":\"" + path + "\"}";

        response.getWriter().write(body);
    }
}

