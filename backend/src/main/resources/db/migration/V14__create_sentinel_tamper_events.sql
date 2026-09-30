CREATE TABLE IF NOT EXISTS sentinel_tamper_events (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL,
    focus_session_id BIGINT,
    event_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'HIGH',
    enforcement_mode VARCHAR(30) NOT NULL,
    justification TEXT,
    details TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_sentinel_tamper_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_sentinel_tamper_session
        FOREIGN KEY (focus_session_id)
        REFERENCES focus_sessions(id)
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_sentinel_tamper_user
    ON sentinel_tamper_events(user_id);

CREATE INDEX IF NOT EXISTS idx_sentinel_tamper_session
    ON sentinel_tamper_events(focus_session_id);

CREATE INDEX IF NOT EXISTS idx_sentinel_tamper_created
    ON sentinel_tamper_events(created_at);
