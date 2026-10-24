ALTER TABLE focus_sessions
    ADD COLUMN pomodoro_grace_minutes INTEGER NOT NULL DEFAULT 10;

ALTER TABLE focus_sessions
    DROP CONSTRAINT chk_focus_current_phase,
    ADD CONSTRAINT chk_focus_current_phase CHECK (
        current_phase IN ('FOCUS', 'SHORT_BREAK', 'LONG_BREAK', 'GRACE', 'RETURN_REQUIRED', 'COMPLETE')
    ),
    ADD CONSTRAINT chk_focus_grace_minutes CHECK (pomodoro_grace_minutes BETWEEN 1 AND 60);
