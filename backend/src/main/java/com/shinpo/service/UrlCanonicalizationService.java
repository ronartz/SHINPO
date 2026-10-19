package com.shinpo.service;

import com.shinpo.entity.ContextualFocusResource;
import com.shinpo.entity.ContextualResourceMatchType;
import com.shinpo.entity.ContextualResourceType;
import org.springframework.stereotype.Service;

import java.net.IDN;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Pure, deterministic canonicalization and matching. It never follows a
 * redirect and never performs a network lookup.
 */
@Service
public class UrlCanonicalizationService {

    private static final Pattern YOUTUBE_ID = Pattern.compile("[A-Za-z0-9_-]{11}");
    private static final Pattern YOUTUBE_PLAYLIST_ID = Pattern.compile("[A-Za-z0-9_-]{10,80}");
    private static final Pattern DISCORD_CHANNEL_PATH = Pattern.compile("^/channels/(\\d{5,30})/(\\d{5,30})(?:/.*)?$");
    private static final Pattern PROCESS_PATTERN = Pattern.compile("[a-z0-9._+ -]{1,150}");

    public record DestinationDescriptor(
            String canonicalUrl,
            URI uri,
            String host,
            int port,
            String youtubeVideoId,
            String youtubePlaylistId,
            String discordChannelKey
    ) {}

    public String canonicalizeRule(
            ContextualResourceType resourceType,
            ContextualResourceMatchType matchType,
            String destination
    ) {
        if (resourceType == null || matchType == null) {
            throw new IllegalArgumentException("Resource type and match type are required");
        }
        if (destination == null || destination.isBlank()) {
            throw new IllegalArgumentException("Destination cannot be blank");
        }

        return switch (resourceType) {
            case WEBSITE -> switch (matchType) {
                case EXACT -> canonicalizeWebUrl(destination);
                case DOMAIN -> canonicalizeDomain(destination);
                case URL_PATTERN -> canonicalizeUrlPattern(destination);
                default -> throw invalidCombination(resourceType, matchType);
            };
            case YOUTUBE_VIDEO -> {
                requireMatch(resourceType, matchType, ContextualResourceMatchType.EXACT);
                yield "youtube:video:" + extractYoutubeVideoId(destination);
            }
            case YOUTUBE_PLAYLIST -> {
                requireMatch(resourceType, matchType, ContextualResourceMatchType.EXACT);
                yield "youtube:playlist:" + extractYoutubePlaylistId(destination);
            }
            case DISCORD_CHANNEL -> {
                requireMatch(resourceType, matchType, ContextualResourceMatchType.BROWSER_CHANNEL);
                yield "discord:channel:" + extractDiscordChannelKey(destination);
            }
            case TEMPORARY_SITE -> {
                requireMatch(resourceType, matchType, ContextualResourceMatchType.EXACT);
                yield canonicalizeWebUrl(destination);
            }
            case DESKTOP_PROCESS -> {
                requireMatch(resourceType, matchType, ContextualResourceMatchType.PROCESS);
                yield canonicalizeProcess(destination);
            }
        };
    }

    public DestinationDescriptor analyzeDestination(String destination) {
        String canonical = canonicalizeWebUrl(destination);
        URI uri = URI.create(canonical);
        String host = normalizeHost(uri.getHost());
        String videoId = null;
        String playlistId = null;
        String discordKey = null;

        if (isYoutubeHost(host)) {
            videoId = tryExtractYoutubeVideo(uri);
            playlistId = validatedQueryValue(uri, "list", YOUTUBE_PLAYLIST_ID);
        }
        if (isYoutubeShortHost(host)) {
            String path = uri.getPath();
            if (path != null && path.length() > 1) {
                String candidate = path.substring(1).split("/", 2)[0];
                videoId = YOUTUBE_ID.matcher(candidate).matches() ? candidate : null;
            }
        }
        if (isDiscordHost(host)) {
            Matcher matcher = DISCORD_CHANNEL_PATH.matcher(uri.getPath() == null ? "" : uri.getPath());
            if (matcher.matches()) {
                discordKey = matcher.group(1) + "/" + matcher.group(2);
            }
        }

        return new DestinationDescriptor(
                canonical,
                uri,
                host,
                uri.getPort(),
                videoId,
                playlistId,
                discordKey
        );
    }

    public boolean matches(ContextualFocusResource resource, DestinationDescriptor destination) {
        if (resource == null || destination == null || resource.getResourceType() == ContextualResourceType.DESKTOP_PROCESS) {
            return false;
        }
        String rule = resource.getCanonicalDestination();
        return switch (resource.getResourceType()) {
            case TEMPORARY_SITE -> rule.equals(destination.canonicalUrl());
            case YOUTUBE_VIDEO -> rule.equals("youtube:video:" + nullToEmpty(destination.youtubeVideoId()));
            case YOUTUBE_PLAYLIST -> rule.equals("youtube:playlist:" + nullToEmpty(destination.youtubePlaylistId()));
            case DISCORD_CHANNEL -> rule.equals("discord:channel:" + nullToEmpty(destination.discordChannelKey()));
            case WEBSITE -> switch (resource.getMatchType()) {
                case EXACT -> rule.equals(destination.canonicalUrl());
                case DOMAIN -> domainMatches(rule, destination);
                case URL_PATTERN -> urlPatternMatches(rule, destination.canonicalUrl());
                default -> false;
            };
            case DESKTOP_PROCESS -> false;
        };
    }

    public int specificity(ContextualFocusResource resource) {
        if (resource.getResourceType() == ContextualResourceType.TEMPORARY_SITE) {
            return 100;
        }
        return switch (resource.getMatchType()) {
            case EXACT, BROWSER_CHANNEL -> 90;
            case URL_PATTERN -> 70;
            case DOMAIN -> 50;
            case PROCESS -> 0;
        };
    }

    public boolean isBrowserInternalDestination(String destination) {
        if (destination == null || destination.isBlank()) {
            return false;
        }
        try {
            URI uri = URI.create(destination.trim());
            String scheme = uri.getScheme();
            return scheme != null
                    && !"http".equalsIgnoreCase(scheme)
                    && !"https".equalsIgnoreCase(scheme);
        } catch (IllegalArgumentException ignored) {
            return false;
        }
    }

    public boolean isYoutubeDestination(DestinationDescriptor descriptor) {
        return descriptor != null && (isYoutubeHost(descriptor.host()) || isYoutubeShortHost(descriptor.host()));
    }

    public boolean isYoutubeShorts(DestinationDescriptor descriptor) {
        return isYoutubeDestination(descriptor)
                && descriptor.uri().getPath() != null
                && descriptor.uri().getPath().startsWith("/shorts/");
    }

    public boolean isYoutubeHome(DestinationDescriptor descriptor) {
        if (!isYoutubeDestination(descriptor)) {
            return false;
        }
        String path = descriptor.uri().getPath();
        return path == null || path.isBlank() || "/".equals(path);
    }

    public String safeReturnUrl(ContextualFocusResource resource) {
        if (resource == null) {
            return null;
        }
        return switch (resource.getResourceType()) {
            case YOUTUBE_VIDEO -> "https://www.youtube.com/watch?v="
                    + resource.getCanonicalDestination().substring("youtube:video:".length());
            case YOUTUBE_PLAYLIST -> "https://www.youtube.com/playlist?list="
                    + resource.getCanonicalDestination().substring("youtube:playlist:".length());
            case DISCORD_CHANNEL -> "https://discord.com/channels/"
                    + resource.getCanonicalDestination().substring("discord:channel:".length());
            case WEBSITE, TEMPORARY_SITE -> {
                if (resource.getMatchType() == ContextualResourceMatchType.DOMAIN) {
                    yield "https://" + resource.getCanonicalDestination() + "/";
                }
                if (resource.getMatchType() == ContextualResourceMatchType.URL_PATTERN) {
                    yield resource.getCanonicalDestination().substring(
                            0,
                            resource.getCanonicalDestination().length() - 1
                    );
                }
                yield resource.getCanonicalDestination();
            }
            case DESKTOP_PROCESS -> null;
        };
    }

    public String canonicalizeWebUrl(String raw) {
        URI uri = parseWebUri(raw);
        String scheme = uri.getScheme().toLowerCase(Locale.ROOT);
        HostAndPort hostAndPort = extractHostAndPort(uri);
        int port = hostAndPort.port();
        if (("http".equals(scheme) && port == 80) || ("https".equals(scheme) && port == 443)) {
            port = -1;
        }

        String path = uri.getRawPath();
        path = (path == null || path.isEmpty()) ? "/" : normalizePath(path);
        String query = normalizeQuery(uri.getRawQuery());
        String authority = formatHost(hostAndPort.host()) + (port >= 0 ? ":" + port : "");
        return scheme + "://" + authority + path + (query == null ? "" : "?" + query);
    }

    private String canonicalizeDomain(String raw) {
        String value = raw.trim();
        URI uri = parseWebUri(value.contains("://") ? value : "https://" + value);
        if ((uri.getRawPath() != null && !uri.getRawPath().isBlank() && !"/".equals(uri.getRawPath()))
                || uri.getRawQuery() != null || uri.getRawFragment() != null) {
            throw new IllegalArgumentException("A domain rule cannot contain a path, query, or fragment");
        }
        HostAndPort hostAndPort = extractHostAndPort(uri);
        int port = hostAndPort.port();
        String scheme = uri.getScheme().toLowerCase(Locale.ROOT);
        if (("http".equals(scheme) && port == 80) || ("https".equals(scheme) && port == 443)) {
            port = -1;
        }
        return formatHost(hostAndPort.host()) + (port >= 0 ? ":" + port : "");
    }

    private String canonicalizeUrlPattern(String raw) {
        String value = raw.trim();
        int firstWildcard = value.indexOf('*');
        if (firstWildcard < 0) {
            return canonicalizeWebUrl(value);
        }
        if (!value.substring(firstWildcard).matches("\\*{1,2}")) {
            throw new IllegalArgumentException("URL patterns support only a trailing * or ** wildcard");
        }
        String prefix = value.substring(0, firstWildcard);
        if (prefix.isBlank()) {
            throw new IllegalArgumentException("URL pattern requires an absolute HTTP(S) prefix");
        }
        return canonicalizeWebUrl(prefix) + "*";
    }

    private String extractYoutubeVideoId(String value) {
        String candidate = value.trim();
        if (YOUTUBE_ID.matcher(candidate).matches()) {
            return candidate;
        }
        DestinationDescriptor descriptor = analyzeDestination(candidate);
        if (descriptor.youtubeVideoId() == null) {
            throw new IllegalArgumentException("Destination is not a valid YouTube video URL or ID");
        }
        return descriptor.youtubeVideoId();
    }

    private String extractYoutubePlaylistId(String value) {
        String candidate = value.trim();
        if (YOUTUBE_PLAYLIST_ID.matcher(candidate).matches() && !candidate.contains("://")) {
            return candidate;
        }
        DestinationDescriptor descriptor = analyzeDestination(candidate);
        if (descriptor.youtubePlaylistId() == null) {
            throw new IllegalArgumentException("Destination is not a valid YouTube playlist URL or ID");
        }
        return descriptor.youtubePlaylistId();
    }

    private String extractDiscordChannelKey(String value) {
        String candidate = value.trim();
        if (candidate.matches("\\d{5,30}/\\d{5,30}")) {
            return candidate;
        }
        DestinationDescriptor descriptor = analyzeDestination(candidate);
        if (descriptor.discordChannelKey() == null) {
            throw new IllegalArgumentException("Destination is not a valid Discord server/channel route");
        }
        return descriptor.discordChannelKey();
    }

    private String canonicalizeProcess(String value) {
        String pattern = value.trim().toLowerCase(Locale.ROOT);
        if (!PROCESS_PATTERN.matcher(pattern).matches()) {
            throw new IllegalArgumentException("Desktop process pattern contains unsupported characters or is too long");
        }
        return pattern;
    }

    private URI parseWebUri(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new IllegalArgumentException("Destination cannot be blank");
        }
        try {
            URI uri = new URI(raw.trim());
            String scheme = uri.getScheme();
            if (scheme == null || !(scheme.equalsIgnoreCase("http") || scheme.equalsIgnoreCase("https"))) {
                throw new IllegalArgumentException("Destination must use HTTP or HTTPS");
            }
            if (uri.getRawAuthority() == null || uri.getRawAuthority().isBlank()) {
                throw new IllegalArgumentException("Destination must include a hostname");
            }
            if (uri.getRawUserInfo() != null || uri.getRawAuthority().contains("@")) {
                throw new IllegalArgumentException("Destination URLs cannot contain user credentials");
            }
            extractHostAndPort(uri);
            return uri;
        } catch (URISyntaxException exception) {
            throw new IllegalArgumentException("Destination is not a valid URL", exception);
        }
    }

    private HostAndPort extractHostAndPort(URI uri) {
        String host = uri.getHost();
        int port = uri.getPort();
        if (host != null) {
            return new HostAndPort(normalizeHost(host), port);
        }

        String authority = uri.getRawAuthority();
        if (authority == null || authority.isBlank() || authority.contains("@")) {
            throw new IllegalArgumentException("Destination must include a valid hostname");
        }
        if (authority.startsWith("[")) {
            int closing = authority.indexOf(']');
            if (closing < 0) {
                throw new IllegalArgumentException("Invalid IPv6 hostname");
            }
            host = authority.substring(1, closing);
            String remainder = authority.substring(closing + 1);
            if (!remainder.isEmpty()) {
                if (!remainder.matches(":\\d{1,5}")) {
                    throw new IllegalArgumentException("Invalid destination port");
                }
                port = parsePort(remainder.substring(1));
            }
            return new HostAndPort(normalizeHost(host), port);
        }

        int colon = authority.lastIndexOf(':');
        if (colon >= 0) {
            if (authority.indexOf(':') != colon) {
                throw new IllegalArgumentException("IPv6 hostnames must use brackets");
            }
            String portPart = authority.substring(colon + 1);
            if (!portPart.matches("\\d{1,5}")) {
                throw new IllegalArgumentException("Invalid destination port");
            }
            port = parsePort(portPart);
            authority = authority.substring(0, colon);
        }
        return new HostAndPort(normalizeHost(authority), port);
    }

    private String normalizeHost(String host) {
        if (host == null || host.isBlank()) {
            throw new IllegalArgumentException("Destination must include a valid hostname");
        }
        String value = host.trim();
        if (value.startsWith("[") && value.endsWith("]")) {
            value = value.substring(1, value.length() - 1);
        }
        while (value.endsWith(".")) {
            value = value.substring(0, value.length() - 1);
        }
        if (value.contains(":")) {
            return value.toLowerCase(Locale.ROOT);
        }
        try {
            return IDN.toASCII(value, IDN.USE_STD3_ASCII_RULES).toLowerCase(Locale.ROOT);
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("Destination contains an invalid hostname", exception);
        }
    }

    private String formatHost(String host) {
        return host.contains(":") ? "[" + host + "]" : host;
    }

    private int parsePort(String rawPort) {
        try {
            int port = Integer.parseInt(rawPort);
            if (port < 1 || port > 65535) {
                throw new IllegalArgumentException("Destination port must be between 1 and 65535");
            }
            return port;
        } catch (NumberFormatException exception) {
            throw new IllegalArgumentException("Invalid destination port", exception);
        }
    }

    private String normalizePath(String rawPath) {
        String normalizedPercent = normalizePercentEncoding(rawPath);
        try {
            return URI.create("https://canonical.invalid" + normalizedPercent)
                    .normalize()
                    .getRawPath();
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("Destination contains an invalid path", exception);
        }
    }

    private String normalizeQuery(String rawQuery) {
        if (rawQuery == null) {
            return null;
        }
        if (rawQuery.isEmpty()) {
            return "";
        }
        List<String> parts = new ArrayList<>(Arrays.asList(normalizePercentEncoding(rawQuery).split("&", -1)));
        Collections.sort(parts);
        return String.join("&", parts);
    }

    private String normalizePercentEncoding(String raw) {
        StringBuilder result = new StringBuilder(raw.length());
        for (int i = 0; i < raw.length(); i++) {
            char current = raw.charAt(i);
            if (current == '%' && i + 2 < raw.length()
                    && isHex(raw.charAt(i + 1)) && isHex(raw.charAt(i + 2))) {
                int value = Integer.parseInt(raw.substring(i + 1, i + 3), 16);
                char decoded = (char) value;
                if (isUnreserved(decoded)) {
                    result.append(decoded);
                } else {
                    result.append('%')
                            .append(Character.toUpperCase(raw.charAt(i + 1)))
                            .append(Character.toUpperCase(raw.charAt(i + 2)));
                }
                i += 2;
            } else {
                result.append(current);
            }
        }
        return result.toString();
    }

    private boolean domainMatches(String rawRule, DestinationDescriptor destination) {
        HostAndPort rule = parseCanonicalDomain(rawRule);
        if (rule.port() >= 0 && rule.port() != destination.port()) {
            return false;
        }
        return destination.host().equals(rule.host())
                || (!rule.host().contains(":") && destination.host().endsWith("." + rule.host()));
    }

    private HostAndPort parseCanonicalDomain(String rule) {
        if (rule.startsWith("[")) {
            int end = rule.indexOf(']');
            if (end < 0) {
                throw new IllegalArgumentException("Invalid canonical domain");
            }
            int port = rule.length() > end + 1 ? parsePort(rule.substring(end + 2)) : -1;
            return new HostAndPort(rule.substring(1, end), port);
        }
        int colon = rule.lastIndexOf(':');
        return colon > 0
                ? new HostAndPort(rule.substring(0, colon), parsePort(rule.substring(colon + 1)))
                : new HostAndPort(rule, -1);
    }

    private boolean urlPatternMatches(String rule, String canonicalUrl) {
        if (!rule.endsWith("*")) {
            return rule.equals(canonicalUrl);
        }
        return canonicalUrl.startsWith(rule.substring(0, rule.length() - 1));
    }

    private String tryExtractYoutubeVideo(URI uri) {
        String path = uri.getPath() == null ? "" : uri.getPath();
        if ("/watch".equals(path)) {
            return validatedQueryValue(uri, "v", YOUTUBE_ID);
        }
        for (String prefix : List.of("/shorts/", "/embed/", "/live/")) {
            if (path.startsWith(prefix)) {
                String candidate = path.substring(prefix.length()).split("/", 2)[0];
                return YOUTUBE_ID.matcher(candidate).matches() ? candidate : null;
            }
        }
        return null;
    }

    private String validatedQueryValue(URI uri, String key, Pattern validation) {
        String value = queryValue(uri.getRawQuery(), key);
        return value != null && validation.matcher(value).matches() ? value : null;
    }

    private String queryValue(String rawQuery, String expectedKey) {
        if (rawQuery == null) {
            return null;
        }
        for (String pair : rawQuery.split("&")) {
            String[] pieces = pair.split("=", 2);
            String key = URLDecoder.decode(pieces[0], StandardCharsets.UTF_8);
            if (expectedKey.equals(key) && pieces.length == 2) {
                return URLDecoder.decode(pieces[1], StandardCharsets.UTF_8);
            }
        }
        return null;
    }

    private boolean isYoutubeHost(String host) {
        return host.equals("youtube.com")
                || host.endsWith(".youtube.com")
                || host.equals("youtube-nocookie.com")
                || host.endsWith(".youtube-nocookie.com");
    }

    private boolean isYoutubeShortHost(String host) {
        return host.equals("youtu.be") || host.endsWith(".youtu.be");
    }

    private boolean isDiscordHost(String host) {
        return host.equals("discord.com")
                || host.endsWith(".discord.com")
                || host.equals("discordapp.com")
                || host.endsWith(".discordapp.com");
    }

    private boolean isHex(char value) {
        return (value >= '0' && value <= '9')
                || (value >= 'a' && value <= 'f')
                || (value >= 'A' && value <= 'F');
    }

    private boolean isUnreserved(char value) {
        return (value >= 'a' && value <= 'z')
                || (value >= 'A' && value <= 'Z')
                || (value >= '0' && value <= '9')
                || value == '-' || value == '.' || value == '_' || value == '~';
    }

    private void requireMatch(
            ContextualResourceType resourceType,
            ContextualResourceMatchType actual,
            ContextualResourceMatchType expected
    ) {
        if (actual != expected) {
            throw invalidCombination(resourceType, actual);
        }
    }

    private IllegalArgumentException invalidCombination(
            ContextualResourceType resourceType,
            ContextualResourceMatchType matchType
    ) {
        return new IllegalArgumentException("Unsupported match type " + matchType + " for " + resourceType);
    }

    private String nullToEmpty(String value) {
        return value == null ? "" : value;
    }

    private record HostAndPort(String host, int port) {}
}
