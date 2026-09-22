package com.shinpo.entity;

import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "mission_completions")
public class MissionCompletion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "mission_id", nullable = false)
    private Mission mission;

    @Column(name = "started_at")
    private Instant startedAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "actual_minutes")
    private Integer actualMinutes;

    @Column(nullable = false, length = 20)
    private String result;

    @Column(name = "earned_progress", nullable = false)
    private Integer earnedProgress;

    protected MissionCompletion() {
    }

    public MissionCompletion(
            Mission mission,
            Instant startedAt,
            Instant completedAt,
            Integer actualMinutes,
            String result,
            Integer earnedProgress
    ) {
        this.mission = mission;
        this.startedAt = startedAt;
        this.completedAt = completedAt;
        this.actualMinutes = actualMinutes;
        this.result = result;
        this.earnedProgress = earnedProgress;
    }

    public Long getId() {
        return id;
    }

    public Mission getMission() {
        return mission;
    }

    public Instant getStartedAt() {
        return startedAt;
    }

    public Instant getCompletedAt() {
        return completedAt;
    }

    public Integer getActualMinutes() {
        return actualMinutes;
    }

    public String getResult() {
        return result;
    }

    public Integer getEarnedProgress() {
        return earnedProgress;
    }
}