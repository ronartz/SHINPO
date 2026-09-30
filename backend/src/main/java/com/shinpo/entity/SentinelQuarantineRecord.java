package com.shinpo.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "sentinel_quarantine_records")
public class SentinelQuarantineRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "focus_session_id")
    private FocusSession focusSession;

    @Column(nullable = false)
    private Long pid;

    @Column(name = "process_name", nullable = false, length = 150)
    private String processName;

    @Column(name = "command_line", columnDefinition = "TEXT")
    private String commandLine;

    @Column(name = "policy_action", nullable = false, length = 30)
    private String policyAction;

    @Column(name = "enforcement_mode", nullable = false, length = 30)
    private String enforcementMode;

    @Column(columnDefinition = "TEXT")
    private String reason;

    @Column(name = "detected_at", nullable = false)
    private Instant detectedAt = Instant.now();

    @Column(name = "released_at")
    private Instant releasedAt;

    public SentinelQuarantineRecord() {}

    public SentinelQuarantineRecord(
            User user,
            FocusSession focusSession,
            Long pid,
            String processName,
            String commandLine,
            String policyAction,
            String enforcementMode,
            String reason
    ) {
        this.user = user;
        this.focusSession = focusSession;
        this.pid = pid;
        this.processName = processName;
        this.commandLine = commandLine;
        this.policyAction = policyAction;
        this.enforcementMode = enforcementMode;
        this.reason = reason;
        this.detectedAt = Instant.now();
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

    public Long getPid() {
        return pid;
    }

    public void setPid(Long pid) {
        this.pid = pid;
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

    public String getPolicyAction() {
        return policyAction;
    }

    public void setPolicyAction(String policyAction) {
        this.policyAction = policyAction;
    }

    public String getEnforcementMode() {
        return enforcementMode;
    }

    public void setEnforcementMode(String enforcementMode) {
        this.enforcementMode = enforcementMode;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public Instant getDetectedAt() {
        return detectedAt;
    }

    public void setDetectedAt(Instant detectedAt) {
        this.detectedAt = detectedAt;
    }

    public Instant getReleasedAt() {
        return releasedAt;
    }

    public void setReleasedAt(Instant releasedAt) {
        this.releasedAt = releasedAt;
    }
}
