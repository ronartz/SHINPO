# SHINPO Master Blueprint

**Authority:** Product intent and target architecture. Current code truth is in [SHINPO_IMPLEMENTATION_STATUS.md](SHINPO_IMPLEMENTATION_STATUS.md); requirement statuses are in [SHINPO_PRODUCT_REQUIREMENTS.md](SHINPO_PRODUCT_REQUIREMENTS.md); UI issues are in [SHINPO_UI_UX_DEFECT_REGISTER.md](SHINPO_UI_UX_DEFECT_REGISTER.md).

**Audit baseline:** source, tests, and schema inspected 2026-10-02. The screenshot/video binaries were not available in this workspace and no browser page was shared. User-described observations are recorded as reports and require manual visual verification.

## Product Definition

SHINPO is a cross-device personal execution operating system connecting long-term goals to actual daily execution. It is not merely a task manager, habit tracker, Pomodoro timer, application blocker, or AI chatbot. It helps a person choose meaningful work, act on it, protect attention safely, understand the result, and adapt the next plan.

`GOAL -> OBJECTIVE -> TASK / MISSION -> SCHEDULE -> FOCUS SESSION -> FOCUS PROTECTION -> EXECUTION -> RESULT -> PROGRESS -> ANALYTICS -> ADAPTATION -> NEXT ACTION`

Meaningful execution matters more than vanity metrics. Unknown or insufficient data stays unknown rather than being presented as success.

## Product Principles and Language

- The user remains the decision-maker. SHINPO must be transparent, bounded, and recoverable.
- Focus Protection is contextual, never a universal blacklist. Activity identity alone does not prove distraction.
- AI assists and proposes; authoritative services perform authorized state changes, with explicit approval where consequential.
- Core planning/execution remains available when AI is unavailable.
- Privacy, data minimization, authentication, ownership, auditability, accessibility, and failure handling are first-class requirements.
- Every metric needs a documented definition, population, denominator, time window, timezone, and evidence source.

Prefer **Overview, Plan, Objectives, Tasks, Schedule, Focus, Focus Session, Focus Protection, Progress, Consistency, Milestones, Work Board, Insights, Analytics, Reviews, Recovery Plan, Assistant, Settings**. “Mission” may remain where it maps to the current domain model. “Sentinel”, “EONPAI”, and “SYSTEM: ARISE” may remain technical/internal names but should not dominate ordinary UI. Avoid theatrical military, fantasy-game, cyberpunk-HUD, and generic AI-dashboard language.

“Plan Objective” is now the goal action; backend entity names remain Goal and Mission. The current UI still exposes labels such as “Dashboard”, “Task Manager”, “EONPAI”, “Temporal Focus Sprint”, and tactical/system language.

## Execution Model

Goals provide direction; objectives define outcomes; tasks/missions define actionable work. Planning may use deterministic estimation and AI-assisted decomposition, but the user owns the final plan. Preserve scheduling, Focus Sessions, debrief/review, progress, and next-action capability.

The backend currently models `SCHEDULED`, `ACTIVE`, `PAUSED`, `COMPLETED`, `CANCELLED`, `EXPIRED`, and `FAILED`. `READY`, `BREAK`, and `RECOVERY` are product concepts, not current `FocusSessionStatus` values. The target user-facing lifecycle is `SCHEDULED -> READY -> ACTIVE <-> PAUSED -> COMPLETED`, with explicit break/recovery transitions when implemented. The focus timer is separate from a live wall clock. Timer persistence, pause accounting, tab throttling, restart/reconnect, and desktop behavior require end-to-end verification.

Preserve focus-pattern plans with focus/short-break/long-break intervals, allowed entertainment during breaks, protection resuming at interval boundaries, Recovery Mode, missed-session handling, and adaptive schedule repair. Session interval records exist, but a complete interval runner and persisted Recovery Mode are not verified.

## Daily Quote and Current Time

The sidebar currently shows the permanent “Start Your / Day Be / Productive” slogan and a separate dynamic-message card below it. Replace the slogan region with one concise professional quote for the **current local day**. It must be stable across rerenders and restarts; app restart must reload the correct quote for today's local date, not advance it randomly; a local-day change must load that day's quote. Do not rotate on a timer or let the quote overpower execution information. The current helper uses UTC-derived date text and rotates on new session/tab and manual refresh, so it does not meet the target lifecycle.

The Overview must show the live local wall clock and date, update without reload, and roll over at midnight. This is not a Focus Session timer. Current source contains a one-second session-timer ticker but no live Overview clock. Store timestamps as UTC instants; represent date-only selections as local dates; render using one user-local timezone policy. Current code mixes UTC-derived date strings, local formatting, and UTC construction of scheduled timestamps.

## Focus Protection and Enforcement

### Contextual model

Required target decision and enforcement order:

`ACTIVITY DETECTED -> ACTIVITY IDENTITY VALIDATED -> CURRENT FOCUS CONTEXT -> OBJECTIVE/TASK CONTEXT -> USER POLICY -> EXCEPTIONS -> BREAK/RECOVERY STATE -> SAFETY/PROTECTED PROCESS CHECK -> WARNING -> OPTIONAL GRACE PERIOD (MAX 20 MINUTES) -> OS-LEVEL ENFORCEMENT -> VERIFICATION -> AUDIT`

Discord, Spotify, Steam, Reddit, YouTube, VLC, Chrome, Firefox, and similar tools are not inherently distractions. The same service can support work in one context and interrupt it in another. Music/audio and screen recording are not distractions by category. Current process-name rules and defaults do not meet this model.

### Warning, grace, and desktop surface

Use the ordered target pipeline above. The warning is a professional SHINPO desktop experience and precedes any enforcement action; grace is optional only where policy permits and may never exceed 20 minutes.

Explain detected activity, intervention reason, current session/objective/task, remaining grace, and choices. User-selectable grace is capped at **20 minutes**. A future Tauri/native SHINPO warning surface needs countdown, explanation, keyboard access, focus trapping, reduced motion, clear transitions, and safe fallback. Warning UX and grace flow are not verified as implemented.

### Safety and browser activity

The supplied video is described as showing Sentinel terminating OBS while SHINPO was being recorded. The visual was unavailable, but source corroborates serious risk: `obs` is in Rust and Java fallback distraction lists, and automatic termination is wired to process-name/pattern matching. Fixed protected-name lists are not adequate.

Target protection includes SHINPO, shell, OS-critical processes, input/accessibility/security tools, screen recording, user-protected apps, and configured development/debugging tools. Do not hardcode a final list without policy justification. Immediately validate device, PID and process start time, executable identity, OS user/session, policy version, and safety exclusions. Distinguish requested, signal-sent, exit-confirmed, rejected, stale, unsupported, and failed outcomes. The target retains actual OS-level enforcement when the validated contextual decision and user policy require it; verification and audit are mandatory. The migration replaces unsafe name-only action with safe, contextual, verified enforcement, not removal of enforcement. Current termination paths must not be represented as safe until those controls are verified.

Browser/web activity is a future first-class detection, classification, and enforcement surface. Installed-process monitoring cannot distinguish technical learning/project work from unrelated browsing. Browser classification, privacy boundaries, exceptions, warning UX, browser-agent capabilities, and safe OS/browser enforcement remain migration work.

### Task Manager

The primary concept should be **Focus Protection**: state, current session, detected activity, decision, and reason. Raw process tables, emergency override, sweeps, rules, and tamper feeds belong in an authorized advanced surface. Preserve underlying capability; simplify its presentation. Process data must come from the paired user's device, not imply a backend-host snapshot is their device.

## Planning, Reviews, and AI

Preserve Guide, Planner, Coach, Tutor, Recovery Assistant, Scheduler, Analyst, and Companion roles, with conversational, guided, contextual, planning, execution, recovery, tutor, and command-center modes. The Assistant should be concise, professional, contextual, useful, action-oriented as appropriate, and honest about access. Avoid repeated capability lists, theatrical narration, and false claims of continuous monitoring.

Distinguish informational response, recommendation, suggestion, user-approved action, and system status. Require structured output, narrow tools, principal-derived identity, independent service authorization, prompt-injection defenses, provider abstraction, rate limiting, privacy, auditability, and AI silence when unnecessary. Tool output never grants authority.

Preserve deterministic task estimation, execution profiles, adaptive scheduling, daily planning, briefing, reviews/debriefs, and recovery planning. Code concepts alone do not establish a complete user-approved feedback loop.

## Cross-Device Direction

Target tiers: **Tier 1: Linux, Windows, Android. Later: macOS, iOS.** This is strategy, not implemented platform support. Define device agents, pairing/device authentication, policy sync/expiry, offline behavior, telemetry, conflicts, revocation, and enforcement-state reconciliation. Current code includes a desktop/Tauri path, Rust OS adapters, a Python daemon, and central backend; a mature device registry and cross-device policy protocol are not established.

## Overview, Analytics, and UI Direction

Overview priority: current date/time; current Objective; Next Action; active Focus Session; Focus Protection; Today’s Plan; progress; then supporting analytics/activity. Answer “What am I doing now?” without hiding useful data.

Analytics must define measured versus planned focus time, completion denominator, window, timezone, cancelled/expired treatment, quality scale, streak rules, consistency, planned versus completed, and low-data threshold. Show empty/insufficient/loading/error states distinctly. Do not fabricate a `5.0` score, streak, or completion rate; avoid stars without a meaningful documented metric. Current service and UI have a mission/session denominator mismatch, planned-duration focus minutes, and placeholder quality/streak values.

Preserve dark/light themes, Coral identity, considered glass surfaces, useful bento layouts, readable type, spacing, responsive design, restrained cinematic motion, transitions, interaction feedback, reduced motion, accessibility, and honest states. Light mode requires its own contrast/surface audit, not inversion. A reusable SHINPO date picker needs theme support, month navigation, selected date, Today/Clear where relevant, keyboard/accessibility, local-date semantics, and responsive placement; current forms use native date controls.

## Documentation Governance

Truth order: source code, tests, current schema, current project/reference files, accessible visual evidence, current implementation docs, history. Disagreements must state **DOCUMENTATION CLAIM / ACTUAL IMPLEMENTATION / STATUS: CONTRADICTION / REQUIRES RECONCILIATION**. This blueprint defines target behavior, not implementation certification. [README.md](README.md) classifies other document sets.
