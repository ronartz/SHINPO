-- V17: Persist Sentinel enforcement mode per user across backend restarts
ALTER TABLE users ADD COLUMN IF NOT EXISTS enforcement_mode VARCHAR(30) NOT NULL DEFAULT 'STRICT';

