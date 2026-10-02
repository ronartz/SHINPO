# Codebase Audit Notes

> **STATUS: HISTORICAL SNAPSHOT / SOURCE CONTRADICTIONS REQUIRE RECONCILIATION.** These files are preserved as discovery notes and may help locate implementation areas. They are not current architecture or implementation authority; some use stale versions/counts and make claims contradicted by source/tests.

Use the root documents instead:

- [SHINPO Master Blueprint](../../SHINPO_MASTER_BLUEPRINT.md) for product intent and target behavior.
- [SHINPO Product Requirements](../../SHINPO_PRODUCT_REQUIREMENTS.md) for requirement IDs/status/traceability.
- [SHINPO Architecture](../../SHINPO_ARCHITECTURE.md) for current and target boundaries.
- [SHINPO Implementation Status](../../SHINPO_IMPLEMENTATION_STATUS.md) for verified source truth and caveats.
- [UI/UX Defect Register](../../SHINPO_UI_UX_DEFECT_REGISTER.md) for prioritized findings.

Known contradictions to keep in mind while using this snapshot:

- AI tooling is not uniformly read-only; inspect each registered tool and its service/approval path.
- Java Sentinel and Rust Shield have process-termination paths; do not describe their current behavior as only graceful containment or as production-safe.
- Rust fallback patterns include OBS and common communication/media applications; the user's reported OBS termination is a P0 safety concern.
- Task Manager process data comes from the backend host, with synthetic per-process resource estimates in `TaskManagerService`.
- Analytics completion rate is mission-based while the UI caption is session-based; quality/streak values include placeholders.
- Test totals/pass labels and feature completion tables are historical snapshots, not current verification results.
- The Python daemon exists alongside Rust/Tauri enforcement; retirement or single-agent deployment is not established.
- Tauri/Rust OS adapters and generated architecture diagrams do not establish packaged product or cross-platform certification.

The root authority documents take precedence whenever these notes disagree with code, tests, or schema.
