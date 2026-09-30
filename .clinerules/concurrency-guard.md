# Roo Code — Workspace Operational Rules & Concurrency Guard

## 1. Role: Alternative Coding Agent in SHINPO
Roo Code is configured as an alternative AI coding assistant within this VS Code workspace. It operates as a distinct, dedicated agent interface alongside Google Antigravity.

## 2. Antigravity Coexistence & Anti-Concurrency Protocol
**CRITICAL**: Roo Code and Google Antigravity must NEVER autonomously edit the same working tree simultaneously.

To ensure safety and prevent race conditions or corrupted edits:
1. **Interactive / Explicit Mode**: Only execute file modifications when explicitly instructed by the user in this conversation. Do not initiate unprompted autonomous multi-file refactoring runs in the background.
2. **Preflight Working Tree Check**:
   - Before modifying any file, check `git status`.
   - If the working tree has uncommitted modifications created by an active Antigravity session, HALT and request user confirmation before touching those files.
3. **Branch Isolation**:
   - If Roo Code is tasked with an extensive implementation, work on a dedicated feature branch (e.g. `feature/roo-<task>`) to keep the primary working tree isolated from Antigravity.
4. **No Destructive Operations**:
   - Never run `git reset --hard`, `git clean -fd`, or force pushes without explicit, prompt-level confirmation.

## 3. Architecture & Backpressure Guidelines
- **Backend (Java 25 / Spring Boot 4.1.1)**:
  - Compile check: `cd backend && ./mvnw test-compile -q`
  - Tests: `cd backend && ./mvnw test -q`
- **Frontend (React 19 / TypeScript 6.0 / Vite 8.3)**:
  - Build check: `cd frontend && npm run build`
  - Lint: `cd frontend && npm run lint`
- **GSD & State**:
  - Structured milestones and tasks live in `.planning/`.
  - Read `.planning/STATE.md` to understand active project status before proposing architectural changes.
