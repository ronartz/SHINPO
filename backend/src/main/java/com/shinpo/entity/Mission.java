package com.shinpo.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "missions")
public class Mission {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String title;

    private String description;

    private LocalDate scheduledDate;

    private Integer estimatedMinutes;

    private String status;

    private Instant createdAt;

    @ManyToOne
    @JoinColumn(name = "goal_id", nullable = false)
    private Goal goal;

    protected Mission() {
    }

    public Mission(
            String title,
            String description,
            LocalDate scheduledDate,
            Integer estimatedMinutes,
            Goal goal
    ) {
        this.title = title;
        this.description = description;
        this.scheduledDate = scheduledDate;
        this.estimatedMinutes = estimatedMinutes;
        this.status = "PENDING";
        this.createdAt = Instant.now();
        this.goal = goal;
    }

    public Long getId() {
        return id;
    }

    public String getTitle() {
        return title;
    }

    public String getDescription() {
        return description;
    }

    public LocalDate getScheduledDate() {
        return scheduledDate;
    }

    public Integer getEstimatedMinutes() {
        return estimatedMinutes;
    }

    public String getStatus() {
        return status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Goal getGoal() {
        return goal;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public void setScheduledDate(LocalDate scheduledDate) {
        this.scheduledDate = scheduledDate;
    }

    public void setEstimatedMinutes(Integer estimatedMinutes) {
        this.estimatedMinutes = estimatedMinutes;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public void setGoal(Goal goal) {
        this.goal = goal;
    }

    public void markCompleted() {
        this.status = "COMPLETED";
    }

    public void update(String title, String description, LocalDate scheduledDate, Integer estimatedMinutes, String status, Goal goal) {
        if (title != null && !title.isBlank()) {
            this.title = title;
        }
        this.description = description;
        if (scheduledDate != null) {
            this.scheduledDate = scheduledDate;
        }
        this.estimatedMinutes = estimatedMinutes;
        if (status != null && !status.isBlank()) {
            this.status = status.toUpperCase();
        }
        if (goal != null) {
            this.goal = goal;
        }
    }
}