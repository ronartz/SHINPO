# 進歩 (SHINPO) — Personal Execution Operating System

SHINPO is a full-stack, local-first personal execution system linking high-level strategic goals to tactical daily missions, distraction-free focus sessions, and OS-level process enforcement.

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────┐
│                   SHINPO CLOUD / SERVER                │
│  Spring Boot (Java 25) + PostgreSQL 17 + STOMP Broker  │
│  • Goals & Tactical Missions Lifecycle Management     │
│  • Focus Session State Machine & Interruption Tracking │
│  • EONPAI AI Engine (Ollama Local / Cloud Fallback)    │
│  • Sentinel Policy Gates & Quarantine Audit Database   │
└───────────────────────────┬────────────────────────────┘
                            │ HTTPS / WSS
                            ▼
┌────────────────────────────────────────────────────────┐
│               SHINPO DESKTOP CLIENT                    │
│  • React 19 + TypeScript Bento Cockpit UI              │
│  • Native Rust Shield Daemon (Zero Overhead)           │
│  • OS Distraction Quarantine & Offline Telemetry Spool │
└────────────────────────────────────────────────────────┘
```

---

## Core Capabilities

- **Goal & Mission Decomposition**: Structure ambitious long-term goals into time-boxed, actionable daily missions with XP reward progression.
- **Deep Focus Session Engine**: Pomodoro and sprint countdowns with pause/resume tracking, state synchronization across tabs, and post-session cognitive debriefs.
- **Sentinel OS Shield (Rust)**: Autonomous, cross-platform OS process interceptor (`crates/shinpo-shield`) terminating blacklisted distraction apps (Discord, Steam, Spotify, etc.) during active sprints.
- **Offline Telemetry Spooler**: Buffers intercepted distractions into a local JSONL spool (`daemon/quarantine_spool.jsonl`) when offline and automatically batch-synchronizes when reconnected.
- **Real-Time STOMP WebSockets**: Instant live toast alerts and notification drawer for quarantine interceptions and sprint lockouts.
- **EONPAI AI Executive Guide**: Context-aware daily planner, session recovery assistant, and executive briefing agent using local Ollama (`qwen3:4b`) with automatic heuristic fallbacks.

---

## Quickstart (Development)

### 1. Database
```bash
docker run -d --name shinpo-postgres -p 5432:5432 \
  -e POSTGRES_DB=shinpo \
  -e POSTGRES_USER=shinpo \
  -e POSTGRES_PASSWORD=shinpo_dev \
  postgres:17
```

### 2. Backend (Spring Boot 25)
```bash
cd backend
./mvnw spring-boot:run
```
*Runs on port 8080. Automatically applies Flyway migrations V1–V14.*

### 3. Frontend (React 19 + Vite)
```bash
cd frontend
npm install
npm run dev
```
*Opens cockpit UI at `http://localhost:5173`.*

### 4. Native Rust Shield (Optional Daemon)
```bash
cd crates/shinpo-shield
cargo run -- run
```

---

## Automated Verification

The repository enforces a 100% pass verification baseline across all subsystems:

```bash
# Run 116 Backend Automated Tests
cd backend && ./mvnw test

# Run 8 Native Rust Shield Tests
cd crates/shinpo-shield && cargo test

# Verify Frontend Linter & Production Build
cd frontend && npm run lint && npm run build
```

---

## Production Deployment (Docker Compose)

Deploy the entire production stack (PostgreSQL 17, Spring Boot backend, and Nginx React frontend) with a single command:

```bash
docker compose up -d
```

---

## License

Private & Proprietary. Built for personal execution and distributed focus environments.