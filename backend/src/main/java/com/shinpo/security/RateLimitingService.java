package com.shinpo.security;

import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.web.util.matcher.IpAddressMatcher;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.List;

/**
 * Thread-safe sliding-window rate limiting service for authentication
 * endpoints.
 * Protects against brute-force attacks, credential stuffing, and DoS.
 * Forwarded client addresses are trusted only from configured proxy CIDRs.
 */
@Service
public class RateLimitingService {

    private static final Logger log = LoggerFactory.getLogger(RateLimitingService.class);

    // Default rate limits
    public static final int MAX_FAILED_LOGINS = 5;
    public static final Duration FAILED_LOGIN_WINDOW = Duration.ofMinutes(1);

    public static final int MAX_LOGIN_REQUESTS = 20;
    public static final Duration LOGIN_REQUEST_WINDOW = Duration.ofMinutes(1);

    public static final int MAX_REGISTER_REQUESTS = 5;
    public static final Duration REGISTER_REQUEST_WINDOW = Duration.ofMinutes(10);

    public static final int MAX_REFRESH_REQUESTS = 60;
    public static final Duration REFRESH_REQUEST_WINDOW = Duration.ofMinutes(1);

    public static final int MAX_PASSWORD_CHANGE_REQUESTS = 5;
    public static final Duration PASSWORD_CHANGE_WINDOW = Duration.ofMinutes(1);

    private static final int MAX_ENTRIES_PER_MAP = 5000;
    private final List<IpAddressMatcher> trustedProxyMatchers;

    private final Map<String, Deque<Long>> buckets = new ConcurrentHashMap<>();
    private final Map<String, Deque<Long>> failedLoginBuckets = new ConcurrentHashMap<>();
    private final Map<String, Deque<Long>> failedAccountBuckets = new ConcurrentHashMap<>();

    public RateLimitingService(@Value("${shinpo.security.rate-limit.trusted-proxies:}") String trustedProxies) {
        if (trustedProxies == null || trustedProxies.isBlank()) {
            trustedProxyMatchers = List.of();
        } else {
            List<IpAddressMatcher> matchers = new java.util.ArrayList<>();
            for (String token : trustedProxies.split(",")) {
                String trimmed = token.trim();
                if (!trimmed.isEmpty()) {
                    matchers.add(new IpAddressMatcher(trimmed));
                }
            }
            trustedProxyMatchers = List.copyOf(matchers);
        }
    }

    /**
     * Resolves the real client IP address. Forwarded headers (X-Forwarded-For,
     * X-Real-IP, CF-Connecting-IP)
     * are trusted only if the direct connection originates from a configured proxy
     * CIDR.
     * If an external client connects directly, forwarded headers are rejected to
     * prevent rate-limit evasion.
     */
    public String resolveClientIp(HttpServletRequest request) {
        if (request == null) {
            return "127.0.0.1";
        }

        String remoteAddr = request.getRemoteAddr();
        String directIp = (remoteAddr != null && !remoteAddr.isBlank()) ? remoteAddr.trim() : "127.0.0.1";
        String fallbackIp = directIp;

        // Security Hardening: Only trust headers if the direct socket is a trusted
        // proxy
        if (!isTrustedProxy(directIp)) {
            return directIp;
        }

        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded == null || forwarded.isBlank())
            return directIp;

        String[] chain = forwarded.split(",");
        for (int i = chain.length - 1; i >= 0; i--) {
            String candidate = chain[i].trim();
            if (!isValidIp(candidate))
                return fallbackIp;
            directIp = candidate;
            if (!isTrustedProxy(candidate))
                return candidate;
        }
        return directIp;
    }

    public boolean isTrustedProxy(String ip) {
        if (!isValidIp(ip))
            return false;
        String address = ip.trim();
        return trustedProxyMatchers.stream().anyMatch(matcher -> matcher.matches(address));
    }

    private boolean isValidIp(String ip) {
        if (ip == null || ip.isBlank() || "unknown".equalsIgnoreCase(ip))
            return false;
        try {
            return new IpAddressMatcher(ip.trim()).matches(ip.trim());
        } catch (IllegalArgumentException invalidAddress) {
            return false;
        }
    }

    /**
     * Checks if a request is allowed according to the sliding-window rate limit.
     * Records the request if allowed.
     */
    public synchronized boolean tryConsume(String key, int maxRequests, Duration window) {
        enforceCapacity(buckets);
        long now = Instant.now().toEpochMilli();
        long windowMillis = window.toMillis();
        long cutoff = now - windowMillis;

        Deque<Long> timestamps = buckets.computeIfAbsent(key, k -> new ArrayDeque<>());
        pruneOldTimestamps(timestamps, cutoff);

        if (timestamps.size() >= maxRequests) {
            return false;
        }

        timestamps.addLast(now);
        return true;
    }

    /**
     * Records a failed login attempt for an IP.
     */
    public synchronized void recordFailedLogin(String clientIp) {
        if (clientIp == null || clientIp.isBlank()) {
            return;
        }
        enforceCapacity(failedLoginBuckets);
        long now = Instant.now().toEpochMilli();
        Deque<Long> timestamps = failedLoginBuckets.computeIfAbsent("login_fail:" + clientIp, k -> new ArrayDeque<>());
        pruneOldTimestamps(timestamps, now - FAILED_LOGIN_WINDOW.toMillis());
        timestamps.addLast(now);
        log.warn("RATE_LIMIT: Recorded failed login attempt for IP: {}, total recent failures: {}", clientIp,
                timestamps.size());
    }

    /**
     * Resets failed login attempts for an IP on successful login.
     */
    public synchronized void recordSuccessfulLogin(String clientIp) {
        if (clientIp != null) {
            failedLoginBuckets.remove("login_fail:" + clientIp);
        }
    }

    /**
     * Checks if the IP is currently locked out due to excessive failed logins.
     */
    public synchronized boolean isLoginLockedOut(String clientIp) {
        if (clientIp == null || clientIp.isBlank()) {
            return false;
        }
        long now = Instant.now().toEpochMilli();
        Deque<Long> timestamps = failedLoginBuckets.get("login_fail:" + clientIp);
        if (timestamps == null) {
            return false;
        }
        pruneOldTimestamps(timestamps, now - FAILED_LOGIN_WINDOW.toMillis());
        return timestamps.size() >= MAX_FAILED_LOGINS;
    }

    /**
     * Records a failed login attempt for a specific account (mitigates distributed
     * brute force / password spraying).
     */
    public synchronized void recordFailedLoginForAccount(String usernameOrEmail) {
        if (usernameOrEmail == null || usernameOrEmail.isBlank()) {
            return;
        }
        enforceCapacity(failedAccountBuckets);
        String key = "login_fail_account:" + usernameOrEmail.toLowerCase().trim();
        long now = Instant.now().toEpochMilli();
        Deque<Long> timestamps = failedAccountBuckets.computeIfAbsent(key, k -> new ArrayDeque<>());
        pruneOldTimestamps(timestamps, now - FAILED_LOGIN_WINDOW.toMillis());
        timestamps.addLast(now);
        log.warn("RATE_LIMIT: Recorded failed login for account: {}, total recent failures: {}", usernameOrEmail,
                timestamps.size());
    }

    /**
     * Resets failed login attempts for an account on successful login.
     */
    public synchronized void recordSuccessfulLoginForAccount(String usernameOrEmail) {
        if (usernameOrEmail != null && !usernameOrEmail.isBlank()) {
            failedAccountBuckets.remove("login_fail_account:" + usernameOrEmail.toLowerCase().trim());
        }
    }

    /**
     * Checks if a specific account is currently locked out due to excessive failed
     * logins across any IP.
     */
    public synchronized boolean isAccountLockedOut(String usernameOrEmail) {
        if (usernameOrEmail == null || usernameOrEmail.isBlank()) {
            return false;
        }
        String key = "login_fail_account:" + usernameOrEmail.toLowerCase().trim();
        long now = Instant.now().toEpochMilli();
        Deque<Long> timestamps = failedAccountBuckets.get(key);
        if (timestamps == null) {
            return false;
        }
        pruneOldTimestamps(timestamps, now - FAILED_LOGIN_WINDOW.toMillis());
        return timestamps.size() >= MAX_FAILED_LOGINS;
    }

    /**
     * Returns remaining seconds before a blocked key can retry.
     */
    public synchronized long getRetryAfterSeconds(String key, Duration window) {
        long now = Instant.now().toEpochMilli();

        Deque<Long> timestamps = buckets.get(key);
        if (timestamps == null || timestamps.isEmpty()) {
            Deque<Long> failTimestamps = failedLoginBuckets.get(key);
            if (failTimestamps != null && !failTimestamps.isEmpty()) {
                timestamps = failTimestamps;
            } else {
                Deque<Long> accountTimestamps = failedAccountBuckets.get(key);
                if (accountTimestamps != null && !accountTimestamps.isEmpty()) {
                    timestamps = accountTimestamps;
                }
            }
        }

        if (timestamps == null || timestamps.isEmpty()) {
            return window.toSeconds();
        }

        Long oldest = timestamps.peekFirst();
        if (oldest == null) {
            return window.toSeconds();
        }

        long expiresAt = oldest + window.toMillis();
        long diff = (expiresAt - now) / 1000L;
        return Math.max(1L, diff);
    }

    private void pruneOldTimestamps(Deque<Long> timestamps, long cutoff) {
        while (!timestamps.isEmpty() && timestamps.peekFirst() < cutoff) {
            timestamps.pollFirst();
        }
    }

    private void enforceCapacity(Map<String, Deque<Long>> map) {
        if (map.size() > MAX_ENTRIES_PER_MAP) {
            long now = Instant.now().toEpochMilli();
            map.entrySet().removeIf(entry -> {
                Deque<Long> dq = entry.getValue();
                return dq.isEmpty() || (now - dq.peekLast()) > Duration.ofHours(1).toMillis();
            });
            if (map.size() > MAX_ENTRIES_PER_MAP) {
                map.clear();
            }
        }
    }

    /**
     * Clears all buckets (useful for unit/integration tests).
     */
    public synchronized void reset() {
        buckets.clear();
        failedLoginBuckets.clear();
        failedAccountBuckets.clear();
    }
}
