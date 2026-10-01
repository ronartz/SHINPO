# 03 — API Complete Endpoint Map

Complete HTTP REST API endpoint registry implemented across all 13 controllers.

| HTTP Method | Exact Endpoint | Controller Class | Action / Method | Auth Required | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/ai/chat` | `AiController.java` | `chat()` | Yes (Bearer JWT) | Invokes backend service logic |
| `GET` | `/api/ai/conversation/active` | `AiController.java` | `getActiveConversation()` | Yes (Bearer JWT) | Invokes backend service logic |
| `DELETE` | `/api/ai/conversation/active` | `AiController.java` | `clearActiveConversation()` | Yes (Bearer JWT) | Invokes backend service logic |
| `POST` | `/api/ai/decompose-goal/{goalId}` | `AiController.java` | `decomposeGoal()` | Yes (Bearer JWT) | Invokes backend service logic |
| `GET` | `/api/ai/briefing` | `AiController.java` | `getExecutiveBriefing()` | Yes (Bearer JWT) | Invokes backend service logic |
| `GET` | `/api/ai/next-action` | `AiController.java` | `getNextAction()` | Yes (Bearer JWT) | Invokes backend service logic |
| `GET` | `/api/ai/daily-plan` | `AiController.java` | `getDailyPlan()` | Yes (Bearer JWT) | Invokes backend service logic |
| `POST` | `/api/ai/daily-plan/commit` | `AiController.java` | `commitDailyPlan()` | Yes (Bearer JWT) | Invokes backend service logic |
| `GET` | `/api/ai/recovery/{sessionId}` | `AiController.java` | `getSessionRecovery()` | Yes (Bearer JWT) | Invokes backend service logic |
| `GET` | `/api/ai/recovery/latest` | `AiController.java` | `getLatestSessionRecovery()` | Yes (Bearer JWT) | Invokes backend service logic |
| `GET` | `/api/ai/debrief-analysis/{sessionId}` | `AiController.java` | `analyzeSessionDebrief()` | Yes (Bearer JWT) | Invokes backend service logic |
| `GET` | `/api/ai/debrief-analysis/latest` | `AiController.java` | `analyzeLatestSessionDebrief()` | Yes (Bearer JWT) | Invokes backend service logic |
| `POST` | `/api/ai/suggestions/{suggestionId}/accept` | `AiController.java` | `acceptSuggestion()` | Yes (Bearer JWT) | Invokes backend service logic |
| `POST` | `/api/ai/suggestions/{suggestionId}/commit` | `AiController.java` | `commitSuggestion()` | Yes (Bearer JWT) | Invokes backend service logic |
| `GET` | `/api/ai/profile` | `AiController.java` | `getUserExecutionProfile()` | Yes (Bearer JWT) | Invokes backend service logic |
| `GET` | `/api/ai/tools` | `AiController.java` | `getAvailableTools()` | Yes (Bearer JWT) | Invokes backend service logic |
| `POST` | `/api/ai/tools/{toolName}/execute` | `AiController.java` | `executeTool()` | Yes (Bearer JWT) | Invokes backend service logic |
| `GET` | `/api/analytics/dashboard` | `AnalyticsController.java` | `getAnalyticsDashboard()` | Yes (Bearer JWT) | Invokes backend service logic |
| `POST` | `/api/auth/register` | `AuthController.java` | `register()` | No (Public) | Invokes backend service logic |
| `POST` | `/api/auth/login` | `AuthController.java` | `login()` | No (Public) | Invokes backend service logic |
| `POST` | `/api/auth/refresh` | `AuthController.java` | `refresh()` | No (Public) | Invokes backend service logic |
| `POST` | `/api/auth/logout` | `AuthController.java` | `logout()` | Yes (Bearer JWT) | Invokes backend service logic |
| `GET` | `/api/auth/me` | `AuthController.java` | `getCurrentUser()` | Yes (Bearer JWT) | Invokes backend service logic |
| `GET` | `/api/dashboard/` | `DashboardController.java` | `getDefaultDashboard()` | Yes (Bearer JWT) | Invokes backend service logic |
| `GET` | `/api/dashboard/{userId}` | `DashboardController.java` | `getDashboard()` | Yes (Bearer JWT) | Invokes backend service logic |
| `POST` | `/api/focus-sessions/` | `FocusSessionController.java` | `createSession()` | Yes (Bearer JWT) | Invokes backend service logic |
| `GET` | `/api/focus-sessions/` | `FocusSessionController.java` | `getSessions()` | Yes (Bearer JWT) | Invokes backend service logic |
| `GET` | `/api/focus-sessions/by-date` | `FocusSessionController.java` | `getSessionsByDate()` | Yes (Bearer JWT) | Invokes backend service logic |
| `GET` | `/api/focus-sessions/agenda` | `FocusSessionController.java` | `getAgenda()` | Yes (Bearer JWT) | Invokes backend service logic |
| `GET` | `/api/focus-sessions/{sessionId}` | `FocusSessionController.java` | `getSession()` | Yes (Bearer JWT) | Invokes backend service logic |
| `POST` | `/api/focus-sessions/{sessionId}/start` | `FocusSessionController.java` | `startSession()` | Yes (Bearer JWT) | Invokes backend service logic |
| `POST` | `/api/focus-sessions/{sessionId}/pause` | `FocusSessionController.java` | `pauseSession()` | Yes (Bearer JWT) | Invokes backend service logic |
| `POST` | `/api/focus-sessions/{sessionId}/resume` | `FocusSessionController.java` | `resumeSession()` | Yes (Bearer JWT) | Invokes backend service logic |
| `POST` | `/api/focus-sessions/{sessionId}/complete` | `FocusSessionController.java` | `completeSession()` | Yes (Bearer JWT) | Invokes backend service logic |
| `POST` | `/api/focus-sessions/{sessionId}/cancel` | `FocusSessionController.java` | `cancelSession()` | Yes (Bearer JWT) | Invokes backend service logic |
| `DELETE` | `/api/focus-sessions/{sessionId}` | `FocusSessionController.java` | `deleteSession()` | Yes (Bearer JWT) | Invokes backend service logic |
| `GET` | `/api/goals/` | `GoalController.java` | `getAllGoals()` | Yes (Bearer JWT) | Invokes backend service logic |
| `GET` | `/api/goals/{id}` | `GoalController.java` | `getGoalById()` | Yes (Bearer JWT) | Invokes backend service logic |
| `POST` | `/api/goals/` | `GoalController.java` | `createGoal()` | Yes (Bearer JWT) | Invokes backend service logic |
| `PUT` | `/api/goals/{id}` | `GoalController.java` | `updateGoal()` | Yes (Bearer JWT) | Invokes backend service logic |
| `DELETE` | `/api/goals/{id}` | `GoalController.java` | `deleteGoal()` | Yes (Bearer JWT) | Invokes backend service logic |
| `POST` | `/api/missions/{missionId}/complete` | `MissionCompletionController.java` | `completeMission()` | Yes (Bearer JWT) | Invokes backend service logic |
| `GET` | `/api/missions/` | `MissionController.java` | `getAllMissions()` | Yes (Bearer JWT) | Invokes backend service logic |
| `GET` | `/api/missions/{id}` | `MissionController.java` | `getMissionById()` | Yes (Bearer JWT) | Invokes backend service logic |
| `POST` | `/api/missions/` | `MissionController.java` | `createMission()` | Yes (Bearer JWT) | Invokes backend service logic |
| `PUT` | `/api/missions/{id}` | `MissionController.java` | `updateMission()` | Yes (Bearer JWT) | Invokes backend service logic |
| `DELETE` | `/api/missions/{id}` | `MissionController.java` | `deleteMission()` | Yes (Bearer JWT) | Invokes backend service logic |
| `GET` | `/api/progress/` | `ProgressController.java` | `getCurrentUserProgress()` | Yes (Bearer JWT) | Invokes backend service logic |
| `GET` | `/api/progress/{userId}` | `ProgressController.java` | `getUserProgress()` | Yes (Bearer JWT) | Invokes backend service logic |
| `GET` | `/api/device/sentinel/status` | `SentinelController.java` | `getSentinelStatus()` | Yes (Bearer JWT) | Invokes backend service logic |
| `POST` | `/api/device/sentinel/sweep` | `SentinelController.java` | `triggerSweep()` | Yes (Bearer JWT) | Invokes backend service logic |
| `GET` | `/api/device/sentinel/quarantines` | `SentinelController.java` | `getQuarantines()` | Yes (Bearer JWT) | Invokes backend service logic |
| `GET` | `/api/device/sentinel/rules` | `SentinelController.java` | `listRules()` | Yes (Bearer JWT) | Invokes backend service logic |
| `POST` | `/api/device/sentinel/rules` | `SentinelController.java` | `addRule()` | Yes (Bearer JWT) | Invokes backend service logic |
| `DELETE` | `/api/device/sentinel/rules/{ruleId}` | `SentinelController.java` | `deleteRule()` | Yes (Bearer JWT) | Invokes backend service logic |
| `PUT` | `/api/device/sentinel/mode` | `SentinelController.java` | `updateMode()` | Yes (Bearer JWT) | Invokes backend service logic |
| `POST` | `/api/device/sentinel/emergency-override` | `SentinelController.java` | `emergencyOverride()` | Yes (Bearer JWT) | Invokes backend service logic |
| `GET` | `/api/device/sentinel/tamper-events` | `SentinelController.java` | `listTamperEvents()` | Yes (Bearer JWT) | Invokes backend service logic |
| `POST` | `/api/device/sentinel/quarantines` | `SentinelController.java` | `recordQuarantine()` | Yes (Bearer JWT) | Invokes backend service logic |
| `POST` | `/api/device/sentinel/quarantines/batch` | `SentinelController.java` | `recordBatchQuarantines()` | Yes (Bearer JWT) | Invokes backend service logic |
| `GET` | `/api/device/sentinel/sync` | `SentinelController.java` | `getDaemonSync()` | Yes (Bearer JWT) | Invokes backend service logic |
| `GET` | `/api/device/system-info` | `TaskManagerController.java` | `getSystemInfo()` | Yes (Bearer JWT) | Invokes backend service logic |
| `GET` | `/api/device/processes` | `TaskManagerController.java` | `getProcesses()` | Yes (Bearer JWT) | Invokes backend service logic |
| `GET` | `/api/device/snapshot` | `TaskManagerController.java` | `getSnapshot()` | Yes (Bearer JWT) | Invokes backend service logic |
| `POST` | `/api/device/processes/{pid}/terminate` | `TaskManagerController.java` | `terminateProcess()` | Yes (Bearer JWT) | Invokes backend service logic |
| `POST` | `/api/users/` | `UserController.java` | `createUser()` | Yes (Bearer JWT) | Invokes backend service logic |
| `GET` | `/api/users/me` | `UserController.java` | `getCurrentUser()` | Yes (Bearer JWT) | Invokes backend service logic |
