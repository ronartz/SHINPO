package com.shinpo.ai.provider;

import com.shinpo.ai.config.AiProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.time.Duration;
import java.util.*;

/**
 * Google Gemini API provider for SHINPO EONPAI.
 *
 * Uses the Gemini REST API (v1beta) with API key authentication.
 * Free tier: 60 requests/minute on gemini-2.0-flash.
 *
 * Configuration via application properties:
 *   shinpo.ai.provider=gemini
 *   shinpo.ai.gemini.api-key=${SHINPO_GEMINI_API_KEY}
 *   shinpo.ai.gemini.model=gemini-3.6-flash  (default)
 */
@Component
@ConditionalOnProperty(name = "shinpo.ai.gemini.api-key", matchIfMissing = false)
public class GeminiProvider implements AIProvider {

    private static final Logger log = LoggerFactory.getLogger(GeminiProvider.class);

    private static final String GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
    private static final String DEFAULT_MODEL = "gemini-3.6-flash";
    private static final int MAX_OUTPUT_TOKENS = 1024;

    private final AiProperties aiProperties;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Autowired
    public GeminiProvider(AiProperties aiProperties, ObjectMapper objectMapper) {
        this.aiProperties = aiProperties;
        this.objectMapper = objectMapper;

        int timeoutSec = aiProperties.getGemini() != null ? aiProperties.getGemini().getTimeoutSeconds() : 30;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(5));
        factory.setReadTimeout(Duration.ofSeconds(timeoutSec > 0 ? timeoutSec : 30));
        this.restTemplate = new RestTemplate(factory);
    }

    // Test constructor
    public GeminiProvider(AiProperties aiProperties, ObjectMapper objectMapper, RestTemplate restTemplate) {
        this.aiProperties = aiProperties;
        this.objectMapper = objectMapper;
        this.restTemplate = restTemplate;
    }

    @Override
    public AiProviderResponse generate(AiProviderRequest request) {
        long start = System.currentTimeMillis();
        String model = resolveModel();
        String apiKey = getApiKey();

        if (apiKey == null || apiKey.isBlank()) {
            return AiProviderResponse.failure("Gemini API key not configured", 0, "gemini", model);
        }

        try {
            String endpoint = GEMINI_API_BASE + "/models/" + model + ":generateContent";

            // Build request body
            Map<String, Object> body = new LinkedHashMap<>();

            // System instruction
            if (request.systemPrompt() != null && !request.systemPrompt().isBlank()) {
                Map<String, Object> sysInstruction = new LinkedHashMap<>();
                sysInstruction.put("parts", List.of(Map.of("text", request.systemPrompt())));
                body.put("system_instruction", sysInstruction);
            }

            // User content with context
            StringBuilder userText = new StringBuilder();
            if (request.contextData() != null && !request.contextData().isEmpty()) {
                userText.append("USER PRODUCTIVITY STATUS:\n");
                Object goal = request.contextData().get("currentGoal");
                if (goal instanceof Map<?, ?> gm && gm.get("title") != null) {
                    userText.append("• Active Goal: ").append(gm.get("title")).append("\n");
                }
                Object mission = request.contextData().get("nextMission");
                if (mission instanceof Map<?, ?> mm && mm.get("title") != null) {
                    userText.append("• Next Mission: ").append(mm.get("title")).append("\n");
                }
                Object prog = request.contextData().get("progress");
                if (prog instanceof Map<?, ?> pm) {
                    userText.append("• Progress: ").append(pm.get("completedMissions")).append("/")
                            .append(pm.get("totalMissions")).append(" missions done\n");
                }
                Object enf = request.contextData().get("enforcement");
                if (enf instanceof Map<?, ?> em && em.get("status") != null) {
                    userText.append("• Shield: ").append(em.get("status")).append("\n");
                }
                userText.append("\n");
            }
            userText.append(request.userPrompt() != null ? request.userPrompt() : "");

            Map<String, Object> content = new LinkedHashMap<>();
            content.put("parts", List.of(Map.of("text", userText.toString())));
            body.put("contents", List.of(content));

            // Generation config
            Map<String, Object> genConfig = new LinkedHashMap<>();
            genConfig.put("temperature", request.temperature() != null ? request.temperature() : 0.2);
            genConfig.put("maxOutputTokens", MAX_OUTPUT_TOKENS);
            if (request.jsonMode()) {
                genConfig.put("responseMimeType", "application/json");
            }
            body.put("generationConfig", genConfig);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("x-goog-api-key", apiKey);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

            ResponseEntity<String> response = restTemplate.postForEntity(endpoint, entity, String.class);
            long latencyMs = System.currentTimeMillis() - start;

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                String text = extractTextFromResponse(response.getBody());
                if (text != null && !text.isBlank()) {
                    return AiProviderResponse.success(text, latencyMs, "gemini", model);
                } else {
                    return AiProviderResponse.failure("Gemini returned empty response", latencyMs, "gemini", model);
                }
            } else {
                String error = "Gemini returned status " + response.getStatusCode();
                log.warn("Gemini provider non-200 response: {}", error);
                return AiProviderResponse.failure(error, latencyMs, "gemini", model);
            }
        } catch (RestClientException e) {
            long latencyMs = System.currentTimeMillis() - start;
            log.warn("Gemini provider request failed (model={}): {}", model, e.getMessage());
            String userError = (e.getMessage() != null && e.getMessage().contains("429"))
                    ? "Gemini rate limit reached. Please wait a moment."
                    : "Gemini service temporarily unavailable.";
            return AiProviderResponse.failure(userError, latencyMs, "gemini", model);
        } catch (Exception e) {
            long latencyMs = System.currentTimeMillis() - start;
            log.error("Unexpected error in GeminiProvider", e);
            return AiProviderResponse.failure("Internal provider error occurred", latencyMs, "gemini", model);
        }
    }

    @Override
    public boolean isAvailable() {
        String apiKey = getApiKey();
        if (apiKey == null || apiKey.isBlank()) {
            return false;
        }
        try {
            // Probing models endpoint with x-goog-api-key header to verify API key validity without leaking in URL
            String url = GEMINI_API_BASE + "/models?pageSize=1";
            HttpHeaders headers = new HttpHeaders();
            headers.set("x-goog-api-key", apiKey);
            HttpEntity<Void> entity = new HttpEntity<>(headers);
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, entity, String.class);
            return response.getStatusCode().is2xxSuccessful();
        } catch (Exception e) {
            log.debug("Gemini availability check failed: {}", e.getMessage());
            return false;
        }
    }

    @Override
    public String getProviderName() {
        return "gemini";
    }

    @Override
    public String getModelName() {
        return resolveModel();
    }

    private String resolveModel() {
        if (aiProperties.getGemini() != null && aiProperties.getGemini().getModel() != null
                && !aiProperties.getGemini().getModel().isBlank()) {
            return aiProperties.getGemini().getModel();
        }
        return DEFAULT_MODEL;
    }

    private String getApiKey() {
        if (aiProperties.getGemini() != null) {
            return aiProperties.getGemini().getApiKey();
        }
        return null;
    }

    /**
     * Extract text content from Gemini generateContent response.
     * Response format: { "candidates": [{ "content": { "parts": [{"text": "..."}] } }] }
     */
    private String extractTextFromResponse(String responseBody) {
        try {
            JsonNode root = objectMapper.readTree(responseBody);
            JsonNode candidates = root.get("candidates");
            if (candidates != null && candidates.isArray() && !candidates.isEmpty()) {
                JsonNode firstCandidate = candidates.get(0);
                JsonNode content = firstCandidate.get("content");
                if (content != null) {
                    JsonNode parts = content.get("parts");
                    if (parts != null && parts.isArray()) {
                        StringBuilder sb = new StringBuilder();
                        for (JsonNode part : parts) {
                            JsonNode text = part.get("text");
                            if (text != null) {
                                sb.append(text.asString());
                            }
                        }
                        return sb.toString().trim();
                    }
                }
            }

            // Check for error in response
            JsonNode error = root.get("error");
            if (error != null) {
                String message = error.has("message") ? error.get("message").asString() : "Unknown Gemini error";
                log.warn("Gemini API error: {}", message);
                return null;
            }
        } catch (Exception e) {
            log.error("Failed to parse Gemini response: {}", e.getMessage());
        }
        return null;
    }
}

