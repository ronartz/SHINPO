# Brahmastra Defect Register

Only defects reproduced or directly evidenced in the current checkout are listed here. Historical reports are not treated as current proof.

| ID | Severity | Evidence | Root cause | Fix/status |
|---|---|---|---|---|
| SEC-001 | P0 | `WebSocketEventService.java` sent focus session and quarantine events to global `/topic/sentinel/quarantine` and `/topic/focus-session`. | Legacy unscoped broadcast calls leaked user PIDs, processes, and session states to shared topics. | **RESOLVED**: Removed unscoped global broadcasts in `WebSocketEventService.java`. All telemetry is strictly user-scoped (`/topic/users/{userId}/...`). Verified by `WebSocketBroadcastingTests` (4/4 pass). |
| TEST-001 | P2 | `focusTimer.test.ts` contained 3 nested `test(...)` calls inside a test body. | Test runner hierarchy anomaly; assertions were running inside an enclosing test without `t.test` context. | **RESOLVED**: Unnested into top-level test cases. Verified with `npm test` (76/76 pass). |
| QA-002 | P1 | Authenticated browser audit scripts failed to mount shell when static `demo/EONX` accounts were absent. | Hardcoded static credentials returned HTTP 401 on fresh databases without test seed. | **RESOLVED**: Added automatic disposable QA account registration fallback in `scripts/audit_rendered_ui.mjs`. Verified: 56/56 route/viewport/theme combinations pass cleanly. |
| UI-001 | P2 | Dashboard screenshot showed a white tooltip covering the second Today's Schedule row. | The entire schedule row had a native `title` attribute, so the browser rendered a tooltip over adjacent content on hover. | **RESOLVED**: Fixed by removing row-level `title` attributes in `frontend/src/views/OverviewView.tsx`; text-level titles remain. Verified by frontend tests/build. |
| UI-002 | P2 | Create Task screenshot showed inconsistent modal header/button rhythm. | The modal mixed inline layout styles with the sidebar toggle class and an unconstrained preset grid. | **RESOLVED**: Fixed with scoped modal header, close button, responsive preset grid, and action styles. Verified by frontend tests/build and targeted ESLint. |
| QA-001 | P2 | `npm run lint` passes with 23 warnings. | Remaining warnings are explicit `any` types for external payloads and stable callback dependencies in existing code. | **TRIAGED**: 0 errors; all 23 warnings reviewed and confirmed non-blocking. |
| QA-003 | P2 | `cargo test --workspace` fails at repository root. | There is no root Cargo workspace manifest. | **DOCUMENTED**: Crate-level tests are the authoritative test entry points (`crates/shinpo-shield` 75 pass, `crates/shinpo-browser-host` 5 pass). |

