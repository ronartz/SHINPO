package com.shinpo.security;

import com.auth0.jwt.exceptions.JWTVerificationException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(JwtAuthenticationFilter.class);

    private final JwtTokenService jwtTokenService;
    private final CustomUserDetailsService userDetailsService;

    public JwtAuthenticationFilter(JwtTokenService jwtTokenService, CustomUserDetailsService userDetailsService) {
        this.jwtTokenService = jwtTokenService;
        this.userDetailsService = userDetailsService;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        String token = resolveToken(request);

        if (StringUtils.hasText(token)) {
            try {
                if (jwtTokenService.isTokenBlacklisted(token)) {
                    log.warn("Authentication rejected: access token has been explicitly revoked / blacklisted");
                    filterChain.doFilter(request, response);
                    return;
                }

                Long userId = jwtTokenService.extractUserId(token);
                Long tokenVersion = jwtTokenService.extractTokenVersion(token);
                UserDetails userDetails = userDetailsService.loadUserById(userId);

                if (userDetails instanceof UserPrincipal principal) {
                    if (tokenVersion == null || !tokenVersion.equals(principal.getTokenVersion())) {
                        log.warn("Authentication rejected: access token version mismatch for user ID: {} (tokenVersion={}, currentVersion={})",
                                userId, tokenVersion, principal.getTokenVersion());
                        filterChain.doFilter(request, response);
                        return;
                    }
                }

                if (userDetails.isEnabled()) {
                    UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                            userDetails,
                            null,
                            userDetails.getAuthorities()
                    );
                    authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                } else {
                    log.warn("Authentication rejected for inactive user ID: {}", userId);
                }
            } catch (JWTVerificationException ex) {
                log.debug("JWT verification failed: {}", ex.getMessage());
            } catch (Exception ex) {
                log.error("Could not set user authentication in security context", ex);
            }
        }

        filterChain.doFilter(request, response);
    }

    private String resolveToken(HttpServletRequest request) {
        String bearerToken = request.getHeader("Authorization");
        if (StringUtils.hasText(bearerToken) && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7);
        }
        return null;
    }
}
