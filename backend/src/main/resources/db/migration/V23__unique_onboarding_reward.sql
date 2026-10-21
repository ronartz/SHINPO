DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM progress_events
        WHERE event_type = 'ONBOARDING_COMPLETED'
        GROUP BY user_id
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Duplicate ONBOARDING_COMPLETED events exist; resolve them with an approved data-preserving migration before applying V23';
    END IF;
END;
$$;

CREATE UNIQUE INDEX uq_progress_events_onboarding_reward
    ON progress_events(user_id)
    WHERE event_type = 'ONBOARDING_COMPLETED';
