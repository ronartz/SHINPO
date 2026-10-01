# SHINPO Development Roadmap

## Milestones

### Milestone 1: Core Platform & Cockpit Foundation (COMPLETE)
- [x] Phase 1.1: Core Domain Entities & Relational Schema (PostgreSQL 17, Flyway V1-V6)
- [x] Phase 1.2: Focus Session Engine (Timer intervals, pause/resume, debriefs, sweep daemon)
- [x] Phase 1.3: Stateless JWT Authentication & Refresh Token Rotation (Flyway V8)
- [x] Phase 1.4: Modern 2x2 Bento Cockpit Frontend (Dark luxury aesthetic, Today tasks, Calendar, Velocity pillars, Timeline)

### Milestone 2: EONPAI Tactical Intelligence & Telemetry Loop (COMPLETE)
- [x] Phase 2.1: Local Ollama Provider & AI Gateway (`qwen3:4b`, fallback heuristics)
- [x] Phase 2.2: Read-Only System Tools (`AiToolRegistry` context assembly)
- [x] Phase 2.3: Persistent Conversation History (Flyway V10, message audit)
- [x] Phase 2.4: Session Debrief Analysis & Cognitive Recovery Workflows
- [x] Phase 2.5: Adaptive Planning & Daily Agenda Scheduling

### Milestone 3: Sentinel Process Hardening & OS Enforcement (COMPLETE)
- [x] Phase 3.1: Linux Process Inspection & Safe Containment Boundaries (OS ProcessHandle inspection, protected system process whitelisting)
- [x] Phase 3.2: Automated Distraction App Quarantining during Active Sprints (Periodic sweep daemon, custom blacklist/whitelist policy rules, EONPAI tool telemetry)
- [x] Phase 3.3: Task Manager Permission Boundary & Administrative Policy Gate

### Milestone 4: Native Shield, Lifecycle Management & Production Readiness (IN PROGRESS)
- [x] Phase 4.1: Native Rust Shield Daemon Integration (`crates/shinpo-shield`)
- [x] Phase 4.2: Full Goals & Missions Lifecycle CRUD & UI Controls (`PUT /api/goals/{id}`, `PUT /api/missions/{id}`, Edit modals)
- [x] Phase 4.3: AI.9 Command Center Executive Briefing / Tactical Synthesis (`GET /api/ai/briefing`, Flight Deck executive card)
- [x] Phase 4.4: Production Containerization & Full-Stack Orchestration (Spring Boot 25 Dockerfile, Nginx React Dockerfile, `compose.yaml`)
- [ ] Phase 4.5: Windows WFP / macOS Endpoint Security Layer
- [ ] Phase 4.6: Local-First Offline Telemetry Synchronization
