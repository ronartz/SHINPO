package com.shinpo.security;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.mock;

class JwtAuthenticationFilterTests {

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void unauthenticatedRequestDoesNotInheritAuthenticationFromReusedServerThread() throws Exception {
        var filter = new JwtAuthenticationFilter(mock(JwtTokenService.class), mock(CustomUserDetailsService.class));
        SecurityContextHolder.getContext().setAuthentication(
                UsernamePasswordAuthenticationToken.authenticated("previous-request", null, List.of())
        );
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = (req, res) -> assertNull(SecurityContextHolder.getContext().getAuthentication());

        filter.doFilter(request, response, chain);
    }
}
