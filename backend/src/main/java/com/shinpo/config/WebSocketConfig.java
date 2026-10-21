package com.shinpo.config;

import com.shinpo.security.CustomUserDetailsService;
import com.shinpo.security.JwtTokenService;
import com.shinpo.security.UserPrincipal;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.core.env.Environment;
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
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Objects;

@Configuration(proxyBeanMethods = false)
@EnableWebSocketMessageBroker
@Order(Ordered.HIGHEST_PRECEDENCE + 99)
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final JwtTokenService jwtTokenService;
    private final CustomUserDetailsService userDetailsService;
    private final Environment environment;

    @Value("${shinpo.security.cors.allowed-origins:}")
    private String customAllowedOrigins = "";

    public WebSocketConfig(JwtTokenService jwtTokenService, CustomUserDetailsService userDetailsService) {
        this(jwtTokenService, userDetailsService, null);
    }

    @Autowired
    public WebSocketConfig(
            JwtTokenService jwtTokenService,
            CustomUserDetailsService userDetailsService,
            @Autowired(required = false) Environment environment
    ) {
        this.jwtTokenService = jwtTokenService;
        this.userDetailsService = userDetailsService;
        this.environment = environment;
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        boolean isProduction = false;
        if (environment != null && environment.getActiveProfiles() != null) {
            isProduction = Arrays.stream(environment.getActiveProfiles())
                    .anyMatch(p -> p.equalsIgnoreCase("prod") || p.equalsIgnoreCase("production"));
        }

        List<String> origins = new ArrayList<>(List.of(
                "http://localhost:5173",
                "http://127.0.0.1:5173",
                "http://localhost:4173",
                "http://127.0.0.1:4173",
                "http://localhost:3000",
                "http://127.0.0.1:3000",
                "tauri://localhost",
                "http://tauri.localhost",
                "https://tauri.localhost"
        ));

        if (customAllowedOrigins != null && !customAllowedOrigins.isBlank()) {
            for (String origin : customAllowedOrigins.split(",")) {
                String trimmed = origin.trim();
                if (!trimmed.isEmpty() && !origins.contains(trimmed)) {
                    origins.add(trimmed);
                }
            }
        }

        String[] originPatterns;
        if (isProduction && !origins.contains("*")) {
            originPatterns = origins.toArray(new String[0]);
        } else {
            originPatterns = new String[]{"*"};
        }

        // SockJS fallback endpoint
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns(originPatterns)
                .withSockJS();

        // Pure WebSocket endpoint for native clients (Rust, desktop, CLI)
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns(originPatterns);
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
                    } else if (StompCommand.SEND.equals(accessor.getCommand())) {
                        authorizeSend(accessor);
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
                if (jwtTokenService.isTokenBlacklisted(token)) {
                    return;
                }
                Long userId = jwtTokenService.extractUserId(token);
                Long tokenVersion = jwtTokenService.extractTokenVersion(token);
                UserDetails userDetails = userDetailsService.loadUserById(userId);

                if (userDetails instanceof UserPrincipal principal) {
                    if (tokenVersion == null || !tokenVersion.equals(principal.getTokenVersion())) {
                        return;
                    }
                }

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

    private void authorizeSend(StompHeaderAccessor accessor) {
        Principal user = accessor.getUser();
        UserPrincipal userPrincipal = null;
        if (user instanceof Authentication auth && auth.getPrincipal() instanceof UserPrincipal up) {
            userPrincipal = up;
        } else if (user instanceof UserPrincipal up) {
            userPrincipal = up;
        }

        if (userPrincipal == null) {
            throw new AccessDeniedException("Unauthenticated: SEND commands require valid authentication");
        }

        String destination = accessor.getDestination();
        if (destination == null || !destination.startsWith("/app")) {
            throw new AccessDeniedException("Forbidden: Unknown or unauthorized SEND destination: " + destination);
        }
    }

    private void authorizeSubscribe(StompHeaderAccessor accessor) {
        String destination = accessor.getDestination();
        if (destination == null || destination.isBlank()) {
            throw new AccessDeniedException("Destination required for SUBSCRIBE");
        }

        Long targetUserId = null;
        if (destination.startsWith("/topic/users/")) {
            String rest = destination.substring("/topic/users/".length());
            if (rest.isBlank()) {
                throw new AccessDeniedException("Malformed destination: target user ID missing in " + destination);
            }
            int slashIndex = rest.indexOf('/');
            String userIdStr = (slashIndex != -1) ? rest.substring(0, slashIndex) : rest;
            try {
                targetUserId = Long.parseLong(userIdStr);
                if (targetUserId <= 0) {
                    throw new AccessDeniedException("Invalid target user ID in destination: " + destination);
                }
            } catch (NumberFormatException e) {
                throw new AccessDeniedException("Malformed user ID in destination: " + destination);
            }
        } else if (destination.startsWith("/topic/user.")) {
            String rest = destination.substring("/topic/user.".length());
            if (rest.isBlank()) {
                throw new AccessDeniedException("Malformed destination: target user ID missing in " + destination);
            }
            int sepIndex = -1;
            for (int i = 0; i < rest.length(); i++) {
                char c = rest.charAt(i);
                if (c == '.' || c == '/') {
                    sepIndex = i;
                    break;
                }
            }
            String userIdStr = (sepIndex != -1) ? rest.substring(0, sepIndex) : rest;
            try {
                targetUserId = Long.parseLong(userIdStr);
                if (targetUserId <= 0) {
                    throw new AccessDeniedException("Invalid target user ID in destination: " + destination);
                }
            } catch (NumberFormatException e) {
                throw new AccessDeniedException("Malformed user ID in destination: " + destination);
            }
        } else if (destination.startsWith("/user/")) {
            // User-scoped destination, allowed only if authenticated
            Principal user = accessor.getUser();
            if (user == null) {
                throw new AccessDeniedException("Unauthenticated: subscription to /user/ requires valid authentication");
            }
            return;
        } else {
            // Deny by default: Unknown, legacy global, or unscoped destination
            throw new AccessDeniedException("Forbidden: Unknown or unauthorized SUBSCRIBE destination: " + destination);
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
