# SHINPO Execution Architecture

**Status:** Contract for implementation; integrated behavior is not yet qualified.

## Authority and data flow

```text
React UI ── authenticated API/WebSocket ── Spring Boot ── PostgreSQL
   │                                         │
   ├── Tauri commands ── Sentinel Shield     └── versioned contextual policy
   │                          │                              │
   └── status display         └── local enrolled-app action  └── native host
                                                                  │
                                                        Chrome/Chromium/Edge/
                                                        Firefox extension
```

PostgreSQL and Spring Boot own session identity, phase transitions/deadlines, idempotent reward and penalty events, and policy revisions. Tauri/Rust owns local host integration and operating-system enforcement. The native messaging host authenticates to the backend and supplies a leased policy snapshot to the extension. The extension evaluates navigations and presents restrictions; it does not invent phase transitions, extend a break, or calculate XP.

## Lifecycle and synchronization

The backend transition service must atomically persist phase, transition timestamp/deadline, revision, and any event identity. Session responses, WebSocket events, active policy snapshots, native host cache, and extension UI expose the same session ID, phase, revision, and server timestamps. Clients render remaining time as `max(0, deadline - current time)` and resynchronize on reconnect. They never add elapsed time to a client-owned authoritative counter.

Focus restrictions, break allowlist, grace behavior, and return-required restrictions are server-defined policy states. A lease includes issued/expiry timestamps and policy revision. Stale leases are visibly stale; enforcement outcome is reported separately from desired policy. Offline native actions must follow the explicitly accepted safety policy and cannot create a server XP penalty.

Current source persists `FOCUS`, `SHORT_BREAK`, `LONG_BREAK`, `GRACE`, `RETURN_REQUIRED`, and `COMPLETE`, with a configurable additional grace duration and server-derived deadlines. Resource rules include a session-scoped `breakOnly` flag: only these explicit approvals apply during break/grace, and they become restrictions outside that phase. The extension evaluates the server deadline locally only to revoke break-only access at cutoff; it does not advance backend state. On lease expiry it reports degraded, preserves only known explicit restrictions, treats other destinations as uncertain, and does not claim an active synchronized policy. Focused accelerated backend and extension policy tests pass; native enforcement and connected browser runtime remain unverified.

## Penalty and enforcement integrity

At hard cutoff, one transaction locks/validates the session, confirms server-observed lifecycle eligibility, inserts a unique overdue-break event, applies the configured bounded nonnegative-balance adjustment, advances policy revision, and emits the resulting state. Duplicate scheduler, reconnect, or WebSocket delivery must converge on that same event identity. Suspension/network ambiguity defers penalty until a trustworthy server state can be established. The Shield closes only verified, explicitly enrolled distraction processes gracefully; browser restrictions act per tab/site and never close the browser.

## Compatibility and privacy

- Preserve existing REST DTOs where possible; add versioned fields additively and keep older clients safe/inactive when they cannot interpret an enforcement phase.
- Host pairing secrets stay in OS-appropriate user storage; never log tokens. Browser permissions and the data inspected by URL evaluation are disclosed during setup.
- Do not introduce production credentials or a paid service as part of local implementation. Production hosting, PostgreSQL backup custody, and public distribution require their own authorization and evidence.
- Native messaging manifests/registration are OS- and browser-specific. Chromium-family and Firefox packages may share policy logic but are qualified separately.

## Current implementation anchors

- Backend lifecycle: `backend/src/main/java/com/shinpo/entity/FocusSession.java`, `FocusSessionService.java`.
- Active policy endpoint: `ContextualFocusPolicyService.java`, `ContextualFocusController.java`.
- Native IPC and registration: `crates/shinpo-browser-host/`, `scripts/register-browser-companion.*`.
- Extension evaluation/recovery: `browser-extension/src/lib/policy-engine.js`, `background-core.js`.
- Local process protection: `crates/shinpo-shield/` and Tauri commands in `frontend/src-tauri/`.

## Deployment boundary

Desktop binaries are clients, not standalone service hosts. Friends require an independently reachable HTTPS backend and persistent PostgreSQL, securely managed credentials, migrations, backups/recovery, and account isolation. Native Shield and browser host remain local on each user's machine. Until a real remote backend and installed clients are exercised, remote/private-beta readiness remains unqualified.
