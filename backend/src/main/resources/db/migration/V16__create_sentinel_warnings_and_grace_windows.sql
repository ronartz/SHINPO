-- Migration: V16__create_sentinel_warnings_and_grace_windows.sql
-- Description: Create tables for pre-enforcement warnings and grace windows

CREATE TABLE IF NOT EXISTS sentinel_enforcement_warnings (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    warning_id UUID NOT NULL UNIQUE,
    user_id BIGINT NOT NULL,
    focus_session_id BIGINT NOT NULL,
    process_name VARCHAR(150) NOT NULL,
    command_line TEXT,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    decision_deadline TIMESTAMPTZ NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ISSUED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_sentinel_warning_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_sentinel_warning_session
        FOREIGN KEY (focus_session_id)
        REFERENCES focus_sessions(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sentinel_warning_user
    ON sentinel_enforcement_warnings(user_id);

CREATE INDEX IF NOT EXISTS idx_sentinel_warning_session
    ON sentinel_enforcement_warnings(focus_session_id);

CREATE INDEX IF NOT EXISTS idx_sentinel_warning_session_proc_status
    ON sentinel_enforcement_warnings(focus_session_id, process_name, status);

CREATE UNIQUE INDEX IF NOT EXISTS uq_sentinel_warning_active_session_proc
    ON sentinel_enforcement_warnings(focus_session_id, process_name)
    WHERE status IN ('ISSUED', 'GRACE_ACTIVE');

CREATE TABLE IF NOT EXISTS sentinel_grace_windows (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    warning_id UUID NOT NULL,
    focus_session_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    process_name VARCHAR(150) NOT NULL,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_grace_duration_bounds
        CHECK (duration_minutes >= 1 AND duration_minutes <= 20),

    CONSTRAINT fk_sentinel_grace_warning
        FOREIGN KEY (warning_id)
        REFERENCES sentinel_enforcement_warnings(warning_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_sentinel_grace_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_sentinel_grace_session
        FOREIGN KEY (focus_session_id)
        REFERENCES focus_sessions(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sentinel_grace_user
    ON sentinel_grace_windows(user_id);

CREATE INDEX IF NOT EXISTS idx_sentinel_grace_session
    ON sentinel_grace_windows(focus_session_id);

CREATE INDEX IF NOT EXISTS idx_sentinel_grace_session_proc_status
    ON sentinel_grace_windows(focus_session_id, process_name, status);

CREATE UNIQUE INDEX IF NOT EXISTS uq_sentinel_grace_active_session_proc
    ON sentinel_grace_windows(focus_session_id, process_name)
    WHERE status = 'ACTIVE';

CREATE UNIQUE INDEX IF NOT EXISTS uq_sentinel_grace_warning
    ON sentinel_grace_windows(warning_id);
