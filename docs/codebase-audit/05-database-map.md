# 05 — Database Complete Map

Complete Flyway migration timeline and database schema mapping.

## 1. Migration Timeline

| Version | Description | File | Key Tables / Alters Created |
| :--- | :--- | :--- | :--- |
| `V10` | create conversations | [`V10__create_conversations.sql`](file:////home/eonx/Projects/SHINPO/backend/src/main/resources/db/migration/V10__create_conversations.sql) | Tables: `conversations`, `conversation_messages`  |
| `V11` | add user roles | [`V11__add_user_roles.sql`](file:////home/eonx/Projects/SHINPO/backend/src/main/resources/db/migration/V11__add_user_roles.sql) | Alters: `users`, `users` |
| `V12` | one active conversation per user | [`V12__one_active_conversation_per_user.sql`](file:////home/eonx/Projects/SHINPO/backend/src/main/resources/db/migration/V12__one_active_conversation_per_user.sql) | Schema adjustments |
| `V13` | create sentinel quarantine and policy tables | [`V13__create_sentinel_quarantine_and_policy_tables.sql`](file:////home/eonx/Projects/SHINPO/backend/src/main/resources/db/migration/V13__create_sentinel_quarantine_and_policy_tables.sql) | Tables: `sentinel_quarantine_records`, `sentinel_policy_rules`  |
| `V14` | create sentinel tamper events | [`V14__create_sentinel_tamper_events.sql`](file:////home/eonx/Projects/SHINPO/backend/src/main/resources/db/migration/V14__create_sentinel_tamper_events.sql) | Tables: `sentinel_tamper_events`  |
| `V1` | create core tables | [`V1__create_core_tables.sql`](file:////home/eonx/Projects/SHINPO/backend/src/main/resources/db/migration/V1__create_core_tables.sql) | Tables: `users`, `goals`, `missions`, `mission_completions`, `progress_events`  |
| `V2` | create focus sessions | [`V2__create_focus_sessions.sql`](file:////home/eonx/Projects/SHINPO/backend/src/main/resources/db/migration/V2__create_focus_sessions.sql) | Tables: `focus_sessions`  |
| `V3` | add pause tracking to focus sessions | [`V3__add_pause_tracking_to_focus_sessions.sql`](file:////home/eonx/Projects/SHINPO/backend/src/main/resources/db/migration/V3__add_pause_tracking_to_focus_sessions.sql) | Alters: `focus_sessions` |
| `V4` | create session plans | [`V4__create_session_plans.sql`](file:////home/eonx/Projects/SHINPO/backend/src/main/resources/db/migration/V4__create_session_plans.sql) | Tables: `session_plans`, `session_intervals`  |
| `V5` | add plan to focus sessions | [`V5__add_plan_to_focus_sessions.sql`](file:////home/eonx/Projects/SHINPO/backend/src/main/resources/db/migration/V5__add_plan_to_focus_sessions.sql) | Alters: `focus_sessions` |
| `V6` | add session result to focus sessions | [`V6__add_session_result_to_focus_sessions.sql`](file:////home/eonx/Projects/SHINPO/backend/src/main/resources/db/migration/V6__add_session_result_to_focus_sessions.sql) | Alters: `focus_sessions` |
| `V7` | create ai suggestions | [`V7__create_ai_suggestions.sql`](file:////home/eonx/Projects/SHINPO/backend/src/main/resources/db/migration/V7__create_ai_suggestions.sql) | Tables: `ai_suggestions`  |
| `V8` | create auth tables | [`V8__create_auth_tables.sql`](file:////home/eonx/Projects/SHINPO/backend/src/main/resources/db/migration/V8__create_auth_tables.sql) | Tables: `refresh_tokens` Alters: `ai_suggestions` |
| `V9` | create bug reports | [`V9__create_bug_reports.sql`](file:////home/eonx/Projects/SHINPO/backend/src/main/resources/db/migration/V9__create_bug_reports.sql) | Tables: `bug_reports`  |

## 2. Table to Entity Mapping

| Table Name | JPA Entity Class | Primary Key | Foreign Keys / Relationships |
| :--- | :--- | :--- | :--- |
| `users` | `com.shinpo.entity.User` | `id (BIGSERIAL)` | Roles, RefreshTokens, Goals, FocusSessions |
| `goals` | `com.shinpo.entity.Goal` | `id (BIGSERIAL)` | `user_id -> users(id)` |
| `missions` | `com.shinpo.entity.Mission` | `id (BIGSERIAL)` | `goal_id -> goals(id)` |
| `mission_completions` | `com.shinpo.entity.MissionCompletion` | `id (BIGSERIAL)` | `mission_id -> missions(id)` |
| `focus_sessions` | `com.shinpo.entity.FocusSession` | `id (BIGSERIAL)` | `user_id -> users(id)`, `goal_id`, `mission_id`, `plan_id` |
| `session_plans` | `com.shinpo.entity.SessionPlan` | `id (BIGSERIAL)` | `session_intervals` |
| `session_intervals` | `com.shinpo.entity.SessionInterval` | `id (BIGSERIAL)` | `plan_id -> session_plans(id)` |
| `refresh_tokens` | `com.shinpo.entity.RefreshToken` | `id (BIGSERIAL)` | `user_id -> users(id)` |
| `ai_suggestions` | `com.shinpo.entity.AiSuggestion` | `id (BIGSERIAL)` | `user_id -> users(id)` |
| `conversations` | `com.shinpo.entity.Conversation` | `id (BIGSERIAL)` | `user_id -> users(id)` (Unique active constraint in V12) |
| `conversation_messages`| `com.shinpo.entity.ConversationMessage`| `id (BIGSERIAL)` | `conversation_id -> conversations(id)` |
| `sentinel_quarantine_records`| `com.shinpo.entity.SentinelQuarantineRecord`| `id (BIGSERIAL)` | `user_id -> users(id)`, `focus_session_id` |
| `sentinel_policy_rules`| `com.shinpo.entity.SentinelPolicyRule`| `id (BIGSERIAL)` | `user_id -> users(id)` |
| `sentinel_tamper_events`| `com.shinpo.entity.SentinelTamperEvent`| `id (BIGSERIAL)` | `user_id -> users(id)` |
| `bug_reports` | `com.shinpo.entity.BugReport` | `id (BIGSERIAL)` | `user_id -> users(id)` |
| `progress_events` | `com.shinpo.entity.ProgressEvent` | `id (BIGSERIAL)` | `user_id -> users(id)` |
