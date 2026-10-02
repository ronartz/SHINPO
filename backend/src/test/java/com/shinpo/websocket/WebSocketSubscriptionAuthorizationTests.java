package com.shinpo.websocket;

import com.shinpo.config.WebSocketConfig;
import com.shinpo.security.CustomUserDetailsService;
import com.shinpo.security.JwtTokenService;
import com.shinpo.security.UserPrincipal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.Message;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;

import java.security.Principal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@ExtendWith(MockitoExtension.class)
@ActiveProfiles("test")
public class WebSocketSubscriptionAuthorizationTests {

    @Mock
    private JwtTokenService jwtTokenService;

    @Mock
    private CustomUserDetailsService userDetailsService;

    private ChannelInterceptor interceptor;
    private UserPrincipal alicePrincipal;
    private UsernamePasswordAuthenticationToken aliceAuth;

    @BeforeEach
    void setUp() {
        WebSocketConfig config = new WebSocketConfig(jwtTokenService, userDetailsService);
        interceptor = config.createClientInboundInterceptor();

        alicePrincipal = new UserPrincipal(
                100L,
                "alice",
                "alice@shinpo.io",
                "secret_hash",
                true,
                List.of(new SimpleGrantedAuthority("ROLE_USER"))
        );
        aliceAuth = new UsernamePasswordAuthenticationToken(
                alicePrincipal,
                null,
                alicePrincipal.getAuthorities()
        );
    }

    private Message<?> createSubscribeMessage(String destination, Principal principal) {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
        if (destination != null) {
            accessor.setDestination(destination);
        }
        if (principal != null) {
            accessor.setUser(principal);
        }
        accessor.setSessionId("test-session-id");
        accessor.setSubscriptionId("sub-001");
        return MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
    }

    @Test
    @DisplayName("SUBSCRIBE: Authenticated user subscribing to own user-scoped topics is ALLOWED")
    void testAuthenticatedUser_subscribingToOwnTopic_allowed() {
        // 1. Focus session topic
        Message<?> msg1 = createSubscribeMessage("/topic/users/100/focus-session", aliceAuth);
        Message<?> result1 = interceptor.preSend(msg1, null);
        assertNotNull(result1, "Subscribing to own focus-session topic must be allowed");

        // 2. Sentinel quarantine topic
        Message<?> msg2 = createSubscribeMessage("/topic/users/100/sentinel/quarantine", aliceAuth);
        Message<?> result2 = interceptor.preSend(msg2, null);
        assertNotNull(result2, "Subscribing to own sentinel quarantine topic must be allowed");

        // 3. Sentinel status topic
        Message<?> msg3 = createSubscribeMessage("/topic/users/100/sentinel/status", aliceAuth);
        Message<?> result3 = interceptor.preSend(msg3, null);
        assertNotNull(result3, "Subscribing to own sentinel status topic must be allowed");

        // 4. Base user topic
        Message<?> msg4 = createSubscribeMessage("/topic/users/100", aliceAuth);
        Message<?> result4 = interceptor.preSend(msg4, null);
        assertNotNull(result4, "Subscribing to own base user topic must be allowed");
    }

    @Test
    @DisplayName("SUBSCRIBE: Authenticated user subscribing to another user's topic is REJECTED with AccessDeniedException")
    void testAuthenticatedUser_subscribingToOtherUserTopic_rejected() {
        // Alice (100) attempts to subscribe to Bob (200)
        Message<?> msg = createSubscribeMessage("/topic/users/200/focus-session", aliceAuth);

        AccessDeniedException ex = assertThrows(AccessDeniedException.class, () ->
                interceptor.preSend(msg, null)
        );
        assertTrue(ex.getMessage().contains("not authorized"),
                "Exception message must indicate user is not authorized");
        assertTrue(ex.getMessage().contains("100"),
                "Exception message must include caller's authenticated user ID");
    }

    @Test
    @DisplayName("SUBSCRIBE: Unauthenticated client or missing UserPrincipal subscribing to user-scoped topic is REJECTED")
    void testUnauthenticated_subscribingToUserTopic_rejected() {
        // 1. No principal at all
        Message<?> unauthMsg = createSubscribeMessage("/topic/users/100/focus-session", null);
        AccessDeniedException ex1 = assertThrows(AccessDeniedException.class, () ->
                interceptor.preSend(unauthMsg, null)
        );
        assertTrue(ex1.getMessage().contains("Unauthenticated"));

        // 2. Non-UserPrincipal authentication (e.g. String principal)
        Principal foreignPrincipal = new UsernamePasswordAuthenticationToken("anonymousUser", null);
        Message<?> nonUserPrincipalMsg = createSubscribeMessage("/topic/users/100/focus-session", foreignPrincipal);
        AccessDeniedException ex2 = assertThrows(AccessDeniedException.class, () ->
                interceptor.preSend(nonUserPrincipalMsg, null)
        );
        assertTrue(ex2.getMessage().contains("Unauthenticated"));
    }

    @Test
    @DisplayName("SUBSCRIBE: Malformed /topic/users/... destinations are safely REJECTED with AccessDeniedException")
    void testMalformedUserTopic_safelyRejected() {
        // 1. Missing user ID entirely
        Message<?> emptyIdMsg = createSubscribeMessage("/topic/users/", aliceAuth);
        assertThrows(AccessDeniedException.class, () -> interceptor.preSend(emptyIdMsg, null));

        // 2. Non-numeric user ID
        Message<?> alphaIdMsg = createSubscribeMessage("/topic/users/not-a-number/focus-session", aliceAuth);
        assertThrows(AccessDeniedException.class, () -> interceptor.preSend(alphaIdMsg, null));

        // 3. Alphanumeric user ID
        Message<?> mixedIdMsg = createSubscribeMessage("/topic/users/100abc/focus-session", aliceAuth);
        assertThrows(AccessDeniedException.class, () -> interceptor.preSend(mixedIdMsg, null));

        // 4. Negative user ID
        Message<?> negativeIdMsg = createSubscribeMessage("/topic/users/-100/focus-session", aliceAuth);
        assertThrows(AccessDeniedException.class, () -> interceptor.preSend(negativeIdMsg, null));

        // 5. Zero user ID
        Message<?> zeroIdMsg = createSubscribeMessage("/topic/users/0/focus-session", aliceAuth);
        assertThrows(AccessDeniedException.class, () -> interceptor.preSend(zeroIdMsg, null));
    }

    @Test
    @DisplayName("SUBSCRIBE: Non-user-scoped topics remain accessible without restriction")
    void testNonUserScopedTopics_remainUnchanged() {
        // 1. Global sentinel quarantine topic (no auth required)
        Message<?> globalQuarantine = createSubscribeMessage("/topic/sentinel/quarantine", null);
        Message<?> res1 = interceptor.preSend(globalQuarantine, null);
        assertNotNull(res1);

        // 2. Global focus session topic (with auth)
        Message<?> globalSession = createSubscribeMessage("/topic/focus-session", aliceAuth);
        Message<?> res2 = interceptor.preSend(globalSession, null);
        assertNotNull(res2);

        // 3. Queue destination
        Message<?> queueMsg = createSubscribeMessage("/queue/notifications", null);
        Message<?> res3 = interceptor.preSend(queueMsg, null);
        assertNotNull(res3);

        // 4. Null destination
        Message<?> nullDest = createSubscribeMessage(null, null);
        Message<?> res4 = interceptor.preSend(nullDest, null);
        assertNotNull(res4);
    }
}
