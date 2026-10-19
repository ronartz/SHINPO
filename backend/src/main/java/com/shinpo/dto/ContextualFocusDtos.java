package com.shinpo.dto;

import com.shinpo.entity.*;
import jakarta.validation.constraints.*;

import java.time.Instant;
import java.util.List;

public final class ContextualFocusDtos {

    private ContextualFocusDtos() {}

    public record CreateResourceRequest(
            Long missionId,
            Long focusSessionId,
            @NotNull ContextualResourceType resourceType,
            @NotNull ContextualResourceMatchType matchType,
            @NotNull ContextualResourceDisposition disposition,
            @NotBlank @Size(max = 4096) String destination,
            @Size(max = 200) String displayName,
            Instant expiresAt
    ) {}

    public record ResourceResponse(
            Long id,
            Long userId,
            Long missionId,
            Long focusSessionId,
            Long processExceptionId,
            ContextualResourceType resourceType,
            ContextualResourceMatchType matchType,
            ContextualResourceDisposition disposition,
            String destination,
            String canonicalDestination,
            String displayName,
            Instant expiresAt,
            boolean enabled,
            Instant createdAt,
            Instant updatedAt
    ) {
        public static ResourceResponse from(ContextualFocusResource resource) {
            return new ResourceResponse(
                    resource.getId(),
                    resource.getUser() != null ? resource.getUser().getId() : null,
                    resource.getMission() != null ? resource.getMission().getId() : null,
                    resource.getFocusSession() != null ? resource.getFocusSession().getId() : null,
                    resource.getProcessException() != null ? resource.getProcessException().getId() : null,
                    resource.getResourceType(),
                    resource.getMatchType(),
                    resource.getDisposition(),
                    resource.getDestination(),
                    resource.getCanonicalDestination(),
                    resource.getDisplayName(),
                    resource.getExpiresAt(),
                    resource.isEnabled(),
                    resource.getCreatedAt(),
                    resource.getUpdatedAt()
            );
        }
    }

    public record UpdateModeRequest(@NotNull ContextualFocusMode mode) {}

    public record UpdateAdapterSettingsRequest(
            Boolean restrictYoutubeShorts,
            Boolean restrictYoutubeHome,
            Boolean restrictUnapprovedYoutube,
            Boolean hideYoutubeRecommendations
    ) {}

    public record AdapterSettings(
            boolean restrictYoutubeShorts,
            boolean restrictYoutubeHome,
            boolean restrictUnapprovedYoutube,
            boolean hideYoutubeRecommendations
    ) {
        public static AdapterSettings from(FocusSession session) {
            return new AdapterSettings(
                    session.isRestrictYoutubeShorts(),
                    session.isRestrictYoutubeHome(),
                    session.isRestrictUnapprovedYoutube(),
                    session.isHideYoutubeRecommendations()
            );
        }
    }

    public record SessionPolicySettingsResponse(
            Long sessionId,
            ContextualFocusMode mode,
            long policyRevision,
            AdapterSettings adapterSettings
    ) {}

    public record EvaluateResourceRequest(
            @NotBlank @Size(max = 4096) String destination,
            ContextualResourceType resourceType
    ) {}

    public record PolicyEvaluationResponse(
            ContextualPolicyDecision decision,
            String reason,
            String canonicalDestination,
            Long matchedResourceId,
            ContextualFocusMode mode,
            long policyVersion,
            Instant leaseExpiresAt
    ) {}

    public record TemporaryExceptionRequest(
            Long sessionId,
            @NotBlank @Size(max = 4096) String destination,
            @NotNull @Min(1) @Max(60) Integer durationMinutes
    ) {}

    public record PolicySnapshotResponse(
            long policyVersion,
            Long sessionId,
            FocusSessionStatus status,
            ContextualFocusMode mode,
            Long taskId,
            String taskTitle,
            Instant issuedAt,
            Instant leaseExpiresAt,
            long leaseSeconds,
            String returnUrl,
            List<ResourceResponse> resources,
            AdapterSettings adapterSettings
    ) {}

    public record CompanionHeartbeatRequest(
            @NotBlank @Size(max = 100) String adapterName,
            @Size(max = 50) String version,
            @Size(max = 50) String platform,
            @Pattern(regexp = "FULL|LIMITED|NONE") String adapterCoverage
    ) {}

    public record CompanionConnectionResponse(
            String state,
            String adapterCoverage,
            String adapterName,
            String detail,
            Instant lastSeenAt
    ) {}

    public record ProtectionComponentStatus(
            String state,
            String detail
    ) {}

    public record ContextualFocusStatusResponse(
            Long sessionId,
            FocusSessionStatus sessionStatus,
            ContextualFocusMode mode,
            long policyRevision,
            CompanionConnectionResponse browserCompanion,
            ProtectionComponentStatus nativeShield,
            List<ResourceResponse> restrictions
    ) {}

    public record PolicyAuditResponse(
            Long id,
            Long sessionId,
            Long resourceId,
            long policyRevision,
            String changeType,
            Instant createdAt
    ) {
        public static PolicyAuditResponse from(ContextualPolicyAuditEvent event) {
            return new PolicyAuditResponse(
                    event.getId(),
                    event.getFocusSession() != null ? event.getFocusSession().getId() : null,
                    event.getResourceId(),
                    event.getPolicyRevision(),
                    event.getChangeType(),
                    event.getCreatedAt()
            );
        }
    }
}
