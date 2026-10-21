package com.shinpo.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.MapsId;
import jakarta.persistence.OneToOne;
import jakarta.persistence.PostLoad;
import jakarta.persistence.PostPersist;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;
import org.springframework.data.domain.Persistable;

import java.time.Instant;

@Entity
@Table(name = "user_onboarding")
public class UserOnboarding implements Persistable<Long> {

    @Id
    @Column(name = "user_id")
    private Long userId;

    @OneToOne
    @MapsId
    @JoinColumn(name = "user_id")
    private User user;

    @Transient
    private boolean isNew = true;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private OnboardingStatus status = OnboardingStatus.NOT_STARTED;

    @Column(name = "current_step", nullable = false)
    private int currentStep = 0;

    @Column(name = "completed_steps_count", nullable = false)
    private int completedStepsCount = 0;

    @Column(name = "verified_steps", nullable = false, length = 255)
    private String verifiedSteps = "";

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public enum OnboardingStatus {
        NOT_STARTED,
        IN_PROGRESS,
        PAUSED,
        SKIPPED,
        COMPLETED
    }

    protected UserOnboarding() {
        this.isNew = false;
    }

    public UserOnboarding(User user) {
        this.user = user;
        this.userId = user != null ? user.getId() : null;
        this.status = OnboardingStatus.NOT_STARTED;
        this.currentStep = 0;
        this.completedStepsCount = 0;
        this.verifiedSteps = "";
        this.updatedAt = Instant.now();
        this.isNew = true;
    }

    @Override
    public Long getId() {
        return userId;
    }

    @Override
    public boolean isNew() {
        return isNew;
    }

    @PostLoad
    @PostPersist
    void markNotNew() {
        this.isNew = false;
    }

    public Long getUserId() {
        return userId;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
        if (user != null) {
            this.userId = user.getId();
        }
    }

    public OnboardingStatus getStatus() {
        return status;
    }

    public void setStatus(OnboardingStatus status) {
        this.status = status;
    }

    public int getCurrentStep() {
        return currentStep;
    }

    public void setCurrentStep(int currentStep) {
        this.currentStep = currentStep;
    }

    public int getCompletedStepsCount() {
        return completedStepsCount;
    }

    public void setCompletedStepsCount(int completedStepsCount) {
        this.completedStepsCount = completedStepsCount;
    }

    public String getVerifiedSteps() {
        return verifiedSteps;
    }

    public void setVerifiedSteps(String verifiedSteps) {
        this.verifiedSteps = verifiedSteps;
    }

    public Instant getCompletedAt() {
        return completedAt;
    }

    public void setCompletedAt(Instant completedAt) {
        this.completedAt = completedAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}

