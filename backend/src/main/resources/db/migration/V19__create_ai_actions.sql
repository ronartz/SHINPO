CREATE TABLE ai_actions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    action_id VARCHAR(64) NOT NULL UNIQUE,
    user_id BIGINT NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    risk_level VARCHAR(30) NOT NULL,
    status VARCHAR(30) NOT NULL,
    description TEXT NOT NULL,
    payload TEXT NOT NULL,
    result_summary TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMPTZ,
    executed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,

    CONSTRAINT fk_ai_action_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

CREATE INDEX idx_ai_actions_user_status ON ai_actions(user_id, status);
CREATE INDEX idx_ai_actions_action_id ON ai_actions(action_id);

