ALTER TABLE progress_events
    ADD COLUMN goal_id BIGINT;

ALTER TABLE progress_events
    ADD CONSTRAINT fk_progress_goal
        FOREIGN KEY (goal_id)
        REFERENCES goals(id)
        ON DELETE SET NULL;

CREATE UNIQUE INDEX uq_progress_events_goal_completion_reward
    ON progress_events(goal_id)
    WHERE event_type = 'GOAL_COMPLETED' AND goal_id IS NOT NULL;
