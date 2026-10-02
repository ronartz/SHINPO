package com.shinpo.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "sentinel_enforcement_warnings")
public class SentinelEnforcementWarning {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "warning_id", nullable = false, unique = true, updatable = false)
    private UUID warningId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "focus_session_id", nullable = false)
    private FocusSession focusSession;

    @Column(name = "process_name", nullable = false, length = 150)
    private String processName;

    @Column(name = "command_line", columnDefinition = "TEXT")
    private String commandLine;

    @Column(name = "issued_at", nullable = false)
    private Instant issuedAt = Instant.now();

    @Column(name = "decision_deadline", nullable = false)
    private Instant decisionDeadline;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private SentinelWarningStatus status = SentinelWarningStatus.ISSUED;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public SentinelEnforcementWarning() {}

    public SentinelEnforcementWarning(
            User user,
            FocusSession focusSession,
            String processName,
            String commandLine,
            Instant issuedAt,
            Instant decisionDeadline
    ) {
        this.warningId = UUID.randomUUID();
        this.user = user;
        this.focusSession = focusSession;
        this.processName = processName;
        this.commandLine = commandLine;
        this.issuedAt = issuedAt != null ? issuedAt : Instant.now();
        this.decisionDeadline = decisionDeadline;
        this.status = SentinelWarningStatus.ISSUED;
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    @PrePersist
    protected void onCreate() {
        Instant now = Instant.now();
        if (warningId == null) {
            warningId = UUID.randomUUID();
        }
        if (issuedAt == null) {
            issuedAt = now;
        }
        if (status == null) {
            status = SentinelWarningStatus.ISSUED;
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

    public String getProcessName() {
        return processName;
    }

    public void setProcessName(String processName) {
        this.processName = processName;
    }

    public String getCommandLine() {
        return commandLine;
    }

    public void setCommandLine(String commandLine) {
        this.commandLine = commandLine;
    }

    public Instant getIssuedAt() {
        return issuedAt;
    }

    public void setIssuedAt(Instant issuedAt) {
        this.issuedAt = issuedAt;
    }

    public Instant getDecisionDeadline() {
        return decisionDeadline;
    }

    public void setDecisionDeadline(Instant decisionDeadline) {
        this.decisionDeadline = decisionDeadline;
    }

    public SentinelWarningStatus getStatus() {
        return status;
    }

    public void setStatus(SentinelWarningStatus status) {
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
