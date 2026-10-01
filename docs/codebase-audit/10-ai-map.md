# 10 — AI / EONPAI Complete Map

EONPAI is SHINPO's autonomous executive guide and personal performance intelligence system.

## 1. Package Structure (`backend/src/main/java/com/shinpo/ai/`)
- `context/ContextEngine.java`: Assembles comprehensive prompt context (Goals, Missions, Recent Focus Sessions, Quarantined Distractions, Execution Profile).
- `provider/AiProvider.java`: Interface with `chat()`, `health()`, `isAvailable()`.
- `provider/OllamaAiProvider.java`: Local Ollama inference client (`qwen3:4b` default on port 11434).
- `provider/AiProviderRegistry.java`: Routes requests to active provider with graceful fallback to heuristic rules.
- `tool/AiTool.java`: Interface defining tool contracts (`getName()`, `execute()`, `getDefinition()`).
- `tool/AiToolRegistry.java`: Dispatches LLM tool execution to backend services.

## 2. Implemented AI Tools
| Tool Name | Purpose | Target Service / Action |
| :--- | :--- | :--- |
| `decompose_goal` | Breaks complex goal into tactical missions | `GoalService` + AI heuristic breakdown |
| `create_mission` | Schedules actionable tactical mission | `MissionService.createMission()` |
| `start_focus_session` | Initiates deep work sprint | `FocusSessionService.startSession()` |
| `trigger_sentinel_sweep` | Scans OS for active distraction apps | `SentinelEnforcementService.triggerSweep()` |
| `set_enforcement_mode` | Switches policy enforcement mode | `SentinelEnforcementService.setEnforcementMode()` |
| `get_executive_briefing`| Synthesizes daily velocity & action plan | `UserExecutionProfileService` + context |
