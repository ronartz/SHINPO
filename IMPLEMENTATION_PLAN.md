# SHINPO — Master Implementation Plan (IMPLEMENTATION_PLAN.md)

**Document Version:** 1.0.0-PROD  
**Status:** Approved & Living Document  
**Operating Principle:** Build strictly in dependency order. No fake completion. Every chunk requires verifiable tests and runtime proof before advancement.

---

## 1. Implementation Phasing & Status Overview

```
[ Phase 0: Baseline & Documentation Governance ] ──────────────► COMPLETED
                      │
                      ▼
[ Phase 1: Authentication, Identity & RBAC Hardening (P0) ] ───► NEXT
                      │
                      ▼
[ Phase 2: EONPAI Execution Intelligence Layer ]
       ├── AI.0: Architecture Audit ──────────────────────────► COMPLETED
       ├── AI.1: Provider Abstraction & Resilient Pipeline ────► READY TO BUILD
       ├── AI.2: Centralized Context Engine
       ├── AI.3: Controlled Tool Layer
       ├── AI.4: Structured Suggestions & Approval Engine
       ├── AI.5: Conversational UX & Action Cards
       ├── AI.6: Contextual Execution AI & Silence Rules
       ├── AI.7: User Execution Profile Engine
       ├── AI.8: Recovery Intelligence
       ├── AI.9: Command Center Summarization
       ├── AI.10: Safe Device & Policy Intelligence
       ├── AI.11: Deterministic Tutorial Integration
       ├── AI.12 & AI.13: Security & Privacy Hardening
       └── AI.14: Production Acceptance
                      │
                      ▼
[ Phase 3: Sentinel & Host Process Decoupling (P0) ]
                      │
                      ▼
[ Phase 4: Production Packaging & Containerization ]
```

---

## 2. Phase 0: Baseline & Documentation Governance (COMPLETED)
- **Status:** **COMPLETED**
- **Deliverables:**
  - Audited full application codebase (Spring Boot 4.1.1, Java 25, React 19.2.8, Vite, PostgreSQL 17 Flyway V1-V10).
  - Verified backend test suite passes: 33 tests, 0 failures.
  - Verified frontend builds cleanly: `tsc -b && vite build` passing with zero errors.
  - Authored the four core living documentation files: `TRD.md`, `APP_FLOW.md`, `IMPLEMENTATION_PLAN.md`, `TESTING.md`.

---

## 3. Phase 1: Authentication, Identity & RBAC Hardening (P0) (COMPLETED)
- **Goal:** Eliminate account takeover vectors, enforce database-backed RBAC, and remove development seed disclosures.
- **Preconditions:** Phase 0 complete.
- **Tasks & Deliverables:**
  1. **Chunk 1.1: Database Role Attribute Migration (COMPLETED)**:
     - Flyway migration `V11__add_user_roles.sql`: Added `role VARCHAR(20) NOT NULL DEFAULT 'ROLE_USER'` and `is_active BOOLEAN NOT NULL DEFAULT TRUE` to table `users`.
     - Updated `User.java` and `UserPrincipal.java` to dynamically map roles from database to `GrantedAuthority`, and wired `isEnabled()` to `isActive`.
     - Hardened `JwtAuthenticationFilter` and `AuthService` to reject deactivated accounts with `401 UNAUTHORIZED`.
  2. **Chunk 1.2: Production JWT Secret Gating (COMPLETED)**:
     - Removed fallback default secret string from base `application.properties`.
     - In `JwtTokenService`, startup strictly fails with `IllegalStateException` if `shinpo.jwt.secret` is blank or if the known development secret is supplied in the `prod`/`production` profile.
     - Added `application-dev.properties` for zero-friction local development while keeping production strictly gated.
  3. **Chunk 1.3: Eliminate Seed Disclosures (COMPLETED)**:
     - Removed `GET /api/users/default` endpoint from `UserController.java` and removed backdoor auto-seeding logic `getOrCreateDefaultUser()` from `UserService.java`.
     - Authenticated requests to `/api/users/default` return `404 NOT_FOUND`; unauthenticated requests return `401 UNAUTHORIZED`.
  4. **Chunk 1.4: Pessimistic Lock on Refresh Tokens (COMPLETED)**:
     - Added `@Lock(LockModeType.PESSIMISTIC_WRITE)` to `RefreshTokenRepository.findByTokenHash` preventing race conditions during concurrent token rotation.
- **Verification:**
  - Automated integration & unit test suite in `Phase1SecurityHardeningTests.java` covering all 4 chunks (5 test scenarios).
  - Full suite verified: 45 tests passing (0 failures, 0 errors). Frontend builds cleanly in 177ms (`tsc -b && vite build`).

---

## 4. Phase 2: EONPAI Execution Intelligence Layer Hardening

### AI.0 — Architecture Audit (COMPLETED)
- Audited `AiGateway`, `AiService`, `AiToolRegistry`, `AIProvider`, `OllamaProvider`, `ai_suggestions`, `conversations`, `conversation_messages`, and `bug_reports`.
- Documented reusable components, security gaps, and vertical slice sequence.

### AI.1 — Provider Abstraction & Resilient Pipeline (COMPLETED)
- **Goal:** Provide a resilient, multi-provider SPI supporting Ollama, Mock/Test Provider, and fail-soft behavior.
- **Preconditions:** AI.0 complete.
- **Tasks & Deliverables:**
  1. Implemented `AIProviderRegistry` that manages and indexes available `AIProvider` beans with case-insensitive resolution and graceful active provider fallback.
  2. Implemented `MockAIProvider` with configurable canned responses, availability toggling, and request recording for zero-latency hermetic testing.
  3. Hardened `OllamaProvider` with strict connection timeouts (3s connect timeout, 2s health check) and fail-soft error handling without throwing uncaught exceptions.
  4. Updated `AiGateway` to inject `AIProviderRegistry` with backwards-compatible overloaded constructors.
  5. Authored comprehensive test suite in `AIProviderPipelineTests.java` verifying registry lookup, dynamic provider switching, mock generation, and offline fail-soft fallback.
- **Exit Condition Achieved:** All 49 backend tests pass (0 failures, 0 errors). Frontend builds cleanly in 177ms.

### AI.2 — Centralized Context Engine (COMPLETED)
- **Goal:** Build typed, sanitized context assembly with prompt injection defense.
- **Preconditions:** AI.1 complete.
- **Tasks & Deliverables:**
  1. Defined typed record `ExecutionIntelligenceContext` covering User, Goal, Mission, Session, Progress, Enforcement, Device summaries, and schedule items.
  2. Implemented `ContextEngine` which sanitizes prompts, strips token/password patterns, isolates context blocks within `<system_prompt>`, `<context>`, and `<user_input>` XML tags, and defangs prompt injection.
  3. Integrated `ContextEngine` directly into `AiGateway.processChat`.
  4. Authored `ContextEngineTests` verifying typed context assembly, secret redaction, and prompt injection defanging.
- **Exit Condition Achieved:** All 52 backend tests pass (0 failures, 0 errors). Frontend builds cleanly in 140ms.

### AI.3 — Controlled Tool Layer (COMPLETED)
- **Goal:** Formalize read tools with user-scoped isolation and explicit schemas.
- **Preconditions:** AI.2 complete.
- **Tasks & Deliverables:**
  1. Defined typed contracts `AiTool`, `ToolParameter`, `ToolResult`, and `ToolDefinition`.
  2. Refactored `AiToolRegistry` into a formal tool container indexing 12 standard tools (`get_current_user`, `get_current_goal`, `get_todays_schedule`, `get_active_focus_session`, `get_next_mission`, `get_todays_missions`, `get_progress_summary`, `get_device_status`, `get_enforcement_state`, `get_recent_session_events`, `get_enforcement_explanation`, `get_sanitized_diagnostics`) with snake_case and camelCase alias normalization.
  3. Enforced cross-tenant IDOR protection via `GoalRepository.findByIdAndUser_Id` and `MissionRepository.findByIdAndGoal_User_Id`.
  4. Stripped caller-injected `userId` overrides to ensure strict authentication principal ownership.
  5. Exposed `GET /api/ai/tools` and `POST /api/ai/tools/{toolName}/execute` in `AiController`.
  6. Authored `ControlledToolLayerTests` covering schema registration, unauthenticated rejection, cross-tenant IDOR defenses, parameter spoofing immunity, and REST execution.
- **Exit Condition Achieved:** All 58 backend tests pass (0 failures, 0 errors). Frontend builds cleanly in 153ms.

### AI.4 — Structured Suggestions & Transactional Approval (COMPLETED)
- **Goal:** Bridge the gap between AI proposals and authoritative database mutations.
- **Preconditions:** AI.3 complete.
- **Tasks & Deliverables:**
  1. Extended `GoalDecompositionResponse` with `suggestionId` and defined `SuggestionCommitRequest` and `SuggestionCommitResponse` DTOs.
  2. Implemented `AiService.commitSuggestion` that validates caller tenant ownership, extracts proposed missions from `AiSuggestion` payload, and transactionally persists them into `Mission` database records linked to the target `Goal`.
  3. Added endpoint `POST /api/ai/suggestions/{id}/commit` in `AiController` enforcing authenticated principal ownership.
  4. Updated `AiGateway.decomposeGoal` to serialize structured suggestions and return the generated audit `suggestionId`.
  5. Authored `StructuredSuggestionApprovalTests` verifying suggestion audit creation, atomic mission database persistence, selective mission committing, cross-tenant 403 Forbidden rejection, and REST API execution.
- **Exit Condition Achieved:** All 63 backend tests pass (0 failures, 0 errors). Frontend builds cleanly in 201ms.

### AI.5 — Conversational UX & Action Cards (COMPLETED)
- **Goal:** Elevate frontend chat with interactive approval cards and accessibility.
- **Preconditions:** AI.4 complete.
- **Tasks & Deliverables:**
  1. Defined typed `SuggestionCommitRequest`, `SuggestionCommitResponse`, and `commitSuggestion` API call in `frontend/src/api/ai.ts`.
  2. Implemented interactive proposal cards container in `frontend/src/App.tsx`:
     - Proposal header bar with item count and "⚡ Approve & Add All to Backlog" batch commit button.
     - "✓ Added to Backlog" indicator when proposals have been committed to the database.
     - Individual "+ Backlog" single-mission commit buttons with immediate reactive state update.
     - Single-click "Start focus" arming sprint button.
     - Strict ARIA regions (`role="region"`, `aria-label="Actionable AI proposal cards"`, `role="group"`) and loading states (`msg.committing`) preventing duplicate concurrent submissions.
  3. Styled `.ai-cards-container`, `.ai-card-header-bar`, `.ai-card-header-title`, `.ai-commit-all-btn`, and `.ai-commit-single-btn` in `frontend/src/App.css` with responsive layout, light/dark theme variables, focus-visible outlines, and `@media (prefers-reduced-motion: reduce)` motion suppression.
- **Exit Condition Achieved:** All 63 backend tests pass (0 failures, 0 errors). Frontend builds cleanly via `tsc -b && vite build` in 147ms with 0 errors and passes ESLint with 0 warnings.

### AI.6 — Contextual Execution AI & Silence Engine (APPROVED NEXT SLICE)
- **Goal:** Implement silence rules during active focus sessions.
- **Tasks:**
  1. Detect active focus sessions; suppress proactive interruptions and motivational spam.
  2. Provide quiet assistance only when explicitly prompted by the user.

### AI.7 — User Execution Profile Engine
- **Goal:** Track historical estimation bias and completion velocity from real data.
- **Tasks:**
  1. Compute average focus duration and estimation bias percentage from completed sessions.
  2. Never fabricate metrics when data is insufficient.

### AI.8 — Recovery Intelligence
- **Goal:** Classify session interruptions into Plan Failure vs Execution Failure and suggest constructive recovery paths.

### AI.9 — Command Center Summarization
- **Goal:** Multi-dimensional execution state summarization (Goals, Missions, Schedule, Sentinel).

### AI.10 — Safe Device & Policy Intelligence
- **Goal:** Explain distraction blocks and Sentinel enforcement safely without exposing arbitrary process termination.

### AI.11 — Deterministic Tutorial Engine Expansion
- **Goal:** Complete interactive tour across all 7 tabs using `TutorialOverlay.tsx`.

### AI.12 & AI.13 — Security, Privacy & Rate Limiting Hardening
- **Goal:** Add rate limiting filter to AI endpoints and enforce conversation retention/deletion policies.

### AI.14 — Production Acceptance
- **Goal:** Execute the full 30-step end-to-end acceptance flow.

---

## 5. Phase 3: Sentinel & Host Process Decoupling (P0)
- **Goal:** Eliminate arbitrary server-side process killing.
- **Tasks:**
  1. Restrict `/api/device/processes/{pid}/terminate` behind an administrative authority gate (`@PreAuthorize("hasRole('ROLE_ADMIN')")`).
  2. Decouple local workstation application enforcement to a dedicated desktop daemon or authenticated agent pairing protocol.

---

## 6. Phase 4: Production Packaging & Containerization
- **Goal:** Prepare SHINPO for reliable production deployment.
- **Tasks:**
  1. Create multi-stage `Dockerfile` for the Spring Boot backend (Alpine / Distroless).
  2. Create production container configuration for the React frontend (Nginx with security headers).
  3. Expand `compose.yaml` to orchestrate Backend, Frontend, and PostgreSQL with health checks.
