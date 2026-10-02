package com.shinpo.service;

import com.shinpo.dto.SentinelDtos.ActiveGraceWindowItem;
import com.shinpo.dto.SentinelDtos.ActiveWarningItem;
import com.shinpo.dto.SentinelWarningDtos.*;
import com.shinpo.entity.*;
import com.shinpo.repository.FocusSessionRepository;
import com.shinpo.repository.SentinelEnforcementWarningRepository;
import com.shinpo.repository.SentinelGraceWindowRepository;
import com.shinpo.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class SentinelWarningService {

    private static final Logger log = LoggerFactory.getLogger(SentinelWarningService.class);
    public static final Duration WARNING_DECISION_WINDOW = Duration.ofSeconds(60);
    public static final int MIN_GRACE_MINUTES = 1;
    public static final int MAX_GRACE_MINUTES = 20;

    private final SentinelEnforcementWarningRepository warningRepository;
    private final SentinelGraceWindowRepository graceWindowRepository;
    private final FocusSessionRepository focusSessionRepository;
    private final UserRepository userRepository;
    private final ContextualEnforcementDecisionService contextualDecisionService;

    public SentinelWarningService(
            SentinelEnforcementWarningRepository warningRepository,
            SentinelGraceWindowRepository graceWindowRepository,
            FocusSessionRepository focusSessionRepository,
            UserRepository userRepository,
            ContextualEnforcementDecisionService contextualDecisionService
    ) {
        this.warningRepository = warningRepository;
        this.graceWindowRepository = graceWindowRepository;
        this.focusSessionRepository = focusSessionRepository;
        this.userRepository = userRepository;
        this.contextualDecisionService = contextualDecisionService;
    }

    @Transactional
    public SentinelWarningResponse issueWarning(Long userId, IssueWarningRequest request) {
        if (userId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User authentication required");
        }
        if (request == null || request.processName() == null || request.processName().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Process name cannot be empty");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found: " + userId));

        // Resolve active focus session
        FocusSession session;
        if (request.focusSessionId() != null) {
            session = focusSessionRepository.findById(request.focusSessionId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Focus session not found: " + request.focusSessionId()));
            if (!session.getUser().getId().equals(userId)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Focus session does not belong to authenticated user");
            }
        } else {
            List<FocusSession> activeSessions = focusSessionRepository.findAllByUser_IdAndStatus(userId, FocusSessionStatus.ACTIVE);
            if (activeSessions.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No active focus session found for user");
            }
            session = activeSessions.get(0);
        }

        if (session.getStatus() != FocusSessionStatus.ACTIVE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Warnings can only be issued for ACTIVE focus sessions");
        }

        String canonicalProcessName = request.processName().trim().toLowerCase();

        // Expire any stale warnings / grace windows before evaluating state
        expireStaleItems();

        // Check if an active/issued warning already exists for this session + process
        Optional<SentinelEnforcementWarning> existingWarning = warningRepository
                .findByFocusSession_IdAndProcessNameAndStatusIn(
                        session.getId(),
                        canonicalProcessName,
                        List.of(SentinelWarningStatus.ISSUED, SentinelWarningStatus.GRACE_ACTIVE)
                );
        if (existingWarning.isPresent()) {
            SentinelEnforcementWarning w = existingWarning.get();
            SentinelGraceWindow g = graceWindowRepository.findByWarningId(w.getWarningId()).orElse(null);
            return SentinelWarningResponse.from(w, g);
        }

        // Rule: Maximum one completed/granted grace lifecycle per process per FocusSession
        boolean graceAlreadyConsumed = graceWindowRepository.existsByFocusSession_IdAndProcessNameAndStatusIn(
                session.getId(),
                canonicalProcessName,
                List.of(SentinelGraceStatus.ACTIVE, SentinelGraceStatus.EXPIRED, SentinelGraceStatus.CONSUMED)
        );
        if (graceAlreadyConsumed) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Grace window has already been granted for process '" + canonicalProcessName + "' in this session"
            );
        }

        Instant now = Instant.now();
        Instant deadline = now.plus(WARNING_DECISION_WINDOW);

        SentinelEnforcementWarning warning = new SentinelEnforcementWarning(
                user,
                session,
                canonicalProcessName,
                request.commandLine(),
                now,
                deadline
        );

        SentinelEnforcementWarning saved = warningRepository.save(warning);
        log.info("SENTINEL_WARNING_ISSUED: user={} session={} process={} warningId={} deadline={}",
                userId, session.getId(), canonicalProcessName, saved.getWarningId(), deadline);

        return SentinelWarningResponse.from(saved);
    }

    @Transactional
    public SentinelWarningResponse respondToWarning(Long userId, UUID warningId, RespondWarningRequest request) {
        if (userId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User authentication required");
        }
        if (warningId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Warning ID cannot be null");
        }
        if (request == null || request.action() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Action must be specified");
        }

        // Expire stale items
        expireStaleItems();

        SentinelEnforcementWarning warning = warningRepository.findByWarningIdAndUser_Id(warningId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Warning not found or access denied"));

        // Validate warning status
        if (warning.getStatus() != SentinelWarningStatus.ISSUED) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Warning is not in ISSUED state (current status: " + warning.getStatus() + ")"
            );
        }

        Instant now = Instant.now();
        if (now.isAfter(warning.getDecisionDeadline())) {
            warning.setStatus(SentinelWarningStatus.EXPIRED);
            warningRepository.save(warning);
            throw new ResponseStatusException(HttpStatus.GONE, "Warning decision deadline has expired");
        }

        FocusSession session = warning.getFocusSession();
        if (session == null || session.getStatus() != FocusSessionStatus.ACTIVE) {
            warning.setStatus(SentinelWarningStatus.CANCELLED);
            warningRepository.save(warning);
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Associated focus session is no longer active"
            );
        }

        String action = request.action().trim().toUpperCase();

        if ("TERMINATE_NOW".equals(action)) {
            warning.setStatus(SentinelWarningStatus.TERMINATE_NOW);
            SentinelEnforcementWarning saved = warningRepository.save(warning);
            log.info("SENTINEL_WARNING_TERMINATE_NOW: user={} warningId={} process={}",
                    userId, warningId, warning.getProcessName());
            return SentinelWarningResponse.from(saved);
        }

        if ("GRANT_GRACE".equals(action)) {
            Integer requestedMinutes = request.graceMinutes();
            if (requestedMinutes == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "graceMinutes must be provided for GRANT_GRACE");
            }
            if (requestedMinutes < MIN_GRACE_MINUTES || requestedMinutes > MAX_GRACE_MINUTES) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Grace minutes must be between " + MIN_GRACE_MINUTES + " and " + MAX_GRACE_MINUTES + " minutes"
                );
            }

            // Verify one grace lifecycle per process per session
            boolean alreadyHasGrace = graceWindowRepository.existsByFocusSession_IdAndProcessNameAndStatusIn(
                    session.getId(),
                    warning.getProcessName(),
                    List.of(SentinelGraceStatus.ACTIVE, SentinelGraceStatus.EXPIRED, SentinelGraceStatus.CONSUMED)
            );
            if (alreadyHasGrace) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Grace period already utilized for process '" + warning.getProcessName() + "' in this session"
                );
            }

            // Calculate expiration server-side
            Instant calculatedExpiresAt = now.plus(Duration.ofMinutes(requestedMinutes));

            // Cap to session remaining lifetime if session remaining time is less than requested grace
            long remainingSecondsInSession = session.calculateRemainingSeconds(now);
            if (remainingSecondsInSession <= 0) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Focus session duration has expired; cannot grant grace"
                );
            }

            Instant sessionEnd = now.plusSeconds(remainingSecondsInSession);
            if (calculatedExpiresAt.isAfter(sessionEnd)) {
                calculatedExpiresAt = sessionEnd;
            }

            // Effective duration in whole minutes (at least 1 minute)
            int effectiveMinutes = (int) Math.max(1, Duration.between(now, calculatedExpiresAt).toMinutes());

            SentinelGraceWindow grace = new SentinelGraceWindow(
                    warning.getWarningId(),
                    session,
                    warning.getUser(),
                    warning.getProcessName(),
                    now,
                    calculatedExpiresAt,
                    effectiveMinutes
            );

            SentinelGraceWindow savedGrace = graceWindowRepository.save(grace);

            warning.setStatus(SentinelWarningStatus.GRACE_ACTIVE);
            SentinelEnforcementWarning savedWarning = warningRepository.save(warning);

            log.info("SENTINEL_GRACE_GRANTED: user={} warningId={} process={} expiresAt={} durationMinutes={}",
                    userId, warningId, warning.getProcessName(), calculatedExpiresAt, effectiveMinutes);

            return SentinelWarningResponse.from(savedWarning, savedGrace);
        }

        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown action: " + action);
    }

    @Transactional
    public List<SentinelWarningResponse> getActiveWarningsForUser(Long userId) {
        if (userId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User authentication required");
        }

        expireStaleItems();

        Instant now = Instant.now();
        List<SentinelEnforcementWarning> warnings = warningRepository
                .findAllByUser_IdAndStatusInOrderByIssuedAtDesc(
                        userId,
                        List.of(SentinelWarningStatus.ISSUED, SentinelWarningStatus.GRACE_ACTIVE)
                );

        return warnings.stream()
                .filter(w -> {
                    if (w.getStatus() == SentinelWarningStatus.ISSUED) {
                        return w.getDecisionDeadline().isAfter(now);
                    }
                    if (w.getStatus() == SentinelWarningStatus.GRACE_ACTIVE) {
                        Optional<SentinelGraceWindow> grace = graceWindowRepository.findByWarningId(w.getWarningId());
                        return grace.isPresent()
                                && grace.get().getStatus() == SentinelGraceStatus.ACTIVE
                                && grace.get().getExpiresAt().isAfter(now);
                    }
                    return false;
                })
                .map(w -> {
                    SentinelGraceWindow grace = null;
                    if (w.getStatus() == SentinelWarningStatus.GRACE_ACTIVE) {
                        grace = graceWindowRepository.findByWarningId(w.getWarningId()).orElse(null);
                    }
                    return SentinelWarningResponse.from(w, grace);
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public Optional<SentinelGraceWindow> getActiveGraceWindow(Long sessionId, String processName) {
        if (sessionId == null || processName == null || processName.isBlank()) {
            return Optional.empty();
        }
        String canonical = processName.trim().toLowerCase();
        Optional<SentinelGraceWindow> graceOpt = graceWindowRepository
                .findByFocusSession_IdAndProcessNameAndStatus(sessionId, canonical, SentinelGraceStatus.ACTIVE);

        if (graceOpt.isEmpty()) {
            return Optional.empty();
        }

        SentinelGraceWindow grace = graceOpt.get();
        if (Instant.now().isAfter(grace.getExpiresAt())) {
            return Optional.empty();
        }
        return Optional.of(grace);
    }

    @Transactional
    public void expireStaleItems() {
        Instant now = Instant.now();
        warningRepository.expireStaleWarnings(SentinelWarningStatus.EXPIRED, now);
        warningRepository.expireGraceActiveWarnings(SentinelWarningStatus.EXPIRED, SentinelGraceStatus.CONSUMED, now);
        graceWindowRepository.expireStaleGraceWindows(SentinelGraceStatus.EXPIRED, now);
    }

    @Transactional
    public List<ActiveWarningItem> getActiveWarningsForSession(Long sessionId) {
        if (sessionId == null) {
            return List.of();
        }
        expireStaleItems();
        Instant now = Instant.now();
        return warningRepository.findAllByFocusSession_IdAndStatus(sessionId, SentinelWarningStatus.ISSUED)
                .stream()
                .filter(w -> w.getDecisionDeadline().isAfter(now))
                .map(w -> new ActiveWarningItem(w.getWarningId(), w.getProcessName(), w.getDecisionDeadline(), w.getStatus().name()))
                .toList();
    }

    @Transactional
    public List<ActiveGraceWindowItem> getActiveGraceWindowsForSession(Long sessionId) {
        if (sessionId == null) {
            return List.of();
        }
        expireStaleItems();
        Instant now = Instant.now();
        return graceWindowRepository.findAllByFocusSession_IdAndStatus(sessionId, SentinelGraceStatus.ACTIVE)
                .stream()
                .filter(g -> g.getExpiresAt().isAfter(now))
                .map(g -> new ActiveGraceWindowItem(g.getWarningId(), g.getProcessName(), g.getExpiresAt()))
                .toList();
    }

    @Transactional
    public CandidateProcessResponse evaluateCandidate(Long userId, CandidateProcessRequest request) {
        if (userId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User authentication required");
        }
        if (request == null || request.processName() == null || request.processName().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Process name cannot be empty");
        }

        String canonical = request.processName().trim().toLowerCase();

        // 1. Contextual policy check (protected processes, session exceptions, user allowed/blocked rules)
        ContextualEnforcementDecisionService.PolicyDecision policyDecision =
                contextualDecisionService.evaluateProcess(userId, canonical);
        if (policyDecision == ContextualEnforcementDecisionService.PolicyDecision.ALLOW) {
            return new CandidateProcessResponse("ALLOW", null, null, null, "Process permitted by contextual policy");
        }

        // 2. Active FocusSession resolution (scoped strictly to authenticated user)
        List<FocusSession> activeSessions = focusSessionRepository.findAllByUser_IdAndStatus(userId, FocusSessionStatus.ACTIVE);
        if (activeSessions.isEmpty()) {
            // Fail-closed: no active focus session means no destructive enforcement
            return new CandidateProcessResponse("ALLOW", null, null, null, "No active focus session");
        }
        FocusSession session = activeSessions.get(0);

        // 3. Expire stale warnings and grace windows
        expireStaleItems();
        Instant now = Instant.now();

        // 4. Check for active unexpired grace window
        Optional<SentinelGraceWindow> activeGrace = graceWindowRepository
                .findByFocusSession_IdAndProcessNameAndStatus(session.getId(), canonical, SentinelGraceStatus.ACTIVE);
        if (activeGrace.isPresent() && activeGrace.get().getExpiresAt().isAfter(now)) {
            SentinelGraceWindow grace = activeGrace.get();
            return new CandidateProcessResponse(
                    "DEFER_GRACE",
                    grace.getWarningId(),
                    null,
                    grace.getExpiresAt(),
                    "Active grace window in effect"
            );
        }

        // 5. Check for active unexpired warning
        Optional<SentinelEnforcementWarning> activeWarning = warningRepository
                .findByFocusSession_IdAndProcessNameAndStatusIn(
                        session.getId(),
                        canonical,
                        List.of(SentinelWarningStatus.ISSUED)
                );
        if (activeWarning.isPresent() && activeWarning.get().getDecisionDeadline().isAfter(now)) {
            SentinelEnforcementWarning w = activeWarning.get();
            return new CandidateProcessResponse(
                    "DEFER_WARNING",
                    w.getWarningId(),
                    w.getDecisionDeadline(),
                    null,
                    "Active warning awaiting user decision"
            );
        }

        // 6. Check if grace was already consumed or if warning has expired / been commanded to terminate
        boolean graceConsumedOrExpired = graceWindowRepository.existsByFocusSession_IdAndProcessNameAndStatusIn(
                session.getId(),
                canonical,
                List.of(SentinelGraceStatus.ACTIVE, SentinelGraceStatus.EXPIRED, SentinelGraceStatus.CONSUMED)
        );
        boolean warningExpiredOrTerminated = warningRepository.existsByFocusSession_IdAndProcessNameAndStatusIn(
                session.getId(),
                canonical,
                List.of(SentinelWarningStatus.EXPIRED, SentinelWarningStatus.TERMINATE_NOW)
        );

        if (graceConsumedOrExpired || warningExpiredOrTerminated) {
            String lifecycleReason = graceConsumedOrExpired ? "GRACE_EXPIRED" : "WARNING_EXPIRED";
            return new CandidateProcessResponse(
                    "ENFORCE_TERMINATE",
                    null,
                    null,
                    null,
                    "Warning decision deadline or grace window has expired; enforcement authorized (" + lifecycleReason + ")"
            );
        }

        // 7. No prior warning or grace: issue warning on first detection
        SentinelWarningResponse issued = issueWarning(userId, new IssueWarningRequest(session.getId(), canonical, request.commandLine()));
        return new CandidateProcessResponse(
                "DEFER_WARNING",
                issued.warningId(),
                issued.decisionDeadline(),
                null,
                "New warning issued on candidate detection; enforcement deferred"
        );
    }

    @Transactional
    public String handleQuarantineRecorded(Long sessionId, String processName) {
        if (sessionId == null || processName == null || processName.isBlank()) {
            return null;
        }
        String canonical = processName.trim().toLowerCase();

        Optional<SentinelGraceWindow> graceOpt = graceWindowRepository
                .findByFocusSession_IdAndProcessNameAndStatusIn(
                        sessionId,
                        canonical,
                        List.of(SentinelGraceStatus.ACTIVE, SentinelGraceStatus.EXPIRED, SentinelGraceStatus.CONSUMED)
                );

        if (graceOpt.isPresent()) {
            SentinelGraceWindow grace = graceOpt.get();
            if (grace.getStatus() != SentinelGraceStatus.CONSUMED) {
                grace.setStatus(SentinelGraceStatus.CONSUMED);
                graceWindowRepository.save(grace);
            }

            warningRepository.findByWarningId(grace.getWarningId()).ifPresent(w -> {
                if (w.getStatus() == SentinelWarningStatus.GRACE_ACTIVE || w.getStatus() == SentinelWarningStatus.ISSUED) {
                    w.setStatus(SentinelWarningStatus.EXPIRED);
                    warningRepository.save(w);
                }
            });

            return "GRACE_EXPIRED";
        }

        boolean hadWarning = warningRepository.existsByFocusSession_IdAndProcessNameAndStatusIn(
                sessionId,
                canonical,
                List.of(SentinelWarningStatus.EXPIRED, SentinelWarningStatus.TERMINATE_NOW, SentinelWarningStatus.ISSUED)
        );
        if (hadWarning) {
            warningRepository.findByFocusSession_IdAndProcessNameAndStatusIn(
                    sessionId,
                    canonical,
                    List.of(SentinelWarningStatus.ISSUED)
            ).ifPresent(w -> {
                w.setStatus(SentinelWarningStatus.EXPIRED);
                warningRepository.save(w);
            });
            return "WARNING_EXPIRED";
        }

        return null;
    }
}
