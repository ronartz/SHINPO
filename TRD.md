# SHINPO — Technical Requirements Document (TRD)

**Document Version:** 1.0.0-PROD  
**Status:** Approved & Living Document  
**Architecture Baseline:** Java 25, Spring Boot 4.1.1, PostgreSQL 17 (Flyway V1–V10), React 19.2.8, Vite 8.3.0

---

## 1. System Overview & Vision

SHINPO is a **Personal Execution Operating System** engineered to bridge the critical gap between high-level ambition and ground-level execution. It does not treat productivity as a passive task list or motivational chatbot. Instead, it enforces a closed-loop execution lifecycle:

$$\text{INTENTION} \longrightarrow \text{GOAL} \longrightarrow \text{MISSION} \longrightarrow \text{PLAN} \longrightarrow \text{SCHEDULE} \longrightarrow \text{FOCUS} \longrightarrow \text{EXECUTION} \longrightarrow \text{RESULT} \longrightarrow \text{ANALYSIS} \longrightarrow \text{ADAPTATION} \longrightarrow \text{NEXT ACTION}$$

### Core Differentiator
SHINPO tightly couples goal/mission planning with **OS-level focus enforcement (Sentinel)** and an **Execution Intelligence Layer (EONPAI)** that operates strictly above authoritative application services.

---

## 2. Technical Stack & Runtime Environment

| Layer | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Runtime Language** | Java (OpenJDK) | 25 | Backend runtime environment |
| **Backend Framework** | Spring Boot | 4.1.1 | REST API, security, transactions, dependency injection |
| **Data Access** | Spring Data JPA / Hibernate | 6.x / 7.x | Relational object-relational mapping (ORM) |
| **Database Migrations**| Flyway | 10.x | Version-controlled, deterministic database schema evolution |
| **Primary Database** | PostgreSQL | 17 | ACID relational data persistence via Docker Compose |
| **Security & Auth** | Spring Security + Java-JWT | 4.4.0 | Stateless JWT access tokens (HMAC-256) + Refresh tokens (SHA-256) |
| **Local AI Engine** | Ollama / Local Models | qwen3:4b | On-device, privacy-preserving execution intelligence |
| **Frontend Framework**| React | 19.2.8 | User interface components and reactive rendering |
| **Language (Web)** | TypeScript | 6.0.2 | End-to-end typed frontend application shell |
| **Build Tooling** | Vite | 8.3.0 | Ultra-fast HMR and optimized production bundling |
| **Testing** | JUnit 5, Mockito, Spring Test| 5.x | Automated unit, mock, and slice testing |

---

## 3. System Architecture & Component Model

SHINPO enforces a strict unidirectional layer hierarchy. The intelligence layer (EONPAI) sits **above** the authoritative business services:

```
                     ┌──────────────────────────┐
                     │    React 19 Frontend     │
                     │  (7 Feature Tabs + AI)   │
                     └─────────────┬────────────┘
                                   │ HTTP / JSON (Bearer JWT)
                                   ▼
                     ┌──────────────────────────┐
                     │  Spring Security Filter  │
                     │  (Stateless Token Auth)  │
                     └─────────────┬────────────┘
                                   │
         ┌─────────────────────────┴─────────────────────────┐
         │                                                   │
         ▼                                                   ▼
┌──────────────────────────┐                       ┌──────────────────────────┐
│   EONPAI Intelligence    │                       │  Authoritative Services  │
│ ┌──────────────────────┐ │                       │ ┌──────────────────────┐ │
│ │  AiGateway / Router  │ │                       │ │  GoalService         │ │
│ ├──────────────────────┤ │   Proposes Actions    │ ├──────────────────────┤ │
│ │  AiToolRegistry      ├─┼──────────────────────►│ │  MissionService      │ │
│ ├──────────────────────┤ │   (User Approval Req) │ ├──────────────────────┤ │
│ │  AIProvider (Ollama) │ │                       │ │  FocusSessionService │ │
│ └──────────────────────┘ │                       │ ├──────────────────────┤ │
│                          │                       │ │  TaskManagerService  │ │
│                          │                       │ ├──────────────────────┤ │
│                          │                       │ │  AnalyticsService    │ │
│                          │                       │ └──────────────────────┘ │
└──────────────────────────┘                       └─────────────┬────────────┘
                                                                 │
                                                                 ▼
                                                   ┌──────────────────────────┐
                                                   │    PostgreSQL 17 DB      │
                                                   │   (12 Core Entities)     │
                                                   └──────────────────────────┘
```

### Architectural Principles:
1. **AI Proposes; Product Services Decide**: The AI layer never directly executes mutations against the database or host operating system. It emits structured suggestions (`AiSuggestion`). The user approves them; authoritative services validate and persist them.
2. **Identity Derives Exclusively from Authentication**: Client request bodies cannot dictate user identity. The verified `UserPrincipal` injected by Spring Security is the sole source of truth for resource ownership.
3. **Fail-Soft AI Resiliency**: An offline, slow, or errored AI provider must never break core execution functions (goals, missions, focus timers, scheduling).
4. **Zero Untrusted Host Execution**: Process management must never permit arbitrary process termination or command execution from unauthorized or unauthenticated contexts.

---

## 4. Data Architecture & Relational Schema

Database schema is managed deterministically via Flyway migrations (`V1` through `V10`):

```
+-------------------------------------------------------------------------------------------------+
|                                    RELATIONAL SCHEMA MAP                                        |
+-------------------------------------------------------------------------------------------------+
| users (V1)                                                                                      |
|   id: BIGINT PK, username: VARCHAR(50) UNIQUE, email: VARCHAR(255) UNIQUE,                      |
|   password_hash: VARCHAR(255), created_at: TIMESTAMPTZ                                           |
|   └── refresh_tokens (V8): token_hash: VARCHAR(64) UNIQUE, expires_at, revoked_at               |
|   └── goals (V1): title: VARCHAR(150), start_date, target_date, status: VARCHAR(20)             |
|       └── missions (V1): goal_id FK, title, scheduled_date, estimated_minutes, status           |
|           └── mission_completions (V1): started_at, completed_at                                |
|   └── focus_sessions (V2-V6): name, intention, status, duration_minutes, target_minutes,         |
|                               scheduled_at, started_at, ended_at, result_status, debrief_notes  |
|       └── session_intervals (V2, V3): started_at, ended_at, interval_type                       |
|       └── session_plans (V4, V5): planned_action, estimated_minutes, completed                  |
|   └── ai_suggestions (V7, V8): suggestion_type, input_context, output_payload, accepted,        |
|                                provider, model_used, prompt_tokens, latency_ms                 |
|   └── bug_reports (V9): bug_id VARCHAR(50) UNIQUE, summary, feature, severity, status          |
|   └── conversations (V10): conversation_uuid VARCHAR(64) UNIQUE, title, status                  |
|       └── conversation_messages (V10): role, content, suggestion_type, metadata_json            |
+-------------------------------------------------------------------------------------------------+
```

---

## 5. Subsystem Specifications

### 5.1 Identity & Authentication Subsystem
- **Access Tokens**: Short-lived (60 min) HMAC-256 JWTs signed with `shinpo.jwt.secret`.
- **Refresh Tokens**: Long-lived (30 day) cryptographically secure 32-byte tokens stored in database exclusively as SHA-256 hashes (`token_hash`). Rotated on every use; reuse triggers immediate revocation.
- **Password Hashing**: BCrypt (`BCryptPasswordEncoder`) with work factor 10.
- **Identity Injection**: `@AuthenticationPrincipal UserPrincipal principal` across all authenticated controllers.

### 5.2 Execution Engine (Focus Sessions)
- **Session Lifecycle**: `SCHEDULED` $\rightarrow$ `ACTIVE` $\rightarrow$ `PAUSED` $\rightarrow$ `COMPLETED` / `ABORTED`.
- **Accurate Time Accounting**: Active duration is computed strictly via monotonic interval timestamps (`session_intervals`), guaranteeing accurate tracking across system sleep, pauses, or tab backgrounding.
- **Session Debriefs**: Post-session capture of `resultStatus` (`SUCCESS`, `PARTIAL`, `FAILED`), `completionQuality` (1–5 scale), and structured `debriefNotes`.

### 5.3 Sentinel & Host Process Management
- **Process Classification**:
  - `PROTECTED`: Kernel, systemd, display server, SSH, and SHINPO itself. Never terminated.
  - `BLOCKED`: Known distractions (Discord, Steam, games). Auto-quarantined during focus sprints.
  - `ALLOWED`: Standard development and work tooling.
- **Safety Boundary**: Native process inspection via `ProcessHandle`. Direct process termination must require explicit user intent and administrative privilege.

### 5.4 EONPAI Execution Intelligence Layer
- **Provider SPI (`AIProvider`)**:
  - Pluggable interface (`generate`, `isAvailable`, `getProviderName`, `getModelName`).
  - Active provider: `OllamaProvider` connecting to local Ollama on port 11434 (`qwen3:4b`).
  - Hermetic fallback: When Ollama is offline or uninstalled, `AiGateway` falls back to deterministic rule engines without raising runtime exceptions.
- **Read-Only Tool Registry (`AiToolRegistry`)**:
  - Supplies context to prompts without exposing credentials, password hashes, or raw entity tables.
  - Tools include: `getCurrentUser`, `getCurrentGoal`, `getTodaysSchedule`, `getActiveFocusSession`, `getNextMission`, `getProgressSummary`, `getDeviceStatus`, `getEnforcementState`.
- **Conversation Continuity**:
  - Backed by tables `conversations` and `conversation_messages` (`V10`). Bounded to the top 20 messages per session to prevent context window bloat.
  - Supports structured cards, tutorial payloads, and sanitized bug reports in message metadata.

---

## 6. Security, Privacy & Non-Functional Requirements

1. **User Data Isolation (IDOR/BOLA Prevention)**:
   - All entity lookups must be scoped by authenticated `userId` (e.g. `findByIdAndUser_Id`).
   - Requests attempting to read or mutate another user's goals, missions, or sessions must return HTTP 404 (non-enumerating) or HTTP 403.
2. **Prompt Injection Defense**:
   - System prompts, user input, and tool outputs must be separated by strict delimiters (`<system>`, `<context>`, `<user_input>`).
   - User-provided text (goal titles, mission descriptions) must never be trusted as instructions.
3. **Data Minimization & Privacy**:
   - AI prompts must never include passwords, hashes, JWTs, device keys, or personal documents.
   - Host process enumeration must be sanitized to exclude process parameters containing sensitive CLI flags.
4. **Cost & Rate Control**:
   - Authentication and AI endpoints must be protected against brute-force and prompt denial-of-service.

---

## 7. Definition of Done (DoD)

A requirement or chunk is considered complete only when:
- [x] Architecture aligns with TRD.md and introduces zero duplicate subsystems.
- [x] Database changes are committed as forward-only Flyway migrations.
- [x] Security controls enforce authentication, authorization, and tenant isolation.
- [x] Automated unit and integration tests pass cleanly via `./mvnw test`.
- [x] Frontend builds cleanly with zero TypeScript errors via `npm run build`.
- [x] Living documentation (`TRD.md`, `APP_FLOW.md`, `IMPLEMENTATION_PLAN.md`, `TESTING.md`) is updated to reflect reality.
