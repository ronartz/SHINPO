CREATE TABLE focus_sessions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    user_id BIGINT NOT NULL,
    goal_id BIGINT,
    mission_id BIGINT,

    name VARCHAR(150) NOT NULL,
    intention TEXT,

    duration_minutes INTEGER NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED',

    scheduled_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_focus_session_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_focus_session_goal
        FOREIGN KEY (goal_id)
        REFERENCES goals(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_focus_session_mission
        FOREIGN KEY (mission_id)
        REFERENCES missions(id)
        ON DELETE SET NULL,

    CONSTRAINT chk_focus_session_duration
        CHECK (duration_minutes > 0),

    CONSTRAINT chk_focus_session_status
        CHECK (
            status IN (
                'SCHEDULED',
                'ACTIVE',
                'PAUSED',
                'COMPLETED',
                'CANCELLED',
                'EXPIRED',
                'FAILED'
            )
        )
);

CREATE INDEX idx_focus_sessions_user
    ON focus_sessions(user_id);

CREATE INDEX idx_focus_sessions_goal
    ON focus_sessions(goal_id);

CREATE INDEX idx_focus_sessions_mission
    ON focus_sessions(mission_id);

CREATE INDEX idx_focus_sessions_status
    ON focus_sessions(status);

CREATE INDEX idx_focus_sessions_scheduled_at
    ON focus_sessions(scheduled_at);

