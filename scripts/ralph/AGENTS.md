# SHINPO Operational Architecture Guide for Coding Agents

## Backpressure Commands
- **Backend Build & Compile**: `cd backend && ./mvnw test-compile -q`
- **Backend Tests**: `cd backend && ./mvnw test -q`
- **Frontend Typecheck & Build**: `cd frontend && npm run build`
- **Frontend Lint**: `cd frontend && npm run lint`

## Architectural Boundaries
1. **Controller Layer**: REST endpoints only, DTO validation with `@Valid`, delegates all business logic to Services.
2. **Service Layer**: Business transactions, entity operations, security ownership verification (`userId`).
3. **Repository Layer**: Spring Data JPA interfaces; parameterized queries only.
4. **Flyway Migrations**: Never modify existing applied migrations (`V1` to `V10`). Always append new versioned migrations (`V11__...sql`).
5. **Frontend Cockpit**: React 19 + TypeScript + Vite. Keep layout aligned with the Dark 2x2 Bento specification.
