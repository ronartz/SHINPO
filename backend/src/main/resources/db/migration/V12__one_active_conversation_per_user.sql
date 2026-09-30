WITH ranked_active_conversations AS (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY updated_at DESC, id DESC) AS row_number
    FROM conversations
    WHERE status = 'ACTIVE'
)
UPDATE conversations AS conversation
SET status = 'ARCHIVED'
FROM ranked_active_conversations AS ranked
WHERE conversation.id = ranked.id
  AND ranked.row_number > 1;

CREATE UNIQUE INDEX uq_conversations_one_active_per_user
    ON conversations (user_id)
    WHERE status = 'ACTIVE';