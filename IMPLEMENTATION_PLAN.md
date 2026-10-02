# SHINPO — Implementation Plan

> STATUS: HISTORICAL / SUPERSEDED
>
> This document preserved older milestone language from an earlier phase of the project. It is retained for historical context only and should not be treated as the current implementation source of truth. See [SHINPO_MASTER_BLUEPRINT.md](SHINPO_MASTER_BLUEPRINT.md), [SHINPO_IMPLEMENTATION_STATUS.md](SHINPO_IMPLEMENTATION_STATUS.md), and [SHINPO_PRODUCT_REQUIREMENTS.md](SHINPO_PRODUCT_REQUIREMENTS.md) for the current product and implementation truth.

The repository still contains substantial implementation work, but the older milestone claims should be reconciled against actual repository evidence before they are used as planning truth.

## Archived milestone claims (not the current plan)

The statuses below preserve an earlier planning snapshot. Some items labeled completed or next are contradicted by current code or later work; none should be used as current implementation evidence. Consult [SHINPO_IMPLEMENTATION_STATUS.md](SHINPO_IMPLEMENTATION_STATUS.md) and [SHINPO_PRODUCT_REQUIREMENTS.md](SHINPO_PRODUCT_REQUIREMENTS.md).

### COMPLETED
- Backend foundation: Spring Boot, PostgreSQL, Flyway, Spring Security
- Core goal, mission, and focus session domain logic
- AI provider abstraction and fallback behavior
- AI context and prompt sanitization
- Tool-based AI access and suggestion approval flow
- STOMP/WebSocket event telemetry
- Rust shield crate and local enforcement loop
- Tauri shell scaffold and native shield thread integration

### IN PROGRESS
- Contextual enforcement beyond default static patterns
- Recovery UX tied to real debrief and interruption data
- Desktop warning surface and user consent flows
- Product-level accessibility validation

### NEXT
- Grace-period warning model with a maximum of 20 minutes
- Browser activity evaluation strategy
- Explicit exception and allowlist policy controls
- Stronger contextual policy evaluation for legitimate vs. distracting activity

### PLANNED
- Full browser-level enforcement and site classification
- Cross-device and cross-platform policy model
- Platform-specific verification for macOS and Windows enforcement paths
- Broader end-to-end product verification across desktop and browser surfaces

### FUTURE
- Full desktop productization with a polished SHINPO-first warning experience
- Broader cloud or multi-device extension beyond the current local-first model
- Advanced adaptive scheduling and personalization based on historical execution patterns

## Historical summary (superseded)

- What is clearly present: goal/missions, focus sessions, AI orchestration, telemetry, Rust shield, desktop shell
- What is clearly partial: contextual browser enforcement, grace-period warning UI, exception UX, product-level accessibility outcomes
- What is required but not yet verified: full browser-based enforcement, polished warning UI, long-term platform support claims

## Decision rule

All future planning should use the codebase and the updated authoritative docs as the source of truth, not the older milestone ledger.