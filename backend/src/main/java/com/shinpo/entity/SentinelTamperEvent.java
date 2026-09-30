package com.shinpo.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "sentinel_tamper_events")
public class SentinelTamperEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "focus_session_id")
    private FocusSession focusSession;

    @Column(name = "event_type", nullable = false, length = 50)
    private String eventType;

    @Column(nullable = false, length = 20)
    private String severity;

    @Column(name = "enforcement_mode", nullable = false, length = 30)
    private String enforcementMode;

    @Column(columnDefinition = "TEXT")
    private String justification;

    @Column(columnDefinition = "TEXT")
    private String details;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public SentinelTamperEvent() {}

    public SentinelTamperEvent(
            User user,
            FocusSession focusSession,
            String eventType,
            String severity,
            String enforcementMode,
            String justification,
            String details
    ) {
        this.user = user;
        this.focusSession = focusSession;
        this.eventType = eventType;
        this.severity = severity != null ? severity : "HIGH";
        this.enforcementMode = enforcementMode;
        this.justification = justification;
        this.details = details;
        this.createdAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public FocusSession getFocusSession() {
        return focusSession;
    }

    public void setFocusSession(FocusSession focusSession) {
        this.focusSession = focusSession;
    }

    public String getEventType() {
        return eventType;
    }

    public void setEventType(String eventType) {
        this.eventType = eventType;
    }

    public String getSeverity() {
        return severity;
    }

    public void setSeverity(String severity) {
        this.severity = severity;
    }

    public String getEnforcementMode() {
        return enforcementMode;
    }

    public void setEnforcementMode(String enforcementMode) {
        this.enforcementMode = enforcementMode;
    }

    public String getJustification() {
        return justification;
    }

    public void setJustification(String justification) {
        this.justification = justification;
    }

    public String getDetails() {
        return details;
    }

    public void setDetails(String details) {
        this.details = details;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
