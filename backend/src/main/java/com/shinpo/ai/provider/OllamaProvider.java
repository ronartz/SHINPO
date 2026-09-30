package com.shinpo.ai.provider;

import com.shinpo.ai.config.AiProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

@Component
public class OllamaProvider implements AIProvider {

    private static final Logger log = LoggerFactory.getLogger(OllamaProvider.class);

    private final AiProperties aiProperties;
    private final RestTemplate restTemplate;
    private final RestTemplate healthRestTemplate;
    private final ObjectMapper objectMapper;

    @org.springframework.beans.factory.annotation.Autowired
    public OllamaProvider(AiProperties aiProperties, ObjectMapper objectMapper) {
        this.aiProperties = aiProperties;
        this.objectMapper = objectMapper;

        int timeoutSec = aiProperties.getOllama() != null ? aiProperties.getOllama().getTimeoutSeconds() : 30;
        SimpleClientHttpRequestFactory reqFactory = new SimpleClientHttpRequestFactory();
        reqFactory.setConnectTimeout(Duration.ofSeconds(3));
        reqFactory.setReadTimeout(Duration.ofSeconds(timeoutSec > 0 ? timeoutSec : 30));
        this.restTemplate = new RestTemplate(reqFactory);

        SimpleClientHttpRequestFactory healthFactory = new SimpleClientHttpRequestFactory();
        healthFactory.setConnectTimeout(Duration.ofSeconds(2));
        healthFactory.setReadTimeout(Duration.ofSeconds(2));
        this.healthRestTemplate = new RestTemplate(healthFactory);
    }

    public OllamaProvider(AiProperties aiProperties, ObjectMapper objectMapper, RestTemplate restTemplate, RestTemplate healthRestTemplate) {
        this.aiProperties = aiProperties;
        this.objectMapper = objectMapper;
        this.restTemplate = restTemplate;
        this.healthRestTemplate = healthRestTemplate;
    }

    @Override
    public AiProviderResponse generate(AiProviderRequest request) {
        long start = System.currentTimeMillis();
        String baseUrl = aiProperties.getOllama().getBaseUrl();
        String model = resolveEffectiveModel(aiProperties.getOllama().getModel());

        try {
            String endpoint = baseUrl.replaceAll("/+$", "") + "/api/generate";

            Map<String, Object> body = new HashMap<>();
            body.put("model", model);
            body.put("system", request.systemPrompt() != null ? request.systemPrompt() : "");

            String userPrompt = request.userPrompt() != null ? request.userPrompt() : "";
            if (userPrompt.startsWith("<system_prompt>") || userPrompt.contains("<user_input>")) {
                body.put("prompt", userPrompt);
            } else {
                StringBuilder promptBuilder = new StringBuilder();
                if (request.contextData() != null && !request.contextData().isEmpty()) {
                    promptBuilder.append("USER PRODUCTIVITY STATUS:\n");
                    Object goal = request.contextData().get("currentGoal");
                    if (goal instanceof Map<?, ?> gm && gm.get("title") != null) {
                        promptBuilder.append("• Active Goal: ").append(gm.get("title")).append("\n");
                    }
                    Object mission = request.contextData().get("nextMission");
                    if (mission instanceof Map<?, ?> mm && mm.get("title") != null) {
                        promptBuilder.append("• Next Mission: ").append(mm.get("title")).append("\n");
                    }
                    Object prog = request.contextData().get("progress");
                    if (prog instanceof Map<?, ?> pm) {
                        promptBuilder.append("• Progress: ").append(pm.get("completedMissions")).append("/")
                                .append(pm.get("totalMissions")).append(" missions done\n");
                    }
                    Object enf = request.contextData().get("enforcement");
                    if (enf instanceof Map<?, ?> em && em.get("status") != null) {
                        promptBuilder.append("• Shield: ").append(em.get("status")).append("\n");
                    }
                    promptBuilder.append("\n");
                }
                promptBuilder.append("USER INQUIRY: ").append(userPrompt);
                body.put("prompt", promptBuilder.toString());
            }

            body.put("stream", false);
            body.put("think", false);

            if (request.jsonMode()) {
                body.put("format", "json");
            }

            Map<String, Object> options = new HashMap<>();
            options.put("temperature", request.temperature() != null ? request.temperature() : 0.2);
            options.put("num_predict", 500);
            options.put("num_ctx", 2048);
            body.put("options", options);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

            ResponseEntity<String> response = restTemplate.postForEntity(endpoint, entity, String.class);
            long latencyMs = System.currentTimeMillis() - start;

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                JsonNode root = objectMapper.readTree(response.getBody());
                JsonNode responseNode = root.get("response");
                String content = responseNode != null ? responseNode.asString() : response.getBody();
                if (content != null) {
                    int thinkStart = content.lastIndexOf("<think>");
                    int thinkEnd = content.lastIndexOf("</think>");
                    if (thinkStart > thinkEnd) {
                        return AiProviderResponse.failure("Ollama returned an incomplete reasoning block", latencyMs, "ollama", model);
                    }
                    if (thinkEnd >= 0) {
                        content = content.substring(thinkEnd + 8).trim();
                        if (content.isEmpty()) {
                            return AiProviderResponse.failure("Ollama returned no response content", latencyMs, "ollama", model);
                        }
                    }
                }
                return AiProviderResponse.success(content, latencyMs, "ollama", model);
            } else {
                String error = "Ollama returned status " + response.getStatusCode();
                log.warn("Ollama provider non-200 response: {}", error);
                return AiProviderResponse.failure(error, latencyMs, "ollama", model);
            }
        } catch (RestClientException e) {
            long latencyMs = System.currentTimeMillis() - start;
            log.warn("Ollama provider request failed at {}: {}", baseUrl, e.getMessage());
            return AiProviderResponse.failure("Ollama connection failed: " + e.getMessage(), latencyMs, "ollama", model);
        } catch (Exception e) {
            long latencyMs = System.currentTimeMillis() - start;
            log.error("Unexpected error in OllamaProvider", e);
            return AiProviderResponse.failure("Internal provider error: " + e.getMessage(), latencyMs, "ollama", model);
        }
    }

    @Override
    public boolean isAvailable() {
        try {
            String baseUrl = aiProperties.getOllama().getBaseUrl();
            String healthUrl = baseUrl.replaceAll("/+$", "") + "/api/tags";
            ResponseEntity<String> response = healthRestTemplate.getForEntity(healthUrl, String.class);
            return response.getStatusCode().is2xxSuccessful();
        } catch (Exception e) {
            return false;
        }
    }

    @Override
    public String getProviderName() {
        return "ollama";
    }

    private String resolveEffectiveModel(String requestedModel) {
        if (requestedModel == null || requestedModel.isBlank()) {
            return "qwen2.5:0.5b";
        }
        return requestedModel;
    }

    @Override
    public String getModelName() {
        return aiProperties.getOllama().getModel();
    }
}
