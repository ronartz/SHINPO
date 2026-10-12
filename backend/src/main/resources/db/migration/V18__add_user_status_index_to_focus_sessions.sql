-- V18: Add composite index on focus_sessions(user_id, status)
-- Optimizes active session lookups and per-user status queries used by Sentinel enforcement and session lifecycle checks
CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_status
    ON focus_sessions(user_id, status);

