# SHINPO Release Qualification Matrix

**Release scope:** Windows/Linux desktop **and** Browser Companion plus native host and Sentinel Shield. Android/iOS excluded.  
**Current result:** **NOT RELEASE QUALIFIED.** This matrix supersedes conflicting target-platform summaries in older historical QA notes; it does not erase them.

| Target / gate | Current status | Evidence and remaining acceptance |
|---|---|---|
| Linux desktop source/runtime | **PARTIAL — NOT CURRENTLY QUALIFIED** | Historical Fedora/WebKit sign-in launch is recorded in [historical ship matrix](SHINPO_SHIP_MATRIX.md). Latest worktree has not passed a fresh installed authenticated workflow. |
| Windows desktop | **NOT TESTED** | No actual Windows execution or installation evidence. |
| Chrome on Linux / Windows | **NOT TESTED (integrated flow)** | Chromium-family build evidence is historical; host registration, real browser permission, and full policy journey must be tested separately per OS. |
| Chromium on Linux / Windows | **NOT TESTED (integrated flow)** | Same shared extension family does not qualify this browser/OS row. |
| Edge on Linux / Windows | **NOT TESTED (integrated flow)** | No separate Edge installation/runtime acceptance evidence. |
| Firefox on Linux / Windows | **NOT TESTED (integrated flow)** | Historical Firefox build is not installation or runtime acceptance. |
| Native messaging registration | **PARTIAL** | Registration scripts exist for Linux/Windows; clean-user install, browser discovery, secure pairing, uninstall/repair and actual message round-trip remain unqualified. |
| Focus/Break/Grace authoritative lifecycle | **IMPLEMENTED; PARTIAL QUALIFICATION** | Persisted phases, 15m final break, configurable 10m grace, return-required state, and explicit return-to-Focus are implemented. Accelerated-clock tests exercise server transitions and verify Focus totals exclude break/grace. Pause/restart/suspend/outage continuity and real-time 60m operation remain unqualified. |
| Extension policy synchronization | **IMPLEMENTED; INTEGRATED RUNTIME OPEN** | Snapshot exposes persisted phase, remaining phase time, server deadline and session-scoped `breakOnly` rules. Only explicitly break-only resources are allowed during Break/Grace; they are restricted outside that interval. At deadline the extension revokes break-only access using the server timestamp. On expired lease it reports degraded, retains known explicit restrictions only, and marks other destinations uncertain. Browser Companion tests 19/19 pass; Chromium/Firefox builds pass. Native messaging runtime, browser reconnect and complete cutoff workflow remain unverified. |
| Sentinel Shield integration | **PHASE-AWARE POLICY IMPLEMENTED; RUNTIME OPEN** | Native candidate evaluation and daemon sync now refresh the persisted session phase. Session-scoped break-only desktop apps enter the Shield allowlist only when enabled, approved, unexpired, and in Break/Grace; otherwise the sync lists them as blocked. Backend policy and sync tests pass. Rust enforcement no longer escalates a failed non-force close request to a force kill and reports an unconfirmed close honestly. No Fedora Shield runtime, safe GUI close/save-prompt behavior, or OS-level app closure is claimed. |
| Native continuity evidence | **INSUFFICIENT — PENALTIES MUST STAY DISABLED** | Existing Sentinel heartbeat is in-memory and not session-scoped; companion presence is a separate in-memory heartbeat. Neither proves continuous active use nor reliably distinguishes suspend, app exit, backend loss, and Shield loss. No automatic late-break XP deduction is safe on this evidence. |
| XP penalty ledger | **NOT IMPLEMENTED — BLOCKED ON VERIFIED CONTINUITY** | Existing ledger remains unchanged. No configurable penalty, debit event, or penalty UI was added because cutoff wall-clock expiry alone cannot prove intentional overstay. |
| Disposable full journey | **PARTIAL — ACCELERATED SERVER PATH ONLY** | Focus/Break/Grace lifecycle and return tests remain accelerated-clock server tests. Current backend verification: 27 targeted tests passed against disposable PostgreSQL 16 schema `shinpo_test`, including sync policy assertions for Focus, Break, and Return Required. Rust Shield verification: 38 library tests and 39 binary tests passed, including no-force-escalation behavior. No connected browser/native Shield run, 25m cutoff penalty, persistent continuity evidence, or end-to-end state agreement is demonstrated. |
| Hosted backend / PostgreSQL | **NOT DEPLOYED** | User's machine-independent service, TLS, production secrets, persistent DB and recovery not verified. No deployment authorization/cost assumed. |
| Browser store publication | **NOT SUBMITTED / NOT APPROVED** | No store approval claim. Sideloaded QA package is distinct from published extension. |
| Owner acceptance | **PENDING** | Visual and integrated release result requires owner review after concrete evidence exists. |

## Evidence handling

Historical test/build/package results remain in [`SHINPO_SHIP_MATRIX.md`](SHINPO_SHIP_MATRIX.md) and do not automatically qualify this source revision. Attach each new result to a commit/source identity, disposable infrastructure identity, browser/OS version, artifact hash, and observed persisted state. A green unit suite does not close a native, visual, installation, remote-backend, or cross-client gate.

## Governing documents

- [Product specification V2](../product/SHINPO_PRODUCT_SPEC_V2.md)
- [Execution architecture](../architecture/SHINPO_EXECUTION_ARCHITECTURE.md)
- [Master backlog](../backlog/SHINPO_MASTER_BACKLOG.md)
