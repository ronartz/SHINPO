# SHINPO — Technical Requirements Document

> STATUS: HISTORICAL / SUPERSEDED
>
> This document represents an earlier architecture baseline and should not be used as implementation truth for the current repository. See [SHINPO_MASTER_BLUEPRINT.md](SHINPO_MASTER_BLUEPRINT.md), [SHINPO_ARCHITECTURE.md](SHINPO_ARCHITECTURE.md), and [SHINPO_IMPLEMENTATION_STATUS.md](SHINPO_IMPLEMENTATION_STATUS.md) for the authoritative current view.

## Preserved product intent (not current implementation evidence)

The original SHINPO vision remains valid: the system is a personal execution operating system designed to connect high-level goals, mission execution, and focus protection. The key direction remains the same, but the repository’s evidence shows that the current product implementation is narrower and more grounded in what is actually present in code.

## Historical requirements worth preserving

- SHINPO is not a generic task manager.
- SHINPO primarily serves the execution loop of goal → mission → schedule → focus session → execution → analysis → adaptation.
- AI should assist rather than bypass it.
- Security and privacy remain first-class concerns.
- Contextual enforcement matters more than a universal blacklist model.
- The user must remain in control of execution policy and approvals.

## Historical architecture view

The older architecture documented a stronger milestone narrative and a more complete “all subsystems complete” story. The live repository does not support that same level of certainty. The current repository evidence is more accurate in the following ways:

- the app layer and backend are real
- the focus session model is real
- the AI and telemetry layers are real
- the desktop shield and Tauri shell are real
- advanced browser-level enforcement and a full grace-period warning experience are not yet verified as implemented

## Use this document only as background

This file should be treated as historical background, not as the source of truth. Future product and implementation decisions should follow the master blueprint and implementation status docs instead.

For the current documentation catalog, see [README.md](README.md).

