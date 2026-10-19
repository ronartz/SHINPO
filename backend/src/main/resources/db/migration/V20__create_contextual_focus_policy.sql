-- Contextual browser policy is a separate dimension from native Sentinel mode.
ALTER TABLE focus_sessions
    ADD COLUMN IF NOT EXISTS study_mode VARCHAR(20) NOT NULL DEFAULT 'PROTECTED',
    ADD COLUMN IF NOT EXISTS context_policy_revision BIGINT NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS restrict_youtube_shorts BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS restrict_youtube_home BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS restrict_unapproved_youtube BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS hide_youtube_recommendations BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE focus_sessions
    ADD CONSTRAINT chk_focus_session_study_mode
    CHECK (study_mode IN ('GUIDED', 'PROTECTED', 'STRICT'));

CREATE TABLE contextual_focus_resources (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL,
    mission_id BIGINT,
    focus_session_id BIGINT,
    process_exception_id BIGINT UNIQUE,
    resource_type VARCHAR(30) NOT NULL,
    match_type VARCHAR(30) NOT NULL,
    disposition VARCHAR(20) NOT NULL,
    destination TEXT NOT NULL,
    canonical_destination TEXT NOT NULL,
    display_name VARCHAR(200),
    expires_at TIMESTAMPTZ,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_context_resource_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_context_resource_mission FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE CASCADE,
    CONSTRAINT fk_context_resource_session FOREIGN KEY (focus_session_id) REFERENCES focus_sessions(id) ON DELETE CASCADE,
    CONSTRAINT fk_context_resource_process_exception FOREIGN KEY (process_exception_id)
        REFERENCES focus_session_enforcement_exceptions(id) ON DELETE CASCADE,
    CONSTRAINT chk_context_resource_scope CHECK (
        (mission_id IS NOT NULL AND focus_session_id IS NULL)
        OR (mission_id IS NULL AND focus_session_id IS NOT NULL)
    ),
    CONSTRAINT chk_context_resource_type CHECK (resource_type IN (
        'WEBSITE', 'YOUTUBE_VIDEO', 'YOUTUBE_PLAYLIST', 'DISCORD_CHANNEL',
        'TEMPORARY_SITE', 'DESKTOP_PROCESS'
    )),
    CONSTRAINT chk_context_resource_match CHECK (match_type IN (
        'EXACT', 'DOMAIN', 'URL_PATTERN', 'BROWSER_CHANNEL', 'PROCESS'
    )),
    CONSTRAINT chk_context_resource_disposition CHECK (disposition IN ('APPROVED', 'BLOCKED'))
);

CREATE INDEX idx_context_resources_user ON contextual_focus_resources(user_id);
CREATE INDEX idx_context_resources_mission ON contextual_focus_resources(mission_id);
CREATE INDEX idx_context_resources_session ON contextual_focus_resources(focus_session_id);
CREATE INDEX idx_context_resources_expiry ON contextual_focus_resources(expires_at);

CREATE TABLE contextual_policy_audit_events (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL,
    focus_session_id BIGINT,
    resource_id BIGINT,
    policy_revision BIGINT NOT NULL,
    change_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_context_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_context_audit_session FOREIGN KEY (focus_session_id) REFERENCES focus_sessions(id) ON DELETE SET NULL
);

CREATE INDEX idx_context_audit_user_created
    ON contextual_policy_audit_events(user_id, created_at DESC);
CREATE INDEX idx_context_audit_session_revision
    ON contextual_policy_audit_events(focus_session_id, policy_revision);
