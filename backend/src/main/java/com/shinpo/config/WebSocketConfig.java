package com.shinpo.config;

import com.shinpo.security.CustomUserDetailsService;
import com.shinpo.security.JwtTokenService;
import com.shinpo.security.UserPrincipal;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

import java.security.Principal;
import java.util.Objects;

@Configuration(proxyBeanMethods = false)
@EnableWebSocketMessageBroker
@Order(Ordered.HIGHEST_PRECEDENCE + 99)
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final JwtTokenService jwtTokenService;
    private final CustomUserDetailsService userDetailsService;

    public WebSocketConfig(JwtTokenService jwtTokenService, CustomUserDetailsService userDetailsService) {
        this.jwtTokenService = jwtTokenService;
        this.userDetailsService = userDetailsService;
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // SockJS fallback endpoint
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*")
                .withSockJS();

        // Pure WebSocket endpoint for native clients (Rust, desktop, CLI)
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*");
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic", "/queue");
        registry.setApplicationDestinationPrefixes("/app");
        registry.setUserDestinationPrefix("/user");
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(createClientInboundInterceptor());
    }

    public ChannelInterceptor createClientInboundInterceptor() {
        return new ChannelInterceptor() {
            @Override
            public Message<?> preSend(Message<?> message, MessageChannel channel) {
                StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
                if (accessor != null) {
                    if (StompCommand.CONNECT.equals(accessor.getCommand())) {
                        authenticateConnect(accessor);
                    } else if (StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
                        authorizeSubscribe(accessor);
                    }
                }
                return message;
            }
        };
    }

    private void authenticateConnect(StompHeaderAccessor accessor) {
        String authHeader = accessor.getFirstNativeHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            String rawToken = accessor.getFirstNativeHeader("token");
            if (rawToken != null && !rawToken.isBlank()) {
                authHeader = "Bearer " + rawToken;
            }
        }

        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            try {
                Long userId = jwtTokenService.extractUserId(token);
                UserDetails userDetails = userDetailsService.loadUserById(userId);
                if (userDetails != null && userDetails.isEnabled()) {
                    UsernamePasswordAuthenticationToken authentication =
                            new UsernamePasswordAuthenticationToken(
                                    userDetails,
                                    null,
                                    userDetails.getAuthorities()
                            );
                    accessor.setUser(authentication);
                }
            } catch (Exception ignored) {
                // Invalid token, proceed without setting principal
            }
        }
    }

    private void authorizeSubscribe(StompHeaderAccessor accessor) {
        String destination = accessor.getDestination();
        if (destination == null || !destination.startsWith("/topic/users/")) {
            return;
        }

        String rest = destination.substring("/topic/users/".length());
        if (rest.isBlank()) {
            throw new AccessDeniedException("Malformed destination: target user ID missing in " + destination);
        }

        int slashIndex = rest.indexOf('/');
        String userIdStr = (slashIndex != -1) ? rest.substring(0, slashIndex) : rest;
        Long targetUserId;
        try {
            targetUserId = Long.parseLong(userIdStr);
            if (targetUserId <= 0) {
                throw new AccessDeniedException("Invalid target user ID in destination: " + destination);
            }
        } catch (NumberFormatException e) {
            throw new AccessDeniedException("Malformed user ID in destination: " + destination);
        }

        Principal user = accessor.getUser();
        UserPrincipal userPrincipal = null;
        if (user instanceof Authentication auth && auth.getPrincipal() instanceof UserPrincipal up) {
            userPrincipal = up;
        } else if (user instanceof UserPrincipal up) {
            userPrincipal = up;
        }

        if (userPrincipal == null) {
            throw new AccessDeniedException("Unauthenticated: subscription to user-scoped destination requires valid UserPrincipal");
        }

        if (!Objects.equals(userPrincipal.getUserId(), targetUserId)) {
            throw new AccessDeniedException("Forbidden: User " + userPrincipal.getUserId()
                    + " is not authorized to subscribe to " + destination);
        }
    }
}
