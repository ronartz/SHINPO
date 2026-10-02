package com.shinpo.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "sentinel_grace_windows")
public class SentinelGraceWindow {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "warning_id", nullable = false, unique = true, updatable = false)
    private UUID warningId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "focus_session_id", nullable = false)
    private FocusSession focusSession;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "process_name", nullable = false, length = 150)
    private String processName;

    @Column(name = "granted_at", nullable = false)
    private Instant grantedAt = Instant.now();

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "duration_minutes", nullable = false)
    private Integer durationMinutes;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private SentinelGraceStatus status = SentinelGraceStatus.ACTIVE;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public SentinelGraceWindow() {}

    public SentinelGraceWindow(
            UUID warningId,
            FocusSession focusSession,
            User user,
            String processName,
            Instant grantedAt,
            Instant expiresAt,
            Integer durationMinutes
    ) {
        this.warningId = warningId;
        this.focusSession = focusSession;
        this.user = user;
        this.processName = processName;
        this.grantedAt = grantedAt != null ? grantedAt : Instant.now();
        this.expiresAt = expiresAt;
        this.durationMinutes = durationMinutes;
        this.status = SentinelGraceStatus.ACTIVE;
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    @PrePersist
    protected void onCreate() {
        Instant now = Instant.now();
        if (grantedAt == null) {
            grantedAt = now;
        }
        if (status == null) {
            status = SentinelGraceStatus.ACTIVE;
        }
        if (createdAt == null) {
            createdAt = now;
        }
        if (updatedAt == null) {
            updatedAt = now;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public UUID getWarningId() {
        return warningId;
    }

    public void setWarningId(UUID warningId) {
        this.warningId = warningId;
    }

    public FocusSession getFocusSession() {
        return focusSession;
    }

    public void setFocusSession(FocusSession focusSession) {
        this.focusSession = focusSession;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public String getProcessName() {
        return processName;
    }

    public void setProcessName(String processName) {
        this.processName = processName;
    }

    public Instant getGrantedAt() {
        return grantedAt;
    }

    public void setGrantedAt(Instant grantedAt) {
        this.grantedAt = grantedAt;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public void setExpiresAt(Instant expiresAt) {
        this.expiresAt = expiresAt;
    }

    public Integer getDurationMinutes() {
        return durationMinutes;
    }

    public void setDurationMinutes(Integer durationMinutes) {
        this.durationMinutes = durationMinutes;
    }

    public SentinelGraceStatus getStatus() {
        return status;
    }

    public void setStatus(SentinelGraceStatus status) {
        this.status = status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
