CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_status_ended_at
    ON focus_sessions(user_id, status, ended_at);
