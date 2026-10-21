package com.shinpo.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 50)
    private String username;

    @Column(nullable = false, unique = true, length = 255)
    private String email;

    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @Column(nullable = false, length = 20)
    private String role = "ROLE_USER";

    @Column(name = "is_active", nullable = false)
    private boolean isActive = true;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "enforcement_mode", nullable = false, length = 30)
    private String enforcementMode = "STRICT";

    @Column(name = "token_version", nullable = false)
    private long tokenVersion = 1L;

    @OneToMany(mappedBy = "user")
    private List<Goal> goals = new ArrayList<>();

    protected User() {
    }

    public User(String username, String email, String passwordHash, Instant createdAt) {
        this(username, email, passwordHash, "ROLE_USER", true, createdAt);
    }

    public User(String username, String email, String passwordHash, String role, boolean isActive, Instant createdAt) {
        this(username, email, passwordHash, role, isActive, "STRICT", createdAt);
    }

    public User(String username, String email, String passwordHash, String role, boolean isActive, String enforcementMode, Instant createdAt) {
        this.username = username;
        this.email = email;
        this.passwordHash = passwordHash;
        this.role = (role != null && !role.isBlank()) ? role : "ROLE_USER";
        this.isActive = isActive;
        this.enforcementMode = (enforcementMode != null && !enforcementMode.isBlank()) ? enforcementMode : "STRICT";
        this.createdAt = createdAt;
    }

    public Long getId() {
        return id;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getEmail() {
        return email;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public void setPasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = (role != null && !role.isBlank()) ? role : "ROLE_USER";
    }

    public boolean isActive() {
        return isActive;
    }

    public void setActive(boolean active) {
        this.isActive = active;
    }

    public String getEnforcementMode() {
        return enforcementMode != null ? enforcementMode : "STRICT";
    }

    public void setEnforcementMode(String enforcementMode) {
        this.enforcementMode = (enforcementMode != null && !enforcementMode.isBlank()) ? enforcementMode : "STRICT";
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public long getTokenVersion() {
        return tokenVersion;
    }

    public void setTokenVersion(long tokenVersion) {
        this.tokenVersion = tokenVersion;
    }
}