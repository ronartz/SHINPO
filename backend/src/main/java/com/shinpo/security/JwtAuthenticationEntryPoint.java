package com.shinpo.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.time.Instant;

@Component
public class JwtAuthenticationEntryPoint implements AuthenticationEntryPoint {

    @Override
    public void commence(
            HttpServletRequest request,
            HttpServletResponse response,
            AuthenticationException authException
    ) throws IOException {
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        String timestamp = Instant.now().toString();
        String path = request.getRequestURI();
        response.getWriter().write("{\"timestamp\":\"" + timestamp
                + "\",\"status\":401,\"error\":\"UNAUTHORIZED\",\"message\":\"Full authentication is required to access this resource.\",\"path\":\""
                + path + "\"}");
    }
}
