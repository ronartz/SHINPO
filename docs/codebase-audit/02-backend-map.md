# 02 — Backend Complete Code Map

This document provides a comprehensive map of all Java controllers and services in `backend/src/main/java/com/shinpo/`.

## 1. Controllers

### `AiController.java`
- **Package**: `com.shinpo.controller`
- **File**: [`backend/src/main/java/com/shinpo/controller/AiController.java`](file:////home/eonx/Projects/SHINPO/backend/src/main/java/com/shinpo/controller/AiController.java)
- **Base Path**: `/api/ai`

| Method | Endpoint | Handler Method | Parameters | Return Type |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/ai/chat` | `chat` | `(` | `ResponseEntity<AiChatResponse>` |
| `GET` | `/api/ai/conversation/active` | `getActiveConversation` | `(` | `ResponseEntity<ConversationDto>` |
| `DELETE` | `/api/ai/conversation/active` | `clearActiveConversation` | `(` | `ResponseEntity<ConversationDto>` |
| `POST` | `/api/ai/decompose-goal/{goalId}` | `decomposeGoal` | `(` | `ResponseEntity<GoalDecompositionResponse>` |
| `GET` | `/api/ai/briefing` | `getExecutiveBriefing` | `(` | `ResponseEntity<ExecutiveBriefingResponse>` |
| `GET` | `/api/ai/next-action` | `getNextAction` | `(` | `ResponseEntity<NextActionResponse>` |
| `GET` | `/api/ai/daily-plan` | `getDailyPlan` | `(` | `ResponseEntity<DailyPlanResponse>` |
| `POST` | `/api/ai/daily-plan/commit` | `commitDailyPlan` | `(` | `ResponseEntity<CommitDailyPlanResponse>` |
| `GET` | `/api/ai/recovery/{sessionId}` | `getSessionRecovery` | `(` | `ResponseEntity<RecoveryResponse>` |
| `GET` | `/api/ai/recovery/latest` | `getLatestSessionRecovery` | `(` | `ResponseEntity<RecoveryResponse>` |
| `GET` | `/api/ai/debrief-analysis/{sessionId}` | `analyzeSessionDebrief` | `(` | `ResponseEntity<SessionDebriefAnalysisResponse>` |
| `GET` | `/api/ai/debrief-analysis/latest` | `analyzeLatestSessionDebrief` | `(` | `ResponseEntity<SessionDebriefAnalysisResponse>` |
| `POST` | `/api/ai/suggestions/{suggestionId}/accept` | `acceptSuggestion` | `(` | `ResponseEntity<Void>` |
| `POST` | `/api/ai/suggestions/{suggestionId}/commit` | `commitSuggestion` | `(` | `ResponseEntity<SuggestionCommitResponse>` |
| `GET` | `/api/ai/profile` | `getUserExecutionProfile` | `(` | `ResponseEntity<UserExecutionProfileDto>` |
| `GET` | `/api/ai/tools` | `getAvailableTools` | `(` | `ResponseEntity<List<ToolDefinition>>` |
| `POST` | `/api/ai/tools/{toolName}/execute` | `executeTool` | `(` | `ResponseEntity<ToolResult>` |

---

### `AnalyticsController.java`
- **Package**: `com.shinpo.controller`
- **File**: [`backend/src/main/java/com/shinpo/controller/AnalyticsController.java`](file:////home/eonx/Projects/SHINPO/backend/src/main/java/com/shinpo/controller/AnalyticsController.java)
- **Base Path**: `/api/analytics`

| Method | Endpoint | Handler Method | Parameters | Return Type |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/analytics/dashboard` | `getAnalyticsDashboard` | `(` | `ResponseEntity<AnalyticsDashboardResponse>` |

---

### `AuthController.java`
- **Package**: `com.shinpo.controller`
- **File**: [`backend/src/main/java/com/shinpo/controller/AuthController.java`](file:////home/eonx/Projects/SHINPO/backend/src/main/java/com/shinpo/controller/AuthController.java)
- **Base Path**: `/api/auth`

| Method | Endpoint | Handler Method | Parameters | Return Type |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | `register` | `(@Valid @RequestBody RegisterRequest request) ` | `AuthResponse` |
| `POST` | `/api/auth/login` | `login` | `(@Valid @RequestBody LoginRequest request) ` | `AuthResponse` |
| `POST` | `/api/auth/refresh` | `refresh` | `(@Valid @RequestBody RefreshTokenRequest request) ` | `AuthResponse` |
| `POST` | `/api/auth/logout` | `logout` | `(@RequestBody(required = false) RefreshTokenRequest request) ` | `ResponseEntity<Void>` |
| `GET` | `/api/auth/me` | `getCurrentUser` | `(@AuthenticationPrincipal UserPrincipal principal) ` | `ResponseEntity<UserResponse>` |

---

### `DashboardController.java`
- **Package**: `com.shinpo.controller`
- **File**: [`backend/src/main/java/com/shinpo/controller/DashboardController.java`](file:////home/eonx/Projects/SHINPO/backend/src/main/java/com/shinpo/controller/DashboardController.java)
- **Base Path**: `/api/dashboard`

| Method | Endpoint | Handler Method | Parameters | Return Type |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/dashboard/` | `getDefaultDashboard` | `(@AuthenticationPrincipal UserPrincipal principal) ` | `DashboardResponse` |
| `GET` | `/api/dashboard/{userId}` | `getDashboard` | `(` | `DashboardResponse` |

---

### `FocusSessionController.java`
- **Package**: `com.shinpo.controller`
- **File**: [`backend/src/main/java/com/shinpo/controller/FocusSessionController.java`](file:////home/eonx/Projects/SHINPO/backend/src/main/java/com/shinpo/controller/FocusSessionController.java)
- **Base Path**: `/api/focus-sessions`

| Method | Endpoint | Handler Method | Parameters | Return Type |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/focus-sessions/` | `createSession` | `(` | `ResponseEntity<FocusSessionResponse>` |
| `GET` | `/api/focus-sessions/` | `getSessions` | `(` | `ResponseEntity<List<FocusSessionResponse>>` |
| `GET` | `/api/focus-sessions/by-date` | `getSessionsByDate` | `(` | `ResponseEntity<List<FocusSessionResponse>>` |
| `GET` | `/api/focus-sessions/agenda` | `getAgenda` | `(` | `ResponseEntity<List<FocusSessionResponse>>` |
| `GET` | `/api/focus-sessions/{sessionId}` | `getSession` | `(` | `ResponseEntity<FocusSessionResponse>` |
| `POST` | `/api/focus-sessions/{sessionId}/start` | `startSession` | `(` | `ResponseEntity<FocusSessionResponse>` |
| `POST` | `/api/focus-sessions/{sessionId}/pause` | `pauseSession` | `(` | `ResponseEntity<FocusSessionResponse>` |
| `POST` | `/api/focus-sessions/{sessionId}/resume` | `resumeSession` | `(` | `ResponseEntity<FocusSessionResponse>` |
| `POST` | `/api/focus-sessions/{sessionId}/complete` | `completeSession` | `(` | `ResponseEntity<FocusSessionResponse>` |
| `POST` | `/api/focus-sessions/{sessionId}/cancel` | `cancelSession` | `(` | `ResponseEntity<FocusSessionResponse>` |
| `DELETE` | `/api/focus-sessions/{sessionId}` | `deleteSession` | `(` | `ResponseEntity<Void>` |

---

### `GlobalExceptionHandler.java`
- **Package**: `com.shinpo.controller`
- **File**: [`backend/src/main/java/com/shinpo/controller/GlobalExceptionHandler.java`](file:////home/eonx/Projects/SHINPO/backend/src/main/java/com/shinpo/controller/GlobalExceptionHandler.java)
- **Base Path**: ``

| Method | Endpoint | Handler Method | Parameters | Return Type |
| :--- | :--- | :--- | :--- | :--- |

---

### `GoalController.java`
- **Package**: `com.shinpo.controller`
- **File**: [`backend/src/main/java/com/shinpo/controller/GoalController.java`](file:////home/eonx/Projects/SHINPO/backend/src/main/java/com/shinpo/controller/GoalController.java)
- **Base Path**: `/api/goals`

| Method | Endpoint | Handler Method | Parameters | Return Type |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/goals/` | `getAllGoals` | `(@AuthenticationPrincipal UserPrincipal principal) ` | `List<GoalResponse>` |
| `GET` | `/api/goals/{id}` | `getGoalById` | `(` | `GoalResponse` |
| `POST` | `/api/goals/` | `createGoal` | `(` | `GoalResponse` |
| `PUT` | `/api/goals/{id}` | `updateGoal` | `(` | `GoalResponse` |
| `DELETE` | `/api/goals/{id}` | `deleteGoal` | `(` | `void` |

---

### `MissionCompletionController.java`
- **Package**: `com.shinpo.controller`
- **File**: [`backend/src/main/java/com/shinpo/controller/MissionCompletionController.java`](file:////home/eonx/Projects/SHINPO/backend/src/main/java/com/shinpo/controller/MissionCompletionController.java)
- **Base Path**: `/api/missions`

| Method | Endpoint | Handler Method | Parameters | Return Type |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/missions/{missionId}/complete` | `completeMission` | `(` | `MissionCompletionResponse` |

---

### `MissionController.java`
- **Package**: `com.shinpo.controller`
- **File**: [`backend/src/main/java/com/shinpo/controller/MissionController.java`](file:////home/eonx/Projects/SHINPO/backend/src/main/java/com/shinpo/controller/MissionController.java)
- **Base Path**: `/api/missions`

| Method | Endpoint | Handler Method | Parameters | Return Type |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/missions/` | `getAllMissions` | `(@AuthenticationPrincipal UserPrincipal principal) ` | `List<MissionResponse>` |
| `GET` | `/api/missions/{id}` | `getMissionById` | `(` | `MissionResponse` |
| `POST` | `/api/missions/` | `createMission` | `(` | `MissionResponse` |
| `PUT` | `/api/missions/{id}` | `updateMission` | `(` | `MissionResponse` |
| `DELETE` | `/api/missions/{id}` | `deleteMission` | `(` | `void` |

---

### `ProgressController.java`
- **Package**: `com.shinpo.controller`
- **File**: [`backend/src/main/java/com/shinpo/controller/ProgressController.java`](file:////home/eonx/Projects/SHINPO/backend/src/main/java/com/shinpo/controller/ProgressController.java)
- **Base Path**: `/api/progress`

| Method | Endpoint | Handler Method | Parameters | Return Type |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/progress/` | `getCurrentUserProgress` | `(@AuthenticationPrincipal UserPrincipal principal) ` | `ProgressResponse` |
| `GET` | `/api/progress/{userId}` | `getUserProgress` | `(` | `ProgressResponse` |

---

### `SentinelController.java`
- **Package**: `com.shinpo.controller`
- **File**: [`backend/src/main/java/com/shinpo/controller/SentinelController.java`](file:////home/eonx/Projects/SHINPO/backend/src/main/java/com/shinpo/controller/SentinelController.java)
- **Base Path**: `/api/device/sentinel`

| Method | Endpoint | Handler Method | Parameters | Return Type |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/device/sentinel/status` | `getSentinelStatus` | `(` | `ResponseEntity<SentinelStatusResponse>` |
| `POST` | `/api/device/sentinel/sweep` | `triggerSweep` | `(` | `ResponseEntity<SentinelSweepResponse>` |
| `GET` | `/api/device/sentinel/quarantines` | `getQuarantines` | `(` | `ResponseEntity<List<SentinelQuarantineItem>>` |
| `GET` | `/api/device/sentinel/rules` | `listRules` | `(` | `ResponseEntity<List<PolicyRuleResponse>>` |
| `POST` | `/api/device/sentinel/rules` | `addRule` | `(` | `ResponseEntity<PolicyRuleResponse>` |
| `DELETE` | `/api/device/sentinel/rules/{ruleId}` | `deleteRule` | `(` | `ResponseEntity<Void>` |
| `PUT` | `/api/device/sentinel/mode` | `updateMode` | `(` | `ResponseEntity<SentinelStatusResponse>` |
| `POST` | `/api/device/sentinel/emergency-override` | `emergencyOverride` | `(` | `ResponseEntity<EmergencyOverrideResponse>` |
| `GET` | `/api/device/sentinel/tamper-events` | `listTamperEvents` | `(` | `ResponseEntity<List<SentinelTamperEventItem>>` |
| `POST` | `/api/device/sentinel/quarantines` | `recordQuarantine` | `(` | `ResponseEntity<SentinelQuarantineItem>` |
| `POST` | `/api/device/sentinel/quarantines/batch` | `recordBatchQuarantines` | `(` | `ResponseEntity<BatchQuarantineResponse>` |
| `GET` | `/api/device/sentinel/sync` | `getDaemonSync` | `(` | `ResponseEntity<SentinelDaemonSyncResponse>` |

---

### `TaskManagerController.java`
- **Package**: `com.shinpo.controller`
- **File**: [`backend/src/main/java/com/shinpo/controller/TaskManagerController.java`](file:////home/eonx/Projects/SHINPO/backend/src/main/java/com/shinpo/controller/TaskManagerController.java)
- **Base Path**: `/api/device`

| Method | Endpoint | Handler Method | Parameters | Return Type |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/device/system-info` | `getSystemInfo` | `(` | `ResponseEntity<DeviceSystemInfo>` |
| `GET` | `/api/device/processes` | `getProcesses` | `(` | `ResponseEntity<List<ProcessInfo>>` |
| `GET` | `/api/device/snapshot` | `getSnapshot` | `(` | `ResponseEntity<ProcessSnapshot>` |
| `POST` | `/api/device/processes/{pid}/terminate` | `terminateProcess` | `(` | `ResponseEntity<ProcessControlResult>` |

---

### `UserController.java`
- **Package**: `com.shinpo.controller`
- **File**: [`backend/src/main/java/com/shinpo/controller/UserController.java`](file:////home/eonx/Projects/SHINPO/backend/src/main/java/com/shinpo/controller/UserController.java)
- **Base Path**: `/api/users`

| Method | Endpoint | Handler Method | Parameters | Return Type |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/users/` | `createUser` | `(` | `UserResponse` |
| `GET` | `/api/users/me` | `getCurrentUser` | `(@AuthenticationPrincipal UserPrincipal principal) ` | `UserResponse` |

---

## 2. Services & Call Graph

### `AiService.java`
- **Package**: `com.shinpo.service`
- **File**: [`backend/src/main/java/com/shinpo/service/AiService.java`](file:////home/eonx/Projects/SHINPO/backend/src/main/java/com/shinpo/service/AiService.java)

**Dependencies Injected**:
- `goalRepository`: `GoalRepository`
- `missionRepository`: `MissionRepository`
- `focusSessionRepository`: `FocusSessionRepository`
- `aiGateway`: `AiGateway`
- `conversationRepository`: `ConversationRepository`
- `conversationMessageRepository`: `ConversationMessageRepository`
- `userRepository`: `UserRepository`
- `aiSuggestionRepository`: `AiSuggestionRepository`
- `objectMapper`: `ObjectMapper`
- `transactionTemplate`: `TransactionTemplate`
- `conversationTransactionTemplate`: `TransactionTemplate`
- `userExecutionProfileService`: `UserExecutionProfileService`
- `focusSessionService`: `FocusSessionService`
- `sentinelQuarantineRepository`: `SentinelQuarantineRepository`
- `sentinelTamperEventRepository`: `SentinelTamperEventRepository`

**Public Methods**:
- `public GoalDecompositionResponse decomposeGoal(Long goalId, Long userId)`
- `public NextActionResponse getNextAction(Long userId)`
- `public DailyPlanResponse getDailyPlan(Long userId)`
- `public SessionDebriefAnalysisResponse analyzeSessionDebrief(Long sessionId, Long userId)`
- `public SessionDebriefAnalysisResponse analyzeLatestSessionDebrief(Long userId)`
- `public RecoveryResponse getSessionRecovery(Long sessionId, Long userId)`
- `public RecoveryResponse getLatestSessionRecovery(Long userId)`
- `public UserExecutionProfileDto getUserExecutionProfile(Long userId)`
- `public void acceptSuggestion(Long suggestionId, Long userId)`
- `public SuggestionCommitResponse commitSuggestion(Long suggestionId, Long userId, SuggestionCommitRequest request)`
- `public ConversationDto getActiveConversation(Long userId)`
- `public ConversationDto clearActiveConversation(Long userId)`
- `public AiChatResponse processChat(AiChatRequest request)`
- `public CommitDailyPlanResponse commitDailyPlan(Long userId, CommitDailyPlanRequest request)`
- `public ExecutiveBriefingResponse generateExecutiveBriefing(Long userId)`

---

### `AnalyticsService.java`
- **Package**: `com.shinpo.service`
- **File**: [`backend/src/main/java/com/shinpo/service/AnalyticsService.java`](file:////home/eonx/Projects/SHINPO/backend/src/main/java/com/shinpo/service/AnalyticsService.java)

**Dependencies Injected**:
- `focusSessionRepository`: `FocusSessionRepository`
- `missionRepository`: `MissionRepository`

**Public Methods**:
- `public AnalyticsDashboardResponse getAnalyticsDashboard(Long userId)`

---

### `AuthService.java`
- **Package**: `com.shinpo.service`
- **File**: [`backend/src/main/java/com/shinpo/service/AuthService.java`](file:////home/eonx/Projects/SHINPO/backend/src/main/java/com/shinpo/service/AuthService.java)

**Dependencies Injected**:
- `userRepository`: `UserRepository`
- `goalRepository`: `GoalRepository`
- `missionRepository`: `MissionRepository`
- `passwordEncoder`: `PasswordEncoder`
- `jwtTokenService`: `JwtTokenService`

**Public Methods**:
- `public AuthResponse register(RegisterRequest request)`
- `public AuthResponse login(LoginRequest request)`
- `public AuthResponse refreshToken(RefreshTokenRequest request)`
- `public void logout(String refreshToken)`

---

### `DashboardService.java`
- **Package**: `com.shinpo.service`
- **File**: [`backend/src/main/java/com/shinpo/service/DashboardService.java`](file:////home/eonx/Projects/SHINPO/backend/src/main/java/com/shinpo/service/DashboardService.java)

**Dependencies Injected**:
- `userRepository`: `UserRepository`
- `goalRepository`: `GoalRepository`
- `missionRepository`: `MissionRepository`
- `progressEventRepository`: `ProgressEventRepository`

**Public Methods**:
- `public DashboardResponse getDashboard(Long userId)`

---

### `FocusSessionService.java`
- **Package**: `com.shinpo.service`
- **File**: [`backend/src/main/java/com/shinpo/service/FocusSessionService.java`](file:////home/eonx/Projects/SHINPO/backend/src/main/java/com/shinpo/service/FocusSessionService.java)

**Dependencies Injected**:
- `focusSessionRepository`: `FocusSessionRepository`
- `userRepository`: `UserRepository`
- `goalRepository`: `GoalRepository`
- `missionRepository`: `MissionRepository`
- `sessionPlanRepository`: `SessionPlanRepository`
- `webSocketEventService`: `WebSocketEventService`

**Public Methods**:
- `public FocusSessionResponse createSession(CreateFocusSessionRequest request)`
- `public List<FocusSessionResponse> getSessionsForUser(Long userId)`
- `public List<FocusSessionResponse> getSessionsByDate(Long userId, LocalDate date)`
- `public List<FocusSessionResponse> getSessionsForAgenda(Long userId, LocalDate startDate, LocalDate endDate)`
- `public List<FocusSessionResponse> getAgenda(Long userId, LocalDate startDate, LocalDate endDate)`
- `public FocusSessionResponse getSession(Long sessionId, Long userId)`
- `public FocusSessionResponse startSession(Long sessionId, Long userId)`
- `public FocusSessionResponse pauseSession(Long sessionId, Long userId)`
- `public FocusSessionResponse resumeSession(Long sessionId, Long userId)`
- `public FocusSessionResponse completeSession(Long sessionId, Long userId)`
- `public FocusSessionResponse completeSession(Long sessionId, Long userId, CompleteFocusSessionRequest request)`
- `public FocusSessionResponse cancelSession(Long sessionId, Long userId)`
- `public void deleteSession(Long sessionId, Long userId)`
- `public void sweepExpiredSessions()`
- `public boolean checkAndApplyExpiration(FocusSession session, Instant now)`

---

### `GoalService.java`
- **Package**: `com.shinpo.service`
- **File**: [`backend/src/main/java/com/shinpo/service/GoalService.java`](file:////home/eonx/Projects/SHINPO/backend/src/main/java/com/shinpo/service/GoalService.java)

**Dependencies Injected**:
- `goalRepository`: `GoalRepository`
- `userRepository`: `UserRepository`

**Public Methods**:
- `public List<GoalResponse> getGoalsForUser(Long userId)`
- `public GoalResponse getGoal(Long id, Long userId)`
- `public GoalResponse createGoal(Long userId, CreateGoalRequest request)`
- `public GoalResponse updateGoal(Long id, Long userId, UpdateGoalRequest request)`
- `public void deleteGoal(Long id, Long userId)`

---

### `MissionCompletionService.java`
- **Package**: `com.shinpo.service`
- **File**: [`backend/src/main/java/com/shinpo/service/MissionCompletionService.java`](file:////home/eonx/Projects/SHINPO/backend/src/main/java/com/shinpo/service/MissionCompletionService.java)

**Dependencies Injected**:
- `missionRepository`: `MissionRepository`
- `completionRepository`: `MissionCompletionRepository`
- `progressEventRepository`: `ProgressEventRepository`

**Public Methods**:
- `public MissionCompletionResponse completeMission(Long missionId,             Long userId,             CompleteMissionRequest request)`

---

### `MissionService.java`
- **Package**: `com.shinpo.service`
- **File**: [`backend/src/main/java/com/shinpo/service/MissionService.java`](file:////home/eonx/Projects/SHINPO/backend/src/main/java/com/shinpo/service/MissionService.java)

**Dependencies Injected**:
- `missionRepository`: `MissionRepository`
- `goalRepository`: `GoalRepository`

**Public Methods**:
- `public List<MissionResponse> getMissionsForUser(Long userId)`
- `public MissionResponse getMission(Long id, Long userId)`
- `public MissionResponse createMission(Long userId, CreateMissionRequest request)`
- `public MissionResponse updateMission(Long id, Long userId, UpdateMissionRequest request)`
- `public void deleteMission(Long id, Long userId)`

---

### `ProgressService.java`
- **Package**: `com.shinpo.service`
- **File**: [`backend/src/main/java/com/shinpo/service/ProgressService.java`](file:////home/eonx/Projects/SHINPO/backend/src/main/java/com/shinpo/service/ProgressService.java)

**Dependencies Injected**:
- `progressEventRepository`: `ProgressEventRepository`

**Public Methods**:
- `public ProgressResponse getUserProgress(Long userId)`

---

### `SentinelEnforcementService.java`
- **Package**: `com.shinpo.service`
- **File**: [`backend/src/main/java/com/shinpo/service/SentinelEnforcementService.java`](file:////home/eonx/Projects/SHINPO/backend/src/main/java/com/shinpo/service/SentinelEnforcementService.java)

**Dependencies Injected**:
- `focusSessionRepository`: `FocusSessionRepository`
- `quarantineRepository`: `SentinelQuarantineRepository`
- `policyRuleRepository`: `SentinelPolicyRuleRepository`
- `tamperEventRepository`: `SentinelTamperEventRepository`
- `userRepository`: `UserRepository`
- `passwordEncoder`: `PasswordEncoder`
- `auditTransactionTemplate`: `TransactionTemplate`
- `webSocketEventService`: `WebSocketEventService`

**Public Methods**:
- `public String getEnforcementMode(Long userId)`
- `public void setEnforcementMode(Long userId, String mode)`
- `public SentinelStatusResponse getSentinelStatus(Long userId)`
- `public SentinelSweepResponse triggerSweep(Long userId)`
- `public void periodicSentinelDaemon()`
- `public List<SentinelQuarantineItem> getQuarantinesForSession(Long userId, Long sessionId)`
- `public long getInterceptionsCountForSession(Long userId, Long sessionId)`
- `public PolicyRuleResponse addPolicyRule(Long userId, AddPolicyRuleRequest request)`
- `public void deletePolicyRule(Long userId, Long ruleId)`
- `public List<PolicyRuleResponse> listPolicyRules(Long userId)`
- `public EmergencyOverrideResponse emergencyOverride(Long userId, EmergencyOverrideRequest request)`
- `public List<SentinelTamperEventItem> listTamperEvents(Long userId)`
- `public List<SentinelTamperEventItem> listTamperEvents(Long userId, Long sessionId)`
- `public SentinelQuarantineItem recordExternalQuarantine(Long userId, RecordQuarantineRequest request)`
- `public BatchQuarantineResponse recordBatchQuarantines(Long userId, BatchQuarantineRequest request)`
- `public SentinelDaemonSyncResponse getDaemonSyncState(Long userId)`

---

### `TaskManagerService.java`
- **Package**: `com.shinpo.service`
- **File**: [`backend/src/main/java/com/shinpo/service/TaskManagerService.java`](file:////home/eonx/Projects/SHINPO/backend/src/main/java/com/shinpo/service/TaskManagerService.java)

**Dependencies Injected**:
- None

**Public Methods**:
- `public DeviceSystemInfo getSystemInfo()`
- `public List<ProcessInfo> getProcesses(String search, String policyFilter)`
- `public ProcessControlResult terminateProcess(Long pid, boolean force)`

---

### `UserExecutionProfileService.java`
- **Package**: `com.shinpo.service`
- **File**: [`backend/src/main/java/com/shinpo/service/UserExecutionProfileService.java`](file:////home/eonx/Projects/SHINPO/backend/src/main/java/com/shinpo/service/UserExecutionProfileService.java)

**Dependencies Injected**:
- `focusSessionRepository`: `FocusSessionRepository`
- `missionRepository`: `MissionRepository`

**Public Methods**:
- `public UserExecutionProfileDto getUserExecutionProfile(Long userId)`
- `public Map<String, Object> getUserExecutionProfileMap(Long userId)`

---

### `UserService.java`
- **Package**: `com.shinpo.service`
- **File**: [`backend/src/main/java/com/shinpo/service/UserService.java`](file:////home/eonx/Projects/SHINPO/backend/src/main/java/com/shinpo/service/UserService.java)

**Dependencies Injected**:
- `userRepository`: `UserRepository`
- `passwordEncoder`: `PasswordEncoder`

**Public Methods**:
- `public UserResponse createUser(CreateUserRequest request)`

---

### `WebSocketEventService.java`
- **Package**: `com.shinpo.service`
- **File**: [`backend/src/main/java/com/shinpo/service/WebSocketEventService.java`](file:////home/eonx/Projects/SHINPO/backend/src/main/java/com/shinpo/service/WebSocketEventService.java)

**Dependencies Injected**:
- `messagingTemplate`: `SimpMessagingTemplate`

**Public Methods**:
- `public void broadcastQuarantine(Long userId, SentinelQuarantineRecord record)`
- `public void broadcastQuarantines(Long userId, List<SentinelQuarantineRecord> records)`
- `public void broadcastSentinelStatus(Long userId, String mode, boolean isLocked, int blockedCount, int allowedCount)`
- `public void broadcastFocusSession(Long userId, FocusSession session)`

---

