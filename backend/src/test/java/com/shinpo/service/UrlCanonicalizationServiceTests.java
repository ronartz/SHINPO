package com.shinpo.service;

import com.shinpo.entity.ContextualFocusResource;
import com.shinpo.entity.ContextualResourceMatchType;
import com.shinpo.entity.ContextualResourceType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class UrlCanonicalizationServiceTests {

    private UrlCanonicalizationService service;

    @BeforeEach
    void setUp() {
        service = new UrlCanonicalizationService();
    }

    @Test
    @DisplayName("Canonical URLs normalize host, default port, dot segments, query order, and fragment")
    void canonicalizesWebUrlDeterministically() {
        String canonical = service.canonicalizeWebUrl(
                "HTTPS://YouTube.COM:443/a/../watch?z=2&v=dQw4w9WgXcQ#comments"
        );

        assertEquals("https://youtube.com/watch?v=dQw4w9WgXcQ&z=2", canonical);
    }

    @Test
    @DisplayName("Unicode hostnames become stable ASCII IDNs and credentials are rejected")
    void canonicalizesInternationalHostWithoutAllowingCredentials() {
        assertEquals(
                "https://xn--bcher-kva.example/",
                service.canonicalizeWebUrl("https://BÜCHER.example")
        );
        assertThrows(IllegalArgumentException.class,
                () -> service.canonicalizeWebUrl("https://youtube.com@evil.example/watch?v=dQw4w9WgXcQ"));
    }

    @Test
    @DisplayName("YouTube IDs are stable but lookalike hosts never match")
    void extractsYoutubeIdentifiersSafely() {
        assertEquals(
                "youtube:video:dQw4w9WgXcQ",
                service.canonicalizeRule(
                        ContextualResourceType.YOUTUBE_VIDEO,
                        ContextualResourceMatchType.EXACT,
                        "https://www.youtube.com/watch?feature=share&v=dQw4w9WgXcQ"
                )
        );
        assertEquals(
                "youtube:playlist:PL1234567890",
                service.canonicalizeRule(
                        ContextualResourceType.YOUTUBE_PLAYLIST,
                        ContextualResourceMatchType.EXACT,
                        "https://youtube.com/playlist?list=PL1234567890"
                )
        );
        assertThrows(IllegalArgumentException.class, () -> service.canonicalizeRule(
                ContextualResourceType.YOUTUBE_VIDEO,
                ContextualResourceMatchType.EXACT,
                "https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ"
        ));
    }

    @Test
    @DisplayName("Discord matching stores only validated server/channel identifiers")
    void validatesDiscordChannelRoutes() {
        assertEquals(
                "discord:channel:12345678901234567/98765432109876543",
                service.canonicalizeRule(
                        ContextualResourceType.DISCORD_CHANNEL,
                        ContextualResourceMatchType.BROWSER_CHANNEL,
                        "https://discord.com/channels/12345678901234567/98765432109876543"
                )
        );
        assertThrows(IllegalArgumentException.class, () -> service.canonicalizeRule(
                ContextualResourceType.DISCORD_CHANNEL,
                ContextualResourceMatchType.BROWSER_CHANNEL,
                "https://discord.com.evil.example/channels/12345678901234567/98765432109876543"
        ));
        assertThrows(IllegalArgumentException.class, () -> service.canonicalizeRule(
                ContextualResourceType.DISCORD_CHANNEL,
                ContextualResourceMatchType.BROWSER_CHANNEL,
                "https://discord.com/channels/@me/98765432109876543"
        ));
    }

    @Test
    @DisplayName("Domain matching observes hostname boundaries and optional ports")
    void domainMatchingCannotBeSpoofedBySubstring() {
        ContextualFocusResource domain = websiteRule(
                ContextualResourceMatchType.DOMAIN,
                service.canonicalizeRule(
                        ContextualResourceType.WEBSITE,
                        ContextualResourceMatchType.DOMAIN,
                        "https://example.com"
                )
        );
        assertTrue(service.matches(domain, service.analyzeDestination("https://docs.example.com/guide")));
        assertFalse(service.matches(domain, service.analyzeDestination("https://example.com.evil.test/guide")));

        ContextualFocusResource portSpecific = websiteRule(
                ContextualResourceMatchType.DOMAIN,
                service.canonicalizeRule(
                        ContextualResourceType.WEBSITE,
                        ContextualResourceMatchType.DOMAIN,
                        "https://example.com:8443"
                )
        );
        assertTrue(service.matches(portSpecific, service.analyzeDestination("https://example.com:8443/docs")));
        assertFalse(service.matches(portSpecific, service.analyzeDestination("https://example.com/docs")));
    }

    @Test
    @DisplayName("URL patterns permit bounded trailing wildcards, never arbitrary regex-like matching")
    void validatesUrlPatterns() {
        ContextualFocusResource pattern = websiteRule(
                ContextualResourceMatchType.URL_PATTERN,
                service.canonicalizeRule(
                        ContextualResourceType.WEBSITE,
                        ContextualResourceMatchType.URL_PATTERN,
                        "https://docs.spring.io/security/**"
                )
        );
        assertTrue(service.matches(pattern, service.analyzeDestination("https://docs.spring.io/security/reference")));
        assertFalse(service.matches(pattern, service.analyzeDestination("https://docs.spring.io/data/reference")));
        assertThrows(IllegalArgumentException.class, () -> service.canonicalizeRule(
                ContextualResourceType.WEBSITE,
                ContextualResourceMatchType.URL_PATTERN,
                "https://*.spring.io/security/*"
        ));
    }

    @Test
    @DisplayName("Encoded dot segments and percent encodings cannot create canonical aliases")
    void normalizesEncodedPaths() {
        assertEquals(
                "https://example.com/docs/~intro",
                service.canonicalizeWebUrl("https://example.com/a/%2E%2e/docs/%7eintro")
        );
        assertEquals(
                "https://example.com/a%2Fb",
                service.canonicalizeWebUrl("https://example.com/a%2fb")
        );
    }

    @Test
    @DisplayName("Browser-internal schemes stay outside contextual content enforcement")
    void detectsInternalSchemes() {
        assertTrue(service.isBrowserInternalDestination("chrome://settings/privacy"));
        assertTrue(service.isBrowserInternalDestination("moz-extension://abc/options.html"));
        assertFalse(service.isBrowserInternalDestination("https://example.com"));
    }

    private ContextualFocusResource websiteRule(ContextualResourceMatchType matchType, String canonical) {
        ContextualFocusResource resource = new ContextualFocusResource();
        resource.setResourceType(ContextualResourceType.WEBSITE);
        resource.setMatchType(matchType);
        resource.setCanonicalDestination(canonical);
        return resource;
    }
}
