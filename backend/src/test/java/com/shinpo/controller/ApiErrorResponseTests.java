package com.shinpo.controller;

import com.shinpo.dto.ApiErrorResponse;
import com.shinpo.dto.AuthDtos.RegisterRequest;
import com.shinpo.dto.CreateGoalRequest;
import com.shinpo.dto.SentinelWarningDtos.IssueWarningRequest;
import com.shinpo.entity.FocusSession;
import com.shinpo.entity.FocusSessionStatus;
import com.shinpo.entity.User;
import com.shinpo.repository.FocusSessionRepository;
import com.shinpo.repository.UserRepository;
import com.shinpo.security.JwtAccessDeniedHandler;
import com.shinpo.security.JwtTokenService;
import com.shinpo.security.UserPrincipal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.*;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;

import java.io.IOException;
import java.time.Instant;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@ActiveProfiles("test")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
public class ApiErrorResponseTests {

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private FocusSessionRepository focusSessionRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtTokenService jwtTokenService;

    @Autowired
    private JwtAccessDeniedHandler jwtAccessDeniedHandler;

    private User primaryUser;
    private String primaryToken;

    @BeforeEach
    void setUp() {
        String uniqueSuffix = UUID.randomUUID().toString().substring(0, 8);
        primaryUser = userRepository.save(new User(
                "error_tester_" + uniqueSuffix,
                "error_tester_" + uniqueSuffix + "@shinpo.test",
                passwordEncoder.encode("secretpass"),
                Instant.now()
        ));
        primaryToken = jwtTokenService.generateAccessToken(UserPrincipal.create(primaryUser));
    }

    private HttpHeaders authHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(primaryToken);
        headers.setContentType(MediaType.APPLICATION_JSON);
        return headers;
    }

    @Test
    @DisplayName("400 BAD_REQUEST: Validation failure produces VALIDATION_FAILED and validationErrors list")
    void testValidationErrorResponse() {
        CreateGoalRequest invalidRequest = new CreateGoalRequest(
                primaryUser.getId(),
                "",
                "Description",
                null,
                null
        );

        HttpEntity<CreateGoalRequest> entity = new HttpEntity<>(invalidRequest, authHeaders());
        ResponseEntity<ApiErrorResponse> response = restTemplate.postForEntity(
                "/api/goals",
                entity,
                ApiErrorResponse.class
        );

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        ApiErrorResponse body = response.getBody();
        assertNotNull(body);
        assertNotNull(body.timestamp());
        assertEquals(400, body.status());
        assertEquals("VALIDATION_FAILED", body.error());
        assertNotNull(body.message());
        assertEquals("/api/goals", body.path());
        assertNotNull(body.validationErrors());
        assertFalse(body.validationErrors().isEmpty());
    }

    @Test
    @DisplayName("400 BAD_REQUEST: Sensitive fields such as passwords are NEVER exposed in rejectedValue")
    void testSensitiveFieldValidationNeverExposesPassword() {
        RegisterRequest registerRequest = new RegisterRequest(
                "valid_user",
                "valid@example.com",
                "123"
        );

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<RegisterRequest> entity = new HttpEntity<>(registerRequest, headers);

        ResponseEntity<ApiErrorResponse> response = restTemplate.postForEntity(
                "/api/auth/register",
                entity,
                ApiErrorResponse.class
        );

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        ApiErrorResponse body = response.getBody();
        assertNotNull(body);
        assertEquals(400, body.status());
        assertEquals("VALIDATION_FAILED", body.error());
        assertNotNull(body.validationErrors());

        ApiErrorResponse.ValidationErrorItem passwordError = body.validationErrors().stream()
                .filter(v -> "password".equalsIgnoreCase(v.field()))
                .findFirst()
                .orElse(null);

        assertNotNull(passwordError, "Password error item should be present");
        assertNull(passwordError.rejectedValue(), "Sensitive rejectedValue must be null / sanitized");
        assertFalse(response.getBody().toString().contains("123"), "Password plaintext must not appear in response");
    }

    @Test
    @DisplayName("400 BAD_REQUEST: Malformed JSON body produces MALFORMED_REQUEST_BODY without internal parser leaks")
    void testMalformedJsonErrorResponse() {
        HttpHeaders headers = authHeaders();
        HttpEntity<String> entity = new HttpEntity<>("{ invalid_json: ", headers);

        ResponseEntity<ApiErrorResponse> response = restTemplate.postForEntity(
                "/api/goals",
                entity,
                ApiErrorResponse.class
        );

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        ApiErrorResponse body = response.getBody();
        assertNotNull(body);
        assertNotNull(body.timestamp());
        assertEquals(400, body.status());
        assertEquals("MALFORMED_REQUEST_BODY", body.error());
        assertEquals("Malformed JSON request payload", body.message());
        assertEquals("/api/goals", body.path());
        assertNull(body.validationErrors());
    }

    @Test
    @DisplayName("401 UNAUTHORIZED: Missing authentication header produces standardized UNAUTHORIZED response")
    void testUnauthorizedErrorResponse() {
        ResponseEntity<ApiErrorResponse> response = restTemplate.getForEntity(
                "/api/goals",
                ApiErrorResponse.class
        );

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
        ApiErrorResponse body = response.getBody();
        assertNotNull(body);
        assertNotNull(body.timestamp());
        assertEquals(401, body.status());
        assertEquals("UNAUTHORIZED", body.error());
        assertTrue(body.message().contains("Full authentication is required"));
        assertEquals("/api/goals", body.path());
    }

    @Test
    @DisplayName("403 FORBIDDEN: Accessing another user's session in sentinel warning produces FORBIDDEN")
    void testForbiddenErrorResponse() {
        String otherSuffix = UUID.randomUUID().toString().substring(0, 8);
        User otherUser = userRepository.save(new User(
                "other_" + otherSuffix,
                "other_" + otherSuffix + "@shinpo.test",
                passwordEncoder.encode("secretpass"),
                Instant.now()
        ));
        FocusSession otherSession = new FocusSession();
        otherSession.setUser(otherUser);
        otherSession.setName("Other session");
        otherSession.setDurationMinutes(25);
        otherSession.setStatus(FocusSessionStatus.ACTIVE);
        otherSession.setStartedAt(Instant.now());
        otherSession = focusSessionRepository.save(otherSession);

        IssueWarningRequest request = new IssueWarningRequest(
                otherSession.getId(),
                "discord",
                null
        );

        HttpEntity<IssueWarningRequest> entity = new HttpEntity<>(request, authHeaders());
        ResponseEntity<ApiErrorResponse> response = restTemplate.postForEntity(
                "/api/device/sentinel/warnings",
                entity,
                ApiErrorResponse.class
        );

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        ApiErrorResponse body = response.getBody();
        assertNotNull(body);
        assertNotNull(body.timestamp());
        assertEquals(403, body.status());
        assertEquals("FORBIDDEN", body.error());
        assertEquals("Focus session does not belong to authenticated user", body.message());
        assertEquals("/api/device/sentinel/warnings", body.path());
    }

    @Test
    @DisplayName("403 FORBIDDEN: Spring Security JwtAccessDeniedHandler produces standardized REST error schema")
    void testSpringSecurityAccessDeniedHandlerStandardizedResponse() throws IOException {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRequestURI("/api/admin/restricted");
        MockHttpServletResponse response = new MockHttpServletResponse();

        jwtAccessDeniedHandler.handle(request, response, new AccessDeniedException("Forbidden"));

        assertEquals(403, response.getStatus());
        assertEquals(MediaType.APPLICATION_JSON_VALUE, response.getContentType());
        String content = response.getContentAsString();
        assertTrue(content.contains("\"status\":403") || content.contains("\"status\": 403"));
        assertTrue(content.contains("\"error\":\"FORBIDDEN\"") || content.contains("\"error\": \"FORBIDDEN\""));
        assertTrue(content.contains("Access is denied"));
        assertTrue(content.contains("/api/admin/restricted"));
        assertTrue(content.contains("timestamp"));
    }

    @Test
    @DisplayName("404 RESOURCE_NOT_FOUND: Entity not found produces RESOURCE_NOT_FOUND")
    void testResourceNotFoundEntityErrorResponse() {
        HttpEntity<Void> entity = new HttpEntity<>(authHeaders());
        ResponseEntity<ApiErrorResponse> response = restTemplate.exchange(
                "/api/goals/999999999",
                HttpMethod.GET,
                entity,
                ApiErrorResponse.class
        );

        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
        ApiErrorResponse body = response.getBody();
        assertNotNull(body);
        assertNotNull(body.timestamp());
        assertEquals(404, body.status());
        assertEquals("RESOURCE_NOT_FOUND", body.error());
        assertTrue(body.message().contains("Goal not found"));
        assertEquals("/api/goals/999999999", body.path());
    }

    @Test
    @DisplayName("404 ENDPOINT_NOT_FOUND: Non-existent endpoint produces ENDPOINT_NOT_FOUND")
    void testResourceNotFoundEndpointErrorResponse() {
        HttpEntity<Void> entity = new HttpEntity<>(authHeaders());
        ResponseEntity<ApiErrorResponse> response = restTemplate.exchange(
                "/api/nonexistent-endpoint-test",
                HttpMethod.GET,
                entity,
                ApiErrorResponse.class
        );

        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
        ApiErrorResponse body = response.getBody();
        assertNotNull(body);
        assertNotNull(body.timestamp());
        assertEquals(404, body.status());
        assertEquals("ENDPOINT_NOT_FOUND", body.error());
        assertEquals("/api/nonexistent-endpoint-test", body.path());
    }

    @Test
    @DisplayName("405 METHOD_NOT_ALLOWED: Unsupported HTTP method produces METHOD_NOT_ALLOWED")
    void testMethodNotAllowedErrorResponse() {
        HttpEntity<Void> entity = new HttpEntity<>(authHeaders());
        ResponseEntity<ApiErrorResponse> response = restTemplate.exchange(
                "/api/goals",
                HttpMethod.PATCH,
                entity,
                ApiErrorResponse.class
        );

        assertEquals(HttpStatus.METHOD_NOT_ALLOWED, response.getStatusCode());
        ApiErrorResponse body = response.getBody();
        assertNotNull(body);
        assertNotNull(body.timestamp());
        assertEquals(405, body.status());
        assertEquals("METHOD_NOT_ALLOWED", body.error());
        assertEquals("/api/goals", body.path());
    }

    @Test
    @DisplayName("409 INVALID_STATE_TRANSITION: Invalid lifecycle transition produces INVALID_STATE_TRANSITION")
    void testInvalidStateTransitionErrorResponse() {
        FocusSession session = new FocusSession();
        session.setUser(primaryUser);
        session.setName("State test session");
        session.setDurationMinutes(25);
        session.setStatus(FocusSessionStatus.SCHEDULED);
        session = focusSessionRepository.save(session);

        HttpEntity<Void> entity = new HttpEntity<>(authHeaders());
        restTemplate.postForEntity("/api/focus-sessions/" + session.getId() + "/start", entity, String.class);
        restTemplate.postForEntity("/api/focus-sessions/" + session.getId() + "/complete", entity, String.class);

        ResponseEntity<ApiErrorResponse> conflictResponse = restTemplate.postForEntity(
                "/api/focus-sessions/" + session.getId() + "/start",
                entity,
                ApiErrorResponse.class
        );

        assertEquals(HttpStatus.CONFLICT, conflictResponse.getStatusCode());
        ApiErrorResponse body = conflictResponse.getBody();
        assertNotNull(body);
        assertNotNull(body.timestamp());
        assertEquals(409, body.status());
        assertEquals("INVALID_STATE_TRANSITION", body.error());
        assertNotNull(body.message());
        assertEquals("/api/focus-sessions/" + session.getId() + "/start", body.path());
    }
}

