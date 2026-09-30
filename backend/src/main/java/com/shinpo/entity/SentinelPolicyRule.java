package com.shinpo.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "sentinel_policy_rules", uniqueConstraints = {
        @UniqueConstraint(name = "uq_sentinel_policy_user_process", columnNames = {"user_id", "process_name_pattern"})
})
public class SentinelPolicyRule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "process_name_pattern", nullable = false, length = 150)
    private String processNamePattern;

    @Column(name = "policy_type", nullable = false, length = 30)
    private String policyType = "BLOCKED";

    @Column(name = "is_custom", nullable = false)
    private Boolean isCustom = true;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public SentinelPolicyRule() {}

    public SentinelPolicyRule(User user, String processNamePattern, String policyType) {
        this.user = user;
        this.processNamePattern = processNamePattern;
        this.policyType = policyType;
        this.isCustom = true;
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

    public String getProcessNamePattern() {
        return processNamePattern;
    }

    public void setProcessNamePattern(String processNamePattern) {
        this.processNamePattern = processNamePattern;
    }

    public String getPolicyType() {
        return policyType;
    }

    public void setPolicyType(String policyType) {
        this.policyType = policyType;
    }

    public Boolean getIsCustom() {
        return isCustom;
    }

    public void setIsCustom(Boolean custom) {
        isCustom = custom;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
