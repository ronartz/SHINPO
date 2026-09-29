package com.shinpo.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "bug_reports")
public class BugReport {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "bug_id", nullable = false, unique = true, length = 50)
    private String bugId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String summary;

    @Column(nullable = false, length = 100)
    private String feature;

    @Column(nullable = false, length = 20)
    private String severity = "NORMAL";

    @Column(nullable = false, length = 30)
    private String status = "OPEN";

    @Column(name = "sanitized_diagnostics", columnDefinition = "TEXT")
    private String sanitizedDiagnostics;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = Instant.now();
        if (this.severity == null) this.severity = "NORMAL";
        if (this.status == null) this.status = "OPEN";
    }

    public BugReport() {}

    public BugReport(String bugId, User user, String summary, String feature, String sanitizedDiagnostics) {
        this.bugId = bugId;
        this.user = user;
        this.summary = summary;
        this.feature = feature;
        this.sanitizedDiagnostics = sanitizedDiagnostics;
    }

    public Long getId() { return id; }
    public String getBugId() { return bugId; }
    public void setBugId(String bugId) { this.bugId = bugId; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    public String getSummary() { return summary; }
    public void setSummary(String summary) { this.summary = summary; }
    public String getFeature() { return feature; }
    public void setFeature(String feature) { this.feature = feature; }
    public String getSeverity() { return severity; }
    public void setSeverity(String severity) { this.severity = severity; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getSanitizedDiagnostics() { return sanitizedDiagnostics; }
    public void setSanitizedDiagnostics(String sanitizedDiagnostics) { this.sanitizedDiagnostics = sanitizedDiagnostics; }
    public Instant getCreatedAt() { return createdAt; }
}
