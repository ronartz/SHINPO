package com.shinpo.entity;

import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "contextual_focus_resources")
public class ContextualFocusResource {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "mission_id")
    private Mission mission;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "focus_session_id")
    private FocusSession focusSession;

    /**
     * Browser resources live in this table. Desktop resources additionally
     * point at the established PROCESS exception so native enforcement keeps a
     * single source of truth for process permissions.
     */
    @OneToOne(fetch = FetchType.LAZY, cascade = CascadeType.REMOVE)
    @JoinColumn(name = "process_exception_id", unique = true)
    private FocusSessionEnforcementException processException;

    @Enumerated(EnumType.STRING)
    @Column(name = "resource_type", nullable = false, length = 30)
    private ContextualResourceType resourceType;

    @Enumerated(EnumType.STRING)
    @Column(name = "match_type", nullable = false, length = 30)
    private ContextualResourceMatchType matchType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ContextualResourceDisposition disposition;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String destination;

    @Column(name = "canonical_destination", nullable = false, columnDefinition = "TEXT")
    private String canonicalDestination;

    @Column(name = "display_name", length = 200)
    private String displayName;

    @Column(name = "expires_at")
    private Instant expiresAt;

    @Column(nullable = false)
    private boolean enabled = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (createdAt == null) {
            createdAt = now;
        }
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public Long getId() { return id; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    public Mission getMission() { return mission; }
    public void setMission(Mission mission) { this.mission = mission; }
    public FocusSession getFocusSession() { return focusSession; }
    public void setFocusSession(FocusSession focusSession) { this.focusSession = focusSession; }
    public FocusSessionEnforcementException getProcessException() { return processException; }
    public void setProcessException(FocusSessionEnforcementException processException) { this.processException = processException; }
    public ContextualResourceType getResourceType() { return resourceType; }
    public void setResourceType(ContextualResourceType resourceType) { this.resourceType = resourceType; }
    public ContextualResourceMatchType getMatchType() { return matchType; }
    public void setMatchType(ContextualResourceMatchType matchType) { this.matchType = matchType; }
    public ContextualResourceDisposition getDisposition() { return disposition; }
    public void setDisposition(ContextualResourceDisposition disposition) { this.disposition = disposition; }
    public String getDestination() { return destination; }
    public void setDestination(String destination) { this.destination = destination; }
    public String getCanonicalDestination() { return canonicalDestination; }
    public void setCanonicalDestination(String canonicalDestination) { this.canonicalDestination = canonicalDestination; }
    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }
    public Instant getExpiresAt() { return expiresAt; }
    public void setExpiresAt(Instant expiresAt) { this.expiresAt = expiresAt; }
    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
