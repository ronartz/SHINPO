ALTER TABLE focus_sessions
    ADD COLUMN plan_id BIGINT,
    ADD CONSTRAINT fk_focus_session_plan
        FOREIGN KEY (plan_id)
        REFERENCES session_plans(id)
        ON DELETE SET NULL;

CREATE INDEX idx_focus_sessions_plan ON focus_sessions(plan_id);