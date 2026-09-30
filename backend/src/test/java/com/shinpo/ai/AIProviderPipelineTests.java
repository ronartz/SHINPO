package com.shinpo.ai;

import com.shinpo.ai.config.AiProperties;
import com.shinpo.ai.orchestrator.AiGateway;
import com.shinpo.ai.provider.AIProvider;
import com.shinpo.ai.provider.AIProviderRegistry;
import com.shinpo.ai.provider.AiProviderRequest;
import com.shinpo.ai.provider.AiProviderResponse;
import com.shinpo.ai.provider.MockAIProvider;
import com.shinpo.ai.provider.OllamaProvider;
import com.shinpo.dto.AiDtos.AiChatRequest;
import com.shinpo.dto.AiDtos.AiChatResponse;
import com.shinpo.dto.AiDtos.GoalDecompositionResponse;
import com.shinpo.entity.User;
import com.shinpo.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

@ActiveProfiles("test")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class AIProviderPipelineTests {

    @Autowired
    private AIProviderRegistry providerRegistry;

    @Autowired
    private MockAIProvider mockProvider;

    @Autowired
    private AiProperties aiProperties;

    @Autowired
    private AiGateway aiGateway;

    @Autowired
    private UserRepository userRepository;

    private User testUser;

    @BeforeEach
    void setUp() {
        mockProvider.reset();
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        testUser = userRepository.save(new User(
                "ai_tester_" + suffix,
                "ai_tester_" + suffix + "@shinpo.test",
                "hashedpassword",
                Instant.now()
        ));
    }

    @Test
    @DisplayName("AI.1 Task 1: AIProviderRegistry manages beans and resolves active provider")
    void testProviderRegistryResolutionAndSwitching() {
        assertNotNull(providerRegistry);

        // Verify Mock provider is present in registry
        Optional<AIProvider> foundMock = providerRegistry.getProvider("mock");
        assertTrue(foundMock.isPresent());
        assertEquals("mock", foundMock.get().getProviderName());

        // Verify case-insensitive lookup
        assertTrue(providerRegistry.getProvider("MOCK").isPresent());

        // Test dynamic switching of active provider via AiProperties
        aiProperties.setProvider("mock");
        AIProvider active = providerRegistry.getActiveProvider();
        assertNotNull(active);
        assertEquals("mock", active.getProviderName());

        // Check isAnyAvailable
        assertTrue(providerRegistry.isAnyAvailable());
    }

      @Test
      @DisplayName("Ollama rejects incomplete or empty reasoning-only responses")
      void testOllamaRejectsReasoningWithoutVisibleOutput() {
        AiProviderResponse unclosedThink = generateOllamaResponse("<think>private reasoning");
        AiProviderResponse emptyAfterThink = generateOllamaResponse("<think>private reasoning</think>");

        assertFalse(unclosedThink.successful());
        assertFalse(emptyAfterThink.successful());
      }

      @Test
      @DisplayName("Ollama returns visible content after a completed reasoning block")
      void testOllamaReturnsContentAfterThinkBlock() {
        AiProviderResponse response = generateOllamaResponse("<think>private reasoning</think>Visible answer");

        assertTrue(response.successful());
        assertEquals("Visible answer", response.content());
      }

      private AiProviderResponse generateOllamaResponse(String content) {
        RestTemplate restTemplate = new RestTemplate();
        MockRestServiceServer server = MockRestServiceServer.createServer(restTemplate);
        server.expect(requestTo("http://localhost:11434/api/generate"))
            .andRespond(withSuccess("{\"response\":\"" + content + "\"}", MediaType.APPLICATION_JSON));
        OllamaProvider provider = new OllamaProvider(new AiProperties(), new ObjectMapper(), restTemplate, new RestTemplate());

        AiProviderResponse response = provider.generate(AiProviderRequest.of("system", "prompt"));
        server.verify();
        return response;
      }

    @Test
    @DisplayName("AI.1 Task 2: MockAIProvider provides zero-latency canned responses and request recording")
    void testMockAIProviderExecution() {
        mockProvider.setCannedResponse("""
                {
                  "reply": "Custom Mock Strategic Plan",
                  "suggestionType": "PLANNER",
                  "structuredCard": null
                }
                """);

        AiProviderRequest request = AiProviderRequest.of("System Instruction", "What should I do?", Map.of("key", "val"));
        AiProviderResponse response = mockProvider.generate(request);

        assertTrue(response.successful());
        assertEquals("mock", response.provider());
        assertEquals("mock-model-v1", response.model());
        assertTrue(response.content().contains("Custom Mock Strategic Plan"));
        assertEquals(1, mockProvider.getRecordedRequests().size());
        assertEquals("What should I do?", mockProvider.getRecordedRequests().get(0).userPrompt());

        // Verify failure when set to unavailable
        mockProvider.setAvailable(false);
        assertFalse(mockProvider.isAvailable());
        AiProviderResponse failResponse = mockProvider.generate(request);
        assertFalse(failResponse.successful());
        assertTrue(failResponse.errorMessage().contains("unavailable"));
    }

    @Test
    @DisplayName("AI.1 Task 3 & 4: AiGateway seamlessly routes through Mock provider and falls back gracefully")
    void testAiGatewayMockRoutingAndOfflineFallback() {
        aiProperties.setProvider("mock");
        mockProvider.setAvailable(true);
        mockProvider.setCannedResponse("""
                {
                  "reply": "Tactical plan generated via hermetic mock provider.",
                  "suggestionType": "COACH",
                  "structuredCard": null
                }
                """);

        AiChatRequest request = new AiChatRequest(testUser.getId(), "Could you give me an evaluation of my tasks?", null, null, null);
        AiChatResponse response = aiGateway.processChat(request);

        assertNotNull(response);
        assertEquals("Tactical plan generated via hermetic mock provider.", response.reply());
        assertEquals("COACH", response.suggestionType());
        assertFalse(mockProvider.getRecordedRequests().isEmpty());

        // Now simulate provider failure / outage: verify fail-soft deterministic fallback
        mockProvider.setAvailable(false);
        AiChatRequest requestDuringOutage = new AiChatRequest(testUser.getId(), "General query during simulated outage", null, null, null);
        AiChatResponse fallbackResponse = aiGateway.processChat(requestDuringOutage);

        assertNotNull(fallbackResponse);
        assertNotNull(fallbackResponse.reply());
        assertTrue(fallbackResponse.reply().contains("I understand you're asking about"));
    }

    @Test
    @DisplayName("AI.1 Task 4: Goal decomposition routes through Mock provider and falls back safely")
    void testGoalDecompositionMockAndFallback() {
        aiProperties.setProvider("mock");
        mockProvider.setAvailable(true);
        mockProvider.setCannedResponse("""
                {
                  "goalId": 101,
                  "goalTitle": "Scale Architecture",
                  "analysis": "Decomposed into 2 strategic phases",
                  "proposedMissions": [
                    { "title": "Phase A Slicing", "description": "Implement core SPI", "estimatedMinutes": 30 },
                    { "title": "Phase B Hardening", "description": "Verification and tests", "estimatedMinutes": 45 }
                  ]
                }
                """);

        GoalDecompositionResponse decomp = aiGateway.decomposeGoal(101L, testUser.getId(), "Scale Architecture");
        assertNotNull(decomp);
        assertEquals("Scale Architecture", decomp.goalTitle());
        assertEquals(2, decomp.proposedMissions().size());
        assertEquals("Phase A Slicing", decomp.proposedMissions().get(0).title());

        // Now test fallback when provider fails to return valid response
        mockProvider.setAvailable(false);
        GoalDecompositionResponse fallbackDecomp = aiGateway.decomposeGoal(102L, testUser.getId(), "Fallback Goal");
        assertNotNull(fallbackDecomp);
        assertEquals(4, fallbackDecomp.proposedMissions().size());
        assertTrue(fallbackDecomp.analysis().contains("Deterministic Safe Engine"));
    }
}
