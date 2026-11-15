# SHINPO — DEPENDENCY MAINTENANCE & DEFERRAL BACKLOG

**Repository:** `ronartz/SHINPO`  
**Date:** 2026-11-15  
**Document Purpose:** Living audit record of closed individual Dependabot pull requests, deferred major upgrades, compatibility risks, and consolidated maintenance schedule.

---

## 1. Executive Summary

To achieve a clean 2–3 branch repository architecture (`main`, `fix/systematic-layout-and-composition`), all 22 open automated pull requests on GitHub were formally reviewed, classified, and closed via remote head branch deletion.

None of the closed PRs addressed active exploitable security vulnerabilities in SHINPO's offline runtime. Routine updates are transitioned to Dependabot's new grouped, monthly schedule (`.github/dependabot.yml`), while breaking major upgrades are captured below for dedicated engineering triage.

---

## 2. Major / Breaking Upgrades Deferral Matrix

The following major version bumps introduce breaking API or type system changes that cannot be automatically merged without regression risk:

| Dependency | Scope / Ecosystem | Closed PR | Version Jump | Compatibility Concern & Rationale for Deferral |
| :--- | :--- | :---: | :---: | :--- |
| **`typescript`** | `/frontend` (npm) | #11 | `6.0.3` → `7.0.2` | **Major Compiler Evolution:** TypeScript 7 introduces stricter type inference and deprecates legacy compilation flags. Bumping without comprehensive type regression verification could break frontend builds. Defer to dedicated compiler upgrade sprint. |
| **`@types/node`** | `/frontend` (npm) | #13 | `24.13.6` → `26.6.5` | **Two Major Version Jump:** Jumps across Node 25 and Node 26 type declarations. Browser-oriented Vite frontend uses minimal Node types; risk of ambient type signature mismatches. |
| **`sysinfo`** | `/crates/shinpo-shield` | #24 | `0.33.1` → `0.40.1` | **Breaking Native API:** `sysinfo` v0.40 completely revamped system refresh methods, process retrieval signatures, and component naming. Direct merge breaks Rust compilation in `shinpo-shield/src/app_discovery.rs`. |
| **`rand`** | `/crates/shinpo-browser-host` | #7 | `0.8.8` → `0.10.3` | **Breaking Trait Changes:** `rand` 0.10 modified `RngCore` trait methods, distribution initializers, and seed generation conventions. Requires manual refactoring of pairing token generators. |
| **`ureq`** | `/crates/shinpo-shield` | #27 | `2.12.1` → `3.5.1` | **Major Architecture Rewrite:** `ureq` v3 is a ground-up rewrite introducing async transport, new agent builders, and incompatible response body streaming APIs. Breaks existing synchronous HTTP calls. |
| **`ureq`** | `/crates/shinpo-browser-host` | #29 | `2.12.1` → `3.5.1` | **Major Architecture Rewrite:** Same incompatible API transition as above. Must be updated simultaneously across both crates when migrated. |

---

## 3. Routine Updates Consolidated into Maintenance Cycle

These routine patch and minor updates are compatible and will be managed in grouped monthly cycles under the newly configured `.github/dependabot.yml`:

| Group | Closed PRs | Package Names | Versions | Notes |
| :--- | :---: | :--- | :--- | :--- |
| **React Framework** | #16, #18 | `react`, `react-dom` | `19.3.0` → `19.3.1` | Patch update; must be applied in unified lockstep. |
| **Tauri Framework** | #15, #17, #19 | `tauri`, `tauri-build`, `@tauri-apps/cli` | `2.12.3` → `2.12.4`, `2.7.2` → `2.7.3` | Minor framework bumps across Rust backend and Node CLI. |
| **Rust Serialization** | #8, #12 | `serde_json` | `1.0.151/152` → `1.0.154` | Compatible minor performance and bugfix release. |
| **Rust Logging & Crypto** | #2, #4, #25 | `base64`, `sha2`, `log` | `0.22.1` → `0.23.1`, `0.10.9` → `0.11.1`, `0.4.34` → `0.4.35` | Standard utility crate updates in browser host and Tauri runtime. |
| **GitHub Actions** | #5 | `actions/checkout` | `6.0.0` → `7.0.1` | CI runner checkout update. |

---

## 4. Obsolete Pull Requests Permanently Closed

| Closed PR | Head Branch | Reason for Closure |
| :---: | :--- | :--- |
| **#10** | `dependabot/maven/backend/org.apache.maven-apache-maven-3.10.0` | **Obsolete:** Java `/backend` was removed during standalone local-first Tauri 2.0 migration. |
| **#14** | `dependabot/maven/backend/com.auth0-java-jwt-4.6.2` | **Obsolete:** Java `/backend` was removed. |
| **#21** | `dependabot/maven/backend/org.springframework.boot-spring-boot-starter-parent-4.1.2` | **Obsolete:** Java `/backend` was removed. |
| **#28** | `dependabot/github_actions/actions/setup-java-6.2.0` | **Obsolete:** Java is not used in Tauri/Rust desktop builds. |
| **#26** | `copilot/fix-existing-secret-rust-checks` | **Superseded:** Early attempt to add RustSec ignores in CI; canonically solved in `fix/systematic-layout-and-composition` (`c10b40c` & `b4df017`). |

---

## 5. Security & Verification Audit

- **Production NPM Vulnerabilities:** 0 vulnerabilities (`npm audit --omit=dev`).
- **Cargo Audit:** Passes for `crates/shinpo-shield` and `crates/shinpo-browser-host`. Transitive upstream GLib `RUSTSEC-2024-0429` in `frontend/src-tauri` is documented and scoped.
- **Cargo Deny:** Passes all bans, licenses, and sources checks across all three Rust projects.
- **Next Maintenance Window:** Next consolidated dependency maintenance cycle scheduled with monthly Dependabot group generation.
