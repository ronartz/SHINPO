# SHINPO Hardening Guideline

**Purpose:** provide a staged, verifiable path from the current SHINPO codebase to a trustworthy execution product. This is a plan and a set of release gates; it does not certify that any control is already implemented.

**Product principle:** SHINPO helps a user execute their own intentions. It must be transparent about what it observes, honest about what it can enforce, and recoverable when the plan or system fails.

## 1. Scope and baseline

This guideline covers the Spring Boot / PostgreSQL backend, React / TypeScript frontend, Rust and Python local agents, and the intended Linux, Windows, and Android direction. It addresses correctness, security, privacy, accessibility, operations, and verification.

The repository inspection found real goal and mission flows, JWT authentication, focus-session state handling, schedule and analytics views, interval-plan persistence, and local process-control code. Several device-related pieces are incomplete or unsafe to present as production features. Analytics contains placeholder values; AI chat does not consistently derive identity from the authenticated principal; local agents can attempt automatic process termination; and Task Manager process information is read from the backend host with estimated per-process metrics. Recheck these findings against the working tree before implementation.

The reviewed working tree had three commits ahead of `origin/main`, modified tracked files, and new untracked files. Before starting a hardening chunk:

1. Record `git status --short --branch` and inspect every relevant diff.
2. Identify and preserve in-progress work.
3. Record the exact commit used as the chunk baseline.
4. Never mark a chunk complete because a file exists or code compiles.

The project `.env` is ignored by Git. Do not print, commit, or copy its contents into logs, documentation, screenshots, or issue reports. Rotate any credential that may have been committed or shared.

## 2. Hardening rules

1. **Identity comes from authentication.** Never trust request-body user IDs, device IDs, owner IDs, or ownership flags.
2. **Backend authorizes; agent independently protects.** Both layers reject unsafe process-control requests.
3. **Capability means verified capability.** A UI operation is available only when a paired device advertises it and the agent version supports it.
4. **Intent is not outcome.** A request sent or signal accepted is not proof that a process stopped or a focus block completed.
5. **AI proposes; product services decide.** AI has no direct arbitrary database or shell access.
6. **No fabricated telemetry.** Unknown values remain unknown. Label estimates and exclude them from measured analytics unless the distinction is clear.
7. **Bound failure modes.** Define timeouts, retries, duplicate messages, stale state, offline devices, and partial failures.
8. **Consent is specific and reversible.** Explain what is collected, why, where, for how long, and how to disable/delete it.
9. **Ship vertical slices.** Each chunk has preconditions, acceptance criteria, tests, and real verification evidence.
10. **Make no production claims without release evidence.** Code, tests, local demos, and platform verification are different evidence levels.

## 3. Risk priorities

| Priority | Area | Why it blocks broader release |
|---|---|---|
| P0 | Process termination and local agents | Can disrupt host software; current identity and verification controls are insufficient. |
| P0 | AI chat identity | A caller-supplied user ID or fallback identity can associate operations with the wrong user. |
| P0 | Authentication secrets and authorization | A development signing-secret fallback and incomplete route-specific checks undermine account isolation. |
| P1 | Focus/session truth | Completion, timing, pauses, and break transitions must represent actual state. |
| P1 | Analytics and progress truth | Placeholder metrics can mislead users and corrupt adaptive planning. |
| P1 | Device identity and policy delivery | A trustworthy device registry/capability/policy loop is not established by the current structure. |
| P2 | Privacy, accessibility, legal, and operations | Required for a trustworthy public product and platform distribution. |

**P0 items block enabling automatic enforcement for end users.** Do not hide this gate behind a feature flag enabled by default.

## 4. Phase 0 — Establish a reviewable baseline

### Work

- Preserve and review current uncommitted work before changing it.
- Inventory routes, entities, migrations, scheduled jobs, UI surfaces, agents, deployment configuration, and tests.
- Map each brief capability to `verified`, `implemented but unverified`, `partial`, `planned`, or `not present`.
- Document build/run prerequisites without embedding secrets.
- Identify which process is the backend host in each deployment mode. Do not assume it runs on the user's device.

### Acceptance

- A reviewer can reproduce the baseline from a named commit and clean dependency state.
- Every claimed capability has an evidence link and explicit status.
- In-progress files and known failures are recorded; no work is silently discarded.

## 5. Phase 1 — Authentication, identity, and account isolation (P0)

### Required design

- Obtain the acting user exclusively from the validated authenticated principal.
- Remove user-ID fallbacks and client-selected identity from authenticated operations, including AI chat.
- Apply ownership checks to every read/write, including nested goal → mission, user → plan, user → device, and device → process command resources.
- Return consistent `401` for missing/invalid authentication and non-enumerating `404` for resources not owned by the caller.
- Keep access tokens short-lived; rotate and revoke refresh tokens; store refresh-token hashes; define logout and account-revocation behavior.
- Require a high-entropy signing secret from deployment configuration. Fail startup when missing or weak in production. Keep development defaults out of production profiles.
- Validate registration, login, refresh, logout, and all request DTOs. Rate-limit registration, login, refresh, password-related operations, and expensive endpoints.
- Require secure transport outside local development. Define bearer/cookie storage and XSS/CSRF implications explicitly.

### Acceptance gate

- A request cannot read or mutate another user's goals, missions, sessions, plans, analytics, AI context, or devices by changing a body field, query parameter, path ID, or header.
- AI chat, analytics, next-action, recovery, and every future tool use the authenticated user's identity.
- Invalid tokens do not create a partially authenticated security context or leak internal exception details.
- Production cannot start with the repository's development signing secret.

## 6. Phase 2 — API, deployment, and application security (P0/P1)

### Required work

- Replace wildcard CORS with explicit environment-specific origins. Do not combine arbitrary origins with credentialed requests.
- Protect actuator endpoints; expose only minimum health information needed by deployment.
- Set security headers and an appropriate restrictive Content Security Policy. Review framing, MIME sniffing, referrer, and transport policies.
- Keep SQL parameterized; validate lengths, ranges, enum values, date windows, and pagination.
- Ensure errors do not expose stack traces, SQL, paths, tokens, or secret configuration.
- Add rate limits and request-size limits; define upload limits before adding file ingestion.
- Review dependency versions, licenses, and known vulnerabilities before release.
- Use least-privilege database credentials; control migrations; encrypt backups; rehearse restore.
- Keep secrets out of tracked files, logs, and client bundles; run secret scanning before release.

### Acceptance gate

- Production has explicit CORS origins, non-public operational endpoints, security headers, bounded request sizes, and rate limits.
- A backup restores into an isolated environment and migration behavior is understood.
- No secret is present in tracked files, build artifacts, logs, or client bundles.

## 7. Phase 3 — Execution domain and state correctness (P1)

### Focus sessions

- Define legal transitions for `SCHEDULED`, `ACTIVE`, `PAUSED`, `COMPLETED`, `CANCELLED`, and `EXPIRED`.
- Keep elapsed time server-derived. Decide whether early completion is allowed; record actual elapsed work separately from planned duration.
- Specify behavior when sessions exceed duration, the client disconnects, the backend restarts, or clients issue conflicting lifecycle actions.
- Make lifecycle operations idempotent or return clear conflicts for duplicate/stale actions.
- Protect concurrent updates with versioning/locking or another explicit rule.
- Define schedule timezone behavior. Store instants consistently and render in the user's selected timezone.

### Plans and breaks

- Treat focus and break intervals as explicit execution states, not labels on one timer.
- Define interval advancement, pause/resume, skipped intervals, manual override, cancellation, and enforcement transitions.
- State which controls relax during breaks, when they resume, and what happens if a device is offline at the boundary.
- Do not award completion credit for an interval that did not complete.

### Acceptance gate

- State transitions, elapsed-time calculations, late sessions, and duplicate/concurrent requests have automated coverage.
- UI and API agree after refresh or reconnect.
- Results distinguish planned duration, measured active duration, pause time, and user-reported accomplishment.

## 8. Phase 4 — Progress, analytics, and recovery truth (P1)

### Required work

- Define XP/progress rules in a documented table. Reward meaningful completed work and prevent duplicate awards on retries.
- Use idempotency keys or database uniqueness for each awardable event.
- Store actual events as source of truth; derive totals and charts from them.
- Remove fixed/default streaks and quality scores. Represent insufficient data as unknown/empty, not as success.
- Define analytics windows, timezone, denominators, cancelled/expired session treatment, and whether active sessions count.
- Capture structured recovery reasons only when useful and explain how they affect estimates.
- Keep plan failure distinct from execution failure. Show the evidence behind recommendations and let the user edit them.

### Acceptance gate

- Repeated completion requests cannot duplicate progress.
- Every displayed number is derived from recorded events or clearly labelled as an estimate.
- Empty, partial, and failed data loads have honest UI states.
- Analytics edge cases have test fixtures and documented definitions.

## 9. Phase 5 — AI boundary and auditability (P0/P1)

### Required design

- Keep deterministic services authoritative for session state, permissions, progress, device policy, and destructive operations.
- Scope AI context fetches to the authenticated principal. Never accept model/client user IDs as authorization.
- Define schemas and size limits for model input/output. Validate output before presenting or acting on it.
- Treat state-changing AI tools as proposals. Normal services re-check ownership, state, policy, and preconditions at execution time.
- Require explicit confirmation for consequential/destructive actions. Free-form model output cannot trigger process termination.
- Persist minimum audit context: caller, operation type, timestamp, result, and relevant IDs. Do not log secrets or unnecessary conversation content.
- Keep core app flows available when AI is unavailable, slow, rate-limited, or invalid.
- Explain AI data handling, retention, provider routing, and opt-out before using execution history as model context.

### Acceptance gate

- AI cannot access another user's information, perform arbitrary writes, launch shell commands, or bypass authorization.
- Unsafe model output fails closed and cannot mutate state.
- Provider failure does not block sessions, missions, or progress.

## 10. Phase 6 — Device registry and safe process control (P0)

Do not describe the current backend-host process list as a user's registered device. Define the device-agent contract before enabling remote or automatic enforcement.

### Device identity and capabilities

- Pair each agent through an authenticated, user-approved flow. Issue a revocable device-scoped credential; support rotation and revocation.
- Give each device a stable ID and platform identity. Let the user see, rename, disconnect, revoke, and delete it.
- Agents report supported capabilities and version. Store capability freshness/heartbeat; stale capabilities are unavailable.
- Keep platform-specific behavior in the agent. Backend policy must not imply all OSes support the same controls.
- Use TLS. Prevent replay with unique command IDs, expiry, device binding, and idempotent result handling.

### Process identity

Never address a process by PID alone. Where available, bind the action to:

- device ID and boot/session identity;
- PID and process start time;
- executable identity (canonical path and stronger platform identity where available);
- owning OS user/session;
- capability and policy version authorizing the action.

The local agent re-reads identity immediately before acting and rejects stale/mismatched targets. It enforces protected-process rules independently of the frontend.

### Policy and action semantics

- Distinguish `ALLOW`, `BLOCK`, `PROTECT`, and `UNKNOWN`, with a human-readable reason and source (manual, active policy, or system protection).
- Distinguish graceful `STOP` from forced `TERMINATE`; require stronger confirmation for forced termination.
- Start with dry-run and visible user-configured policies. Do not enable automatic killing by default during rollout.
- Protect the agent, OS-critical processes, accessibility/security tools, and user-configured exclusions. Do not rely on process-name matching alone.
- Return `REQUESTED`, `SIGNAL_SENT`, `EXIT_CONFIRMED`, `REJECTED`, `NOT_FOUND`, `STALE_TARGET`, `UNSUPPORTED`, or `FAILED` distinctly.
- Verify exit by polling the original process identity for a bounded period. A successful signal is not confirmed termination.
- Record manual actions separately from automatic policy actions. Avoid collecting unrelated process arguments or file contents.

### Offline behavior

- Policies have an expiry/lease. Define visible behavior when the backend is unavailable; never silently extend indefinite lockdown.
- Reconcile missed start, pause, end, or policy updates after reconnect.
- Revoked devices and expired commands fail closed for control operations.

### Acceptance gate

- The agent controls only its paired local device and advertised capabilities.
- Users cannot control another user's device or unrelated backend-host processes.
- PID reuse, spoofed names, duplicate/expired commands, permission failures, agent restart, and backend outage are covered by tests and platform verification.
- UI reports actual device/action state, not assumed “active defense.”

## 11. Phase 7 — Privacy, accessibility, and product trust (P1/P2)

### Privacy

For every collected field, document purpose, source, storage location, access, retention, deletion route, and whether it leaves the device. Keep ambient monitoring separate from active enforcement. Explicitly prohibit keylogging, screenshots, screen recording, document-content inspection, password inspection, and covert monitoring.

Minimize data: process name/state may be sufficient. Avoid command-line arguments, window titles, paths, or detailed activity unless a concrete feature requires them and the user opts in. Define retention limits and a verified account/device data deletion process.

### Accessibility and UI trust

- Support keyboard navigation, visible focus, semantic labels, screen-reader announcements, adequate contrast, responsive layouts, and accessible destructive-action confirmations.
- Add `prefers-reduced-motion` behavior to the motion system. State changes remain understandable without animation.
- Label demo, estimated, stale, unavailable, and verified data distinctly.
- Provide clear empty, loading, permission-denied, offline, and error states.
- Keep Focus Mode quiet and purposeful.

### Acceptance gate

- Users can inspect/control monitoring, enforcement, retention, and deletion settings.
- Major flows are checked for accessibility; essential controls work without pointer or motion.
- Users can tell whether process and analytics data is measured, estimated, stale, or unavailable.

## 12. Phase 8 — Production and release readiness (P2)

Before public launch, complete a threat model and review actual target jurisdictions and distribution channels. Do not guess legal requirements. Obtain qualified review for privacy policy, terms/EULA, consent, deletion, subscriptions, app-store rules, open-source licenses, and intellectual-property concerns.

Operational readiness includes:

- production deployment topology and environment separation;
- secret management and rotation procedures;
- least-privilege database/service accounts;
- encrypted backups and restore exercises;
- health/readiness checks without public sensitive diagnostics;
- structured logs with redaction, useful audit events, and retention limits;
- monitoring for auth abuse, device revocation, failed enforcement, migration errors, and provider outages;
- incident response and user notification procedures;
- dependency, container, and secret scanning;
- rollback and migration recovery plan;
- supported OS/agent-version matrix and signed agent release artifacts.

## 13. Verification package for every chunk

Each chunk's review record includes:

1. User outcome and risk addressed.
2. Baseline commit and relevant files/routes/data model.
3. Preconditions and migration/compatibility impact.
4. Acceptance criteria written before implementation.
5. Automated tests for expected, boundary, authorization, and failure behavior.
6. Real API/browser/agent/device verification as appropriate.
7. Security and privacy review notes.
8. Known limitations and rollback method.
9. Explicit status: `not started`, `in progress`, `blocked`, or `complete`.

Mark a chunk `complete` only when every acceptance criterion has evidence. A passing build is not proof of secure authorization, process termination, device support, or user experience.

## 14. Recommended first hardening sequence

1. Review and preserve dirty-tree work; create a verified baseline.
2. Fix AI identity derivation and audit other principal-to-service paths.
3. Remove production secret defaults; tighten CORS and actuator exposure; add rate limits and security headers.
4. Review every authenticated route for ownership and cross-user behavior.
5. Put process termination behind a disabled-by-default development gate or remove the exposed operation until the agent protocol is safe. Do not present it as production capability yet.
6. Correct misleading analytics and device status; remove invented values.
7. Define and verify session timing, early completion, pause, expiry, and planned break behavior.
8. Specify pairing, capabilities, command lifecycle, local protections, offline behavior, and privacy before cross-device enforcement.
9. Verify one Linux device end to end in dry-run, then with explicit user opt-in and reviewed safety gates.
10. Expand to Windows and Android only through capability-specific implementation and verification; never claim parity from shared UI alone.

## 15. Release-blocking questions

- Which platforms and jurisdictions are in the first public release?
- Does SHINPO run locally, remotely, or both, and where does each agent connect?
- Is enforcement opt-in per device, per session, or both? What is the emergency override?
- What is the offline policy and maximum enforcement lease?
- Which process metadata is necessary, and how long is it retained?
- Is early focus-session completion allowed, and how are partial sessions represented in XP and analytics?
- What are the acceptance thresholds for authentication, accessibility, recovery, and agent verification?

Until these are answered and P0 gates pass, describe device enforcement and cross-device control as experimental work, not dependable product capabilities.
