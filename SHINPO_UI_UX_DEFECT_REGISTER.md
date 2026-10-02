# SHINPO UI/UX Defect Register

Audit baseline: source and repository docs inspected 2026-10-02. The supplied screenshot/video assets are not accessible in this workspace, and no browser page is shared. Items labeled **User-reported; visual check pending** preserve the supplied descriptions without claiming independent visual inspection. Priorities: P0 safety/destructive behavior; P1 functional/data correctness; P2 usability/information architecture; P3 visual polish.

## P0 — Safety and Destructive Behavior

| ID | Defect | Evidence and impact | Status |
|---|---|---|---|
| UI-P0-001 | OBS may be treated as a distraction and terminated while recording SHINPO. | User-described video reports “Sentinel Neutralized: obs” and PID termination during screen recording. Source corroborates: `obs` appears in Rust fallback and Java Sentinel defaults, with automatic process termination paths. | Source risk verified; incident video unavailable; manual incident verification required. |
| UI-P0-002 | Process identity and protection are insufficient for automatic termination. | Rust matching is largely process-name/pattern based and termination targets PID; no immediate PID start-time/executable/device revalidation is evident. Static protected names cannot cover recording/accessibility/security/user-approved tools reliably. | Source verified; release-blocking safety gap. |
| UI-P0-003 | Primary Task Manager exposes potentially destructive process controls without a clear contextual safety explanation. | Source exposes process table and terminate control; service targets backend-host processes. User-described screen lists “Sweep Distractions”, “Block App”, emergency override, and terminate actions. | Source verified for controls; screenshot-specific presentation pending visual review. |

## P1 — Functional and Data Correctness

| ID | Defect | Evidence and impact | Status |
|---|---|---|---|
| UI-P1-001 | Completion-rate percentage and caption use different populations. | Backend returns completed missions / total missions; UI labels it completion rate but captions completed / started sessions. The percentage can contradict its own caption. User-described screenshot: 25%, “4 completed of 5 sessions”. | Source verified; screenshot value itself not independently inspected. |
| UI-P1-002 | Analytics fabricates quality, streak, and empty-state success. | Service defaults quality to 4.8, streak to 3 for any completed session, and completion to 100% with no missions; UI defaults to 5.0 and 3 days. Misleads user and could affect planning. | Source verified. |
| UI-P1-003 | Focus-time total counts planned duration, not measured active time. | `AnalyticsService` adds `durationMinutes`; pauses/actual active seconds are not used for this aggregate. | Source verified. |
| UI-P1-004 | Session countdown diverges after pause. | Frontend subtracts elapsed wall time from `startedAt` without applying accumulated pauses; PAUSED path returns full planned duration. Backend tracks pause time, so UI can be contradictory. | Source verified. |
| UI-P1-005 | Overview lacks live local current time/date. | No live wall-clock state found; only session timer ticker exists. A session countdown cannot answer current time. | Source verified. |
| UI-P1-006 | Local date/time selection can shift across timezone boundaries. | Frontend uses UTC ISO date extraction for date inputs and creates scheduled timestamps using a `Z` suffix; analytics compares UTC dates with server-local dates. | Source verified; timezone regression coverage absent. |
| UI-P1-007 | Task Manager resource metrics and machine identity can be misleading. | `TaskManagerService` enumerates the backend host; per-process CPU/memory values are estimates. UI can suggest these reflect the user's actual device and measurements. | Source verified. |
| UI-P1-008 | Focus/break/recovery state vocabulary is not coherent end-to-end. | Backend status enum lacks READY/BREAK/RECOVERY; session plans have break interval types, but a complete interval runner is unverified. Timer/UI may imply a continuous session without a break transition. | Source verified; user-facing manifestation needs runtime check. |
| UI-P1-009 | Analytics low/no-data states do not distinguish insufficient evidence. | UI and service contain `100%`, `5.0`, `3-Day` defaults rather than a clear no-data state. Sparse charts/empty data also require explicit state design. | Source verified for placeholders; charts need visual verification. |
| UI-P1-010 | Bulk cleanup parity is incomplete. | Goals and missions have user-scoped bulk actions; Focus Sessions only single-delete; conversation clear archives active conversation but does not delete all history; no general notification/activity clear route found. | Source verified. |

## P2 — UX and Information Architecture

| ID | Defect | Evidence and impact | Status |
|---|---|---|---|
| UI-P2-001 | Sidebar slogan occupies the intended daily quote region. | Literal “Start Your / Day Be / Productive” remains in `App.tsx`; a separate rotating message exists below. Quote helper uses UTC day/session/manual rotation, conflicting with stable local-day requirement. | Source verified. |
| UI-P2-002 | Focus Session scheduling modal uses over-technical terminology. | Source labels include “Book Temporal Focus Sprint”, “Target Mission”, “Sprint Title / Name”, “Execution Intention / Boundary”, and “Execution Protocol Plan”. It obscures basic task/name/date/time/pattern/duration choices. | Source verified; exact screenshot appearance pending. |
| UI-P2-003 | Navigation and enforcement surfaces foreground internal/administrative language. | Source nav includes Dashboard, Task Manager, EONPAI; UI copy includes tactical/sprint/Sentinel terminology. User-described Task Manager exposes CPU/memory/process, override, sweep, blacklist, audit feed and policy gate. | Source verified for labels/controls; screenshot layout pending. |
| UI-P2-004 | Assistant responses were reported as repetitive and theatrical. | User-described video quotes “I am continuously monitoring your execution loop...” and repeated capability lists after simple messages. This undermines trust if the claim exceeds actual observation. | User-reported; source/video reproduction unavailable; manual conversation test required. |
| UI-P2-005 | Overview has competing telemetry and action concepts. | Current app is a broad cockpit with dashboard, analytics, AI, Task Manager and Sentinel controls. User requirement prioritizes current time/objective/next action/session/protection/today plan. | Source and stated target indicate hierarchy gap; visual assessment pending. |
| UI-P2-006 | Native browser date/time controls break reusable product date selection. | Goal/mission/session surfaces use native `input[type=date]` and `input[type=time]`; browser picker styling/keyboard behavior varies and date semantics are inconsistent. | Source verified; supplied native picker screenshot unavailable. |
| UI-P2-007 | Bulk action wording and scope must remain collection-specific. | Existing “Delete All Goals” and “Clear All Missions” are scoped; other collections lack parity. Avoid one generic delete control or a scope-ambiguous label. | Source verified. |
| UI-P2-008 | Completed mission readability/state needs visual verification. | Status/filter logic exists. User requirement explicitly asks completed missions remain readable with clear completed state, but supplied Goals/Missions screenshot cannot be inspected here. | Visual verification required; no unobserved defect asserted. |

## P3 — Visual Polish (Verification Pending)

No specific screenshot-only visual defect is asserted without access to the supplied images. The following are explicit audit checks, not claims that a defect was independently observed:

| ID | Review item | Evidence / next verification |
|---|---|---|
| UI-P3-001 | Light-mode surfaces, borders, semantic colors, metadata contrast, accent and shadows. | CSS contains light-theme rules; perform separate visual and contrast review. |
| UI-P3-002 | Spacing, typography, card hierarchy and information density across Overview, Goals, Calendar, Analytics and Task Manager. | Product requirement and user-described screens identify these surfaces; screenshots not accessible. |
| UI-P3-003 | Motion, opening/tab transitions, interaction feedback, reduced-motion behavior. | CSS includes motion/reduced-motion patterns; verify in browser at normal and reduced-motion settings. |
| UI-P3-004 | Responsive layouts and non-overlapping text/controls. | Source has responsive CSS; verify desktop/mobile screenshots and keyboard workflows. |
| UI-P3-005 | Color balance and Coral identity without excessive glow or theatrical HUD treatment. | Existing CSS/design intent should be compared against supplied visual target when available. |

## Evidence and Follow-Up

Source evidence includes `frontend/src/App.tsx`, `frontend/src/utils/shinpoMessages.ts`, `backend/src/main/java/com/shinpo/service/AnalyticsService.java`, `backend/src/main/java/com/shinpo/service/TaskManagerService.java`, `backend/src/main/java/com/shinpo/service/SentinelEnforcementService.java`, `crates/shinpo-shield/src/config.rs`, and `crates/shinpo-shield/src/enforcer.rs`.

Before resolving visual-only items, manually review the actual Goals/Missions, scheduling modal, Assistant, Calendar, Dashboard, Task Manager, Analytics, enforcement video, sidebar, date/time, and light/dark evidence. Until supplied assets are available, do not convert user descriptions into verified visual findings.
