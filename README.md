# SHINPO

SHINPO is a cross-device personal execution operating system intended to connect long-term goals to daily execution. The current repository contains a useful but incomplete implementation. Product intent and target behavior are documented separately from verified implementation; do not infer feature completion from this summary.

## Current architecture snapshot

- Backend: Spring Boot + PostgreSQL + Spring Security + Flyway
- Frontend: React + TypeScript + Vite
- Desktop: Tauri shell with native Rust enforcement thread
- Local enforcement: Rust shield crate that inspects active processes and reports back to the backend
- Realtime: STOMP/WebSocket telemetry
- AI: provider abstraction, context assembly, suggestions, and fallback behavior

## Implementation Snapshot

The repository includes goal/mission CRUD, a focus-session API lifecycle, schedule surfaces, AI/provider and suggestion paths, STOMP/WebSocket events, process-control code, a Rust telemetry spool, and Tauri v2 command wiring. These are bounded code paths, not evidence that the complete product requirements are finished or safe for release. In particular, contextual/browser enforcement, process safety, current-time/timezone correctness, Analytics truth, polished warning/grace UX, and device/platform certification remain gaps.

For detailed source/test evidence and bounded statuses, use [SHINPO_IMPLEMENTATION_STATUS.md](SHINPO_IMPLEMENTATION_STATUS.md). Product requirements are in [SHINPO_PRODUCT_REQUIREMENTS.md](SHINPO_PRODUCT_REQUIREMENTS.md), target behavior in [SHINPO_MASTER_BLUEPRINT.md](SHINPO_MASTER_BLUEPRINT.md), architecture in [SHINPO_ARCHITECTURE.md](SHINPO_ARCHITECTURE.md), and UI findings in [SHINPO_UI_UX_DEFECT_REGISTER.md](SHINPO_UI_UX_DEFECT_REGISTER.md).

## Development stack

- Java 25 + Spring Boot 4.1.1
- PostgreSQL 17
- React 19 + TypeScript
- Vite
- Tauri v2 desktop shell
- Rust shield crate
- STOMP/WebSocket eventing

## Development setup

### Backend
```bash
cd backend
./mvnw spring-boot:run
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Rust native shield
```bash
cd crates/shinpo-shield
cargo test
```

### Docker / compose
```bash
docker compose up -d
```

## Documentation index

- [SHINPO_MASTER_BLUEPRINT.md](SHINPO_MASTER_BLUEPRINT.md) — authoritative product intent and target behavior
- [SHINPO_PRODUCT_REQUIREMENTS.md](SHINPO_PRODUCT_REQUIREMENTS.md) — stable requirement IDs, status, and traceability
- [SHINPO_ARCHITECTURE.md](SHINPO_ARCHITECTURE.md) — current architecture evidence, trust boundaries, and migration target
- [SHINPO_IMPLEMENTATION_STATUS.md](SHINPO_IMPLEMENTATION_STATUS.md) — implementation truth, limitations, contradictions, and verification scope
- [SHINPO_UI_UX_DEFECT_REGISTER.md](SHINPO_UI_UX_DEFECT_REGISTER.md) — prioritized safety, correctness, UX, and visual-verification register
- [docs/SHINPO_HARDENING_GUIDELINE.md](docs/SHINPO_HARDENING_GUIDELINE.md) — current hardening guidance; not a certification of implementation

## Documentation Status

| Document set | Classification | Use |
|---|---|---|
| The five `SHINPO_*.md` authority documents above | CURRENT | Product intent, stable requirements/status, implementation truth, architecture, and defects. |
| `README.md` | CURRENT | Project entry point and documentation catalog. |
| `APP_FLOW.md`, `IMPLEMENTATION_PLAN.md`, `TESTING.md`, `TRD.md` | HISTORICAL / SUPERSEDED | Retained for provenance; old milestone, current-flow, completion, and test-count claims are not current evidence. |
| `docs/codebase-audit/*.md` | HISTORICAL SNAPSHOT; some claims CONTRADICT source | Useful discovery notes only; verify every claim against live code and tests. |
| `docs/architecture/*.html`, `shinpo_architecture.html`, `.planning/*.html`, `.archify/**` | GENERATED REFERENCE / UNKNOWN | Diagrams are not source authority or proof of browser-tested product behavior. |
| `.planning/PROJECT.md`, `ROADMAP.md`, `ARCHITECTURE_REMAINING.md` | HISTORICAL / SUPERSEDED where contradicted | Preserve as planning history; do not use old milestones as implementation truth. |
| `.planning/STATE.md` | CONTRADICTORY / REQUIRES RECONCILIATION | Its milestone snapshot is stale. It was not edited because the workspace guard requires an authorized GSD workflow for `.planning/` writes. |
| `.clinerules/**`, `.roorules` | CURRENT workspace instructions | Agent/tool operating rules, not product requirements. |

## Important product note

The project must not be described as a universal blacklist system. Contextual protection is the target; current process enforcement still uses static patterns and has a P0 process-safety gap. Browser enforcement and the warning/grace flow (maximum 20 minutes) are requirements, not verified implementation claims. See the defect register before enabling or presenting automatic process termination.

## License

Private and proprietary project documentation. See repository-specific legal and distribution constraints for any shipping or deployment decisions.