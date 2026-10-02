# SHINPO Product Requirements

Stable requirement IDs and repository-grounded status, inspected 2026-10-02. **IMPLEMENTED** means the bounded behavior is verified end-to-end; **PARTIAL** means some implementation exists but required behavior or verification is missing; **PLANNED** means target behavior is not implemented/verified; **UNKNOWN** means evidence is insufficient; **SUPERSEDED** means an older approach has been replaced. See [implementation evidence](SHINPO_IMPLEMENTATION_STATUS.md), [architecture](SHINPO_ARCHITECTURE.md), and [defect register](SHINPO_UI_UX_DEFECT_REGISTER.md).

Screenshots/video were described by the user but not accessible as files or shared browser pages in this session. Those reports are labeled and need manual visual confirmation.

## Core and Planning

| ID | Requirement | Status | Evidence / gap |
|---|---|---|---|
| PR-CORE-001 | Cross-device personal execution OS connecting long-term goals to actual daily execution; meaningful execution over vanity metrics. | PARTIAL | Goals, tasks, schedules, sessions and analytics exist; complete adaptive loop and cross-device product do not. |
| PR-CORE-002 | Preserve Goal -> Objective -> Task/Mission -> Schedule -> Focus Session -> Protection -> Result -> Progress -> Analytics -> Adaptation -> Next Action. | PARTIAL | Several components exist; end-to-end loop not verified. |
| PR-PLAN-001 | User-scoped goal and mission CRUD. | IMPLEMENTED | Goal/Mission controllers and services, ownership checks, backend tests. |
| PR-PLAN-002 | Schedule sessions against tasks/objectives and inspect agenda. | PARTIAL | APIs and calendar surface exist; form UX and timezone behavior are defective. |
| PR-PLAN-003 | Deterministic estimation and adaptive scheduling use observed execution evidence and user approval. | PARTIAL | Execution profile/adaptive-planning code/tests exist; full approved feedback loop unverified. |
| PR-PLAN-004 | Reviews/debriefs and next actions support non-shaming adaptation. | PARTIAL | Debrief/recovery services exist; complete user flow unverified. |

## Focus Sessions and Time

| ID | Requirement | Status | Evidence / gap |
|---|---|---|---|
| PR-FOCUS-001 | Create, schedule, start, pause, resume, complete, cancel, expire and retrieve sessions with ownership checks. | IMPLEMENTED | `FocusSessionService`, controller, tests; states include FAILED too. |
| PR-FOCUS-002 | Accurate elapsed/remaining timer accounts for pauses. | PARTIAL | UI subtracts raw time since `startedAt`, ignores pause accumulation, and paused display returns full duration. Backend tracks pause time. |
| PR-FOCUS-003 | Timer stays coherent across rerenders, background tabs, restart, desktop, reconnect, and clients. | PARTIAL | Local ticker and WebSocket events exist; server-authoritative rehydration/platform behavior unverified. |
| PR-FOCUS-004 | Focus patterns run explicit focus/break states and define protection at each boundary. | PARTIAL | Plan intervals include FOCUS/SHORT_BREAK/LONG_BREAK; no BREAK status or complete interval runner verified. |
| PR-FOCUS-005 | Recovery Mode covers missed sessions, interruption recovery, user-approved plan, and adaptive reschedule. | PARTIAL | AI recovery/debrief exists; persisted mode and complete UX/policy transitions unverified. |
| PR-TIME-001 | Live local wall clock/date on Overview, continuous update and midnight rollover. | PLANNED | No live Overview clock found; focus timer ticker is distinct. |
| PR-TIME-002 | Separate wall clock from session timer. | PARTIAL | Session countdown exists; wall clock absent. |
| PR-TIME-003 | Date-only values preserve local dates; UTC instants render in a consistent user timezone. | PARTIAL | UI mixes UTC ISO extraction, UTC timestamp construction, local formatting, and server UTC analytics boundaries. |
| PR-TIME-004 | Consistent local-time policy across dashboard, goals, tasks, calendar, focus, activity, assistant, alerts, desktop. | PLANNED | No common policy/helper verified. |
| PR-QUOTE-001 | One concise daily quote, stable during local day/restart/rerender, changed at local midnight; no timed rotation. | PARTIAL | Helper exists but uses UTC date and rotates on new session/tab and manual refresh. |
| PR-QUOTE-002 | Replace sidebar’s “Start Your / Day Be / Productive” slogan region with daily quote. | PLANNED | Slogan remains; dynamic message occupies another region. |

## UX and Presentation

| ID | Requirement | Status | Evidence / gap |
|---|---|---|---|
| PR-UX-001 | Professional user language; internal terms remain secondary. | PARTIAL | “Plan Objective” is present; tactical/temporal labels and EONPAI/Sentinel navigation remain. |
| PR-UX-002 | Schedule form uses Task/Objective, Session Name, Date, Start Time, Focus Pattern, Duration; Cancel/Schedule Session. | PLANNED | Current modal says “Book Temporal Focus Sprint”, “Target Mission”, “Sprint Title / Name”, “Execution Protocol Plan”. |
| PR-UX-003 | Overview prioritizes time, current objective, next action, session, protection, today plan, progress, supporting data. | PARTIAL | Dashboard exists; current hierarchy/cockpit remains crowded. |
| PR-UX-004 | Completed tasks stay readable and clearly completed. | PARTIAL | Mission status/filter exists; supplied visual not accessible for independent review. |
| PR-UX-005 | Reusable SHINPO date picker: themes, month nav, selected date, Today/Clear, keyboard/accessibility, local dates, responsive. | PLANNED | Native `input[type=date]` used. |
| PR-UX-006 | Accessible dark/light design with Coral accent and separate light-mode treatment. | PARTIAL | Theme styles exist; separate contrast/usability audit absent. |
| PR-UX-007 | Responsive, keyboard/assistive-tech support, focus visibility, reduced motion, honest loading/empty/error states. | PARTIAL | Some ARIA/reduced-motion/responsive patterns exist; no full validation. |
| PR-UX-008 | Restrained, purposeful motion with reduced-motion support. | PARTIAL | CSS motion and reduced-motion rules exist; product-wide verification absent. |
| PR-UX-009 | Assistant is concise, contextual, professional, useful, and honest about observation/access. | PARTIAL | AI/silence paths exist; repetitive/theatrical replies were reported from inaccessible supplied media. |
| PR-UX-010 | Distinguish loading, empty, insufficient-data, offline, and error states; do not fabricate. | PARTIAL | Some states exist; Analytics defaults are fabricated. |

## Analytics and Data Truth

| ID | Requirement | Status | Evidence / gap |
|---|---|---|---|
| PR-AN-001 | Completion-rate value and caption share the same metric, population, denominator, window, timezone. | PARTIAL | Backend percentage is completed missions / total missions; UI caption is completed / started sessions. |
| PR-AN-002 | Focus time is measured active time or explicitly labeled planned duration. | PARTIAL | Service sums planned `durationMinutes`. |
| PR-AN-003 | Quality, streak, velocity, consistency, progress have meaningful documented definitions. | PARTIAL | Backend defaults quality to 4.8 and streak to 3 when any session completed; UI defaults to 5.0/3 days. |
| PR-AN-004 | Low/no data uses honest empty/insufficient state, never perfect success. | PLANNED | UI defaults to 100%, 5.0, 3 days; service returns 100% with no missions and 4.8 quality. |
| PR-AN-005 | Seven-day velocity uses user-local days and defined inclusion rules. | PARTIAL | Server `LocalDate.now()` compared to UTC session date; user timezone is not established. |

## Focus Protection and Safety

| ID | Requirement | Status | Evidence / gap |
|---|---|---|---|
| PR-ENF-001 | Evaluate local activity during an authorized active session. | IMPLEMENTED | Java Sentinel/Rust process scans and policies exist; process-pattern based. |
| PR-ENF-002 | Contextual decision includes session, objective, task, policy, exceptions, break/recovery, activity identity, safety. | PARTIAL | Rules, active-session checks, allow/protected patterns exist; no complete contextual engine. |
| PR-ENF-003 | App/site identity alone is insufficient; music/audio and screen recording are not inherently distracting. | PLANNED | Defaults include Spotify/OBS; OBS termination was reported by user. |
| PR-ENF-004 | Protect SHINPO, OS-critical, accessibility/security/input, recording, and user-protected apps. | PARTIAL | Static names exist, but robust identity/configurable categories do not. |
| PR-ENF-005 | Validate device, PID+start time, executable, OS user/session, policy version, safety before termination. | PLANNED | Current paths match patterns and terminate by PID; immediate identity validation not evidenced. |
| PR-ENF-006 | Native warning explains detection, reason, current session/task, grace countdown, actions. | PLANNED | Complete warning overlay not found. |
| PR-ENF-007 | User-selectable grace capped at 20 minutes. | PLANNED | No verified grace setting/countdown. |
| PR-ENF-008 | Verify result and audit requested/sent/confirmed/rejected/stale/failed. | PARTIAL | Quarantine/tamper records exist; target outcome verification and distinct action contract incomplete. |
| PR-ENF-009 | Scoped exceptions, allow rules and emergency override are explainable/authorized/audited. | PARTIAL | Allow patterns, override endpoint and tamper events exist; complete safe UX/device scope needs verification. |
| PR-ENF-010 | Browser activity is a privacy-bounded enforcement surface. | PLANNED | No browser site classifier/agent found. |
| PR-ENF-011 | Task Manager primary UX communicates Focus Protection; advanced controls are appropriately gated. | PARTIAL | Raw table and termination exist; backend-host process scope and synthetic metrics mislead. |

## Bulk Cleanup and History

| ID | Requirement | Status | Evidence / gap |
|---|---|---|---|
| PR-DEL-001 | Bulk goal delete is user-scoped, count-confirmed, explains linked missions/permanence, updates UI correctly. | IMPLEMENTED | `/api/goals/all`, service deletes linked missions, UI confirmation/error handling and regression test. |
| PR-DEL-002 | Bulk mission clear is user-scoped, preserves goals, count-confirmed, handles errors. | IMPLEMENTED | `/api/missions/all`, service, UI confirmation/error handling and regression test. |
| PR-DEL-003 | Appropriate cleanup for sessions, conversation history, activity/history, notifications, other deletable collections. | PARTIAL | Single-session delete only; assistant clear archives active conversation and creates a new one; no general history/notification bulk route found. |
| PR-DEL-004 | Each bulk action states scope/count/dependencies/permanence and enforces authorization/audit. | PARTIAL | Goals/missions explain scope/count/permanence; other collections absent and audit coverage not universal. |

## AI, Realtime, Security, and Platforms

| ID | Requirement | Status | Evidence / gap |
|---|---|---|---|
| PR-AI-001 | Preserve Guide, Planner, Coach, Tutor, Recovery Assistant, Scheduler, Analyst, Companion and modes. | PARTIAL | Gateway planning/recovery/briefing/profile exists; not all are distinct verified modes. |
| PR-AI-002 | Structured output, narrow tools, principal identity, service authorization, approval for consequential mutations, prompt defense. | PARTIAL | Principal-bound chat and tool registry exist, including mutating/operational tools; complete per-tool approval/security audit needed. |
| PR-AI-003 | Provider abstraction and useful application behavior when AI unavailable. | PARTIAL | Registry/fallback exist; app-wide resilience unverified. |
| PR-AI-004 | User-triggered, private, rate-limited, auditable AI; untrusted user content. | PARTIAL | Sanitization/conversation/suggestion records exist; comprehensive retention/rate-limit/privacy posture unverified. |
| PR-RT-001 | Authenticated STOMP/WebSocket carries focus/Sentinel events to UI. | IMPLEMENTED | Backend config/service, frontend client, tests. |
| PR-RT-002 | Offline telemetry spool retries/syncs without corrupting or duplicating audit data. | PARTIAL | JSONL spool and batch flush exist; idempotency/replay/retention not exhaustively verified. |
| PR-PLAT-001 | Tauri v2 starts/stops local Rust Shield integration. | PARTIAL | Commands/thread wiring exist; packaged end-user flow/platform behavior unverified. |
| PR-PLAT-002 | Tier 1 Linux/Windows/Android, later macOS/iOS. | PLANNED | Rust adapters are not platform certification; Android/iOS agent not found. |
| PR-PLAT-003 | Device pairing/auth/revocation, policy sync/expiry, offline conflict and telemetry reconciliation. | PLANNED | Mature device registry/protocol not found. |
| PR-PLAT-004 | Preserve tutorial, command briefing, execution profile, estimation, adaptive scheduling. | PARTIAL | Tutorial, briefing/profile services/tests exist; outcome-linked adaptation incomplete. |
| PR-SEC-001 | Authenticate and scope protected operations to principal-owned records. | PARTIAL | JWT/principal and many checks/tests exist; all routes/tools not certified. |
| PR-SEC-002 | Minimize sensitive data; define retention/deletion, secrets, and consequential-action audit. | PARTIAL | Sanitization and audit foundations exist; complete lifecycle and production hardening absent. |
| PR-DOC-001 | Source > tests > schema > references > accessible visuals > current docs > history; report contradictions. | IMPLEMENTED | Governance applied by this register and document catalog in README. |
| PR-DOC-002 | Universal static app blacklist is the enforcement architecture. | SUPERSEDED | Replaced by contextual policy, exceptions, safety exclusions, and browser-aware target model. |

## Traceability

- **PR-ENF-003/004/005:** target safety boundary -> Rust `config.rs`/`enforcer.rs` and Java Sentinel -> Rust/backend tests; user-reported OBS event needs manual incident/runtime verification.
- **PR-AN-001..005:** metric definitions -> `AnalyticsService.java` -> `AnalyticsDtos.java` -> `/api/analytics/dashboard` -> Analytics card in `frontend/src/App.tsx`; no focused metric-calculation test found.
- **PR-FOCUS-002/003, PR-TIME-001..004:** session/time architecture -> `FocusSessionService.java` and `App.tsx`; lifecycle backend tests exist, but clock/timezone/pause/background behavior lacks end-to-end evidence.
- **PR-DEL-001/002:** principal -> controllers/services -> front-end API/UI -> `ShinpoApplicationTests`; remaining collection parity absent.

Do not promote a feature to IMPLEMENTED based only on a button, route, test name, or historical document.
