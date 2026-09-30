CREATE TABLE IF NOT EXISTS sentinel_quarantine_records (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL,
    focus_session_id BIGINT,
    pid BIGINT NOT NULL,
    process_name VARCHAR(150) NOT NULL,
    command_line TEXT,
    policy_action VARCHAR(30) NOT NULL,
    enforcement_mode VARCHAR(30) NOT NULL,
    reason TEXT,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    released_at TIMESTAMPTZ,

    CONSTRAINT fk_sentinel_quarantine_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_sentinel_quarantine_session
        FOREIGN KEY (focus_session_id)
        REFERENCES focus_sessions(id)
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_sentinel_quarantine_user
    ON sentinel_quarantine_records(user_id);

CREATE INDEX IF NOT EXISTS idx_sentinel_quarantine_session
    ON sentinel_quarantine_records(focus_session_id);

CREATE INDEX IF NOT EXISTS idx_sentinel_quarantine_detected
    ON sentinel_quarantine_records(detected_at);

CREATE TABLE IF NOT EXISTS sentinel_policy_rules (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL,
    process_name_pattern VARCHAR(150) NOT NULL,
    policy_type VARCHAR(30) NOT NULL DEFAULT 'BLOCKED',
    is_custom BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_sentinel_policy_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT uq_sentinel_policy_user_process
        UNIQUE (user_id, process_name_pattern)
);

CREATE INDEX IF NOT EXISTS idx_sentinel_policy_user
    ON sentinel_policy_rules(user_id);
