CREATE TABLE bug_reports (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    bug_id VARCHAR(50) NOT NULL UNIQUE,
    user_id BIGINT,
    summary TEXT NOT NULL,
    feature VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
    status VARCHAR(30) NOT NULL DEFAULT 'OPEN',
    sanitized_diagnostics TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_bug_report_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE SET NULL
);

CREATE INDEX idx_bug_reports_user ON bug_reports(user_id);
CREATE INDEX idx_bug_reports_status ON bug_reports(status);
