package com.shinpo.entity;

import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "progress_events")
public class ProgressEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne
    @JoinColumn(name = "mission_completion_id")
    private MissionCompletion missionCompletion;

    @Column(name = "event_type", nullable = false, length = 30)
    private String eventType;

    @Column(nullable = false)
    private Integer amount;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected ProgressEvent() {
    }

    public ProgressEvent(
            User user,
            MissionCompletion missionCompletion,
            String eventType,
            Integer amount
    ) {
        this.user = user;
        this.missionCompletion = missionCompletion;
        this.eventType = eventType;
        this.amount = amount;
        this.createdAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public User getUser() {
        return user;
    }

    public MissionCompletion getMissionCompletion() {
        return missionCompletion;
    }

    public String getEventType() {
        return eventType;
    }

    public Integer getAmount() {
        return amount;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}