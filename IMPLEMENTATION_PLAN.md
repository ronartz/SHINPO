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

## 3. Phase 1: Authentication, Identity & RBAC Hardening (P0)
- **Goal:** Eliminate account takeover vectors, enforce database-backed RBAC, and remove development seed disclosures.
- **Preconditions:** Phase 0 complete.
- **Tasks:**
  1. **Chunk 1.1: Database Role Attribute Migration**:
     - Flyway migration `V11__add_user_roles.sql`: Add `role VARCHAR(20) NOT NULL DEFAULT 'ROLE_USER'` and `is_active BOOLEAN NOT NULL DEFAULT TRUE` to table `users`.
     - Update `User.java` and `UserPrincipal.java` to dynamically map roles from database to `GrantedAuthority`.
  2. **Chunk 1.2: Production JWT Secret Gating**:
     - Remove fallback default secret string in `application.properties`. Fail Spring Boot startup with clear exception if `SHINPO_JWT_SECRET` is unset in production profile.
  3. **Chunk 1.3: Eliminate Seed Disclosures**:
     - Remove `GET /api/users/default` endpoint and its associated database auto-seeding logic.
  4. **Chunk 1.4: Pessimistic Lock on Refresh Tokens**:
     - Add `@Lock(LockModeType.PESSIMISTIC_WRITE)` to `RefreshTokenRepository.findByTokenHash` to prevent concurrent race conditions during token rotation.
- **Verification:** Unit and integration tests verifying user role assignments, rejected unauthenticated calls, and failed startup on empty secret.

---

## 4. Phase 2: EONPAI Execution Intelligence Layer Hardening

### AI.0 — Architecture Audit (COMPLETED)
- Audited `AiGateway`, `AiService`, `AiToolRegistry`, `AIProvider`, `OllamaProvider`, `ai_suggestions`, `conversations`, `conversation_messages`, and `bug_reports`.
- Documented reusable components, security gaps, and vertical slice sequence.

### AI.1 — Provider Abstraction & Resilient Pipeline (APPROVED NEXT SLICE)
- **Goal:** Provide a resilient, multi-provider SPI supporting Ollama, Mock/Test Provider, and fail-soft behavior.
- **Preconditions:** AI.0 complete.
- **Tasks:**
  1. Implement `AIProviderRegistry` that manages available `AIProvider` beans.
  2. Implement `MockAIProvider` with configurable canned responses to enable hermetic, zero-latency unit/integration testing without network timeouts.
  3. Harden `OllamaProvider` with strict connection timeouts and fail-soft error handling.
  4. Create integration tests verifying provider switching and graceful offline fallback.
- **Exit Condition:** Automated tests verify provider selection and fallback with zero test suite hangs.

### AI.2 — Centralized Context Engine
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
