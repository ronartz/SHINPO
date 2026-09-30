package com.shinpo.ai;

import com.shinpo.ai.tool.AiTool;
import com.shinpo.ai.tool.AiToolRegistry;
import com.shinpo.ai.tool.ToolDefinition;
import com.shinpo.ai.tool.ToolResult;
import com.shinpo.entity.Goal;
import com.shinpo.entity.User;
import com.shinpo.repository.GoalRepository;
import com.shinpo.repository.UserRepository;
import com.shinpo.security.JwtTokenService;
import com.shinpo.security.UserPrincipal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@ActiveProfiles("test")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class ControlledToolLayerTests {

    @Autowired
    private AiToolRegistry toolRegistry;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private GoalRepository goalRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtTokenService jwtTokenService;

    @Autowired
    private TestRestTemplate restTemplate;

    private User userA;
    private User userB;

    @BeforeEach
    void setUp() {
        String suffixA = UUID.randomUUID().toString().substring(0, 8);
        userA = userRepository.save(new User(
                "tool_user_a_" + suffixA,
                "tool_a_" + suffixA + "@shinpo.test",
                passwordEncoder.encode("secretpassA"),
                Instant.now()
        ));

        String suffixB = UUID.randomUUID().toString().substring(0, 8);
        userB = userRepository.save(new User(
                "tool_user_b_" + suffixB,
                "tool_b_" + suffixB + "@shinpo.test",
                passwordEncoder.encode("secretpassB"),
                Instant.now()
        ));
    }

    @Test
    @DisplayName("AI.3 Task 1: Tool catalog & schemas are registered with descriptions and read-only flags")
    void testToolCatalogAndMetadataRegistered() {
        assertNotNull(toolRegistry);
        List<ToolDefinition> definitions = toolRegistry.getToolDefinitions();
        assertFalse(definitions.isEmpty());
        assertTrue(definitions.size() >= 12, "Must register at least 12 core read tools");

        for (ToolDefinition def : definitions) {
            assertNotNull(def.name(), "Tool name must not be null");
            assertFalse(def.name().isBlank(), "Tool name must not be blank");
            assertNotNull(def.description(), "Tool description must not be null");
            assertFalse(def.description().isBlank(), "Tool description must not be blank");
            assertTrue(def.readOnly(), "Core context tools must be strictly read-only");
        }

        // Test snake_case and camelCase resolution
        assertTrue(toolRegistry.hasTool("get_current_user"));
        assertTrue(toolRegistry.hasTool("getCurrentUser"));
        assertTrue(toolRegistry.hasTool("get_current_goal"));
        assertTrue(toolRegistry.hasTool("getCurrentGoal"));
        assertTrue(toolRegistry.hasTool("get_sanitized_diagnostics"));

        Optional<AiTool> userTool = toolRegistry.getTool("getCurrentUser");
        assertTrue(userTool.isPresent());
        assertEquals("get_current_user", userTool.get().getName());
    }

    @Test
    @DisplayName("AI.3 Task 2: Tool execution strictly requires authenticated user context")
    void testToolExecutionRequiresAuthenticatedUser() {
        ToolResult result = toolRegistry.executeTool("get_current_user", null, Map.of());
        assertNotNull(result);
        assertFalse(result.success());
        assertEquals("get_current_user", result.toolName());
        assertTrue(result.errorMessage().contains("Unauthenticated"));
    }

    @Test
    @DisplayName("AI.3 Task 3: Cross-tenant IDOR attack on goal inspection is strictly blocked")
    void testCrossTenantIdorProtectionOnGoalInspection() {
        // User B creates a confidential goal
        Goal confidentialGoal = new Goal(
                "User B Secret Patent Strategy",
                "Confidential research for distributed consensus",
                LocalDate.now(),
                LocalDate.now().plusMonths(3),
                userB
        );
        Goal savedGoalB = goalRepository.save(confidentialGoal);

        // User A attempts to inspect User B's goal by passing User B's goalId
        ToolResult idorResult = toolRegistry.executeTool(
                "get_current_goal",
                userA.getId(),
                Map.of("goalId", savedGoalB.getId())
        );

        assertNotNull(idorResult);
        assertFalse(idorResult.success(), "Cross-tenant access must be rejected");
        assertTrue(idorResult.errorMessage().contains("access denied") || idorResult.errorMessage().contains("not found"));
        assertNull(idorResult.data(), "No confidential goal payload must be leaked to User A");

        // User B invokes the tool for their own goal: succeeds cleanly
        ToolResult legitimateResult = toolRegistry.executeTool(
                "get_current_goal",
                userB.getId(),
                Map.of("goalId", savedGoalB.getId())
        );

        assertTrue(legitimateResult.success());
        assertNotNull(legitimateResult.data());
        assertTrue(legitimateResult.data() instanceof Map<?, ?>);
        @SuppressWarnings("unchecked")
        Map<String, Object> goalMap = (Map<String, Object>) legitimateResult.data();
        assertEquals("User B Secret Patent Strategy", goalMap.get("title"));
    }

    @Test
    @DisplayName("AI.3 Task 4: Caller-spoofed userId parameter is stripped; security principal is authoritative")
    void testCallerSpoofedUserIdParameterIgnored() {
        // User A calls get_current_user but attempts to inject userB's ID in the parameter map
        ToolResult result = toolRegistry.executeTool(
                "get_current_user",
                userA.getId(),
                Map.of("userId", userB.getId(), "user_id", userB.getId())
        );

        assertTrue(result.success());
        assertNotNull(result.data());
        @SuppressWarnings("unchecked")
        Map<String, Object> data = (Map<String, Object>) result.data();

        // Must match User A, NOT User B
        assertEquals(userA.getId(), data.get("userId"));
        assertEquals(userA.getUsername(), data.get("username"));
        assertNotEquals(userB.getId(), data.get("userId"));
    }

    @Test
    @DisplayName("AI.3 Task 5: Diagnostics and telemetry scrub passwords, secrets, and raw keys")
    void testDataSanitizationInDiagnosticsAndDeviceTelemetry() {
        ToolResult diagResult = toolRegistry.executeTool(
                "get_sanitized_diagnostics",
                userA.getId(),
                Map.of("feature", "TESTING")
        );

        assertTrue(diagResult.success());
        @SuppressWarnings("unchecked")
        Map<String, Object> diagData = (Map<String, Object>) diagResult.data();

        assertNotNull(diagData.get("appVersion"));
        assertNotNull(diagData.get("os"));
        assertFalse(diagData.containsKey("password"));
        assertFalse(diagData.containsKey("secret"));
        assertFalse(diagData.containsKey("token"));
        assertFalse(diagData.containsKey("credentials"));

        ToolResult deviceResult = toolRegistry.executeTool("get_device_status", userA.getId(), Map.of());
        assertTrue(deviceResult.success());
        @SuppressWarnings("unchecked")
        Map<String, Object> devData = (Map<String, Object>) deviceResult.data();
        assertNotNull(devData.get("os"));
        assertFalse(devData.containsKey("env"));
    }

    @Test
    @DisplayName("AI.3 Task 6: Controlled tool HTTP endpoints enforce authentication and tenant security")
    void testControlledToolEndpointsViaRest() {
        // 1. Unauthenticated request to /api/ai/tools returns 401
        ResponseEntity<String> unauthTools = restTemplate.getForEntity("/api/ai/tools", String.class);
        assertEquals(HttpStatus.UNAUTHORIZED, unauthTools.getStatusCode());

        // 2. Authenticated request to /api/ai/tools returns 200 with tool catalog
        String tokenA = jwtTokenService.generateAccessToken(UserPrincipal.create(userA));
        HttpHeaders headersA = new HttpHeaders();
        headersA.setBearerAuth(tokenA);
        headersA.setContentType(MediaType.APPLICATION_JSON);

        HttpEntity<Void> getReqA = new HttpEntity<>(headersA);
        ResponseEntity<List<ToolDefinition>> toolsResponse = restTemplate.exchange(
                "/api/ai/tools",
                HttpMethod.GET,
                getReqA,
                new ParameterizedTypeReference<>() {}
        );

        assertEquals(HttpStatus.OK, toolsResponse.getStatusCode());
        assertNotNull(toolsResponse.getBody());
        assertTrue(toolsResponse.getBody().size() >= 12);

        // 3. User B creates a secret goal
        Goal confidentialGoal = goalRepository.save(new Goal(
                "User B Confidential Strategy",
                "Secret mission",
                LocalDate.now(),
                LocalDate.now().plusMonths(1),
                userB
        ));

        // 4. User A executes get_current_goal via HTTP targeting User B's goalId -> returns 403 Forbidden
        Map<String, Object> idorPayload = Map.of("goalId", confidentialGoal.getId());
        HttpEntity<Map<String, Object>> postReqA = new HttpEntity<>(idorPayload, headersA);

        ResponseEntity<ToolResult> idorHttpResult = restTemplate.postForEntity(
                "/api/ai/tools/get_current_goal/execute",
                postReqA,
                ToolResult.class
        );

        assertEquals(HttpStatus.FORBIDDEN, idorHttpResult.getStatusCode());
        assertNotNull(idorHttpResult.getBody());
        assertFalse(idorHttpResult.getBody().success());

        // 5. User B executes get_current_goal via HTTP targeting User B's goalId -> returns 200 OK
        String tokenB = jwtTokenService.generateAccessToken(UserPrincipal.create(userB));
        HttpHeaders headersB = new HttpHeaders();
        headersB.setBearerAuth(tokenB);
        headersB.setContentType(MediaType.APPLICATION_JSON);

        HttpEntity<Map<String, Object>> postReqB = new HttpEntity<>(idorPayload, headersB);
        ResponseEntity<ToolResult> validHttpResult = restTemplate.postForEntity(
                "/api/ai/tools/get_current_goal/execute",
                postReqB,
                ToolResult.class
        );

        assertEquals(HttpStatus.OK, validHttpResult.getStatusCode());
        assertNotNull(validHttpResult.getBody());
        assertTrue(validHttpResult.getBody().success());
    }
}
