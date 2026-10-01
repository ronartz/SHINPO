# 06 — Frontend Complete Code Map

Frontend is a React 19 + TypeScript + Vite SPA configured with Tailwind/CSS custom themes.

## 1. File Structure & Component Hierarchy
- `main.tsx`: Entrypoint, binds React DOM to `#root`.
- `App.tsx`: Central Cockpit Dashboard (Bento Grid layout, state management, modal controllers, WebSocket telemetry drawer, live alerts toast portal).
- `components/CustomCursor.tsx`: Custom fluid cursor for interactive desktop feel.
- `components/ShinpoLogo.tsx`: SVG vector logo with glowing state.
- `components/TutorialOverlay.tsx`: Interactive onboarding step-through.

## 2. API Modules (`frontend/src/api/`)
| File | Purpose | Key Functions | Backend Endpoint Base |
| :--- | :--- | :--- | :--- |
| `auth.ts` | JWT Auth, login, register, me, logout | `login()`, `register()`, `fetchCurrentUser()`, `logout()` | `/api/auth` |
| `goalsAndMissions.ts`| Goals & Missions CRUD | `fetchGoals()`, `createGoal()`, `fetchMissions()`, `createMission()`, `completeMission()` | `/api/goals`, `/api/missions` |
| `focusSessions.ts` | Sprint lifecycle state machine | `getFocusSessions()`, `createFocusSession()`, `startFocusSession()`, `pauseFocusSession()`, `resumeFocusSession()`, `completeFocusSession()`, `cancelFocusSession()` | `/api/focus-sessions` |
| `device.ts` | Task Manager & Sentinel Control | `fetchDeviceSystemInfo()`, `fetchProcesses()`, `terminateProcess()`, `fetchSentinelStatus()`, `updateEnforcementMode()`, `triggerSentinelSweep()` | `/api/device` |
| `analytics.ts` | Executive Analytics Dashboard | `fetchAnalyticsDashboard()` | `/api/analytics` |
| `ai.ts` | EONPAI AI chat, briefing, daily plan | `fetchActiveConversation()`, `sendChatMessage()`, `fetchDailyPlan()`, `commitDailyPlan()`, `fetchExecutiveBriefing()` | `/api/ai` |
| `websocket.ts` | STOMP Client for real-time telemetry | `ShinpoWebSocketClient` singleton `wsClient` | `/ws` |
