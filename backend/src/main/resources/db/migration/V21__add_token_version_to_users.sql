-- Migration V21: Add token_version to users for immediate access-token invalidation
-- Supports instant revocation upon password change, logout, and replay detection.

ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version BIGINT NOT NULL DEFAULT 1;

