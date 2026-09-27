package com.shinpo.entity;

import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "session_intervals")
public class SessionInterval {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "plan_id", nullable = false)
    private SessionPlan plan;

    @Column(name = "interval_order", nullable = false)
    private Integer intervalOrder;

    @Enumerated(EnumType.STRING)
    @Column(name = "interval_type", nullable = false, length = 20)
    private SessionIntervalType intervalType;

    @Column(name = "duration_minutes", nullable = false)
    private Integer durationMinutes;

    @Column(length = 100)
    private String label;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public SessionPlan getPlan() {
        return plan;
    }

    public void setPlan(SessionPlan plan) {
        this.plan = plan;
    }

    public Integer getIntervalOrder() {
        return intervalOrder;
    }

    public void setIntervalOrder(Integer intervalOrder) {
        this.intervalOrder = intervalOrder;
    }

    public SessionIntervalType getIntervalType() {
        return intervalType;
    }

    public void setIntervalType(SessionIntervalType intervalType) {
        this.intervalType = intervalType;
    }

    public Integer getDurationMinutes() {
        return durationMinutes;
    }

    public void setDurationMinutes(Integer durationMinutes) {
        this.durationMinutes = durationMinutes;
    }

    public String getLabel() {
        return label;
    }

    public void setLabel(String label) {
        this.label = label;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}