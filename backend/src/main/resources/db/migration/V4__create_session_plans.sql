CREATE TABLE session_plans (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_session_plans_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

CREATE TABLE session_intervals (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    plan_id BIGINT NOT NULL,
    interval_order INTEGER NOT NULL,
    interval_type VARCHAR(20) NOT NULL,
    duration_minutes INTEGER NOT NULL,
    label VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_session_intervals_plan
        FOREIGN KEY (plan_id)
        REFERENCES session_plans(id)
        ON DELETE CASCADE,

    CONSTRAINT chk_interval_duration
        CHECK (duration_minutes > 0),

    CONSTRAINT chk_interval_type
        CHECK (interval_type IN ('FOCUS', 'SHORT_BREAK', 'LONG_BREAK'))
);

CREATE INDEX idx_session_plans_user ON session_plans(user_id);
CREATE INDEX idx_session_intervals_plan ON session_intervals(plan_id);
CREATE UNIQUE INDEX idx_plan_interval_order ON session_intervals(plan_id, interval_order);