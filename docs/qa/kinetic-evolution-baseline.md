# Kinetic Product Evolution — gated baseline

Date: 2026-10-23 (Asia/Kolkata)

## Safety and source identity

- Branch: `prototype/sidebar-v2-interaction`; HEAD: `387e490`.
- The worktree is dirty, including the unapproved Sidebar V2 prototype. HEAD alone is not the current source identity; preserve all tracked and untracked work. No reset, push, merge, deployment, install, or owner-data mutation was performed.
- The latest frontend build was produced from this worktree after the sidebar alignment/dependency fix. `frontend/dist` manifest SHA-256: `ce8537f0f75eacbfd8ad2c438e6ce1a8bce450b5576f5f34fd6d9bca3641db7b`.
- At that checkpoint `npm test` passed **105/105**, ESLint was clean, TypeScript/Vite build passed, and `git diff --check` was clean. This is frontend/static build evidence, not complete product acceptance.
- Sidebar-only browser QA used a fresh account and disposable tmpfs PostgreSQL; its QA services were stopped. Existing local development services were left running. No real focus interval was performed in this baseline pass.

## Rendered baseline

Production-preview Chromium captures at 1280×800:

- [Dark, collapsed sidebar + Dashboard](/tmp/shinpo-premium-sidebar-captures-qRPc0b/01-collapsed-dashboard-dark.png) — SHA-256 `73dcfb832dc6654296689cc08e3148b6a60b9e1da1143d63f43201c4dce9efc1`.
- [Dark, expanded sidebar + Dashboard](/tmp/shinpo-premium-sidebar-captures-qRPc0b/02-expanded-dashboard-dark.png) — SHA-256 `1cef3c0e6dd3661aca1fdb68a125382049f2313dd4939befecf23f8af91caccc`.
- [Light, expanded sidebar + Dashboard](/tmp/shinpo-premium-sidebar-captures-qRPc0b/05-expanded-dashboard-light.png) — SHA-256 `b24cf6ef9a5393ae6c5831029320cded5dc0634b0f3c445571d38bf1c9c2efd6`.
- These were rendered with the disposable fresh account `premium_sidebar_1792693379076`; they are not owner data or a populated-dashboard acceptance run. The dark capture was taken while the onboarding-skip toast was active; it overlaps part of the primary Dashboard area. Record this for Part 2's toast/notification layering review; it is not evidence that the stable Dashboard remains obstructed after the toast closes.
- The light capture shows the Dashboard hierarchy (four metric cards, Daily Execution Flow, priority and schedule cards) and expanded navigation. At this viewport, several secondary task/objective phrases are ellipsized. No new collision or functional behavior is inferred from that screenshot alone.

## Previously verified behavior to preserve

The ship matrix contains prior isolated evidence for the goal→task→schedule→focus→completion journey, PostgreSQL persistence, 75 XP reconciliation, Calendar lanes/lifecycle, and sidebar interactions. Do not repeat the 16-minute focus test without a specific regression. Those results apply to their recorded source snapshots; they are not automatically proof for the current dirty tree.

## Aurora-specific authorization

On 2026-10-23, the owner explicitly requested applying the sidebar UI changes to the Aurora version. This authorizes the **sidebar treatment in Aurora only**; it does not authorize redesigning Dashboard or other screens. The current app already renders the shared `Sidebar` within `.app-shell.theme-aurora` when `isV2Preview` is enabled, so the prototype styling and interaction are on the live Aurora path. `AuroraAppShell`/`AuroraSidebar` are not referenced by the running `App` and were not changed to avoid maintaining a second unused implementation. The [review](sidebar-v2-reference-review.md) and [motion comparison](sidebar-v2-motion-comparison.html) show the treatment; owner review of the final running appearance is still pending.
