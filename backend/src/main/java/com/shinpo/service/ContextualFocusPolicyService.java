package com.shinpo.service;

import com.shinpo.dto.ContextualFocusDtos.*;
import com.shinpo.entity.*;
import com.shinpo.repository.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class ContextualFocusPolicyService {

    private static final Duration POLICY_LEASE = Duration.ofSeconds(60);

    private final ContextualFocusResourceRepository resourceRepository;
    private final ContextualPolicyAuditEventRepository auditRepository;
    private final FocusSessionRepository focusSessionRepository;
    private final FocusSessionService focusSessionService;
    private final MissionRepository missionRepository;
    private final FocusSessionEnforcementExceptionRepository processExceptionRepository;
    private final UrlCanonicalizationService canonicalizationService;
    private final BrowserCompanionConnectionService companionConnectionService;
    private final SentinelEnforcementService sentinelEnforcementService;
    private final Clock clock;

    public ContextualFocusPolicyService(
            ContextualFocusResourceRepository resourceRepository,
            ContextualPolicyAuditEventRepository auditRepository,
            FocusSessionRepository focusSessionRepository,
            FocusSessionService focusSessionService,
            MissionRepository missionRepository,
            FocusSessionEnforcementExceptionRepository processExceptionRepository,
            UrlCanonicalizationService canonicalizationService,
            BrowserCompanionConnectionService companionConnectionService,
            SentinelEnforcementService sentinelEnforcementService,
            Clock clock
    ) {
        this.resourceRepository = resourceRepository;
        this.auditRepository = auditRepository;
        this.focusSessionRepository = focusSessionRepository;
        this.focusSessionService = focusSessionService;
        this.missionRepository = missionRepository;
        this.processExceptionRepository = processExceptionRepository;
        this.canonicalizationService = canonicalizationService;
        this.companionConnectionService = companionConnectionService;
        this.sentinelEnforcementService = sentinelEnforcementService;
        this.clock = clock;
    }

    @Transactional
    public ResourceResponse createResource(Long userId, CreateResourceRequest request) {
        if (request == null) {
            throw badRequest("Resource request is required");
        }
        if ((request.missionId() == null) == (request.focusSessionId() == null)) {
            throw badRequest("Exactly one of missionId or focusSessionId is required");
        }

        FocusSession session = null;
        Mission mission = null;
        User owner;
        if (request.focusSessionId() != null) {
            session = ownedSession(request.focusSessionId(), userId);
            owner = session.getUser();
        } else {
            mission = missionRepository.findByIdAndGoal_User_Id(request.missionId(), userId)
                    .orElseThrow(() -> notFound("Task not found: " + request.missionId()));
            owner = mission.getGoal().getUser();
        }

        validateResourceSemantics(request, session);
        String canonical;
        try {
            canonical = canonicalizationService.canonicalizeRule(
                    request.resourceType(),
                    request.matchType(),
                    request.destination()
            );
        } catch (IllegalArgumentException exception) {
            throw badRequest(exception.getMessage());
        }

        List<ContextualFocusResource> directResources;
        if (session != null) {
            directResources = resourceRepository.findAllByUser_IdAndFocusSession_IdOrderByCreatedAtDesc(userId, session.getId());
        } else if (mission != null) {
            directResources = resourceRepository.findAllByUser_IdAndMission_IdOrderByCreatedAtDesc(userId, mission.getId());
        } else {
            throw badRequest("Either focusSessionId or missionId must resolve to a valid entity");
        }
        Instant now = clock.instant();
        boolean duplicate = directResources.stream().anyMatch(existing ->
                existing.isEnabled()
                        && existing.getResourceType() == request.resourceType()
                        && existing.getMatchType() == request.matchType()
                        && existing.getDisposition() == request.disposition()
                        && existing.getCanonicalDestination().equals(canonical)
                        && (existing.getExpiresAt() == null || existing.getExpiresAt().isAfter(now))
        );
        if (duplicate) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "An equivalent active resource rule already exists");
        }

        ContextualFocusResource resource = new ContextualFocusResource();
        resource.setUser(owner);
        resource.setMission(mission);
        resource.setFocusSession(session);
        resource.setResourceType(request.resourceType());
        resource.setMatchType(request.matchType());
        resource.setDisposition(request.disposition());
        resource.setDestination(request.destination().trim());
        resource.setCanonicalDestination(canonical);
        resource.setDisplayName(trimToNull(request.displayName()));
        resource.setExpiresAt(request.expiresAt());
        resource.setBreakOnly(request.breakOnly());

        if (request.resourceType() == ContextualResourceType.DESKTOP_PROCESS) {
            if (session == null) {
                throw badRequest("Desktop process exceptions must be scoped to a Focus session");
            }
            if (processExceptionRepository.existsByFocusSession_IdAndActivityTypeAndActivityPatternIgnoreCase(
                    session.getId(),
                    FocusSessionActivityType.PROCESS,
                    canonical
            )) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "A process exception already exists for this session");
            }
            FocusSessionEnforcementException processException = processExceptionRepository.save(
                    new FocusSessionEnforcementException(session, canonical, FocusSessionActivityType.PROCESS)
            );
            resource.setProcessException(processException);
        }

        ContextualFocusResource saved = resourceRepository.save(resource);
        bumpAffectedPolicy(saved, "RESOURCE_CREATED");
        return ResourceResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public List<ResourceResponse> listResources(Long userId, Long missionId, Long sessionId) {
        List<ContextualFocusResource> resources;
        if (sessionId != null) {
            FocusSession session = ownedSession(sessionId, userId);
            if (missionId != null) {
                ownedMission(missionId, userId);
                if (session.getMission() == null || !missionId.equals(session.getMission().getId())) {
                    throw badRequest("Focus session is not linked to the requested task");
                }
            }
            Map<Long, ContextualFocusResource> combined = new LinkedHashMap<>();
            resourceRepository.findAllByUser_IdAndFocusSession_IdOrderByCreatedAtDesc(userId, sessionId)
                    .forEach(resource -> combined.put(resource.getId(), resource));
            if (session.getMission() != null) {
                resourceRepository.findAllByUser_IdAndMission_IdOrderByCreatedAtDesc(userId, session.getMission().getId())
                        .forEach(resource -> combined.put(resource.getId(), resource));
            }
            resources = new ArrayList<>(combined.values());
        } else if (missionId != null) {
            ownedMission(missionId, userId);
            resources = resourceRepository.findAllByUser_IdAndMission_IdOrderByCreatedAtDesc(userId, missionId);
        } else {
            resources = resourceRepository.findAllByUser_IdOrderByCreatedAtDesc(userId);
        }
        return resources.stream().map(ResourceResponse::from).toList();
    }

    @Transactional
    public void deleteResource(Long userId, Long resourceId) {
        ContextualFocusResource resource = resourceRepository.findByIdAndUser_Id(resourceId, userId)
                .orElseThrow(() -> notFound("Study resource not found: " + resourceId));
        resourceRepository.delete(resource);
        resourceRepository.flush();
        bumpAffectedPolicy(resource, "RESOURCE_DELETED");
    }

    @Transactional
    public SessionPolicySettingsResponse updateMode(Long userId, Long sessionId, ContextualFocusMode mode) {
        if (mode == null) {
            throw badRequest("Study mode is required");
        }
        FocusSession session = ownedSession(sessionId, userId);
        if (session.getStudyMode() != mode) {
            session.setStudyMode(mode);
            long revision = session.incrementContextPolicyRevision();
            focusSessionRepository.save(session);
            audit(session.getUser(), session, null, revision, "MODE_CHANGED");
        }
        return settingsResponse(session);
    }

    @Transactional
    public SessionPolicySettingsResponse updateAdapterSettings(
            Long userId,
            Long sessionId,
            UpdateAdapterSettingsRequest request
    ) {
        if (request == null) {
            throw badRequest("Adapter settings are required");
        }
        FocusSession session = ownedSession(sessionId, userId);
        boolean changed = false;
        if (request.restrictYoutubeShorts() != null
                && request.restrictYoutubeShorts() != session.isRestrictYoutubeShorts()) {
            session.setRestrictYoutubeShorts(request.restrictYoutubeShorts());
            changed = true;
        }
        if (request.restrictYoutubeHome() != null
                && request.restrictYoutubeHome() != session.isRestrictYoutubeHome()) {
            session.setRestrictYoutubeHome(request.restrictYoutubeHome());
            changed = true;
        }
        if (request.restrictUnapprovedYoutube() != null
                && request.restrictUnapprovedYoutube() != session.isRestrictUnapprovedYoutube()) {
            session.setRestrictUnapprovedYoutube(request.restrictUnapprovedYoutube());
            changed = true;
        }
        if (request.hideYoutubeRecommendations() != null
                && request.hideYoutubeRecommendations() != session.isHideYoutubeRecommendations()) {
            session.setHideYoutubeRecommendations(request.hideYoutubeRecommendations());
            changed = true;
        }
        if (changed) {
            long revision = session.incrementContextPolicyRevision();
            focusSessionRepository.save(session);
            audit(session.getUser(), session, null, revision, "ADAPTER_SETTINGS_CHANGED");
        }
        return settingsResponse(session);
    }

    @Transactional(readOnly = true)
    public PolicyEvaluationResponse evaluate(Long userId, Long sessionId, EvaluateResourceRequest request) {
        if (request == null || request.destination() == null || request.destination().isBlank()) {
            throw badRequest("Destination is required");
        }
        FocusSession session = ownedSession(sessionId, userId);
        return evaluateAt(session, request.destination(), clock.instant());
    }

    /** Visible for deterministic expiry/precedence tests without changing the system clock. */
    @Transactional(readOnly = true)
    public PolicyEvaluationResponse evaluateAt(
            Long userId,
            Long sessionId,
            String destination,
            Instant now
    ) {
        return evaluateAt(ownedSession(sessionId, userId), destination, now);
    }

    @Transactional
    public PolicySnapshotResponse getActivePolicy(Long userId) {
        FocusSession session = focusSessionRepository
                .findFirstByUser_IdAndStatusOrderByCreatedAtDesc(userId, FocusSessionStatus.ACTIVE)
                .orElseGet(() -> focusSessionRepository
                        .findFirstByUser_IdAndStatusOrderByCreatedAtDesc(userId, FocusSessionStatus.PAUSED)
                        .orElse(null));
        if (session != null && session.getStatus() == FocusSessionStatus.ACTIVE) {
            focusSessionService.getSession(session.getId(), userId);
            session = focusSessionRepository.findByIdAndUser_Id(session.getId(), userId).orElseThrow();
        }
        return session == null ? inactiveSnapshot(clock.instant()) : snapshot(session, clock.instant());
    }

    @Transactional
    public PolicySnapshotResponse getPolicy(Long userId, Long sessionId) {
        ownedSession(sessionId, userId);
        focusSessionService.getSession(sessionId, userId);
        return snapshot(ownedSession(sessionId, userId), clock.instant());
    }

    @Transactional
    public PolicySnapshotResponse createTemporaryException(
            Long userId,
            Long pathSessionId,
            TemporaryExceptionRequest request
    ) {
        if (request == null) {
            throw badRequest("Temporary exception request is required");
        }
        Long sessionId = pathSessionId != null ? pathSessionId : request.sessionId();
        if (sessionId == null) {
            throw badRequest("sessionId is required");
        }
        if (pathSessionId != null && request.sessionId() != null && !pathSessionId.equals(request.sessionId())) {
            throw badRequest("Path and request session IDs do not match");
        }
        FocusSession session = ownedSession(sessionId, userId);
        if (session.getStatus() != FocusSessionStatus.ACTIVE) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Temporary exceptions require an active Focus session");
        }
        if (request.durationMinutes() == null || request.durationMinutes() < 1 || request.durationMinutes() > 60) {
            throw badRequest("durationMinutes must be between 1 and 60");
        }

        createResource(userId, new CreateResourceRequest(
                null,
                sessionId,
                ContextualResourceType.TEMPORARY_SITE,
                ContextualResourceMatchType.EXACT,
                ContextualResourceDisposition.APPROVED,
                request.destination(),
                "Temporary exception",
                clock.instant().plus(Duration.ofMinutes(request.durationMinutes())),
                false
        ));
        return snapshot(session, clock.instant());
    }

    @Transactional(readOnly = true)
    public List<ResourceResponse> listRestrictions(Long userId, Long sessionId) {
        Instant now = clock.instant();
        return listResources(userId, null, sessionId).stream()
                .filter(resource -> resource.disposition() == ContextualResourceDisposition.BLOCKED)
                .filter(resource -> resource.enabled())
                .filter(resource -> resource.expiresAt() == null || resource.expiresAt().isAfter(now))
                .toList();
    }

    @Transactional(readOnly = true)
    public ContextualFocusStatusResponse getStatus(Long userId, Long requestedSessionId) {
        FocusSession session = requestedSessionId != null
                ? ownedSession(requestedSessionId, userId)
                : focusSessionRepository
                        .findFirstByUser_IdAndStatusOrderByCreatedAtDesc(userId, FocusSessionStatus.ACTIVE)
                        .orElseGet(() -> focusSessionRepository
                                .findFirstByUser_IdAndStatusOrderByCreatedAtDesc(userId, FocusSessionStatus.PAUSED)
                                .orElse(null));

        String sentinelStatus = sentinelEnforcementService.getSentinelStatus(userId).status();
        String nativeState;
        if (sentinelStatus == null || sentinelStatus.contains("UNAVAILABLE")) {
            nativeState = "DISCONNECTED";
        } else if (sentinelStatus.equals("ACTIVE") || sentinelStatus.equals("READY") || sentinelStatus.equals("STANDBY")) {
            nativeState = "CONNECTED";
        } else {
            nativeState = "DEGRADED";
        }

        return new ContextualFocusStatusResponse(
                session != null ? session.getId() : null,
                session != null ? session.getStatus() : null,
                session != null ? session.getStudyMode() : null,
                session != null ? session.getContextPolicyRevision() : 0L,
                companionConnectionService.getStatus(userId),
                new ProtectionComponentStatus(nativeState, sentinelStatus),
                session != null ? listRestrictions(userId, session.getId()) : List.of()
        );
    }

    @Transactional(readOnly = true)
    public List<PolicyAuditResponse> listAudit(Long userId, Long sessionId) {
        if (sessionId != null) {
            ownedSession(sessionId, userId);
            return auditRepository.findAllByFocusSession_IdOrderByPolicyRevisionAsc(sessionId)
                    .stream()
                    .map(PolicyAuditResponse::from)
                    .toList();
        }
        return auditRepository.findAllByUser_IdOrderByCreatedAtDesc(userId)
                .stream()
                .map(PolicyAuditResponse::from)
                .toList();
    }

    private PolicyEvaluationResponse evaluateAt(FocusSession session, String destination, Instant now) {
        Instant leaseExpiresAt = now.plus(POLICY_LEASE);
        if (session.getStatus() != FocusSessionStatus.ACTIVE) {
            return new PolicyEvaluationResponse(
                    ContextualPolicyDecision.INACTIVE,
                    "Contextual protection is inactive because this Focus session is not active",
                    null,
                    null,
                    session.getStudyMode(),
                    session.getContextPolicyRevision(),
                    now
            );
        }
        if (canonicalizationService.isBrowserInternalDestination(destination)) {
            return response(
                    session,
                    ContextualPolicyDecision.ALLOW,
                    "Browser and operating-system internal pages are outside content enforcement",
                    destination,
                    null,
                    leaseExpiresAt
            );
        }

        UrlCanonicalizationService.DestinationDescriptor descriptor;
        try {
            descriptor = canonicalizationService.analyzeDestination(destination);
        } catch (IllegalArgumentException exception) {
            return response(
                    session,
                    ContextualPolicyDecision.UNCERTAIN,
                    "The destination could not be safely canonicalized",
                    null,
                    null,
                    leaseExpiresAt
            );
        }

        boolean breakPhase = isBreakPermissionPhase(session.getCurrentPhase());
        List<ContextualFocusResource> applicable = applicableResources(session, now);
        if (!breakPhase && applicable.stream()
                .filter(ContextualFocusResource::isBreakOnly)
                .anyMatch(resource -> canonicalizationService.matches(resource, descriptor))) {
            return response(
                    session,
                    ContextualPolicyDecision.RESTRICT,
                    "This resource is only permitted during the configured break",
                    descriptor.canonicalUrl(),
                    null,
                    leaseExpiresAt
            );
        }
        List<ContextualFocusResource> matches = applicable.stream()
                .filter(resource -> resource.getDisposition() == ContextualResourceDisposition.BLOCKED
                        || (breakPhase ? resource.isBreakOnly() : !resource.isBreakOnly()))
                .filter(resource -> canonicalizationService.matches(resource, descriptor))
                .sorted(rulePrecedence())
                .toList();
        if (!matches.isEmpty()) {
            ContextualFocusResource winner = matches.get(0);
            if (winner.getDisposition() == ContextualResourceDisposition.APPROVED) {
                String reason = winner.getResourceType() == ContextualResourceType.TEMPORARY_SITE
                        ? "An unexpired session-scoped temporary exception allows this page"
                        : "This destination is an approved study resource";
                return response(
                        session,
                        ContextualPolicyDecision.ALLOW,
                        reason,
                        descriptor.canonicalUrl(),
                        winner.getId(),
                        leaseExpiresAt
                );
            }
            ContextualPolicyDecision blockedDecision = isBreakPermissionPhase(session.getCurrentPhase())
                    ? ContextualPolicyDecision.RESTRICT
                    : session.getStudyMode() == ContextualFocusMode.GUIDED
                    ? ContextualPolicyDecision.WARN
                    : ContextualPolicyDecision.RESTRICT;
            return response(
                    session,
                    blockedDecision,
                    "This destination matches an explicit Focus restriction",
                    descriptor.canonicalUrl(),
                    winner.getId(),
                    leaseExpiresAt
            );
        }

        if (isBreakPermissionPhase(session.getCurrentPhase())) {
            return response(
                    session,
                    ContextualPolicyDecision.RESTRICT,
                    "This destination is not on the approved break-resource list",
                    descriptor.canonicalUrl(),
                    null,
                    leaseExpiresAt
            );
        }

        boolean adapterRestriction = (session.isRestrictYoutubeShorts() && canonicalizationService.isYoutubeShorts(descriptor))
                || (session.isRestrictYoutubeHome() && canonicalizationService.isYoutubeHome(descriptor))
                || (session.isRestrictUnapprovedYoutube()
                    && canonicalizationService.isYoutubeDestination(descriptor)
                    && descriptor.youtubeVideoId() != null);
        if (adapterRestriction) {
            ContextualPolicyDecision decision = session.getStudyMode() == ContextualFocusMode.GUIDED
                    ? ContextualPolicyDecision.WARN
                    : ContextualPolicyDecision.RESTRICT;
            return response(
                    session,
                    decision,
                    "This YouTube route is explicitly restricted in the session adapter settings",
                    descriptor.canonicalUrl(),
                    null,
                    leaseExpiresAt
            );
        }

        if (session.getStudyMode() == ContextualFocusMode.GUIDED) {
            return response(
                    session,
                    ContextualPolicyDecision.ALLOW,
                    "Guided Focus keeps unmatched browsing available",
                    descriptor.canonicalUrl(),
                    null,
                    leaseExpiresAt
            );
        }
        return response(
                session,
                ContextualPolicyDecision.UNCERTAIN,
                "This destination has no explicit study-resource rule",
                descriptor.canonicalUrl(),
                null,
                leaseExpiresAt
        );
    }

    private PolicyEvaluationResponse response(
            FocusSession session,
            ContextualPolicyDecision decision,
            String reason,
            String canonicalDestination,
            Long matchedResourceId,
            Instant leaseExpiresAt
    ) {
        return new PolicyEvaluationResponse(
                decision,
                reason,
                canonicalDestination,
                matchedResourceId,
                session.getStudyMode(),
                session.getContextPolicyRevision(),
                leaseExpiresAt
        );
    }

    private PolicySnapshotResponse snapshot(FocusSession session, Instant now) {
        if (session.getStatus() != FocusSessionStatus.ACTIVE) {
            return new PolicySnapshotResponse(
                    session.getContextPolicyRevision(),
                    session.getId(),
                    session.getStatus(),
                    session.getCurrentPhase(),
                    session.calculateRemainingSeconds(now),
                    null,
                    session.getStudyMode(),
                    session.getMission() != null ? session.getMission().getId() : null,
                    session.getMission() != null ? session.getMission().getTitle() : session.getName(),
                    now,
                    now,
                    0L,
                    null,
                    List.of(),
                    AdapterSettings.from(session)
            );
        }

        List<ContextualFocusResource> resources = applicableResources(session, now);
        String returnUrl = resources.stream()
                .filter(resource -> resource.getDisposition() == ContextualResourceDisposition.APPROVED)
                .filter(resource -> resource.getResourceType() != ContextualResourceType.TEMPORARY_SITE)
                .filter(resource -> resource.getResourceType() != ContextualResourceType.DESKTOP_PROCESS)
                .sorted(Comparator.comparingInt(canonicalizationService::specificity).reversed())
                .map(canonicalizationService::safeReturnUrl)
                .filter(value -> value != null && !value.isBlank())
                .findFirst()
                .orElse(null);
        Instant leaseExpiresAt = now.plus(POLICY_LEASE);
        return new PolicySnapshotResponse(
                session.getContextPolicyRevision(),
                session.getId(),
                session.getStatus(),
                session.getCurrentPhase(),
                session.calculateRemainingSeconds(now),
                session.getStatus() == FocusSessionStatus.ACTIVE
                        ? now.plusSeconds(session.calculateRemainingSeconds(now)) : null,
                session.getStudyMode(),
                session.getMission() != null ? session.getMission().getId() : null,
                session.getMission() != null ? session.getMission().getTitle() : session.getName(),
                now,
                leaseExpiresAt,
                POLICY_LEASE.toSeconds(),
                returnUrl,
                resources.stream().map(ResourceResponse::from).toList(),
                AdapterSettings.from(session)
        );
    }

    private PolicySnapshotResponse inactiveSnapshot(Instant now) {
        return new PolicySnapshotResponse(
                0L,
                null,
                null,
                null,
                0L,
                null,
                null,
                null,
                null,
                now,
                now,
                0L,
                null,
                List.of(),
                null
        );
    }

    private boolean isBreakPermissionPhase(SessionIntervalType phase) {
        return phase == SessionIntervalType.SHORT_BREAK
                || phase == SessionIntervalType.LONG_BREAK
                || phase == SessionIntervalType.GRACE;
    }

    private List<ContextualFocusResource> applicableResources(FocusSession session, Instant now) {
        return resourceRepository.findApplicableActiveResources(
                session.getUser().getId(),
                session.getId(),
                session.getMission() != null ? session.getMission().getId() : null,
                now
        );
    }

    /**
     * Explicit precedence (highest first): temporary exception; exact/video/channel;
     * URL pattern; domain. At equal specificity, BLOCKED wins so an explicit
     * same-scope restriction is never silently weakened. A specific approval
     * still outranks a broader block (for example, approved video over blocked
     * youtube.com domain).
     */
    private Comparator<ContextualFocusResource> rulePrecedence() {
        return Comparator
                .comparingInt(canonicalizationService::specificity)
                .reversed()
                .thenComparingInt(resource -> resource.getDisposition() == ContextualResourceDisposition.BLOCKED ? 0 : 1)
                .thenComparingLong(resource -> resource.getId() != null ? resource.getId() : Long.MAX_VALUE);
    }

    private void validateResourceSemantics(CreateResourceRequest request, FocusSession session) {
        if (request.resourceType() == null || request.matchType() == null || request.disposition() == null) {
            throw badRequest("resourceType, matchType, and disposition are required");
        }
        if (request.expiresAt() != null && !request.expiresAt().isAfter(clock.instant())) {
            throw badRequest("expiresAt must be in the future");
        }
        if (request.breakOnly() && (session == null || request.disposition() != ContextualResourceDisposition.APPROVED)) {
            throw badRequest("Break-only resources must be approved and scoped to a Focus session");
        }
        if (request.resourceType() == ContextualResourceType.TEMPORARY_SITE) {
            if (session == null
                    || request.disposition() != ContextualResourceDisposition.APPROVED
                    || request.expiresAt() == null) {
                throw badRequest("Temporary sites must be approved, session-scoped, and have a future expiry");
            }
        }
        if (request.resourceType() == ContextualResourceType.DESKTOP_PROCESS) {
            if (session == null || request.disposition() != ContextualResourceDisposition.APPROVED) {
                throw badRequest("Desktop process exceptions must be approved and scoped to a Focus session");
            }
        }
    }

    private void bumpAffectedPolicy(ContextualFocusResource resource, String changeType) {
        if (resource.getFocusSession() != null) {
            FocusSession session = resource.getFocusSession();
            long revision = session.incrementContextPolicyRevision();
            focusSessionRepository.save(session);
            audit(resource.getUser(), session, resource.getId(), revision, changeType);
            return;
        }

        List<FocusSession> affected = focusSessionRepository.findAllByUser_IdAndMission_Id(
                resource.getUser().getId(),
                resource.getMission().getId()
        );
        if (affected.isEmpty()) {
            audit(resource.getUser(), null, resource.getId(), 0L, changeType);
            return;
        }
        for (FocusSession session : affected) {
            long revision = session.incrementContextPolicyRevision();
            focusSessionRepository.save(session);
            audit(resource.getUser(), session, resource.getId(), revision, changeType);
        }
    }

    private void audit(
            User user,
            FocusSession session,
            Long resourceId,
            long revision,
            String changeType
    ) {
        auditRepository.save(new ContextualPolicyAuditEvent(user, session, resourceId, revision, changeType));
    }

    private SessionPolicySettingsResponse settingsResponse(FocusSession session) {
        return new SessionPolicySettingsResponse(
                session.getId(),
                session.getStudyMode(),
                session.getContextPolicyRevision(),
                AdapterSettings.from(session)
        );
    }

    private FocusSession ownedSession(Long sessionId, Long userId) {
        return focusSessionRepository.findByIdAndUser_Id(sessionId, userId)
                .orElseThrow(() -> notFound("Focus session not found: " + sessionId));
    }

    private Mission ownedMission(Long missionId, Long userId) {
        return missionRepository.findByIdAndGoal_User_Id(missionId, userId)
                .orElseThrow(() -> notFound("Task not found: " + missionId));
    }

    private ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    private ResponseStatusException notFound(String message) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, message);
    }

    private String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
