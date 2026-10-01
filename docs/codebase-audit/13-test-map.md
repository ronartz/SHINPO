# 13 — Test Complete Map

Automated test coverage across Backend (Spring Boot) and Native Rust Shield.

## 1. Backend Automated Tests (116 Tests / 100% Pass)
| Test Class | Tests Run | Focus Area | Mocked Components |
| :--- | :--- | :--- | :--- |
| `ShinpoApplicationTests` | 33 | Context loads, Flyway migration sanity, End-to-end user journeys | None (H2 in-memory DB) |
| `GoalAndMissionLifecycleTests` | 12 | Goal & Mission creation, completion XP awards, ownership security | None |
| `Phase1SecurityHardeningTests` | 16 | Password hashing, JWT creation/refresh/rotation, token tampering | None |
| `SentinelEnforcementTests` | 15 | Policy locking, sweep logic, distraction interception, emergency override | None |
| `AdaptivePlanningTests` | 8 | AI adaptive daily plan generation, commitment to tactical missions | RestTemplate (Ollama) |
| `AIProviderPipelineTests` | 6 | Multi-tier provider fallback (Ollama -> Heuristics) | RestTemplate |
| `AiArchitectureTests` | 4 | Architectural component binding and interface contracts | None |
| `ContextEngineTests` | 5 | Dynamic prompt context assembly from user goals & metrics | None |
| `ControlledToolLayerTests` | 4 | Security and validation boundaries around AI tool execution | None |
| `ExecutiveBriefingTests` | 3 | Daily executive status synthesis and recommendations | RestTemplate |
| `SessionDebriefAndRecoveryTests` | 4 | Post-session cognitive debrief and momentum recovery analysis | RestTemplate |
| `SilenceEngineTests` | 3 | Contextual AI silence when user is in deep uninterrupted flow | None |
| `StructuredSuggestionApprovalTests`| 2 | Approval workflow for AI-proposed tactical adjustments | None |
| `UserExecutionProfileTests` | 2 | Behavioral execution profiling and metrics tracking | None |
| `WebSocketBroadcastingTests` | 4 | Real-time STOMP event dispatch on quarantine & sprint lockdown | SimpMessagingTemplate |

## 2. Rust Shield Automated Tests (8 Tests / 100% Pass)
- `test_platform_interceptor_instantiation`: Verifies OS platform interceptor binds correctly.
- `test_spooler_lifecycle`: Verifies append, peek, and batch flush of offline JSONL buffer.
- `test_protected_process_immunity`: Ensures system processes cannot be terminated.
- `test_short_pattern_false_positive_immunity`: Prevents short string false positives.
- `test_jvm_internal_threads_ignored`: Confirms Java/JVM processes are safely ignored.
- `test_enforcer_interceptor_binding`: Checks interceptor hook invocation.
- `test_distraction_detection_positive`: Confirms blacklisted apps (e.g. Discord, Steam) are caught.
- `test_user_whitelist_overrides_blacklist`: Proves whitelist precedence over blacklist.
