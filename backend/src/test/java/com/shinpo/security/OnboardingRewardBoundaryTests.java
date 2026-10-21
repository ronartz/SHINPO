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
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;

import java.time.Instant;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@AutoConfigureTestRestTemplate
class OnboardingRewardBoundaryTests {

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

            ResponseEntity<Map> forgedStep = restTemplate.exchange(
                    url("/api/onboarding/step"), HttpMethod.POST,
                    new HttpEntity<>("{\"stepIndex\":5,\"actionVerified\":true}", headers), Map.class);
            assertThat(forgedStep.getStatusCode().is2xxSuccessful()).isTrue();
            assertThat(((Number) forgedStep.getBody().get("completedStepsCount")).intValue()).isZero();
            assertThat(forgedStep.getBody().get("verifiedSteps")).isEqualTo("");

            ResponseEntity<Map> finish = restTemplate.exchange(
                    url("/api/onboarding/finish"), HttpMethod.POST,
                    new HttpEntity<>("{}", headers), Map.class);
            assertThat(finish.getStatusCode().is2xxSuccessful()).isTrue();
            assertThat(finish.getBody().get("canClaimReward")).isEqualTo(false);

            ResponseEntity<Map> claim = restTemplate.exchange(
                    url("/api/progress/onboarding"), HttpMethod.POST,
                    new HttpEntity<>(headers), Map.class);
            assertThat(claim.getStatusCode().value()).isEqualTo(400);

            ResponseEntity<Map> progress = restTemplate.exchange(
                    url("/api/progress"), HttpMethod.GET,
                    new HttpEntity<>(headers), Map.class);
            assertThat(((Number) progress.getBody().get("totalProgress")).intValue()).isZero();
        } finally {
            userRepository.deleteById(user.getId());
        }
    }

    private String url(String path) {
        return "http://localhost:" + port + path;
    }
}
