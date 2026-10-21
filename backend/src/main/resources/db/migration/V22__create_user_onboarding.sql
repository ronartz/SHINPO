-- Migration V22: Create user_onboarding table for server-enforced onboarding state and reward verification
-- Ensures distinct states: NOT_STARTED, IN_PROGRESS, PAUSED, SKIPPED, COMPLETED
-- Prevents unauthorized reward claims, skip-reward leakage, and client-side tampering.

CREATE TABLE IF NOT EXISTS user_onboarding (
    user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL DEFAULT 'NOT_STARTED',
    current_step INT NOT NULL DEFAULT 0,
    completed_steps_count INT NOT NULL DEFAULT 0,
    verified_steps VARCHAR(255) NOT NULL DEFAULT '',
    completed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_onboarding_status ON user_onboarding(status);

