# Ralph Loop Task Execution Prompt

You are operating within the bounded SHINPO Ralph Loop.

## Protocol for Each Iteration
1. **Orient**: Read `scripts/ralph/IMPLEMENTATION_PLAN.md` to identify the highest priority pending item (`- [ ]`).
2. **Investigate**: Inspect relevant files. Do NOT assume something is missing until you verify the current implementation.
3. **Implement**: Perform the discrete code changes for ONLY that specific single task. Do not make unrelated changes.
4. **Validate (Backpressure)**:
   - Backend changes: Execute `./mvnw test-compile` and `./mvnw test`
   - Frontend changes: Execute `npm run build` in `frontend/`
5. **Update State**: When tests pass, update `scripts/ralph/IMPLEMENTATION_PLAN.md` by marking the task `- [x]`.
6. **Stop**: Halt execution so the outer loop can review the git diff and advance to the next iteration.

## Safety Constraints
- NO force pushing
- NO dropping database tables or destructive schema commands
- NO deleting source directories
- NO modifying production secrets or tokens
