# SHINPO — Master Codebase Context Package

This master document serves as the high-density technical briefing for any senior engineer or AI agent working on this exact repository.

## 1. System Overview
SHINPO (進歩) is a Personal Execution Operating System linking long-term Strategic Goals to Tactical Missions, deep work Focus Sessions, and real-time OS-level Process Enforcement (Shield).

## 2. Core Subsystems
- **Backend (`backend/`)**: Spring Boot 25 with Java 25, Flyway V1-V14 migrations, PostgreSQL 17, HMAC-SHA256 JWT auth (15m access / 7d refresh token rotation), STOMP WebSocket broker on `/ws`.
- **Frontend (`frontend/`)**: React 19 + TypeScript + Vite. Bento grid dashboard, live STOMP alert drawer, dark/light theme, zero lint errors.
- **Shield Daemon (`crates/shinpo-shield/`)**: Native Rust process sentinel with offline JSONL spooler, Windows `taskkill` interceptor, and REST sync.
- **AI Engine (`backend/.../ai/`)**: EONPAI intelligence provider with Ollama local inference (`qwen3:4b`), fallback heuristics, and controlled tool execution layer.

## 3. Critical Invariants (DO NOT BREAK)
1. **Zero Database DDL in JPA**: `spring.jpa.hibernate.ddl-auto=none`. All schema changes MUST go through Flyway versioned SQL scripts in `backend/src/main/resources/db/migration/`.
2. **Stateless Security**: `SessionCreationPolicy.STATELESS` with JWT. User ID is extracted from token claims, never trusted from unauthenticated request bodies.
3. **Protected Processes**: Native shield and Sentinel must NEVER terminate IDEs, compiler toolchains, JVMs, or core OS services (`crates/shinpo-shield/src/enforcer.rs`).
4. **Offline Resilience**: Distraction quarantine events must buffer to `quarantine_spool.jsonl` if the backend is temporarily offline, flushing upon reconnection.
