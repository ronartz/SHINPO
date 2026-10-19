package com.shinpo.service;

import com.shinpo.dto.ContextualFocusDtos.CompanionConnectionResponse;
import com.shinpo.dto.ContextualFocusDtos.CompanionHeartbeatRequest;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Ephemeral operational presence only. Pairing credentials stay in the native
 * host; this service stores no token and no browsing activity.
 */
@Service
public class BrowserCompanionConnectionService {

    private static final Duration HEARTBEAT_TTL = Duration.ofSeconds(35);
    private final Map<Long, ConnectionState> connections = new ConcurrentHashMap<>();

    public CompanionConnectionResponse heartbeat(Long authenticatedUserId, CompanionHeartbeatRequest request) {
        if (authenticatedUserId == null) {
            throw new IllegalArgumentException("Authenticated user is required");
        }
        Instant now = Instant.now();
        String coverage = request.adapterCoverage() == null ? "LIMITED" : request.adapterCoverage();
        connections.put(authenticatedUserId, new ConnectionState(
                request.adapterName().trim(),
                coverage,
                request.version(),
                request.platform(),
                now
        ));
        return response(connections.get(authenticatedUserId), now);
    }

    public CompanionConnectionResponse getStatus(Long authenticatedUserId) {
        Instant now = Instant.now();
        ConnectionState state = connections.get(authenticatedUserId);
        if (state == null || Duration.between(state.lastSeenAt(), now).compareTo(HEARTBEAT_TTL) > 0) {
            if (state != null) {
                connections.remove(authenticatedUserId, state);
            }
            return new CompanionConnectionResponse(
                    "DISCONNECTED",
                    "NONE",
                    null,
                    "No recent authenticated Browser Companion heartbeat",
                    state != null ? state.lastSeenAt() : null
            );
        }
        return response(state, now);
    }

    public void disconnect(Long authenticatedUserId) {
        if (authenticatedUserId != null) {
            connections.remove(authenticatedUserId);
        }
    }

    private CompanionConnectionResponse response(ConnectionState state, Instant now) {
        String detail = "Authenticated native host heartbeat"
                + optionalDetail(state.version(), " v")
                + optionalDetail(state.platform(), " on ");
        return new CompanionConnectionResponse(
                "CONNECTED",
                state.coverage(),
                state.adapterName(),
                detail,
                state.lastSeenAt()
        );
    }

    private String optionalDetail(String value, String prefix) {
        return value == null || value.isBlank() ? "" : prefix + value.trim();
    }

    private record ConnectionState(
            String adapterName,
            String coverage,
            String version,
            String platform,
            Instant lastSeenAt
    ) {}
}
