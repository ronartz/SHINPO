# Brahmastra Defect Register

Only defects reproduced or directly evidenced in the current checkout are listed here. Historical reports are not treated as current proof.

| ID | Severity | Evidence | Root cause | Fix/status |
|---|---|---|---|---|
| UI-001 | P2 | Dashboard screenshot showed a white tooltip covering the second Today's Schedule row. | The entire schedule row had a native `title` attribute, so the browser rendered a tooltip over adjacent content on hover. | Fixed by removing row-level `title` attributes in `frontend/src/views/OverviewView.tsx`; text-level titles remain. Verified by frontend tests/build. |
| UI-002 | P2 | Create Task screenshot showed inconsistent modal header/button rhythm. | The modal mixed inline layout styles with the sidebar toggle class and an unconstrained preset grid. | Fixed with scoped modal header, close button, responsive preset grid, and action styles. Verified by frontend tests/build and targeted ESLint. |
| QA-001 | P2 | `npm run lint` passes with 23 warnings. | Remaining warnings are explicit `any` types and dependency-array hygiene in existing code. | Reduced; non-blocking cleanup remains. |
| QA-002 | P1 | Authenticated browser audit cannot mount the shell. | The configured test credentials return HTTP 401 from the running backend. | Blocked; needs a valid disposable test account or explicit test fixture setup. |
| QA-003 | P2 | `cargo test --workspace` fails at repository root. | There is no root Cargo workspace manifest. | Documented; crate-level tests pass. Add a workspace only if it matches the existing packaging architecture. |

