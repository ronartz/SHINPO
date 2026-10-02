-- Migration: V15__create_focus_session_enforcement_exceptions.sql
-- Description: Create focus_session_enforcement_exceptions table for session-scoped enforcement permissions

CREATE TABLE IF NOT EXISTS focus_session_enforcement_exceptions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    focus_session_id BIGINT NOT NULL,
    activity_pattern VARCHAR(150) NOT NULL,
    activity_type VARCHAR(30) NOT NULL DEFAULT 'PROCESS',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_focus_session_exception_session
        FOREIGN KEY (focus_session_id)
        REFERENCES focus_sessions(id)
        ON DELETE CASCADE,

    CONSTRAINT uq_session_exception_type_pattern
        UNIQUE (focus_session_id, activity_type, activity_pattern)
);

CREATE INDEX IF NOT EXISTS idx_focus_session_exception_session
    ON focus_session_enforcement_exceptions(focus_session_id);
