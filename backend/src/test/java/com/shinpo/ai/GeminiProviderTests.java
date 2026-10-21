package com.shinpo.ai;

import com.shinpo.ai.config.AiProperties;
import com.shinpo.ai.provider.AiProviderRequest;
import com.shinpo.ai.provider.AiProviderResponse;
import com.shinpo.ai.provider.GeminiProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;
import tools.jackson.databind.ObjectMapper;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class GeminiProviderTests {

    private AiProperties aiProperties;
    private ObjectMapper objectMapper;
    private RestTemplate restTemplate;
    private MockRestServiceServer mockServer;
    private GeminiProvider geminiProvider;

    @BeforeEach
    void setUp() {
        aiProperties = new AiProperties();
        aiProperties.getGemini().setApiKey("test-api-key");
        aiProperties.getGemini().setModel("gemini-2.5-flash");
        objectMapper = new ObjectMapper();
        restTemplate = new RestTemplate();
        mockServer = MockRestServiceServer.createServer(restTemplate);
        geminiProvider = new GeminiProvider(aiProperties, objectMapper, restTemplate);
    }

    @Test
    @DisplayName("isAvailable() returns false when API key is blank")
    void isAvailable_NoApiKey_ReturnsFalse() {
        aiProperties.getGemini().setApiKey("");
        assertFalse(geminiProvider.isAvailable());

        aiProperties.getGemini().setApiKey(null);
        assertFalse(geminiProvider.isAvailable());
    }

    @Test
    @DisplayName("isAvailable() returns true when API models endpoint responds 200 with x-goog-api-key header")
    void isAvailable_ValidProbe_ReturnsTrue() {
        mockServer.expect(requestTo("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1"))
                .andExpect(method(HttpMethod.GET))
                .andExpect(header("x-goog-api-key", "test-api-key"))
                .andRespond(withSuccess("{\"models\":[]}", MediaType.APPLICATION_JSON));

        assertTrue(geminiProvider.isAvailable());
        mockServer.verify();
    }

    @Test
    @DisplayName("isAvailable() returns false when probe fails")
    void isAvailable_ProbeFails_ReturnsFalse() {
        mockServer.expect(requestTo("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1"))
                .andExpect(method(HttpMethod.GET))
                .andExpect(header("x-goog-api-key", "test-api-key"))
                .andRespond(withStatus(HttpStatus.UNAUTHORIZED));

        assertFalse(geminiProvider.isAvailable());
        mockServer.verify();
    }

    @Test
    @DisplayName("generate() successfully extracts text from valid Gemini response with secure header auth")
    void generate_Success() {
        String geminiResponseJson = """
                {
                  "candidates": [
                    {
                      "content": {
                        "parts": [
                          {
                            "text": "{\\"reply\\": \\"Focus on completing your high-priority mission.\\", \\"suggestionType\\": \\"TACTICAL_ASSISTANT\\"}"
                          }
                        ],
                        "role": "model"
                      },
                      "finishReason": "STOP"
                    }
                  ]
                }
                """;

        mockServer.expect(requestTo("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("x-goog-api-key", "test-api-key"))
                .andExpect(jsonPath("$.contents[0].parts[0].text").exists())
                .andExpect(jsonPath("$.generationConfig.responseMimeType").value("application/json"))
                .andRespond(withSuccess(geminiResponseJson, MediaType.APPLICATION_JSON));

        AiProviderRequest req = AiProviderRequest.of("System instruction", "What should I do?", Map.of());
        AiProviderResponse res = geminiProvider.generate(req);

        assertTrue(res.successful());
        assertEquals("gemini", res.provider());
        assertEquals("gemini-2.5-flash", res.model());
        assertNotNull(res.content());
        assertTrue(res.content().contains("Focus on completing"));
        mockServer.verify();
    }

    @Test
    @DisplayName("generate() fails gracefully when API key is missing")
    void generate_MissingApiKey() {
        aiProperties.getGemini().setApiKey(null);
        AiProviderRequest req = AiProviderRequest.of("Sys", "User", Map.of());
        AiProviderResponse res = geminiProvider.generate(req);

        assertFalse(res.successful());
        assertTrue(res.errorMessage().contains("Gemini API key not configured"));
    }

    @Test
    @DisplayName("generate() fails gracefully on API error (e.g. 429 rate limit)")
    void generate_RateLimitOrError() {
        mockServer.expect(requestTo("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("x-goog-api-key", "test-api-key"))
                .andRespond(withStatus(HttpStatus.TOO_MANY_REQUESTS));

        AiProviderRequest req = AiProviderRequest.of("Sys", "User", Map.of());
        AiProviderResponse res = geminiProvider.generate(req);

        assertFalse(res.successful());
        assertTrue(res.errorMessage().contains("Rate limit") || res.errorMessage().contains("rate limit") || res.errorMessage().contains("temporarily unavailable"));
        mockServer.verify();
    }

    @Test
    @DisplayName("Provider name and model name reflect configuration")
    void metadata() {
        assertEquals("gemini", geminiProvider.getProviderName());
        assertEquals("gemini-2.5-flash", geminiProvider.getModelName());
    }
}

