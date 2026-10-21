package com.shinpo.service;

import com.shinpo.config.SecurityConfig;
import com.shinpo.dto.SentinelDtos.SentinelSweepResponse;
import com.shinpo.dto.TaskManagerDtos.DeviceSystemInfo;
import com.shinpo.dto.TaskManagerDtos.ProcessControlResult;
import com.shinpo.dto.TaskManagerDtos.ProcessInfo;
import com.shinpo.repository.*;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class CloudDeploymentDecouplingTests {

    @Test
    @DisplayName("TaskManagerService: In cloud/production mode, server process scanning and termination are strictly disabled")
    void testTaskManagerService_cloudModeDisabled() {
        TaskManagerService cloudService = new TaskManagerService(false);
        assertFalse(cloudService.isServerProcessScanningEnabled());

        List<ProcessInfo> procs = cloudService.getProcesses(null, null);
        assertNotNull(procs);
        assertTrue(procs.isEmpty(), "Server-side process listing must return empty list in cloud mode");

        DeviceSystemInfo sysInfo = cloudService.getSystemInfo();
        assertNotNull(sysInfo);
        assertNull(sysInfo.processCount(), "Process count must be unavailable when server process scanning is disabled");
        assertTrue(sysInfo.deviceName().contains("Cloud") || sysInfo.deviceName().equals(System.getenv("HOSTNAME")),
                "Device name must reflect cloud node or container hostname");

        ProcessControlResult result = cloudService.terminateProcess(99999L, false);
        assertNotNull(result);
        assertEquals("REJECTED", result.status());
        assertTrue(result.message().contains("Server-side process termination is disabled in cloud deployment"),
                "Message must clearly explain that server-side termination is disabled");
    }

    @Test
    @DisplayName("TaskManagerService: In local/dev mode, server process scanning is enabled")
    void testTaskManagerService_devModeEnabled() {
        TaskManagerService devService = new TaskManagerService(true);
        assertTrue(devService.isServerProcessScanningEnabled());

        DeviceSystemInfo sysInfo = devService.getSystemInfo();
        assertNotNull(sysInfo);
        assertTrue(sysInfo.processCount() > 0, "Process count should be > 0 on local development host");
    }

    @Test
    @DisplayName("SentinelEnforcementService: In cloud/production mode, triggerSweep delegates to SHINPO Shield daemon")
    void testSentinelEnforcementService_cloudModeDelegatesToShield() {
        FocusSessionRepository focusSessionRepository = mock(FocusSessionRepository.class);
        SentinelQuarantineRepository quarantineRepository = mock(SentinelQuarantineRepository.class);
        SentinelPolicyRuleRepository policyRuleRepository = mock(SentinelPolicyRuleRepository.class);
        SentinelTamperEventRepository tamperEventRepository = mock(SentinelTamperEventRepository.class);
        UserRepository userRepository = mock(UserRepository.class);
        PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
        PlatformTransactionManager transactionManager = mock(PlatformTransactionManager.class);
        WebSocketEventService webSocketEventService = mock(WebSocketEventService.class);
        FocusSessionEnforcementExceptionService exceptionService = mock(FocusSessionEnforcementExceptionService.class);
        SentinelWarningService warningService = mock(SentinelWarningService.class);

        SentinelEnforcementService cloudSentinel = new SentinelEnforcementService(
                focusSessionRepository,
                quarantineRepository,
                policyRuleRepository,
                tamperEventRepository,
                userRepository,
                passwordEncoder,
                transactionManager,
                webSocketEventService,
                exceptionService,
                warningService,
                false // serverProcessScanningEnabled = false
        );

        assertFalse(cloudSentinel.isServerProcessScanningEnabled());

        SentinelSweepResponse sweep = cloudSentinel.triggerSweep(42L);
        assertNotNull(sweep);
        assertEquals(0, sweep.scannedProcessCount(), "Scanned process count must be 0 when server scanning is disabled");
        assertEquals(0, sweep.interceptedCount(), "Intercepted count must be 0 when server scanning is disabled");
        assertTrue(sweep.message().contains("Server-side process scanning is disabled in cloud deployment"),
                "Sweep response must explain delegation to SHINPO Shield daemon");

        // periodic daemon must also skip silently without scanning
        assertDoesNotThrow(() -> cloudSentinel.periodicSentinelDaemon());
    }

    @Test
    @DisplayName("SecurityConfig: Configurable CORS origins support cloud domain injection")
    void testSecurityConfig_customCorsOrigins() {
        SecurityConfig config = new SecurityConfig(null, null, null);
        config.setCustomAllowedOrigins("https://shinpo.team.com, https://beta.shinpo.app");

        UrlBasedCorsConfigurationSource source = (UrlBasedCorsConfigurationSource) config.corsConfigurationSource();
        CorsConfiguration corsConfig = source.getCorsConfigurations().get("/**");

        assertNotNull(corsConfig);
        List<String> origins = corsConfig.getAllowedOrigins();
        assertNotNull(origins);
        assertTrue(origins.contains("https://shinpo.team.com"));
        assertTrue(origins.contains("https://beta.shinpo.app"));
        assertTrue(origins.contains("tauri://localhost"), "Must retain Tauri default origin");
        assertTrue(origins.contains("https://tauri.localhost"), "Must retain Tauri HTTPS origin");
    }

    @Test
    @DisplayName("SecurityConfig: Wildcard CORS origin sets allowed origin patterns")
    void testSecurityConfig_wildcardCorsOrigin() {
        SecurityConfig config = new SecurityConfig(null, null, null);
        config.setCustomAllowedOrigins("*");

        UrlBasedCorsConfigurationSource source = (UrlBasedCorsConfigurationSource) config.corsConfigurationSource();
        CorsConfiguration corsConfig = source.getCorsConfigurations().get("/**");

        assertNotNull(corsConfig);
        List<String> patterns = corsConfig.getAllowedOriginPatterns();
        assertNotNull(patterns);
        assertTrue(patterns.contains("*"));
    }
}
