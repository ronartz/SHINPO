package com.shinpo.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.time.Instant;

@Component
public class JwtAccessDeniedHandler implements AccessDeniedHandler {

    @Override
    public void handle(
            HttpServletRequest request,
            HttpServletResponse response,
            AccessDeniedException accessDeniedException
    ) throws IOException {
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        String timestamp = Instant.now().toString();
        String path = request.getRequestURI();
        response.getWriter().write("{\"timestamp\":\"" + timestamp
                + "\",\"status\":403,\"error\":\"FORBIDDEN\",\"message\":\"Access is denied.\",\"path\":\""
                + path + "\"}");
    }
}
