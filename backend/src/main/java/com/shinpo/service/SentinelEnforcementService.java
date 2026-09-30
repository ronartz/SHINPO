package com.shinpo.service;

import com.shinpo.dto.SentinelDtos.*;
import com.shinpo.entity.FocusSession;
import com.shinpo.entity.FocusSessionStatus;
import com.shinpo.entity.SentinelPolicyRule;
import com.shinpo.entity.SentinelQuarantineRecord;
import com.shinpo.entity.User;
import com.shinpo.repository.FocusSessionRepository;
import com.shinpo.repository.SentinelPolicyRuleRepository;
import com.shinpo.repository.SentinelQuarantineRepository;
import com.shinpo.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.File;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.*;
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
            "discord", "steam", "spotify", "telegram-desktop", "vlc", "obs",
            "game", "lutris", "heroic", "battlenet", "riotclientservices", "epicgameslauncher",
            "tiktok", "netflix", "youtube"
    );

    private final FocusSessionRepository focusSessionRepository;
    private final SentinelQuarantineRepository quarantineRepository;
    private final SentinelPolicyRuleRepository policyRuleRepository;
    private final UserRepository userRepository;

    // Per-user enforcement mode (default STRICT)
    private final Map<Long, String> userEnforcementModes = new ConcurrentHashMap<>();

    // Debounce cache: key = "userId_pid", value = Instant of last logged quarantine
    private final Map<String, Instant> debounceMap = new ConcurrentHashMap<>();

    private volatile Instant lastGlobalSweep = Instant.now();

    public SentinelEnforcementService(
            FocusSessionRepository focusSessionRepository,
            SentinelQuarantineRepository quarantineRepository,
            SentinelPolicyRuleRepository policyRuleRepository,
            UserRepository userRepository
    ) {
        this.focusSessionRepository = focusSessionRepository;
        this.quarantineRepository = quarantineRepository;
        this.policyRuleRepository = policyRuleRepository;
        this.userRepository = userRepository;
    }

    public String getEnforcementMode(Long userId) {
        return userEnforcementModes.getOrDefault(userId, "STRICT");
    }

    public void setEnforcementMode(Long userId, String mode) {
        if (mode == null || mode.isBlank()) {
            mode = "STRICT";
        }
        String upper = mode.toUpperCase();
        if (!List.of("STRICT", "AUDIT_ONLY", "CONTAINMENT").contains(upper)) {
            throw new IllegalArgumentException("Invalid enforcement mode: " + mode + ". Must be STRICT, AUDIT_ONLY, or CONTAINMENT.");
        }
        userEnforcementModes.put(userId, upper);
        log.info("SENTINEL_MODE_UPDATED: user={} mode={}", userId, upper);
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

        return executeSweepForUser(user, activeSession);
    }

    @Scheduled(fixedRate = 5000)
    @Transactional
    public void sweepActiveFocusSessions() {
        lastGlobalSweep = Instant.now();
        List<FocusSession> allActive = focusSessionRepository.findAll().stream()
                .filter(s -> s.getStatus() == FocusSessionStatus.ACTIVE)
                .toList();

        if (allActive.isEmpty()) {
            return;
        }

        Set<Long> processedUsers = new HashSet<>();
        for (FocusSession session : allActive) {
            User user = session.getUser();
            if (user != null && processedUsers.add(user.getId())) {
                try {
                    executeSweepForUser(user, session);
                } catch (Exception e) {
                    log.error("Error executing Sentinel sweep for user {}: {}", user.getId(), e.getMessage());
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

            if ("STRICT".equals(mode) && activeSession != null) {
                boolean terminated = handle.destroy();
                if (!terminated) {
                    terminated = handle.destroyForcibly();
                }
                actionTaken = terminated ? "TERMINATED" : "TERMINATE_ATTEMPTED";
                reason = "Autonomous sprint enforcement: process terminated forcibly";
            } else if ("CONTAINMENT".equals(mode) && activeSession != null) {
                boolean destroyed = handle.destroy();
                actionTaken = destroyed ? "CONTAINED" : "CONTAINMENT_FAILED";
                reason = "Autonomous sprint containment: process quarantined";
            } else {
                actionTaken = "WARNED";
                reason = "Sentinel audit: distraction detected during focus window";
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
}
