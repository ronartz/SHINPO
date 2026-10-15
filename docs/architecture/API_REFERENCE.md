# SHINPO (進歩) — API Reference & Data Contracts

## 1. Authentication Endpoints

Base Path: `/api/auth`

| Method | Endpoint | Description | Request Body | Response |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Register new user account | `{ username, email, password }` | `AuthResponse` |
| `POST` | `/api/auth/login` | Authenticate with credentials | `{ usernameOrEmail, password }` | `AuthResponse` |
| `GET` | `/api/auth/me` | Fetch authenticated user profile | None | `AuthUser` |
| `POST` | `/api/auth/refresh` | Refresh access token | `{ refreshToken }` | `AuthResponse` |
| `POST` | `/api/auth/logout` | Revoke active refresh token | `{ refreshToken }` | `204 No Content` |

### `AuthResponse` Schema
```json
{
  "accessToken": "eyJhbGciOi...",
  "refreshToken": "48b6c0...",
  "tokenType": "Bearer",
  "expiresInSeconds": 86400,
  "user": {
    "id": 1,
    "username": "eonx",
    "email": "user@shinpo.local"
  }
}
```

---

## 2. Goals & Missions (Tasks) Endpoints

Base Path: `/api`

| Method | Endpoint | Description | Request Body | Response |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/goals` | List all goals for current user | None | `Goal[]` |
| `POST` | `/api/goals` | Create a new goal | `CreateGoalPayload` | `Goal` |
| `PUT` | `/api/goals/{id}` | Update goal details/status | `UpdateGoalPayload` | `Goal` |
| `DELETE` | `/api/goals/{id}` | Delete goal and child tasks | None | `204 No Content` |
| `GET` | `/api/missions` | List all tasks/missions | None | `Mission[]` |
| `POST` | `/api/missions` | Create a new task | `CreateMissionPayload` | `Mission` |
| `PUT` | `/api/missions/{id}` | Update task details/status | `UpdateMissionPayload` | `Mission` |
| `DELETE` | `/api/missions/{id}` | Delete task | None | `204 No Content` |
| `POST` | `/api/missions/{id}/complete` | Mark task completed & award XP | `{ actualMinutes }` | `MissionCompletionResponse` |

---

## 3. Focus Sessions Endpoints

Base Path: `/api/focus-sessions`

| Method | Endpoint | Description | Request Body | Response |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/focus-sessions` | List active & past sessions | None | `FocusSession[]` |
| `POST` | `/api/focus-sessions` | Create a focus session | `CreateFocusSessionRequest` | `FocusSession` |
| `GET` | `/api/focus-sessions/by-date` | Sessions for specific calendar date | `?date=YYYY-MM-DD` | `FocusSession[]` |
| `GET` | `/api/focus-sessions/agenda` | Sessions across date range | `?startDate=...&endDate=...` | `FocusSession[]` |
| `POST` | `/api/focus-sessions/{id}/start` | Transition session to ACTIVE | None | `FocusSession` |
| `POST` | `/api/focus-sessions/{id}/pause` | Pause active countdown | None | `FocusSession` |
| `POST` | `/api/focus-sessions/{id}/resume` | Resume paused countdown | None | `FocusSession` |
| `POST` | `/api/focus-sessions/{id}/complete` | Complete session with reflection | `CompleteFocusSessionPayload` | `FocusSession` |
| `POST` | `/api/focus-sessions/{id}/cancel` | Cancel active session | None | `FocusSession` |
| `DELETE` | `/api/focus-sessions/{id}` | Remove scheduled session | None | `204 No Content` |

---

## 4. Sentinel Shield & Device Endpoints

Base Path: `/api/sentinel`

| Method | Endpoint | Description | Response |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/sentinel/status` | Current shield protection status | `SentinelStatus` |
| `GET` | `/api/sentinel/warnings` | Active distraction warnings | `SentinelWarningItem[]` |
| `POST` | `/api/sentinel/warnings/{id}/respond` | User response to grace warning | `200 OK` |
| `POST` | `/api/sentinel/test/trigger` | Development test trigger | `200 OK` |

---

## 5. Standardized Error Response Model

Every non-2xx HTTP response from backend adheres to:

```json
{
  "timestamp": "2026-10-15T15:00:00Z",
  "status": 409,
  "error": "INVALID_STATE_TRANSITION",
  "message": "Focus session #42 is already COMPLETED and cannot be resumed.",
  "path": "/api/focus-sessions/42/resume"
}
```

Frontend's `apiClient` maps this schema to an `ApiError` instance with methods `isUnauthorized()`, `isForbidden()`, `isConflict()`, and `isValidationError()`.

