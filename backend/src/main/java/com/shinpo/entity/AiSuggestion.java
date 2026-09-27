package com.shinpo.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "ai_suggestions")
public class AiSuggestion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "suggestion_type", nullable = false, length = 50)
    private String suggestionType;

    @Column(name = "input_context", columnDefinition = "TEXT")
    private String inputContext;

    @Column(name = "output_payload", nullable = false, columnDefinition = "TEXT")
    private String outputPayload;

    @Column(nullable = false)
    private Boolean accepted = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = Instant.now();
        if (this.accepted == null) {
            this.accepted = false;
        }
    }

    public AiSuggestion() {}

    public AiSuggestion(User user, String suggestionType, String inputContext, String outputPayload) {
        this.user = user;
        this.suggestionType = suggestionType;
        this.inputContext = inputContext;
        this.outputPayload = outputPayload;
        this.accepted = false;
    }

    public Long getId() { return id; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    public String getSuggestionType() { return suggestionType; }
    public void setSuggestionType(String suggestionType) { this.suggestionType = suggestionType; }
    public String getInputContext() { return inputContext; }
    public void setInputContext(String inputContext) { this.inputContext = inputContext; }
    public String getOutputPayload() { return outputPayload; }
    public void setOutputPayload(String outputPayload) { this.outputPayload = outputPayload; }
    public Boolean getAccepted() { return accepted; }
    public void setAccepted(Boolean accepted) { this.accepted = accepted; }
    public Instant getCreatedAt() { return createdAt; }
}