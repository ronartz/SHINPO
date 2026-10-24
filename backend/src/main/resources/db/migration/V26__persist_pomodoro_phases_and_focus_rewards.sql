ALTER TABLE focus_sessions
    ADD COLUMN pomodoro_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN pomodoro_focus_cycles INTEGER NOT NULL DEFAULT 4,
    ADD COLUMN pomodoro_short_break_minutes INTEGER NOT NULL DEFAULT 5,
    ADD COLUMN pomodoro_long_break_minutes INTEGER NOT NULL DEFAULT 15,
    ADD COLUMN current_phase VARCHAR(20) NOT NULL DEFAULT 'FOCUS',
    ADD COLUMN completed_focus_cycles INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN phase_started_at TIMESTAMPTZ,
    ADD COLUMN phase_elapsed_seconds BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN focus_active_seconds BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN break_active_seconds BIGINT NOT NULL DEFAULT 0;

ALTER TABLE focus_sessions
    ADD CONSTRAINT chk_focus_pomodoro_cycles CHECK (pomodoro_focus_cycles BETWEEN 1 AND 12),
    ADD CONSTRAINT chk_focus_short_break CHECK (pomodoro_short_break_minutes BETWEEN 1 AND 60),
    ADD CONSTRAINT chk_focus_long_break CHECK (pomodoro_long_break_minutes BETWEEN 1 AND 120),
    ADD CONSTRAINT chk_focus_current_phase CHECK (current_phase IN ('FOCUS', 'SHORT_BREAK', 'LONG_BREAK', 'COMPLETE'));

ALTER TABLE progress_events
    ADD COLUMN focus_session_id BIGINT REFERENCES focus_sessions(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX idx_progress_event_focus_session_once
    ON progress_events(focus_session_id)
    WHERE focus_session_id IS NOT NULL AND event_type = 'FOCUS_SESSION_COMPLETED';
