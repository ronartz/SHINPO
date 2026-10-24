# SHINPO Product Specification V2

**Status:** Owner-approved scope; implementation and release acceptance incomplete.  
**Platforms:** Windows and Linux desktop, with Chrome, Chromium, Edge, and Firefox Browser Companion.  
**Excluded this cycle:** Android and iOS.

## Product contract

SHINPO helps an individual turn goals into scheduled tasks, protect focused work, review actual progress, and build consistency. The desktop app, Sentinel Shield, backend, and Browser Companion are one release. The browser extension is mandatory, not an optional add-on. SHINPO remains a productivity product; Fernly is a visual reference only and does not authorize team-collaboration features.

## Governing decisions

- Preserve React, TypeScript, Vite, Tauri v2, Rust, Spring Boot, and PostgreSQL.
- Preserve EONPAI and its authorized real tool actions, the server-backed XP ledger, the Fernly-inspired desktop visual direction, and the approved sidebar collapse behavior.
- Focus sounds and audio-based rewards are removed.
- The backend is authoritative for persisted session lifecycle, phase deadlines, policy revision, reward ledger, and penalty idempotency. The extension may display a countdown derived from server timestamps, but must not own a drifting timer or decide penalties.
- Local native enforcement runs only on the user's machine, only for explicitly enrolled distractions, with safe graceful close and truthful outcome reporting. A disconnected Shield or extension is reported as degraded; it is never presented as successful enforcement.
- Do not claim store publication without store approval, or platform/release qualification without actual packaged installation and runtime evidence.

## Focus, break, and return lifecycle

Required journey: **60 minutes Focus → 15-minute break → 10-minute grace → return required at 25 minutes → configured one-time XP penalty and safe enforcement → resume Focus.** The persisted backend lifecycle must represent `FOCUS`, `BREAK`, `GRACE`, and `RETURN_REQUIRED`, plus `PAUSED`, `COMPLETED`, `CANCELLED`, and recoverable interruption as needed. All clients consume the same phase, server timestamps/deadlines, session ID, and policy revision.

- Focus accrues verified active work only. Pause/resume and process restart must not invent elapsed work.
- During the normal break, only resources explicitly marked **Allow only during scheduled breaks** are available. Ordinary study approvals do not become break approvals. Break-only permissions are revoked at the server-provided cutoff and cannot leak into Focus.
- At 15 minutes, transition to a visible 10-minute grace warning. Returning early resumes Focus without penalty.
- At 25 minutes, persist one overdue event and apply the configured penalty exactly once, capped by the configured daily limit and available XP. Default proposal is −5 XP per overdue break, capped at −20 XP/day; values must be configurable, user-enabled, and confirmed against the existing ledger before implementation.
- Never penalize solely because of network loss, stale client state, clock skew, or computer suspension. Do not claim a process was closed unless the OS confirms it. Never terminate a browser or non-enrolled process.
- Extension restart/reconnect obtains a fresh backend policy. If the lease expires offline, it reports degraded status, keeps only cached explicit blocked and break-only destinations restricted, marks other destinations uncertain, and claims no active server synchronization. It never invents a phase or blocks unrelated sites.

## Browser Companion release acceptance

The complete Browser Companion and native messaging host are required in the initial desktop release. Build/installation and real runtime qualification are separate for Chrome, Chromium, Edge, and Firefox on each supported OS. Required behavior: secure pairing, registered host, real connection state, synchronized phase/policy and countdown, Focus website restrictions, approved break access, grace warning, hard-cutoff restrictions, Return to Focus action, reconnect after browser/extension/host restart, and understandable installation/permission instructions. Never collect browsing content beyond what URL policy evaluation requires.

Release workflow to demonstrate with disposable accounts and isolated QA services:

1. Start 60-minute Focus and verify enrolled desktop apps and websites are restricted.
2. Enter the 15-minute break and verify a configured approved site/app is accessible.
3. Cross 15 minutes and verify desktop, backend, Shield, and extension agree on Grace and show the synchronized remaining time.
4. Cross 25 minutes and verify exactly one configured XP ledger deduction, restored web restrictions, safe enrolled-app enforcement, and truthful result reporting.
5. Return to Focus and verify the same session and policies resume consistently.

Exercise boundaries at 14:59, 15:00, during grace, 24:59, and 25:00; restart/reconnect, pause/cancel, backend interruption, suspend/resume, disconnected Shield/extension, and repeated timeout delivery. Do not use owner data or personal PostgreSQL for QA.

## Remaining desktop feature scope

Continue the existing audit and `docs/product/SHINPO_V1_ACCEPTANCE.md` for authentication, Goals/Tasks, Calendar, Analytics/reviews, EONPAI, rewards, Settings, security/privacy, notifications, accessibility, and the existing native shell. Complete only confirmed gaps; preserve working behavior and historical QA evidence. The authorized feature inventory includes projects, subtasks/checklists, recurrence, persisted Kanban ordering/view preference, month calendar, planning/reminders, weekly/monthly reviews, native shortcuts/tray/window recovery, installation/update/rollback, remote backend/PostgreSQL, encrypted backups, and private beta onboarding. Those items remain individually gated in the backlog; their presence in source is not acceptance.

## Acceptance vocabulary

`MISSING`, `PARTIAL`, `DEFECT CONFIRMED`, `IMPLEMENTED UNVERIFIED`, `VERIFIED` (with evidence), `NATIVE VERIFIED`, `OWNER ACCEPTED`, and `RELEASE QUALIFIED` are distinct states. Unit tests and builds alone cannot advance a visual, native, persistence, or release gate.

## Authority and history

This V2 document supersedes conflicting V1 target/scope statements for this cycle. Existing V1 behavior remains useful where not contradicted. Historical evidence remains in [`../qa/SHINPO_SHIP_MATRIX.md`](../qa/SHINPO_SHIP_MATRIX.md); current release qualification is tracked in [`../qa/SHINPO_RELEASE_MATRIX.md`](../qa/SHINPO_RELEASE_MATRIX.md). Implementation order and blockers are in [`../backlog/SHINPO_MASTER_BACKLOG.md`](../backlog/SHINPO_MASTER_BACKLOG.md).
