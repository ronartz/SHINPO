package com.shinpo.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "focus_session_enforcement_exceptions", uniqueConstraints = {
        @UniqueConstraint(
                name = "uq_session_exception_type_pattern",
                columnNames = {"focus_session_id", "activity_type", "activity_pattern"}
        )
})
public class FocusSessionEnforcementException {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "focus_session_id", nullable = false)
    private FocusSession focusSession;

    @Column(name = "activity_pattern", nullable = false, length = 150)
    private String activityPattern;

    @Enumerated(EnumType.STRING)
    @Column(name = "activity_type", nullable = false, length = 30)
    private FocusSessionActivityType activityType = FocusSessionActivityType.PROCESS;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    public FocusSessionEnforcementException() {}

    public FocusSessionEnforcementException(
            FocusSession focusSession,
            String activityPattern,
            FocusSessionActivityType activityType
    ) {
        this.focusSession = focusSession;
        this.activityPattern = activityPattern;
        this.activityType = activityType != null ? activityType : FocusSessionActivityType.PROCESS;
        this.createdAt = Instant.now();
    }

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
        if (activityType == null) {
            activityType = FocusSessionActivityType.PROCESS;
        }
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public FocusSession getFocusSession() {
        return focusSession;
    }

    public void setFocusSession(FocusSession focusSession) {
        this.focusSession = focusSession;
    }

    public String getActivityPattern() {
        return activityPattern;
    }

    public void setActivityPattern(String activityPattern) {
        this.activityPattern = activityPattern;
    }

    public FocusSessionActivityType getActivityType() {
        return activityType;
    }

    public void setActivityType(FocusSessionActivityType activityType) {
        this.activityType = activityType;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
