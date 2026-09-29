# SHINPO (進歩) — System Architecture Documentation

This directory contains the authoritative, source-backed architecture and security documentation for **SHINPO** (Personal Strategic Execution Operating System). All architectural representations, component boundaries, data flows, and security profiles are derived directly from the code, dependencies, database migrations, and runtime configurations in this repository.

---

## Interactive Architecture Visualizations (Archify)

The following interactive visualizations have been compiled and validated using the Archify engine (`v3.0.1`). Each diagram includes interactive node inspection, real-browser tested geometry, dark/light theme support, and inline repository source evidence:

1. **[System Architecture Overview](file:///home/eonx/Projects/SHINPO/docs/architecture/system-architecture.html)** (`system-architecture.html`)
   - Primary end-to-end component topology: Browser SPA, Security Gateway, Spring Boot API, PostgreSQL 17, EONPAI AI Gateway, Ollama LLM, Native OS Shield Daemon, and Linux Process Management.
2. **[Authentication & Security Lifecycle Flow](file:///home/eonx/Projects/SHINPO/docs/architecture/auth-security-flow.html)** (`auth-security-flow.html`)
   - Sequence diagram illustrating credential submission, BCrypt validation, HMAC-256 JWT generation, single-use refresh token rotation, request interception via `JwtAuthenticationFilter`, and session revocation.
3. **[Core Execution & Progress Data Flow](file:///home/eonx/Projects/SHINPO/docs/architecture/execution-data-flow.html)** (`execution-data-flow.html`)
   - Pipeline showing the lifecycle from Strategic Intake (`goals`) &rarr; Decomposition (`missions`) &rarr; Execution & Shield (`focus_sessions`) &rarr; Debrief & Progress (`mission_completions`, `progress_events`) &rarr; Tactical Analytics (`/api/analytics`).
4. **[AI (EONPAI) Orchestration & Reasoning Flow](file:///home/eonx/Projects/SHINPO/docs/architecture/ai-orchestration-workflow.html)** (`ai-orchestration-workflow.html`)
   - Workflow diagram modeling user intent, read-only state assembly via `AiToolRegistry`, provider availability probing, local Ollama inference, Jackson schema validation, and deterministic rule-based fallback with audit logging.
5. **[Deployment & Infrastructure Topology](file:///home/eonx/Projects/SHINPO/docs/architecture/infrastructure-deployment.html)** (`infrastructure-deployment.html`)
   - Host workstation deployment layout, Linux process models, Docker bridge network, container services (`shinpo-postgres`, `shinpo-ollama`), persistent volumes, and desktop notifications.

---

## 1. Technologies Discovered

| Tier | Technology | Version | Location / Evidence |
|---|---|---|---|
| **Runtime Language** | Java | 25 | `backend/pom.xml:23` (`<java.version>25</java.version>`) |
| **Backend Framework** | Spring Boot | 4.1.1 (Snapshot/Milestone) | `backend/pom.xml:11` (`spring-boot-starter-parent`) |
| **Security Framework** | Spring Security | 6.x / 7.x compatible | `backend/src/main/java/com/shinpo/config/SecurityConfig.java` |
| **JWT Library** | Auth0 `java-jwt` | 4.4.0 | `backend/pom.xml:52` |
| **Database** | PostgreSQL | 17 | `compose.yaml:3` (`postgres:17`), `application.properties:3` |
| **Migration Tool** | Flyway | 10.x | `backend/pom.xml:42`, `backend/src/main/resources/db/migration/` |
| **ORM / Data Access** | Hibernate / Spring Data JPA | 6.x / 7.x | `backend/pom.xml:37`, `application.properties:7` |
| **JSON Serialization** | Jackson 3 (`tools.jackson`) | 3.x | `backend/src/main/java/com/shinpo/ai/orchestrator/AiGateway.java:3` |
| **AI / LLM Integration** | Ollama REST Client | Local daemon | `backend/src/main/java/com/shinpo/ai/provider/OllamaProvider.java:40` |
| **Frontend Framework** | React | 19.2.8 | `frontend/package.json:13` |
| **Frontend Language** | TypeScript | 6.0.2 | `frontend/package.json:26` |
| **Build & Dev Tool** | Vite | 8.3.0 | `frontend/package.json:28`, `frontend/vite.config.ts` |
| **Desktop Enforcer (Rust)** | Rust (`sysinfo`, `serde`) | 1.80+ / 2021 edition | `crates/shinpo-shield/Cargo.toml`, `src/main.rs` |
| **Desktop Enforcer (Py)** | Python | 3.10+ | `daemon/shinpo_shield.py` |
| **Containerization** | Docker Compose | Compose v2 | `compose.yaml` |

---

## 2. Major Components & Subsystems

```
                                  +-----------------------------------------------+
                                  |            CLIENT / WORKSTATION               |
                                  |  React 19 SPA (Vite :5173) / Desktop Browser  |
                                  +-----------------------+-----------------------+
                                                          | HTTP REST (Bearer JWT)
                                                          v
                                  +-----------------------------------------------+
                                  |           SECURITY PERIMETER (Spring)         |
                                  |  SecurityConfig + JwtAuthenticationFilter      |
                                  +-----------------------+-----------------------+
                                                          | Authenticated UserPrincipal
                                                          v
                                  +-----------------------------------------------+
                                  |           SPRING BOOT CORE API (:8080)        |
                                  |  - AuthController       - FocusSessionCtrl    |
                                  |  - GoalController       - MissionController   |
                                  |  - AnalyticsController  - TaskManagerCtrl     |
                                  |  - ProgressController   - AiController        |
                                  +--------+----------------+--------------+------+
                                           |                |              |
                      JPA / SQL Statements |                | Read Context | Polled by
                                           v                v              | daemon
+------------------------------------+ +-------+       +----+----+     +---+---+
|       PERSISTENCE LAYER            | | DB    |       | AI GATEWAY|   | SHIELD|
| PostgreSQL 17 (:5432)              | | JPA   |       | EONPAI  |     | DAEMON|
| - users            - goals         | +-------+       +----+----+     +---+---+
| - missions         - focus_sessions|                      |              |
| - mission_compl.   - session_plans |                      | POST /gen    | SIGKILL
| - progress_events  - refresh_tokens|                      v              v
| - ai_suggestions                   |                 +----+----+     +---+---+
+------------------------------------+                 | OLLAMA  |     | OS    |
                                                       | :11434  |     | PROCS |
                                                       +---------+     +-------+
```

### Component Inventory

1. **Frontend Client (`frontend/src/`)**:
   - Single Page Application built on React 19 and TypeScript.
   - Modular API clients located in `src/api/`: `auth.ts`, `focusSessions.ts`, `goalsAndMissions.ts`, `ai.ts`, `device.ts`, `analytics.ts`.
   - Task Master 2x2 Bento Dashboard matching interactive specifications (Today tasks, Inset Calendar, Velocity pillars, Glowing needle Timeline, and EONPAI companion).

2. **Security Gateway (`com.shinpo.security`, `com.shinpo.config`)**:
   - `SecurityFilterChain` configuring stateless session creation, CORS handling, and public/private endpoint filters.
   - `JwtAuthenticationFilter` intercepting every request, resolving the `Authorization: Bearer <token>` header, verifying HMAC-256 signatures, and hydrating `UserPrincipal` into Spring's `SecurityContextHolder`.

3. **Core Execution & Focus Engine (`com.shinpo.service.FocusSessionService`)**:
   - Coordinates the lifecycle of Focus Sessions (`SCHEDULED` &rarr; `ACTIVE` &rarr; `PAUSED` &rarr; `COMPLETED` / `CANCELLED` / `EXPIRED`).
   - Automatically handles interval tracking (`accumulated_paused_seconds`) and scheduled automated sweeps (`sweepExpiredSessions`) using Spring's `@Scheduled` mechanism.

4. **Strategic Planning & Progress Subsystem (`GoalService`, `MissionService`, `ProgressService`)**:
   - Models the hierarchy: `Goal` &rarr; `Mission` &rarr; `FocusSession` &rarr; `MissionCompletion` &rarr; `ProgressEvent`.
   - Enforces relational scoping and foreign-key isolation so users only read and mutate their own objectives.

5. **AI Orchestrator (EONPAI) (`com.shinpo.ai`)**:
   - `AiGateway`: Central coordinator handling Goal Decomposition, Daily Planning, Next Action routing, and Session Recovery.
   - `AiToolRegistry`: Provides controlled, read-only system state to the AI (active goals, next mission, today's schedule, system metrics).
   - `OllamaProvider`: Pluggable implementation of `AIProvider` SPI communicating over HTTP with local Ollama daemon (`http://localhost:11434`).
   - `Deterministic Fallback Engine`: Hardened fallback routines executing when Ollama is unavailable, ensuring zero downtime and zero hallucinated responses.
   - `AiSuggestionRepository`: Audits every generated suggestion, token usage, latency, and tool call into the `ai_suggestions` table.

6. **Native OS Focus Shield & Task Manager (`crates/shinpo-shield`, `TaskManagerService`)**:
   - `crates/shinpo-shield`: Native Rust daemon using `sysinfo` to monitor running processes, poll the Spring Boot API for active focus sessions, and terminate distraction processes (`discord`, `steam`, `spotify`, etc.) with desktop notifications.
   - `daemon/shinpo_shield.py`: Companion Python enforcement script providing identical polling and termination logic.
   - `TaskManagerService`: Java 9+ `ProcessHandle` and `OperatingSystemMXBean` wrapper exposing CPU load, memory utilization, running process snapshots, and process termination with protection for critical system processes.

---

## 3. Data & Request Flows

### 3.1 Authentication Flow
1. **Intake**: Client submits `POST /api/auth/login` with username/email and plaintext password.
2. **Verification**: `AuthController` loads user via `CustomUserDetailsService` and validates password against BCrypt hash.
3. **Issuance**:
   - `JwtTokenService` generates HMAC-256 JWT access token (1-hour expiration).
   - A cryptographically random 64-character token is generated, hashed with SHA-256, and stored in `refresh_tokens` table.
4. **Interception**: Client attaches `Authorization: Bearer <accessToken>` to subsequent requests. `JwtAuthenticationFilter` validates token claims and populates `SecurityContext`.
5. **Rotation**: Client submits `POST /api/auth/refresh`. Server verifies hash against database, marks old token revoked (`revoked_at`), and issues a new pair.

### 3.2 Focus Execution Flow
1. **Creation**: User schedules a session via `POST /api/focus-sessions` linked to a `goalId` and `missionId`.
2. **Activation**: User initiates sprint (`POST /api/focus-sessions/{id}/start`). State transitions to `ACTIVE`, recording `startedAt`.
3. **Enforcement**: Background Shield daemon (`shinpo-shield` or `shinpo_shield.py`) polls `GET /api/focus-sessions`. Detecting an `ACTIVE` session, it scans OS processes and issues `SIGKILL` to blacklisted binaries, dispatching a native notification via `notify-send`.
4. **Completion**: User concludes sprint (`POST /api/focus-sessions/{id}/complete`). Session transitions to `COMPLETED`, recording `completionQuality` and `reflectionNote`.
5. **Progress**: System creates a `mission_completions` record and appends earned points to `progress_events`.

### 3.3 AI / EONPAI Flow
1. **Intake**: User requests tactical advice or goal decomposition (`POST /api/ai/chat`, `/api/ai/decompose-goal/{id}`).
2. **Context Gathering**: `AiGateway` invokes `AiToolRegistry` to fetch unmasked, non-sensitive context (current user, goal status, backlog missions).
3. **Provider Health Check**: `AiGateway` checks `ollamaProvider.isAvailable()`.
4. **Execution**:
   - *Online*: Dispatches system prompt demanding strict JSON schema to Ollama. Responses are parsed via Jackson `ObjectMapper`.
   - *Offline*: Invokes deterministic rule-based generator (`deterministicChatFallback`).
5. **Audit**: Saves the recommendation, model, latency, and context into `ai_suggestions`.

---

## 4. Security Architecture & Audit Findings

### 4.1 Implemented Security Controls

- **Password Hashing**: Strong one-way hashing implemented via Spring Security's `BCryptPasswordEncoder`.
- **Stateless Session Management**: `SessionCreationPolicy.STATELESS` configured; backend does not store HTTP session state in memory.
- **Refresh Token Rotation**: Refresh tokens are stored in PostgreSQL using SHA-256 hashes (`token_hash`) rather than plaintext. Tokens are strictly single-use and revoked on rotation.
- **SQL Injection Prevention**: Spring Data JPA and Hibernate use parameterized JDBC queries throughout all repositories.
- **User Resource Isolation**: Services verify ownership explicitly (e.g., `goal.getUser().getId().equals(user.getId())` and `sessionPlanRepository.findByIdAndUser_Id(...)`), preventing IDOR (Insecure Direct Object Reference) attacks.
- **AI Tool Boundaries**: `AiToolRegistry` only exposes read-only methods. The AI companion cannot write to the database or trigger destructive OS process kills.
- **Protected Process Whitelist**: `TaskManagerService` maintains a protected set of critical system processes (`systemd`, `init`, `dbus`, `sshd`, `shinpo`, `kernel`, `wayland`) that cannot be terminated via API calls.

### 4.2 Security Gaps & Identified Risks

The following items are **not currently implemented** and represent recommended architectural hardening:

1. **Permissive CORS Policy (`SecurityConfig.java:53-56`)**:
   - *Current implementation*: `setAllowedOriginPatterns(List.of("*"))` combined with `setAllowCredentials(true)`.
   - *Risk*: Allows arbitrary origins to make credentialed cross-origin requests.
   - *Recommendation*: Restrict allowed origins to specific trusted domains (e.g., `http://localhost:5173` or production domain).
2. **Unauthenticated Actuator Endpoints (`SecurityConfig.java:74`)**:
   - *Current implementation*: `.requestMatchers("/actuator/**").permitAll()`.
   - *Risk*: Exposes internal operational metrics, environment metadata, and heap/thread health to unauthorized callers.
   - *Recommendation*: Secure `/actuator/**` behind administrative credentials or restrict to localhost.
3. **Token Storage in Browser LocalStorage (`frontend/src/api/auth.ts:24,57`)**:
   - *Current implementation*: Access and refresh tokens are persisted in browser `localStorage`.
   - *Risk*: Susceptible to extraction via Cross-Site Scripting (XSS).
   - *Recommendation*: Store refresh tokens in `httpOnly`, `Secure`, `SameSite=Strict` cookies.
4. **Token Exposure via URL Query Parameter (`frontend/src/api/auth.ts:22`)**:
   - *Current implementation*: `params.get('token')` reads tokens from URL query strings.
   - *Risk*: Tokens in URLs leak through browser history, proxy logs, and `Referer` headers.
   - *Recommendation*: Remove URL query token ingestion; use standard POST body or authorization headers.
5. **No Rate Limiting on Authentication Endpoints**:
   - *Current implementation*: `/api/auth/login` and `/api/auth/register` have no rate limiting.
   - *Risk*: Vulnerable to credential stuffing and brute-force attacks.
   - *Recommendation*: Implement Spring Boot bucket4j or Redis-backed rate limiting on auth endpoints.
6. **Hardcoded Configuration Defaults (`application.properties:5`)**:
   - *Current implementation*: Database password defaults to `shinpo_dev`.
   - *Recommendation*: Require explicit environment variables in production and fail fast if missing.

---

## 5. Architectural Component Status Matrix

To maintain strict documentation integrity, all features, subsystems, and integrations are categorized by their factual state in the codebase:

| Component / Subsystem | Status | Evidence / Notes |
|---|---|---|
| **Spring Boot Core REST API** | **IMPLEMENTED** | 12 REST controllers in `com.shinpo.controller` |
| **JWT Stateless Authentication** | **IMPLEMENTED** | `JwtAuthenticationFilter`, `JwtTokenService`, `AuthController` |
| **Refresh Token Rotation (DB Hashed)** | **IMPLEMENTED** | `V8__create_auth_tables.sql`, `RefreshToken.java`, `AuthService.java` |
| **PostgreSQL 17 + Flyway Migrations** | **IMPLEMENTED** | Migrations V1 through V8 in `src/main/resources/db/migration/` |
| **Focus Session Engine & Timers** | **IMPLEMENTED** | `FocusSessionService.java` with active interval calculation |
| **Automated Session Expiration Sweep** | **IMPLEMENTED** | `@Scheduled sweepExpiredSessions()` in `FocusSessionService.java` |
| **EONPAI AI Gateway & Provider SPI** | **IMPLEMENTED** | `AiGateway.java`, `AIProvider.java`, `OllamaProvider.java` |
| **Deterministic AI Fallback Engine** | **IMPLEMENTED** | `deterministicChatFallback` in `AiGateway.java:277` |
| **Read-Only AI System Tools** | **IMPLEMENTED** | `AiToolRegistry.java` (context assembly for goals, missions, schedule) |
| **AI Suggestions Audit Log** | **IMPLEMENTED** | `ai_suggestions` table (`V7`, `V8`), `AiSuggestionRepository.java` |
| **Task Master 2x2 Bento UI** | **IMPLEMENTED** | `frontend/src/App.tsx`, `App.css` (Today tasks, Calendar, Velocity, Timeline, EONPAI) |
| **Native Rust Shield Daemon** | **IMPLEMENTED** | `crates/shinpo-shield/src/main.rs` (sysinfo, process kill, notify-send) |
| **Python Shield Daemon** | **IMPLEMENTED** | `daemon/shinpo_shield.py`, `shield_config.json` |
| **Java OS Process Management** | **IMPLEMENTED** | `TaskManagerService.java` (`ProcessHandle.allProcesses()`, protected list) |
| **Docker Compose Services** | **IMPLEMENTED** | `compose.yaml` (PostgreSQL 17, persistent volume) |
| **Role-Based Access Control (RBAC)** | **NOT IMPLEMENTED / RECOMMENDED** | Single authority model (`ROLE_USER`); no admin roles |
| **Actuator Security Hardening** | **NOT IMPLEMENTED / RECOMMENDED** | Currently set to `permitAll()` |
| **Rate Limiting / Brute-Force Guard** | **NOT IMPLEMENTED / RECOMMENDED** | No request throttling configured on `/api/auth` |
| **Cookie-Based HTTP-Only Auth** | **NOT IMPLEMENTED / RECOMMENDED** | Tokens stored in `localStorage` |
| **Distributed / Cloud Sync Agent** | **PLANNED** | Architecture prepared for remote agent socket connection |
| **Multi-Device Session Coordination**| **PLANNED** | Multi-device locking mentioned in design guidelines |
| **Cloud LLM Providers (OpenAI/Anthropic)**| **PLANNED** | `AIProvider` interface supports additional cloud providers |

---

## 6. Verification & Artifact Validation

All architecture diagrams and summaries in this directory have been verified against the physical codebase at commit `715e47390e731b69cc7690cad96317a593d41d73`:

- **Automated Validation**: All diagrams passed Archify schema checks (`validate`), artifact generation (`deliver`), strict structural checks (`check`), and real headless browser layout checks (`browser-check`).
- **Codebase Truth**: 100% of cited components, lines, and database schemas exist in the committed repository. No fictional services, third-party clouds, or unimplemented tables were included.
