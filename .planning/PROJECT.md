# SHINPO — Personal Execution Operating System

## Project Vision
SHINPO is a personal execution operating system engineered to close the gap between long-term ambition and real-time execution. Unlike conventional to-do apps, SHINPO links macro goals to micro missions, schedules structured focus sessions, enforces focus at the OS process level (Sentinel), debriefs session results, and closes the behavioral loop with adaptive AI guidance (EONPAI).

## The Core Loop
```
GOAL → MISSION → SCHEDULE → FOCUS SESSION → ENFORCEMENT → EXECUTION → RESULT → PROGRESS → ANALYTICS → IMPROVEMENT → NEXT ACTION
```

## Architecture Stack
- **Backend**: Java 25, Spring Boot 4.1.1, Spring Security (Stateless JWT + Refresh Token Rotation), Spring Data JPA, Flyway DB Migrations.
- **Database**: PostgreSQL 17 running on port 5432 (`shinpo-postgres`).
- **AI Companion (EONPAI)**: Ollama local runtime (`qwen3:4b`), `AiGateway`, deterministic fallback engine, read-only system tools (`AiToolRegistry`).
- **Frontend**: React 19.2.8, TypeScript 6.0.2, Vite 8.3, pure CSS modern dark glassmorphic cockpit layout.
- **Enforcement (Sentinel)**: Linux process inspection (`ProcessHandle`), protected system process whitelist, distraction quarantine, native Rust/Python shield daemons.

## Non-Negotiables & Constraints
1. **Zero Hallucination / Data Integrity**: Every metric and status must reflect real database records.
2. **Read-Only / Safe AI Boundaries**: AI cannot mutate database state or kill OS processes unprompted.
3. **Bounded Autonomous Execution**: All iterative loops must have strict iteration limits and validate builds/tests before committing.
4. **Security Boundaries**: Multi-tenant isolation by user ID on all queries; no hardcoded production secrets.
