CREATE TABLE users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE goals (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    target_date DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_goals_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

CREATE TABLE missions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    goal_id BIGINT NOT NULL,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    scheduled_date DATE NOT NULL,
    estimated_minutes INTEGER,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_missions_goal
        FOREIGN KEY (goal_id)
        REFERENCES goals(id)
        ON DELETE CASCADE
);

CREATE TABLE mission_completions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    mission_id BIGINT NOT NULL,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    actual_minutes INTEGER,
    result VARCHAR(20) NOT NULL,
    earned_progress INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT fk_completion_mission
        FOREIGN KEY (mission_id)
        REFERENCES missions(id)
        ON DELETE CASCADE
);

CREATE TABLE progress_events (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL,
    mission_completion_id BIGINT,
    event_type VARCHAR(30) NOT NULL,
    amount INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_progress_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_progress_completion
        FOREIGN KEY (mission_completion_id)
        REFERENCES mission_completions(id)
        ON DELETE SET NULL
);
