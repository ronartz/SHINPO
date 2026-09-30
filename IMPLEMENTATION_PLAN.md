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

### AI.2 — Centralized Context Engine (APPROVED NEXT SLICE)
- **Goal:** Build typed, sanitized context assembly with prompt injection defense.
- **Tasks:**
  1. Define typed record `ExecutionIntelligenceContext`.
  2. Isolate context with strict delimiters: `<system_prompt>`, `<context>`, `<user_input>`.
  3. Ensure zero passwords, tokens, or raw host secrets ever enter prompt context.

### AI.3 — Controlled Tool Layer
- **Goal:** Formalize read tools with user-scoped isolation and explicit schemas.
- **Tasks:**
  1. Refactor `AiToolRegistry` into explicit typed tool contracts.
  2. Verify all tool calls derive ownership exclusively from authenticated `principal.getUserId()`.

### AI.4 — Structured Suggestions & Transactional Approval
- **Goal:** Bridge the gap between AI proposals and authoritative database mutations.
- **Tasks:**
  1. Add endpoint `POST /api/ai/suggestions/{id}/commit` to atomically convert approved `ProposedMission` items into real database records via `MissionService`.
  2. Link suggestions to `AiSuggestion` audit records.

### AI.5 — Conversational UX & Action Cards
- **Goal:** Elevate frontend chat with interactive approval cards and accessibility.
- **Tasks:**
  1. Render actionable cards in `App.tsx` with one-click "Approve & Schedule" buttons.
  2. Verify keyboard navigation, ARIA labels, and reduced-motion styling.

### AI.6 — Contextual Execution AI & Silence Engine
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
