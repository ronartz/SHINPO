# SHINPO — EONPAI AI Subsystem Audit Report

**Audit Date:** October 26–27, 2026  
**Auditor Role:** Senior AI Engineer & Systems Architect  
**Scope:** EONPAI Architecture, Model Providers, Tool Execution Security, Fallback Engine, Offline Parity  

---

## 1. Executive Summary

EONPAI is SHINPO's embedded productivity intelligence agent. It is designed to assist users with goal decomposition, task prioritisation, scheduled reflection, and focus encouragement.

**Key Finding:** EONPAI currently exists as a **hybrid cloud/server feature implemented exclusively in the Spring Boot backend**. In standalone desktop mode (Tauri + SQLCipher without Spring Boot), EONPAI lacks local database schema support and attempts to hit `http://localhost:8080/api/ai/*`. When the backend is offline, the chat view degrades to a connection error unless explicitly connected to a local Ollama instance or backend service.

---

## 2. Multi-Provider Architecture & Fallbacks

EONPAI implements an adapter-based model routing architecture orchestrated by `AiGateway.java`:

```
                           ┌────────────────────────┐
                           │      AiGateway         │
                           └───────────┬────────────┘
                                       │
         ┌─────────────────────────────┼─────────────────────────────┐
         ▼                             ▼                             ▼
┌──────────────────┐          ┌──────────────────┐          ┌──────────────────┐
│  Ollama (Local)  │          │  Gemini (Cloud)  │          │  SilenceEngine   │
│  http://127...   │          │  BYOK API Key    │          │  (Offline Rules) │
└──────────────────┘          └──────────────────┘          └──────────────────┘
```

1. **Local Ollama Integration (`OllamaClient.java`):**
   - Connects to user's local instance (default `http://localhost:11434`).
   - Supports local models (e.g. `llama3.2`, `mistral`, `qwen2.5-coder`).
   - Zero telemetry, fully air-gapped data retention.
2. **Google Gemini Integration (`GeminiClient.java`):**
   - Supports user-supplied API key (BYOK) stored in encrypted preferences.
   - Leverages `gemini-1.5-flash` for high-speed low-latency intent extraction.
3. **Deterministic Fallback Engine (`SilenceEngine.java`):**
   - When no AI provider is available, or when the user is in an active focus session, the `SilenceEngine` takes over.
   - Enforces the "Silence by Default" principle: suppresses chatty banter, limits responses to short encouragement or deterministic task recommendations based on overdue status.

---

## 3. Tool Registration & Execution Safety

EONPAI can propose actions to be executed on the user's workspace via structured tool calling:

| Tool Name | Parameters | Target Subsystem | User Confirmation Required? |
| :--- | :--- | :--- | :--- |
| `create_task` | `title`, `priority`, `goalId`, `dueDate` | Task Service / Repository | **YES (Always Required)** |
| `create_goal` | `title`, `targetDate`, `category` | Goal Service / Repository | **YES (Always Required)** |
| `start_focus_session` | `durationMinutes`, `taskId` | Focus Engine | **YES (Always Required)** |
| `reschedule_task` | `taskId`, `newDueDate` | Task Service / Schedule | **YES (Always Required)** |

### Security Safeguards
- **No Unrestricted Autonomous Mutation:** Tools cannot execute silently. The backend returns an `AiActionProposal` DTO. The frontend renders an interactive confirmation card. Only an explicit user click on "Confirm" dispatches the final mutation.
- **Strict Domain Boundary:** EONPAI is structurally forbidden from accessing or altering:
  - Sentinel Shield enrollment lists or security rules.
  - User master passwords, vault keys, or recovery tokens.
  - Browser blocking exemptions.
- **Prompt Injection Defense:** System prompts strictly demarcate user input within XML tags (`<user_prompt>`) and command the LLM to ignore instructions attempting to override role boundaries.

---

## 4. The Standalone Desktop Parity Gap (CRITICAL)

In the current codebase, there is a fundamental split between web mode and desktop mode:

1. **Web Mode (PostgreSQL 16):**
   - Supported by Flyway tables: `conversations`, `ai_suggestions`, `ai_actions`.
   - Stores full chat history, context embeddings, and suggestion logs.
2. **Desktop Mode (SQLCipher SQLite):**
   - `native_vault.rs` only provisions tables for: `schema_migrations`, `users`, `goals`, `tasks`, `focus_sessions`, `focus_session_intervals`, `progress_events`.
   - **Zero tables exist for conversations or AI history.**
   - In desktop mode, frontend requests to `/api/ai/*` fail with `ECONNREFUSED` if the Spring Boot JAR is not running in the background.

---

## 5. Backend Test Suite Failures (Root Cause Analysis)

During the empirical backend test run (`./mvnw test`), 3 tests failed out of 421:
1. `AiArchitectureTests.aiGatewayFallsBackGracefullyWhenProviderFails`
2. `SilenceEngineTests.testSilenceEngineDeterministicFallbackDuringFocusSession`
3. `SilenceEngineTests.testSilenceEngineMinimalGreetingDuringFocusSession`

### Root Cause:
`AiGateway.java` and `SilenceEngine.java` were updated to replace robotic, roleplay-style strings:
- Old String: `"EONPAI Operational Directive: Execute ["`
- New String: `"Suggested next task: "`
- Old String: `"Focus sprint active. I am keeping interruptions minimal."`
- New String: `"Focus session in progress. Stay focused on your primary task."`

The test assertions in `src/test/java/...` were not updated to match the refined production copy strings. **This is a copy assertion mismatch, not a functional or runtime failure.**

---

## 6. Recommendations & Roadmap

1. **P1 — Update Copy Assertions in AI Unit Tests:** Sync `AiArchitectureTests.java` and `SilenceEngineTests.java` with current `AiGateway` copy strings.
2. **P2 — Port EONPAI Schema to SQLCipher:** Add `conversations` and `ai_suggestions` tables to `native_vault.rs` and introduce Tauri IPC commands for local Ollama invocation, enabling 100% offline standalone AI on desktop.
3. **P3 — Streaming Support:** Implement Server-Sent Events (SSE) or Tauri event streaming for token-by-token generation in chat UI.

