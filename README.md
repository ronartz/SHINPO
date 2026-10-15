# SHINPO

> **Personal execution operating system connecting high-level ambition to daily focused execution.**

SHINPO is an integrated productivity and focus runtime that pairs desktop-level distraction containment with strategic goal decomposition and an autonomous planning copilot. It brings together a low-overhead native process shield, real-time telemetry, server-synchronized focus timers, and a fluid desktop workspace.

---

## Core Systems

- **Sentinel Shield (Native Process Enforcer)**: High-speed, low-overhead process monitor implemented in Rust that enforces focus boundaries during active work sessions and safely quarantines distracting applications.
- **Precision Focus Engine**: Server-anchored countdown timers, distraction tracking, pause/resume state machines, and post-session reflection debriefs designed to survive background tab throttling and system sleep.
- **Strategic Goal & Task Hierarchy**: Multi-tier execution architecture connecting multi-month goals down to atomic daily tasks with kanban boards, priority queues, and schedule timelines.
- **EONPAI Executive Copilot**: Conversational AI assistant supporting daily planning, automated goal breakdown, and validated action execution via a structured tool registry.
- **Aurora Desktop Interface**: Desktop workspace powered by React 19 and Tauri v2, supporting both high-contrast Dark and WCAG-compliant Light modes with a fixed application-shell scroll layout.

---

## Architecture Overview

```
                          ┌───────────────────────────┐
                          │    Desktop / Browser      │
                          │   React 19 + TypeScript   │
                          │        (Tauri v2)         │
                          └─────────────┬─────────────┘
                                        │
                         HTTP REST / WS │ STOMP
                                        │
             ┌──────────────────────────▼──────────────────────────┐
             │               SHINPO Backend Engine                 │
             │           Spring Boot 4.1 / Java 25                 │
             ├──────────────────────────┬──────────────────────────┤
             │  • Focus Session Manager │  • EONPAI AI Gateway     │
             │  • Goal & Task Services  │  • WebSocket Telemetry   │
             │  • Sentinel Controller   │  • Action Tool Registry  │
             └─────────────┬────────────────────────────┬──────────┘
                           │                            │
                     JDBC  │                      IPC / │ Realtime
                           ▼                      Event │ Telemetry
                 ┌───────────────────┐                  ▼
                 │   PostgreSQL 17   │        ┌───────────────────┐
                 │  Flyway Migrations│        │   Native Shield   │
                 └───────────────────┘        │   (Rust Crate)    │
                                              └───────────────────┘
```

---

## Tech Stack

| Domain | Technology | Details |
|---|---|---|
| **Backend** | Java 25, Spring Boot 4.1.1 | Spring Security, Spring Data JPA, Flyway, STOMP WebSockets |
| **Database** | PostgreSQL 16+ / 17 | Relational persistence, automated versioned migrations |
| **Frontend** | React 19, TypeScript, Vite | Custom Aurora UI design tokens, Material UI primitives |
| **Desktop Shell** | Tauri v2, Rust | Cross-platform native windowing, system tray, IPC bridge |
| **Enforcement** | Rust (`crates/shinpo-shield`) | Cross-platform process enumeration and termination daemon |
| **AI Gateway** | Spring AI / Provider Abstraction | Pluggable local (Ollama) and cloud model endpoints |

---

## Repository Structure

```
.
├── backend/                  # Spring Boot application, REST controllers, AI gateway & migrations
├── frontend/                 # React 19 desktop SPA and Tauri client
│   ├── src/                  # Views, components, hooks, styles, and API clients
│   └── src-tauri/            # Tauri desktop configuration and native bindings
├── crates/
│   └── shinpo-shield/        # Rust process enforcement daemon and IPC client
├── docs/
│   └── architecture/         # System architecture, API contracts, and engineering standards
├── scripts/                  # Automated verification, test runners, and runtime scripts
└── docker-compose.yml        # Local infrastructure services (PostgreSQL, mock services)
```

---

## Getting Started

### Prerequisites

Ensure you have the following installed on your host machine:

- **Java JDK 25** (or compatible vendor distribution, e.g. Eclipse Temurin)
- **Node.js 20+** and **npm**
- **Rust toolchain 1.80+** (`rustc`, `cargo`)
- **PostgreSQL 16+** (or Docker for running containerized DB)

---

### 1. Database Setup

Using Docker Compose:

```bash
docker compose up -d postgres
```

Or connect to an existing PostgreSQL instance and configure credentials in `.env` (refer to `.env.example`).

---

### 2. Run the Backend

```bash
cd backend
./mvnw spring-boot:run
```

The Spring Boot backend will run Flyway migrations and start listening on `http://localhost:8080`.

---

### 3. Run the Frontend (Web Dev Mode)

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server will start at `http://localhost:5173`.

---

### 4. Run Desktop Shell (Tauri Dev Mode)

To launch the native desktop application with full IPC and native window capabilities:

```bash
cd frontend
npm run tauri:dev
```

---

### 5. Native Shield Daemon

To run the standalone process monitor:

```bash
cd crates/shinpo-shield
cargo run
```

---

## Testing & Quality Gates

The codebase enforces strict test-driven quality boundaries across all tiers:

```bash
# Backend unit & integration test suite (295 tests)
cd backend && ./mvnw test

# Frontend typecheck & production build
cd frontend && npm run build

# Frontend linter
cd frontend && npm run lint

# Frontend unit & contract tests
cd frontend && npm test

# Rust enforcement engine checks & tests
cd crates/shinpo-shield && cargo test
```

---

## Configuration

Default environment variables are defined in `.env.example` (root) and `frontend/.env.example`.

| Variable | Default | Purpose |
|---|---|---|
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://localhost:5432/shinpo` | Database connection string |
| `SPRING_DATASOURCE_USERNAME` | `postgres` | Database username |
| `SPRING_DATASOURCE_PASSWORD` | `postgres` | Database password |
| `VITE_API_URL` | `http://localhost:8080` | Backend API base URL |
| `VITE_WS_URL` | `ws://localhost:8080/ws` | WebSocket telemetry endpoint |

---

## Documentation

Detailed architectural and design specifications can be found under `docs/`:

- [API Reference](docs/architecture/API_REFERENCE.md)
- [Code & Engineering Standards](docs/architecture/CODE_STANDARDS.md)
- [Frontend Architecture](docs/architecture/FRONTEND_ARCHITECTURE.md)
- [Standalone Runtime Guide](docs/architecture/STANDALONE_RUNTIME.md)

---

## License

All rights reserved. Proprietary software.