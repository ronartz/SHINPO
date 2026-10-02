# SHINPO — Application Flow

> STATUS: HISTORICAL / SUPERSEDED
>
> This document describes an earlier phase of the product and is kept only as a historical artifact. It is not authoritative for the current implementation. Use [SHINPO_MASTER_BLUEPRINT.md](SHINPO_MASTER_BLUEPRINT.md) and [SHINPO_IMPLEMENTATION_STATUS.md](SHINPO_IMPLEMENTATION_STATUS.md) for current truth.

## Historical view

The product design direction originally emphasized a rich single-page cockpit with goal planning, focus sessions, AI assistance, and process inspection. That direction is still broadly aligned with the current product intent, but it does not represent the final implementation truth.

## Historical flow model (not an end-to-end verification)

The intended product flow is:

- Goal / objective selection
- mission or task breakdown
- schedule creation
- focus session start and enforcement
- result and debrief capture
- analytics and adaptation
- next action recommendation

The older UI flow and exact tab structure are historical and should be interpreted as design material, not current product fact.

## Historical operational description

The sequence below is a historical architectural description, not proof that each transition currently works end-to-end. Use [SHINPO_IMPLEMENTATION_STATUS.md](SHINPO_IMPLEMENTATION_STATUS.md) for evidence-backed implementation status.

1. A user creates or loads a goal and mission.
2. The user schedules one or more focus sessions.
3. The backend validates session state and ownership.
4. An active focus session enables local enforcement checks.
5. The Rust shield or desktop shell can inspect active processes and report findings.
6. The backend logs enforcement and telemetry events.
7. The frontend renders the state and surfaces AI suggestions or summaries.
8. Recovery and debrief information feed back into analytics and the next planning cycle.

## Important distinction

The original flow language often implied a universal app-blocking model. That is not the current documented architecture. The current product direction is contextual focus protection and a planned browser activity model rather than a blanket blacklist model.