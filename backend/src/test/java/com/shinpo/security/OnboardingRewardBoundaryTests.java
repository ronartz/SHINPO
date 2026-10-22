package com.shinpo.security;

import com.shinpo.entity.User;
import com.shinpo.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;

import java.time.Instant;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@AutoConfigureTestRestTemplate
class OnboardingRewardBoundaryTests {

    private static final ParameterizedTypeReference<Map<String, Object>> MAP_TYPE = new ParameterizedTypeReference<>() {};

    @LocalServerPort
    private int port;

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtTokenService jwtTokenService;

    @Test
    void forgedStepFlagsAndTourFinishCannotAwardXpWithoutPersistedWorkflow() {
        long suffix = System.nanoTime();
        User user = userRepository.save(new User(
                "onboarding_boundary_" + suffix,
                "onboarding_boundary_" + suffix + "@shinpo.test",
                "test-hash",
                Instant.now()));
        try {
            String token = jwtTokenService.generateAccessToken(UserPrincipal.create(user));
            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(token);
            headers.setContentType(MediaType.APPLICATION_JSON);

            ResponseEntity<Map<String, Object>> forgedStep = restTemplate.exchange(
                    url("/api/onboarding/step"), HttpMethod.POST,
                    new HttpEntity<>("{\"stepIndex\":5,\"actionVerified\":true}", headers), MAP_TYPE);
            assertThat(forgedStep.getStatusCode().is2xxSuccessful()).isTrue();
            assertThat(forgedStep.getBody()).isNotNull();
            assertThat(((Number) forgedStep.getBody().get("completedStepsCount")).intValue()).isZero();
            assertThat(forgedStep.getBody().get("verifiedSteps")).isEqualTo("");

            ResponseEntity<Map<String, Object>> finish = restTemplate.exchange(
                    url("/api/onboarding/finish"), HttpMethod.POST,
                    new HttpEntity<>("{}", headers), MAP_TYPE);
            assertThat(finish.getStatusCode().is2xxSuccessful()).isTrue();
            assertThat(finish.getBody()).isNotNull();
            assertThat(finish.getBody().get("canClaimReward")).isEqualTo(false);

            ResponseEntity<Map<String, Object>> claim = restTemplate.exchange(
                    url("/api/progress/onboarding"), HttpMethod.POST,
                    new HttpEntity<>(headers), MAP_TYPE);
            assertThat(claim.getStatusCode().value()).isEqualTo(400);

            ResponseEntity<Map<String, Object>> progress = restTemplate.exchange(
                    url("/api/progress"), HttpMethod.GET,
                    new HttpEntity<>(headers), MAP_TYPE);
            assertThat(progress.getBody()).isNotNull();
            assertThat(((Number) progress.getBody().get("totalProgress")).intValue()).isZero();
        } finally {
            userRepository.deleteById(user.getId());
        }
    }

    private String url(String path) {
        return "http://localhost:" + port + path;
    }
}
