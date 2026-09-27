ALTER TABLE focus_sessions
    ADD COLUMN paused_at TIMESTAMPTZ,
    ADD COLUMN accumulated_paused_seconds BIGINT NOT NULL DEFAULT 0;