package com.shinpo.entity;

import jakarta.persistence.*;

import java.time.Duration;
import java.time.Instant;

@Entity
@Table(name = "focus_sessions")
public class FocusSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "goal_id")
    private Goal goal;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "mission_id")
    private Mission mission;

        @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "plan_id")
    private SessionPlan plan;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String intention;

    @Column(name = "duration_minutes", nullable = false)
    private Integer durationMinutes;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private FocusSessionStatus status = FocusSessionStatus.SCHEDULED;

    @Column(name = "scheduled_at")
    private Instant scheduledAt;

    @Column(name = "started_at")
    private Instant startedAt;

    @Column(name = "paused_at")
    private Instant pausedAt;

    @Column(name = "accumulated_paused_seconds", nullable = false)
    private Long accumulatedPausedSeconds = 0L;

    @Column(name = "ended_at")
    private Instant endedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "study_mode", nullable = false, length = 20)
    private ContextualFocusMode studyMode = ContextualFocusMode.PROTECTED;

    @Column(name = "context_policy_revision", nullable = false)
    private Long contextPolicyRevision = 1L;

    @Column(name = "restrict_youtube_shorts", nullable = false)
    private boolean restrictYoutubeShorts;

    @Column(name = "restrict_youtube_home", nullable = false)
    private boolean restrictYoutubeHome;

    @Column(name = "restrict_unapproved_youtube", nullable = false)
    private boolean restrictUnapprovedYoutube;

    @Column(name = "hide_youtube_recommendations", nullable = false)
    private boolean hideYoutubeRecommendations;
    
        @Column(name = "completion_quality")
    private Integer completionQuality;

    @Column(name = "reflection_note", columnDefinition = "TEXT")
    private String reflectionNote;

    @Column(name = "accomplishment", columnDefinition = "TEXT")
    private String accomplishment;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    protected void onCreate() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
        if (accumulatedPausedSeconds == null) {
            accumulatedPausedSeconds = 0L;
        }
        if (studyMode == null) {
            studyMode = ContextualFocusMode.PROTECTED;
        }
        if (contextPolicyRevision == null || contextPolicyRevision < 1L) {
            contextPolicyRevision = 1L;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = Instant.now();
    }

    public long calculateActiveSeconds(Instant currentInstant) {
        if (startedAt == null) {
            return 0L;
        }

        Instant effectiveEnd;
        if (status == FocusSessionStatus.COMPLETED || status == FocusSessionStatus.CANCELLED || status == FocusSessionStatus.EXPIRED || status == FocusSessionStatus.FAILED) {
            effectiveEnd = endedAt != null ? endedAt : currentInstant;
        } else if (status == FocusSessionStatus.PAUSED && pausedAt != null) {
            effectiveEnd = pausedAt;
        } else {
            effectiveEnd = currentInstant;
        }

        long totalElapsed = Math.max(0L, Duration.between(startedAt, effectiveEnd).toSeconds());
        long active = totalElapsed - (accumulatedPausedSeconds != null ? accumulatedPausedSeconds : 0L);
        return Math.max(0L, active);
    }

    public long calculateRemainingSeconds(Instant currentInstant) {
        long totalBudgetSeconds = (long) durationMinutes * 60L;
        long active = calculateActiveSeconds(currentInstant);
        return Math.max(0L, totalBudgetSeconds - active);
    }

    public Long getId() {
        return id;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public Goal getGoal() {
        return goal;
    }

    public void setGoal(Goal goal) {
        this.goal = goal;
    }
    
        public SessionPlan getPlan() {
        return plan;
    }

    public void setPlan(SessionPlan plan) {
        this.plan = plan;
    }

    public Mission getMission() {
        return mission;
    }

    public void setMission(Mission mission) {
        this.mission = mission;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getIntention() {
        return intention;
    }

    public void setIntention(String intention) {
        this.intention = intention;
    }

    public Integer getDurationMinutes() {
        return durationMinutes;
    }

    public void setDurationMinutes(Integer durationMinutes) {
        this.durationMinutes = durationMinutes;
    }

    public FocusSessionStatus getStatus() {
        return status;
    }

    public void setStatus(FocusSessionStatus status) {
        this.status = status;
    }

    public Instant getScheduledAt() {
        return scheduledAt;
    }

    public void setScheduledAt(Instant scheduledAt) {
        this.scheduledAt = scheduledAt;
    }

    public Instant getStartedAt() {
        return startedAt;
    }

    public void setStartedAt(Instant startedAt) {
        this.startedAt = startedAt;
    }

    public Instant getPausedAt() {
        return pausedAt;
    }

    public void setPausedAt(Instant pausedAt) {
        this.pausedAt = pausedAt;
    }

    public Long getAccumulatedPausedSeconds() {
        return accumulatedPausedSeconds != null ? accumulatedPausedSeconds : 0L;
    }

    public void setAccumulatedPausedSeconds(Long accumulatedPausedSeconds) {
        this.accumulatedPausedSeconds = accumulatedPausedSeconds != null ? accumulatedPausedSeconds : 0L;
    }

    public Instant getEndedAt() {
        return endedAt;
    }

    public void setEndedAt(Instant endedAt) {
        this.endedAt = endedAt;
    }

    public ContextualFocusMode getStudyMode() {
        return studyMode != null ? studyMode : ContextualFocusMode.PROTECTED;
    }

    public void setStudyMode(ContextualFocusMode studyMode) {
        this.studyMode = studyMode != null ? studyMode : ContextualFocusMode.PROTECTED;
    }

    public Long getContextPolicyRevision() {
        return contextPolicyRevision != null ? contextPolicyRevision : 1L;
    }

    public void setContextPolicyRevision(Long contextPolicyRevision) {
        this.contextPolicyRevision = contextPolicyRevision != null && contextPolicyRevision > 0
                ? contextPolicyRevision
                : 1L;
    }

    public long incrementContextPolicyRevision() {
        contextPolicyRevision = getContextPolicyRevision() + 1L;
        return contextPolicyRevision;
    }

    public boolean isRestrictYoutubeShorts() { return restrictYoutubeShorts; }
    public void setRestrictYoutubeShorts(boolean restrictYoutubeShorts) { this.restrictYoutubeShorts = restrictYoutubeShorts; }
    public boolean isRestrictYoutubeHome() { return restrictYoutubeHome; }
    public void setRestrictYoutubeHome(boolean restrictYoutubeHome) { this.restrictYoutubeHome = restrictYoutubeHome; }
    public boolean isRestrictUnapprovedYoutube() { return restrictUnapprovedYoutube; }
    public void setRestrictUnapprovedYoutube(boolean restrictUnapprovedYoutube) { this.restrictUnapprovedYoutube = restrictUnapprovedYoutube; }
    public boolean isHideYoutubeRecommendations() { return hideYoutubeRecommendations; }
    public void setHideYoutubeRecommendations(boolean hideYoutubeRecommendations) { this.hideYoutubeRecommendations = hideYoutubeRecommendations; }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
        public Integer getCompletionQuality() {
        return completionQuality;
    }

    public void setCompletionQuality(Integer completionQuality) {
        this.completionQuality = completionQuality;
    }

    public String getReflectionNote() {
        return reflectionNote;
    }

    public void setReflectionNote(String reflectionNote) {
        this.reflectionNote = reflectionNote;
    }

    public String getAccomplishment() {
        return accomplishment;
    }

    public void setAccomplishment(String accomplishment) {
        this.accomplishment = accomplishment;
    }
}
