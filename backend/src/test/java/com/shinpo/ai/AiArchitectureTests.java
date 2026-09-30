package com.shinpo.ai;

import com.shinpo.ai.config.AiProperties;
import com.shinpo.ai.orchestrator.AiGateway;
import com.shinpo.ai.provider.AIProvider;
import com.shinpo.ai.provider.AiProviderRequest;
import com.shinpo.ai.provider.AiProviderResponse;
import com.shinpo.ai.provider.OllamaProvider;
import com.shinpo.ai.tool.AiToolRegistry;
import com.shinpo.dto.AiDtos.*;
import com.shinpo.entity.AiSuggestion;
import com.shinpo.entity.User;
import com.shinpo.repository.AiSuggestionRepository;
import com.shinpo.repository.GoalRepository;
import com.shinpo.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class AiArchitectureTests {

    private AiProperties properties;
    private ObjectMapper objectMapper;
    private AiToolRegistry toolRegistry;
    private AiSuggestionRepository suggestionRepository;
    private UserRepository userRepository;
    private GoalRepository goalRepository;

    @BeforeEach
    void setup() {
        properties = new AiProperties();
        objectMapper = new ObjectMapper();
        toolRegistry = mock(AiToolRegistry.class);
        suggestionRepository = mock(AiSuggestionRepository.class);
        userRepository = mock(UserRepository.class);
        goalRepository = mock(GoalRepository.class);

        User testUser = new User("testuser", "test@shinpo.com", "hash", Instant.now());
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
    }

    @Test
    void ollamaProviderHandlesOfflineGracefully() {
        OllamaProvider provider = new OllamaProvider(properties, objectMapper);

        // When Ollama is offline or unreachable on an unused port
        properties.getOllama().setBaseUrl("http://localhost:59999");

        assertFalse(provider.isAvailable());

        AiProviderRequest req = AiProviderRequest.of("System prompt", "User request");
        AiProviderResponse res = provider.generate(req);

        assertNotNull(res);
        assertFalse(res.successful(), "Offline provider should report failure without throwing");
        assertNotNull(res.errorMessage());
        assertEquals("ollama", res.provider());
    }

        @Test
        void ollamaProviderKeepsRequestedModelWhenItIsNotInstalled() {
                properties.getOllama().setBaseUrl("http://ollama");
                properties.getOllama().setModel("missing-model");
                RestTemplate restTemplate = mock(RestTemplate.class);
                RestTemplate healthRestTemplate = mock(RestTemplate.class);
                when(restTemplate.postForEntity(anyString(), any(), eq(String.class)))
                                .thenReturn(ResponseEntity.ok("{\"response\":\"ok\"}"));

                OllamaProvider provider = new OllamaProvider(properties, objectMapper, restTemplate, healthRestTemplate);
                AiProviderResponse response = provider.generate(AiProviderRequest.of("system", "user"));

                assertEquals("missing-model", response.model());
                verifyNoInteractions(healthRestTemplate);
        }

    @Test
    void aiGatewayFallsBackGracefullyWhenProviderFails() {
        AIProvider failingProvider = mock(AIProvider.class);
        when(failingProvider.getProviderName()).thenReturn("ollama");
        when(failingProvider.isAvailable()).thenReturn(false);

        AiGateway gateway = new AiGateway(
                List.of(failingProvider),
                properties,
                toolRegistry,
                suggestionRepository,
                userRepository,
                objectMapper
        );

        when(toolRegistry.assembleFullContext(any(), any(), any(), any()))
                .thenReturn(Map.of("user", Map.of("username", "testuser")));
        when(toolRegistry.getNextMission(any()))
                .thenReturn(Map.of("id", 101L, "title", "Ship Distributed Shield", "estimatedMinutes", 45));
        when(toolRegistry.getCurrentGoal(any(), any()))
                .thenReturn(Map.of("id", 1L, "title", "Launch SHINPO 1.0"));

        AiChatRequest chatReq = new AiChatRequest(1L, "What should I do now?", null, null, null);
        AiChatResponse chatRes = gateway.processChat(chatReq);

        assertNotNull(chatRes);
        assertNotNull(chatRes.reply());
        assertTrue(chatRes.reply().contains("EONPAI"));
        verify(suggestionRepository, atLeastOnce()).save(any(AiSuggestion.class));
    }

    @Test
    void enforcementRoutingRequiresWhyQuestionContext() {
        AiGateway gateway = new AiGateway(
                List.of(),
                properties,
                toolRegistry,
                suggestionRepository,
                userRepository,
                objectMapper
        );

        when(toolRegistry.getNextMission(any()))
                .thenReturn(Map.of("id", 101L, "title", "Ship Distributed Shield", "estimatedMinutes", 45));
        when(toolRegistry.getCurrentGoal(any(), any()))
                .thenReturn(Map.of("id", 1L, "title", "Launch SHINPO 1.0"));
        when(toolRegistry.getSanitizedDiagnostics(any(), any())).thenReturn(Map.of());
        when(toolRegistry.getEnforcementExplanation(any(), any()))
                .thenReturn(Map.of("reason", "No active enforcement.", "activeBlockPresent", false));

        AiChatResponse nextAction = gateway.processChat(
                new AiChatRequest(1L, "What should I do about the blocked app?", null, null, null)
        );
        AiChatResponse bugReport = gateway.processChat(
                new AiChatRequest(1L, "I found a bug: the app was terminated unexpectedly.", null, null, null)
        );
        AiChatResponse enforcement = gateway.processChat(
                new AiChatRequest(1L, "Why is YouTube blocked?", null, null, null)
        );

        assertEquals("NEXT_ACTION", nextAction.suggestionType());
        assertEquals("BUG_REPORT", bugReport.suggestionType());
        assertEquals("ENFORCEMENT_EXPLANATION", enforcement.suggestionType());
    }

    @Test
    void identityQueryMatchesInformalVariations() {
        AiGateway gateway = new AiGateway(
                List.of(),
                properties,
                toolRegistry,
                suggestionRepository,
                userRepository,
                objectMapper
        );

        AiChatResponse r1 = gateway.processChat(new AiChatRequest(1L, "WHO ARE U?", null, null, null));
        AiChatResponse r2 = gateway.processChat(new AiChatRequest(1L, "who r u", null, null, null));
        AiChatResponse r3 = gateway.processChat(new AiChatRequest(1L, "Who are you?", null, null, null));

        assertEquals("IDENTITY", r1.suggestionType());
        assertEquals("IDENTITY", r2.suggestionType());
        assertEquals("IDENTITY", r3.suggestionType());

        AiChatResponse supportQuery = gateway.processChat(
                new AiChatRequest(1L, "Who are u? My scheduled sessions are missing.", null, null, null)
        );
        assertEquals("TACTICAL_ASSISTANT", supportQuery.suggestionType());
    }

    @Test
    void typoToleranceAndFuzzyMatchingRecognizesIntents() {
        AiGateway gateway = new AiGateway(
                List.of(),
                properties,
                toolRegistry,
                suggestionRepository,
                userRepository,
                objectMapper
        );

        when(toolRegistry.getCurrentGoal(any(), any()))
                .thenReturn(Map.of("id", 1L, "title", "Launch SHINPO 1.0"));
        when(toolRegistry.getNextMission(any()))
                .thenReturn(Map.of("id", 101L, "title", "Ship Distributed Shield", "estimatedMinutes", 45));
        when(toolRegistry.getTodaysSchedule(any()))
                .thenReturn(List.of());

        // Goal decomposition intent with UI preset and typos
        AiChatResponse goal1 = gateway.processChat(new AiChatRequest(1L, "Break down my top goal into actionable steps", null, null, null));
        AiChatResponse goal2 = gateway.processChat(new AiChatRequest(1L, "brek down my top gola", null, null, null));
        AiChatResponse goal3 = gateway.processChat(new AiChatRequest(1L, "actionable steps for goal", null, null, null));
        assertEquals("ARCHITECT", goal1.suggestionType());
        assertEquals("ARCHITECT", goal2.suggestionType());
        assertEquals("ARCHITECT", goal3.suggestionType());

        // Daily plan with typos
        AiChatResponse plan1 = gateway.processChat(new AiChatRequest(1L, "plann my day", null, null, null));
        AiChatResponse plan2 = gateway.processChat(new AiChatRequest(1L, "shedule today", null, null, null));
        assertEquals("PLANNER", plan1.suggestionType());
        assertEquals("PLANNER", plan2.suggestionType());

        // Next action with typos
        AiChatResponse next1 = gateway.processChat(new AiChatRequest(1L, "wat should i do now", null, null, null));
        AiChatResponse next2 = gateway.processChat(new AiChatRequest(1L, "what next", null, null, null));
        assertEquals("NEXT_ACTION", next1.suggestionType());
        assertEquals("NEXT_ACTION", next2.suggestionType());

        // Greeting with typos
        AiChatResponse greet1 = gateway.processChat(new AiChatRequest(1L, "helo", null, null, null));
        AiChatResponse greet2 = gateway.processChat(new AiChatRequest(1L, "hy", null, null, null));
        assertEquals("GREETING", greet1.suggestionType());
        assertEquals("GREETING", greet2.suggestionType());
    }

    @Test
    void aiGatewayParsesStructuredJsonOutputFromModel() {
        AIProvider mockProvider = mock(AIProvider.class);
        when(mockProvider.getProviderName()).thenReturn("ollama");
        when(mockProvider.isAvailable()).thenReturn(true);

        String modelJson = """
                {
                  "reply": "Clear to engage. Your top focus block is ready.",
                  "suggestionType": "TACTICAL_ASSISTANT",
                  "structuredCard": null
                }
                """;

        when(mockProvider.generate(any()))
                .thenReturn(AiProviderResponse.success(modelJson, 150L, "ollama", "qwen3:8b"));

        AiGateway gateway = new AiGateway(
                List.of(mockProvider),
                properties,
                toolRegistry,
                suggestionRepository,
                userRepository,
                objectMapper
        );

        when(toolRegistry.assembleFullContext(any(), any(), any(), any()))
                .thenReturn(Map.of("user", Map.of("username", "eonx")));

        AiChatRequest chatReq = new AiChatRequest(1L, "Give me an update", null, null, null);
        AiChatResponse response = gateway.processChat(chatReq);

        assertNotNull(response);
        assertEquals("Clear to engage. Your top focus block is ready.", response.reply());
        assertEquals("TACTICAL_ASSISTANT", response.suggestionType());
        verify(suggestionRepository).save(any(AiSuggestion.class));
    }

    @Test
    void goalDecompositionProducesSuggestionWithoutMutatingGoal() {
        AIProvider mockProvider = mock(AIProvider.class);
        when(mockProvider.getProviderName()).thenReturn("ollama");
        when(mockProvider.isAvailable()).thenReturn(true);

        String decompositionJson = """
                {
                  "goalId": 42,
                  "goalTitle": "Master Execution Architecture",
                  "analysis": "Decomposed into 3 high-impact phases",
                  "proposedMissions": [
                    {
                      "title": "Phase 1: Foundation",
                      "description": "Establish core kernel",
                      "estimatedMinutes": 30
                    }
                  ]
                }
                """;

        when(mockProvider.generate(any()))
                .thenReturn(AiProviderResponse.success(decompositionJson, 200L, "ollama", "qwen3:8b"));

        AiGateway gateway = new AiGateway(
                List.of(mockProvider),
                properties,
                toolRegistry,
                suggestionRepository,
                userRepository,
                objectMapper
        );

        GoalDecompositionResponse response = gateway.decomposeGoal(42L, 1L, "Master Execution Architecture");

        assertNotNull(response);
        assertEquals(42L, response.goalId());
        assertEquals(1, response.proposedMissions().size());
        assertEquals("Phase 1: Foundation", response.proposedMissions().get(0).title());

        // Verify suggestion was audited
        verify(suggestionRepository).save(any(AiSuggestion.class));
        // Verify GoalRepository was NEVER called to mutate or delete
        verifyNoInteractions(goalRepository);
    }
}
