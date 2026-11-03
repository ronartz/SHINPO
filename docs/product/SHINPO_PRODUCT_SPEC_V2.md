# SHINPO Product Specification V2

**Status:** Owner-approved scope; implementation and release acceptance incomplete.  
**Platforms:** Windows and Linux desktop, with Chrome, Chromium, Edge, and Firefox Browser Companion.  
**Excluded this cycle:** Android and iOS.

## Product contract

SHINPO helps an individual turn goals into scheduled tasks, protect focused work, review actual progress, and build consistency. The desktop app, Sentinel Shield, backend, and Browser Companion are one release. The browser extension is mandatory, not an optional add-on. SHINPO remains a productivity product; Fernly is a visual reference only and does not authorize team-collaboration features.

## Governing decisions

- Preserve React, TypeScript, Vite, Tauri v2, and the local Rust/SQLCipher authority. Spring Boot/PostgreSQL remain legacy transition code, not a required desktop runtime.
- Preserve EONPAI and its authorized real tool actions, the locally persisted XP ledger, the Fernly-inspired desktop visual direction, and the approved sidebar collapse behavior.
- Focus sounds and audio-based rewards are removed.
- The Rust vault is authoritative for persisted session lifecycle, phase deadlines, policy revision, reward ledger, and penalty idempotency. The extension consumes the local policy lease and never owns a drifting timer or decides penalties.
- Guardian recognizes bundled distraction categories without user-maintained blocklists. Its browser domain catalog is versioned independently from the application catalog (`guardian-domains-v1`, `guardian-apps-v1`). Light (`GUIDED`) warns on known blocked sites and leaves ordinary browsing available; Standard (`PROTECTED`) restricts known blocked sites and reports unclassified destinations as uncertain; Strict (`STRICT`) restricts destinations outside the trusted catalog and explicit approvals. Local application observation requires per-session consent and stays warning-only until executable identity and closure safety are qualified. User exceptions are optional; disconnected services are reported as degraded.
- Do not claim store publication without store approval, or platform/release qualification without actual packaged installation and runtime evidence.

## Focus, break, and return lifecycle

Required journey: **30 minutes Focus → 15-minute break → 10-minute grace → return required at 25 minutes → resume for 30 minutes Focus.** A 60-minute Focus duration means 60 minutes of total verified work across two blocks; break and grace are additional and never count as work. An explicitly enabled late-return XP penalty may apply at Return Required. The persisted Rust lifecycle represents `FOCUS`, `BREAK`, `GRACE`, and `RETURN_REQUIRED`, plus `PAUSED`, `COMPLETED`, `CANCELLED`, and recoverable interruption. Browser policy uses the persisted phase, timestamps/deadlines, session ID, and revision.

- Focus accrues verified active work only. Pause/resume and process restart must not invent elapsed work.
- During the normal break, only resources explicitly approved for that break are permitted. A break-only approval expires at the persisted cutoff; the site policy then restricts it again until Focus ends.
- At 15 minutes, transition to a visible 10-minute grace warning. Returning early resumes Focus without penalty.
- At 25 minutes, an opted-in midpoint session persists one overdue event and applies its configured penalty exactly once, capped by the configured daily limit and available XP. Defaults are −5 XP per overdue break and −20 XP/day. Existing sessions and sessions without opt-in never incur this penalty.
- Never penalize solely because of network loss, stale client state, clock skew, or computer suspension. Do not claim a process was closed unless the OS confirms it. Never terminate a browser or non-enrolled process.
- Extension restart/reconnect obtains a fresh policy from the local native host. If the lease expires offline, it reports degraded status, keeps only cached explicit restrictions, marks other destinations uncertain, and claims no active synchronization. It never invents a phase.

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
