package com.shinpo.service;

import com.shinpo.dto.SentinelDtos.*;
import com.shinpo.entity.FocusSession;
import com.shinpo.entity.FocusSessionStatus;
import com.shinpo.entity.Mission;
import com.shinpo.entity.SentinelPolicyRule;
import com.shinpo.entity.SentinelQuarantineRecord;
import com.shinpo.entity.SentinelTamperEvent;
import com.shinpo.entity.User;
import com.shinpo.repository.FocusSessionRepository;
import com.shinpo.repository.SentinelPolicyRuleRepository;
import com.shinpo.repository.SentinelQuarantineRepository;
import com.shinpo.repository.SentinelTamperEventRepository;
import com.shinpo.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.File;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.*;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class SentinelEnforcementService {

    private static final Logger log = LoggerFactory.getLogger(SentinelEnforcementService.class);

    public static final Set<String> PROTECTED_PROCESSES = Set.of(
            "systemd", "init", "kthreadd", "dbus-daemon", "dbus", "xorg", "wayland",
            "sway", "gnome-shell", "shinpo-shield", "shinpo", "sshd", "login",
            "kernel", "bash", "zsh", "systemd-journald", "systemd-udevd", "cron", "crond",
            "postgres", "docker", "dockerd", "containerd", "idea", "code", "vscode", "java"
    );

    public static final Set<String> DEFAULT_DISTRACTIONS = Set.of(
            "discord", "steam", "telegram-desktop", "obs",
            "game", "lutris", "heroic", "battlenet", "riotclientservices", "epicgameslauncher",
            "tiktok", "netflix", "youtube"
    );

    private final FocusSessionRepository focusSessionRepository;
    private final SentinelQuarantineRepository quarantineRepository;
    private final SentinelPolicyRuleRepository policyRuleRepository;
    private final SentinelTamperEventRepository tamperEventRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final TransactionTemplate auditTransactionTemplate;
    private final WebSocketEventService webSocketEventService;
    private final FocusSessionEnforcementExceptionService exceptionService;
    private final SentinelWarningService warningService;

    // Per-user enforcement mode (default STRICT)
    private final Map<Long, String> userEnforcementModes = new ConcurrentHashMap<>();

    // Debounce cache: key = "userId_pid", value = Instant of last logged quarantine
    private final Map<String, Instant> debounceMap = new ConcurrentHashMap<>();

    private volatile Instant lastGlobalSweep = Instant.now();

    public SentinelEnforcementService(
            FocusSessionRepository focusSessionRepository,
            SentinelQuarantineRepository quarantineRepository,
            SentinelPolicyRuleRepository policyRuleRepository,
            SentinelTamperEventRepository tamperEventRepository,
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            PlatformTransactionManager transactionManager,
            WebSocketEventService webSocketEventService,
            FocusSessionEnforcementExceptionService exceptionService,
            SentinelWarningService warningService
    ) {
        this.focusSessionRepository = focusSessionRepository;
        this.quarantineRepository = quarantineRepository;
        this.policyRuleRepository = policyRuleRepository;
        this.tamperEventRepository = tamperEventRepository;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.auditTransactionTemplate = new TransactionTemplate(transactionManager);
        this.auditTransactionTemplate.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        this.webSocketEventService = webSocketEventService;
        this.exceptionService = exceptionService;
        this.warningService = warningService;
    }

    public String getEnforcementMode(Long userId) {
        return userEnforcementModes.getOrDefault(userId, "STRICT");
    }

    @Transactional
    public void setEnforcementMode(Long userId, String mode) {
        if (mode == null || mode.isBlank()) {
            mode = "STRICT";
        }
        String upper = mode.toUpperCase();
        if (!List.of("STRICT", "AUDIT_ONLY", "CONTAINMENT").contains(upper)) {
            throw new IllegalArgumentException("Invalid enforcement mode: " + mode + ". Must be STRICT, AUDIT_ONLY, or CONTAINMENT.");
        }

        String currentMode = getEnforcementMode(userId);
        List<FocusSession> activeSessions = focusSessionRepository.findAllByUser_IdAndStatus(userId, FocusSessionStatus.ACTIVE);
        FocusSession activeSession = activeSessions.isEmpty() ? null : activeSessions.get(0);

        if (activeSession != null && "STRICT".equals(currentMode) && !upper.equals("STRICT")) {
            User user = userRepository.findById(userId).orElse(null);
            if (user != null) {
                SentinelTamperEvent tamper = new SentinelTamperEvent(
                        user,
                        activeSession,
                        "UNAUTHORIZED_MODE_CHANGE_ATTEMPT",
                        "HIGH",
                        currentMode,
                        null,
                        "Attempted mode downgrade from STRICT to " + upper + " during active sprint: " + activeSession.getName()
                );
                persistTamperEventInNewTransaction(tamper);
            }
            log.warn("SENTINEL_POLICY_GATE_BLOCKED: user={} activeSession={} attemptedMode={}",
                    userId, activeSession.getId(), upper);
            throw new IllegalStateException("Administrative Policy Gate: Enforcement mode cannot be downgraded during an active STRICT focus sprint. Execute emergency override with password verification.");
        }

        userEnforcementModes.put(userId, upper);
        log.info("SENTINEL_MODE_UPDATED: user={} mode={}", userId, upper);
        webSocketEventService.broadcastSentinelStatus(userId, upper, activeSession != null && "STRICT".equals(upper), 0, 0);
    }

    @Transactional(readOnly = true)
    public SentinelStatusResponse getSentinelStatus(Long userId) {
        Instant now = Instant.now();
        List<FocusSession> activeSessions = focusSessionRepository.findAllByUser_IdAndStatus(userId, FocusSessionStatus.ACTIVE);
        FocusSession activeSession = activeSessions.isEmpty() ? null : activeSessions.get(0);

        String status;
        if (activeSession != null) {
            status = "ACTIVE_DEFENSE";
        } else {
            Instant threshold = now.plus(Duration.ofMinutes(30));
            List<FocusSession> scheduledSessions = focusSessionRepository.findAllByUser_IdAndStatus(userId, FocusSessionStatus.SCHEDULED);
            boolean upcoming = scheduledSessions.stream()
                    .anyMatch(s -> s.getScheduledAt() != null && s.getScheduledAt().isBefore(threshold) && s.getScheduledAt().isAfter(now.minusSeconds(60)));
            status = upcoming ? "STANDBY" : "IDLE";
        }

        Instant todayStart = LocalDate.now(ZoneOffset.UTC).atStartOfDay(ZoneOffset.UTC).toInstant();
        long totalInterceptedToday = quarantineRepository.countByUser_IdAndDetectedAtAfter(userId, todayStart);
        long activePolicyRulesCount = policyRuleRepository.findAllByUser_IdOrderByCreatedAtDesc(userId).size();

        long tamperEventsCount = (activeSession != null)
                ? tamperEventRepository.countByUser_IdAndFocusSession_Id(userId, activeSession.getId())
            : tamperEventRepository.countByUser_Id(userId);

        boolean isPolicyLocked = activeSession != null && "STRICT".equals(getEnforcementMode(userId));

        List<SentinelQuarantineItem> recent = quarantineRepository.findTop20ByUser_IdOrderByDetectedAtDesc(userId)
                .stream()
                .map(SentinelQuarantineItem::from)
                .toList();

        return new SentinelStatusResponse(
                status,
                activeSession != null ? activeSession.getId() : null,
                activeSession != null ? activeSession.getName() : null,
                getEnforcementMode(userId),
                totalInterceptedToday,
                activePolicyRulesCount,
                tamperEventsCount,
                isPolicyLocked,
                recent,
                lastGlobalSweep
        );
    }

    @Transactional
    public SentinelSweepResponse triggerSweep(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

        List<FocusSession> activeSessions = focusSessionRepository.findAllByUser_IdAndStatus(userId, FocusSessionStatus.ACTIVE);
        FocusSession activeSession = activeSessions.isEmpty() ? null : activeSessions.get(0);

        lastGlobalSweep = Instant.now();
        return executeSweepForUser(user, activeSession);
    }

    @Scheduled(fixedRate = 5000)
    public void periodicSentinelDaemon() {
        List<FocusSession> activeSessions = focusSessionRepository.findAll().stream()
                .filter(s -> s.getStatus() == FocusSessionStatus.ACTIVE)
                .toList();

        if (activeSessions.isEmpty()) {
            return;
        }

        lastGlobalSweep = Instant.now();

        Set<Long> processedUsers = new HashSet<>();
        for (FocusSession session : activeSessions) {
            User user = session.getUser();
            if (user != null && processedUsers.add(user.getId())) {
                try {
                    executeSweepForUser(user, session);
                } catch (Exception e) {
                    log.error("SENTINEL_SWEEP_FAILED: user={} session={} error={}",
                            user.getId(), session.getId(), e.getMessage());
                }
            }
        }
    }

    private SentinelSweepResponse executeSweepForUser(User user, FocusSession activeSession) {
        Long userId = user.getId();
        String mode = getEnforcementMode(userId);
        long myPid = ProcessHandle.current().pid();

        Set<String> blockedPatterns = new HashSet<>(DEFAULT_DISTRACTIONS);
        Set<String> allowedPatterns = new HashSet<>();

        // Contextual policy: if there is an active session, its session exceptions take precedence over blocked rules
        if (activeSession != null) {
            allowedPatterns.addAll(exceptionService.getActiveProcessExceptionsForUser(userId));
        }

        List<SentinelPolicyRule> userRules = policyRuleRepository.findAllByUser_IdOrderByCreatedAtDesc(userId);
        for (SentinelPolicyRule rule : userRules) {
            String pat = rule.getProcessNamePattern().toLowerCase().trim();
            if ("BLOCKED".equalsIgnoreCase(rule.getPolicyType())) {
                blockedPatterns.add(pat);
            } else if ("ALLOWED".equalsIgnoreCase(rule.getPolicyType())) {
                allowedPatterns.add(pat);
            }
        }

        List<Long> interceptedPids = new ArrayList<>();
        List<String> interceptedNames = new ArrayList<>();
        int scannedCount = 0;
        Instant now = Instant.now();
        String currentOsUser = System.getProperty("user.name");

        for (ProcessHandle handle : ProcessHandle.allProcesses().toList()) {
            scannedCount++;
            long pid = handle.pid();
            if (pid == myPid || pid == 1) {
                continue;
            }

            ProcessHandle.Info info = handle.info();
            String rawCmd = info.command().orElse("");
            String name = "";
            if (!rawCmd.isBlank()) {
                name = new File(rawCmd).getName();
            } else {
                name = info.commandLine().map(cl -> cl.split(" ")[0]).orElse("pid-" + pid);
                if (name.contains("/")) {
                    name = new File(name).getName();
                }
            }

            String lowerName = name.toLowerCase();

            if (PROTECTED_PROCESSES.contains(lowerName) || lowerName.contains("shinpo")) {
                continue;
            }

            if (allowedPatterns.stream().anyMatch(lowerName::contains)) {
                continue;
            }

            boolean isDistraction = blockedPatterns.stream().anyMatch(lowerName::contains);
            if (!isDistraction) {
                continue;
            }

            String debounceKey = userId + "_" + pid;
            Instant lastLogged = debounceMap.get(debounceKey);
            boolean shouldRecord = (lastLogged == null || Duration.between(lastLogged, now).toSeconds() > 45);

            String actionTaken = "FLAGGED";
            String reason = "Distraction process detected during active focus session";

            // Process owner privilege boundary verification
            Optional<String> procUser = info.user();
            if (procUser.isPresent() && !procUser.get().equals(currentOsUser) && !"root".equals(currentOsUser)) {
                actionTaken = "PERMISSION_DENIED";
                reason = "Privilege boundary violation: target process belongs to user " + procUser.get();
                if (shouldRecord) {
                    SentinelTamperEvent privilegeViolation = new SentinelTamperEvent(
                            user,
                            activeSession,
                            "PRIVILEGE_BOUNDARY_VIOLATION",
                            "MEDIUM",
                            mode,
                            "Target process owner mismatch",
                            "PID " + pid + " (" + name + ") owned by " + procUser.get()
                    );
                    tamperEventRepository.save(privilegeViolation);
                }
            } else {
                try {
                    if (activeSession != null) {
                        actionTaken = enforceProcess(handle, mode);
                        if ("TERMINATED".equals(actionTaken)) {
                            reason = "Autonomous sprint enforcement: process exit confirmed after forced termination";
                        } else if ("TERMINATE_ATTEMPTED".equals(actionTaken)) {
                            reason = "Autonomous sprint enforcement: process remained alive after forced termination request";
                        } else if ("CONTAINED".equals(actionTaken)) {
                            reason = "Autonomous sprint containment: process exit confirmed";
                        } else if ("CONTAINMENT_FAILED".equals(actionTaken)) {
                            reason = "Autonomous sprint containment: process remained alive after termination escalation";
                        } else {
                            reason = "Sentinel audit: distraction detected during focus window";
                        }
                    } else {
                        actionTaken = "WARNED";
                        reason = "Sentinel audit: distraction detected during focus window";
                    }
                } catch (SecurityException se) {
                    actionTaken = "PERMISSION_DENIED";
                    reason = "OS security policy denied termination: " + se.getMessage();
                    log.error("SENTINEL_SECURITY_DENIAL: pid={} user={} error={}", pid, userId, se.getMessage());
                } catch (Exception ex) {
                    actionTaken = "CONTAINMENT_FAILED";
                    reason = "Process containment failed: " + ex.getMessage();
                    log.error("SENTINEL_CONTAINMENT_EXCEPTION: pid={} user={} error={}", pid, userId, ex.getMessage());
                }
            }

            interceptedPids.add(pid);
            interceptedNames.add(name);

            if (shouldRecord) {
                debounceMap.put(debounceKey, now);
                SentinelQuarantineRecord record = new SentinelQuarantineRecord(
                        user,
                        activeSession,
                        pid,
                        name,
                        info.commandLine().orElse(rawCmd),
                        actionTaken,
                        mode,
                        reason
                );
                quarantineRepository.save(record);
                webSocketEventService.broadcastQuarantine(userId, record);
                log.warn("SENTINEL_INTERCEPTION: user={} pid={} name={} action={} mode={}",
                        userId, pid, name, actionTaken, mode);
            }
        }

        if (debounceMap.size() > 500) {
            debounceMap.entrySet().removeIf(entry -> Duration.between(entry.getValue(), now).toMinutes() > 10);
        }

        String msg = interceptedPids.isEmpty()
                ? "Sentinel sweep clean: 0 distractions active across " + scannedCount + " processes."
                : "Sentinel intercepted " + interceptedPids.size() + " distraction processes (" + String.join(", ", interceptedNames) + ").";

        return new SentinelSweepResponse(
                scannedCount,
                interceptedPids.size(),
                interceptedPids,
                interceptedNames,
                msg,
                now
        );
    }

    static String enforceProcess(ProcessHandle handle, String mode) {
        if ("STRICT".equals(mode)) {
            return requestTerminationAndVerify(handle, true);
        }
        if ("CONTAINMENT".equals(mode)) {
            String gracefulResult = requestTerminationAndVerify(handle, false);
            if ("CONTAINED".equals(gracefulResult)) {
                return gracefulResult;
            }

            String forcedResult = requestTerminationAndVerify(handle, true);
            return "TERMINATED".equals(forcedResult) ? "CONTAINED" : "CONTAINMENT_FAILED";
        }
        return "WARNED";
    }

    static String requestTerminationAndVerify(ProcessHandle handle, boolean force) {
        if (force) {
            handle.destroyForcibly();
        } else {
            handle.destroy();
        }

        boolean exited;
        try {
            handle.onExit().get(100, TimeUnit.MILLISECONDS);
            exited = true;
        } catch (TimeoutException e) {
            exited = !handle.isAlive();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            exited = !handle.isAlive();
        } catch (ExecutionException e) {
            exited = !handle.isAlive();
        }

        if (force) {
            return exited ? "TERMINATED" : "TERMINATE_ATTEMPTED";
        }
        return exited ? "CONTAINED" : "CONTAINMENT_FAILED";
    }

    @Transactional(readOnly = true)
    public List<SentinelQuarantineItem> getQuarantinesForSession(Long userId, Long sessionId) {
        return quarantineRepository.findAllByUser_IdAndFocusSession_IdOrderByDetectedAtDesc(userId, sessionId)
                .stream()
                .map(SentinelQuarantineItem::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public long getInterceptionsCountForSession(Long userId, Long sessionId) {
        return quarantineRepository.countByUser_IdAndFocusSession_Id(userId, sessionId);
    }

    @Transactional
    public PolicyRuleResponse addPolicyRule(Long userId, AddPolicyRuleRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

        if (request.processNamePattern() == null || request.processNamePattern().isBlank()) {
            throw new IllegalArgumentException("Process name pattern cannot be empty");
        }

        String pattern = request.processNamePattern().trim().toLowerCase();
        if (PROTECTED_PROCESSES.contains(pattern) || pattern.contains("shinpo")) {
            throw new IllegalArgumentException("Cannot block protected system core process: " + pattern);
        }

        String type = (request.policyType() != null && !request.policyType().isBlank())
                ? request.policyType().toUpperCase()
                : "BLOCKED";

        if (!List.of("BLOCKED", "ALLOWED").contains(type)) {
            throw new IllegalArgumentException("Policy type must be BLOCKED or ALLOWED");
        }

        Optional<SentinelPolicyRule> existing = policyRuleRepository.findByUser_IdAndProcessNamePatternIgnoreCase(userId, pattern);
        SentinelPolicyRule rule;
        if (existing.isPresent()) {
            rule = existing.get();
            rule.setPolicyType(type);
        } else {
            rule = new SentinelPolicyRule(user, pattern, type);
        }

        SentinelPolicyRule saved = policyRuleRepository.save(rule);
        return PolicyRuleResponse.from(saved);
    }

    @Transactional
    public void deletePolicyRule(Long userId, Long ruleId) {
        SentinelPolicyRule rule = policyRuleRepository.findByIdAndUser_Id(ruleId, userId)
                .orElseThrow(() -> new IllegalArgumentException("Policy rule not found: " + ruleId));

        String currentMode = getEnforcementMode(userId);
        List<FocusSession> activeSessions = focusSessionRepository.findAllByUser_IdAndStatus(userId, FocusSessionStatus.ACTIVE);
        FocusSession activeSession = activeSessions.isEmpty() ? null : activeSessions.get(0);

        if (activeSession != null && "STRICT".equals(currentMode) && "BLOCKED".equalsIgnoreCase(rule.getPolicyType())) {
            User user = userRepository.findById(userId).orElse(null);
            if (user != null) {
                SentinelTamperEvent tamper = new SentinelTamperEvent(
                        user,
                        activeSession,
                        "UNAUTHORIZED_RULE_DELETION_ATTEMPT",
                        "HIGH",
                        currentMode,
                        null,
                        "Attempted deletion of blocked rule '" + rule.getProcessNamePattern() + "' during active sprint: " + activeSession.getName()
                );
                persistTamperEventInNewTransaction(tamper);
            }
            log.warn("SENTINEL_RULE_DELETION_BLOCKED: user={} activeSession={} ruleId={} pattern={}",
                    userId, activeSession.getId(), ruleId, rule.getProcessNamePattern());
            throw new IllegalStateException("Administrative Policy Gate: Distraction blacklist rules cannot be removed during an active focus sprint. Use emergency override if required.");
        }

        policyRuleRepository.delete(rule);
        log.info("SENTINEL_RULE_DELETED: user={} ruleId={}", userId, ruleId);
    }

    @Transactional(readOnly = true)
    public List<PolicyRuleResponse> listPolicyRules(Long userId) {
        return policyRuleRepository.findAllByUser_IdOrderByCreatedAtDesc(userId)
                .stream()
                .map(PolicyRuleResponse::from)
                .toList();
    }

    @Transactional
    public EmergencyOverrideResponse emergencyOverride(Long userId, EmergencyOverrideRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

        if (request.password() == null || !passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            log.warn("SENTINEL_OVERRIDE_REJECTED: user={} reason='Invalid credentials'", userId);
            throw new IllegalArgumentException("Invalid administrative password for emergency override.");
        }

        if (request.reason() == null || request.reason().trim().length() < 15) {
            throw new IllegalArgumentException("Justification must be at least 15 characters long explaining the urgent override necessity.");
        }

        List<FocusSession> activeSessions = focusSessionRepository.findAllByUser_IdAndStatus(userId, FocusSessionStatus.ACTIVE);
        FocusSession activeSession = activeSessions.isEmpty() ? null : activeSessions.get(0);

        String targetMode = (request.targetMode() != null && !request.targetMode().isBlank())
                ? request.targetMode().toUpperCase()
                : "AUDIT_ONLY";
        if (!List.of("STRICT", "AUDIT_ONLY", "CONTAINMENT").contains(targetMode)) {
            targetMode = "AUDIT_ONLY";
        }

        SentinelTamperEvent overrideEvent = new SentinelTamperEvent(
                user,
                activeSession,
                "EMERGENCY_OVERRIDE",
                "CRITICAL",
                targetMode,
                request.reason().trim(),
                "Administrative emergency override authorized by user. Mode transitioned to " + targetMode
        );
        tamperEventRepository.save(overrideEvent);

        userEnforcementModes.put(userId, targetMode);
        log.warn("SENTINEL_EMERGENCY_OVERRIDE_EXECUTED: user={} session={} targetMode={} reason={}",
                userId, activeSession != null ? activeSession.getId() : null, targetMode, request.reason());
        webSocketEventService.broadcastSentinelStatus(userId, targetMode, false, 0, 0);

        return new EmergencyOverrideResponse(
                true,
                "Administrative emergency override authorized. Enforcement mode switched to " + targetMode + ".",
                targetMode,
                Instant.now()
        );
    }

    @Transactional(readOnly = true)
    public List<SentinelTamperEventItem> listTamperEvents(Long userId) {
        return listTamperEvents(userId, null);
    }

    @Transactional(readOnly = true)
    public List<SentinelTamperEventItem> listTamperEvents(Long userId, Long sessionId) {
        List<SentinelTamperEvent> events = sessionId == null
                ? tamperEventRepository.findTop20ByUser_IdOrderByCreatedAtDesc(userId)
                : tamperEventRepository.findTop20ByUser_IdAndFocusSession_IdOrderByCreatedAtDesc(userId, sessionId);
        return events
                .stream()
                .map(SentinelTamperEventItem::from)
                .toList();
    }

    private void persistTamperEventInNewTransaction(SentinelTamperEvent event) {
        auditTransactionTemplate.executeWithoutResult(status -> tamperEventRepository.save(event));
    }

    @Transactional
    public SentinelQuarantineItem recordExternalQuarantine(Long userId, RecordQuarantineRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

        List<FocusSession> activeSessions = focusSessionRepository.findAllByUser_IdAndStatus(userId, FocusSessionStatus.ACTIVE);
        FocusSession activeSession = activeSessions.isEmpty() ? null : activeSessions.get(0);

        String mode = request.enforcementMode() != null && !request.enforcementMode().isBlank()
                ? request.enforcementMode()
                : getEnforcementMode(userId);

        SentinelQuarantineRecord record = new SentinelQuarantineRecord(
                user,
                activeSession,
                request.pid(),
                request.processName(),
                request.commandLine(),
                request.policyAction(),
                mode,
                request.reason() != null && !request.reason().isBlank()
                        ? request.reason()
                        : "Enforced by native Rust shield daemon"
        );

        SentinelQuarantineRecord saved = quarantineRepository.save(record);
        webSocketEventService.broadcastQuarantine(userId, saved);

        log.warn("NATIVE_SHIELD_QUARANTINE_RECORDED: user={} pid={} process={} action={} mode={}",
                userId, request.pid(), request.processName(), request.policyAction(), mode);
        return SentinelQuarantineItem.from(saved);
    }

    @Transactional
    public BatchQuarantineResponse recordBatchQuarantines(Long userId, BatchQuarantineRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

        if (request == null || request.records() == null || request.records().isEmpty()) {
            return new BatchQuarantineResponse(0, 0, "No records provided in batch payload", Instant.now());
        }

        List<FocusSession> activeSessions = focusSessionRepository.findAllByUser_IdAndStatus(userId, FocusSessionStatus.ACTIVE);
        FocusSession activeSession = activeSessions.isEmpty() ? null : activeSessions.get(0);
        String defaultMode = getEnforcementMode(userId);

        List<SentinelQuarantineRecord> toSave = new ArrayList<>();
        int processedCount = 0;

        for (RecordQuarantineRequest item : request.records()) {
            if (item == null || item.processName() == null || item.processName().isBlank()) {
                continue;
            }
            processedCount++;

            String mode = item.enforcementMode() != null && !item.enforcementMode().isBlank()
                    ? item.enforcementMode()
                    : defaultMode;

            SentinelQuarantineRecord record = new SentinelQuarantineRecord(
                    user,
                    activeSession,
                    item.pid(),
                    item.processName(),
                    item.commandLine(),
                    item.policyAction() != null ? item.policyAction() : "TERMINATED",
                    mode,
                    item.reason() != null && !item.reason().isBlank()
                            ? item.reason()
                            : "Enforced by native Rust shield daemon (offline batch sync)"
            );
            toSave.add(record);
        }

        List<SentinelQuarantineRecord> saved = quarantineRepository.saveAll(toSave);
        webSocketEventService.broadcastQuarantines(userId, saved);

        log.warn("NATIVE_SHIELD_BATCH_QUARANTINE_RECORDED: user={} processed={} saved={}",
                userId, processedCount, saved.size());

        return new BatchQuarantineResponse(
                processedCount,
                saved.size(),
                String.format("Successfully synchronized %d quarantine records from offline spool", saved.size()),
                Instant.now()
        );
    }

    @Transactional(readOnly = true)
    public SentinelDaemonSyncResponse getDaemonSyncState(Long userId) {
        List<FocusSession> activeSessions = focusSessionRepository.findAllByUser_IdAndStatus(userId, FocusSessionStatus.ACTIVE);
        FocusSession activeSession = activeSessions.isEmpty() ? null : activeSessions.get(0);

        Mission currentMission = activeSession != null ? activeSession.getMission() : null;
        Long currentMissionId = currentMission != null ? currentMission.getId() : null;
        Long currentGoalId = currentMission != null
            ? currentMission.getGoal().getId()
            : activeSession != null && activeSession.getGoal() != null
                ? activeSession.getGoal().getId()
                : null;

        String mode = getEnforcementMode(userId);
        boolean isLocked = activeSession != null && "STRICT".equals(mode);

        Set<String> blockedPatterns = new HashSet<>(DEFAULT_DISTRACTIONS);
        Set<String> allowedPatterns = new HashSet<>();

        // Contextual policy: if there is an active session, its session exceptions are added to allowedPatterns
        if (activeSession != null) {
            allowedPatterns.addAll(exceptionService.getActiveProcessExceptionsForUser(userId));
        }

        List<SentinelPolicyRule> userRules = policyRuleRepository.findAllByUser_IdOrderByCreatedAtDesc(userId);
        for (SentinelPolicyRule rule : userRules) {
            String pat = rule.getProcessNamePattern().toLowerCase().trim();
            if ("BLOCKED".equalsIgnoreCase(rule.getPolicyType())) {
                blockedPatterns.add(pat);
            } else if ("ALLOWED".equalsIgnoreCase(rule.getPolicyType())) {
                allowedPatterns.add(pat);
            }
        }

        List<ActiveWarningItem> activeWarnings = activeSession != null
                ? warningService.getActiveWarningsForSession(activeSession.getId())
                : List.of();
        List<ActiveGraceWindowItem> activeGraceWindows = activeSession != null
                ? warningService.getActiveGraceWindowsForSession(activeSession.getId())
                : List.of();

        return new SentinelDaemonSyncResponse(
                activeSession != null,
                activeSession != null ? activeSession.getId() : null,
                activeSession != null ? (activeSession.getName() != null && !activeSession.getName().isBlank() ? activeSession.getName() : "Focus Sprint") : null,
                activeSession != null ? activeSession.getDurationMinutes() : null,
                activeSession != null ? activeSession.getIntention() : null,
                mode,
                isLocked,
                new ArrayList<>(blockedPatterns),
                new ArrayList<>(allowedPatterns),
                new ArrayList<>(PROTECTED_PROCESSES),
                Instant.now(),
                currentMissionId,
                currentGoalId,
                activeWarnings,
                activeGraceWindows
        );
    }
}
