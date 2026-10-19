package com.shinpo.entity;

import jakarta.persistence.*;

import java.time.Instant;

/**
 * Records policy mutations, never navigation events or page contents.
 */
@Entity
@Table(name = "contextual_policy_audit_events")
public class ContextualPolicyAuditEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "focus_session_id")
    private FocusSession focusSession;

    @Column(name = "resource_id")
    private Long resourceId;

    @Column(name = "policy_revision", nullable = false)
    private Long policyRevision;

    @Column(name = "change_type", nullable = false, length = 50)
    private String changeType;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected ContextualPolicyAuditEvent() {}

    public ContextualPolicyAuditEvent(
            User user,
            FocusSession focusSession,
            Long resourceId,
            Long policyRevision,
            String changeType
    ) {
        this.user = user;
        this.focusSession = focusSession;
        this.resourceId = resourceId;
        this.policyRevision = policyRevision;
        this.changeType = changeType;
        this.createdAt = Instant.now();
    }

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    public Long getId() { return id; }
    public User getUser() { return user; }
    public FocusSession getFocusSession() { return focusSession; }
    public Long getResourceId() { return resourceId; }
    public Long getPolicyRevision() { return policyRevision; }
    public String getChangeType() { return changeType; }
    public Instant getCreatedAt() { return createdAt; }
}
