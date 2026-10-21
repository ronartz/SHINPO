# SHINPO — Independent Project Health & Security Audit

**Review date:** 2026-10-21  
**Review target:** Current repository working tree at `/home/eonx/Projects/SHINPO`  
**Decision:** **NO-GO for an unqualified public production release.** Core protections exist, but the issues below leave material credential, reward-integrity, data-protection, and product-truth risks. This is a source review and targeted dependency check—not a penetration test, compliance assessment, or release certification.

> **Current-source correction — 2026-10-21:** The detailed SH-01–SH-09 narratives below preserve baseline findings. Historical RC-3 runtime evidence remains valid for that artifact, not for modified current source. Authoritative current gate status is tracked in [`SHINPO_SHIP_MATRIX.md`](SHINPO_SHIP_MATRIX.md). Revalidated summary:
>
> | Finding | Current-source status |
> |---|---|
> | Current suite refresh | This turn: frontend 93/93, TypeScript/Vite build and lint clean, Tauri `cargo check`, Rust credential boundary test 1/1. Current rendered UI sweep: 56/56 after a browser-origin authenticated API probe; a fresh skip persisted as SKIPPED with 0 XP/0 reward events. Prior backend 396/396 and Shield/Browser/extension suites remain historical evidence. Historical RC-3 passed 13 flows; current source has not completed the full journey. |
> | SH-01 CSP/credentials | Tauri refresh tokens now use OS keyring IPC and access tokens remain in memory with proactive refresh; verified in mocked flows. Current DEB built/extracted but not launched. CSP still broadly allows `https:`/`wss:` and inline styles; browser builds still use localStorage. Real OS keyring persistence is unverified. |
> | SH-02 transport | Frontend/native URL policy tests require HTTPS remotely and reject redirects in shared API paths; loopback HTTP is for development. Real remote TLS/WSS and current packaged behavior remain open. |
> | SH-03 onboarding | `PARTIAL / OPEN`: current isolated browser sign-up session reached the authenticated API; skip persisted as `SKIPPED`, 0 XP, 0 reward events. Full goal→task→schedule→>=15 actual active focus minutes workflow, restart/interruption and reward reconciliation remain unverified. |
> | SH-04 backups | Private directory permissions and fail-closed age encryption default implemented (`BACKUP_AGE_RECIPIENT`); actual isolated encrypted backup/restore verified in PostgreSQL (24 tables, user equality). Docker backup credentials streamed via stdin (no CLI argument exposure). Production recipient key custody remains user responsibility. |
> | SH-05 telemetry | Source labels unavailable process data as `null`; current packaged workstation telemetry/containment is not revalidated. |
> | SH-06 proxy trust | Explicit trusted-CIDR configuration and spoofed-header tests remain; the production proxy chain has not been exercised. |
> | SH-07 dependencies | Prior frontend `npm audit` reported zero advisories. Maven scanning lacked an NVD API key; `cargo audit` was unavailable, and this turn's new keyring dependency is not advisory-scanned. |
> | SH-08 browser permissions | Extension disclosure and Chromium/Firefox build/unit evidence remain historical; current installed permission flow is not requalified. |
> | SH-09 CI | Workflow hardening is present, but GitHub-hosted CI, secret scan, and supply-chain checks have not been executed for this worktree. |
> | Current visual findings | Auth input focus now uses the existing purple focus token (not the error-red token); current Chromium screenshot is `/tmp/shinpo-finalform-rc-20261021-CyzYAl/browser-auth-focus-fixed.png`. First-login tour spotlight remains visually defective: screenshot target appears unlabeled although its DOM text/computed styles are present. Current DEB rebuilt with the auth fix, extracted and dependency-checked, but latest hash not launched. |

## Executive assessment

SHINPO is a cross-platform personal execution product: users organize goals and tasks, schedule focus sessions, use an execution timer and reflection/analytics, and optionally use local Focus Shield and a browser companion to manage distractions. The codebase has a real separation between the React/Tauri client, Spring Boot/PostgreSQL service, native Rust components, browser extension, and deployment configuration. Several good foundations are present: authenticated REST endpoints, server-side account ownership checks in the reviewed goal/session paths, BCrypt password hashing, rotating opaque refresh tokens stored as hashes, a production profile that requires injected secrets, private PostgreSQL networking in the production compose file, a non-root backend container user, and narrow default Tauri capabilities.

These controls do not yet add up to a production-ready system. Current open risks include broad CSP secure-origin wildcards, browser-build script-readable tokens, unverified native keyring behavior, unqualified current-source packaged/remote flows, incomplete fresh-user reward reconciliation, unconfigured production backup key custody, and an unqualified release candidate. The latest visual review also reproduces a first-login coachmark target that renders as an unlabeled glowing control even though its DOM text and computed text color are present. The baseline issues below are retained for audit history; use the current-source correction above for present status.

## Findings

### SH-01 — Tauri Content Security Policy is explicitly disabled

**Severity: Medium (high impact if combined with script injection)** · **Confidence: High**

`frontend/src-tauri/tauri.conf.json:25-27` sets `app.security.csp` to `null`. The Tauri capability file grants only `core:default`, which is a useful least-privilege control, but it does not substitute for a WebView content policy. The app keeps both access and refresh tokens in `localStorage` (`frontend/src/api/auth.ts:15-26,53-56`), so any script injection in the UI could read and exfiltrate a user's credentials. A source search found no direct React `dangerouslySetInnerHTML`/runtime `innerHTML` sink in shipped app code; that reduces known injection surface, but does not remove CSP's defense-in-depth value.

**Recommended action:** Add a production CSP tailored to SHINPO's actual asset, API/WebSocket, font, and Tauri IPC origins; test it against packaged Tauri and browser builds. Reconsider refresh-token persistence in script-readable storage. Tauri documents CSP as an important WebView security control and notes that it is enabled only when configured ([Tauri CSP guidance](https://v2.tauri.app/security/csp/), [Tauri config reference](https://v2.tauri.app/reference/config/)).

### SH-02 — Remote backend URLs may use cleartext HTTP

**Severity: High when configured for a remote host; otherwise conditional** · **Confidence: High**

`frontend/src/api/config.ts:55-63` accepts any syntactically valid `http:` or `https:` server URL, and `frontend/src/api/client.ts` attaches the bearer token to requests. The native browser host also accepts and persists any nonempty backend URL without parsing or requiring TLS (`crates/shinpo-browser-host/src/config.rs:136-145`), then uses it for authenticated API requests. The Tauri shield command accepts both schemes as well (`frontend/src-tauri/src/lib.rs:38-41`). `http://localhost` is reasonable for local development, but a remote HTTP endpoint permits a network observer or active intermediary to capture access and refresh tokens and user data.

**Recommended action:** Preserve HTTP only for loopback/development endpoints. Require HTTPS for non-loopback hosts in the desktop URL validator and native host configuration path; clearly display the transport/security status before saving.

### SH-03 — Onboarding reward eligibility is still based on client assertions

**Severity: Medium** · **Confidence: High**

The service now bounds indices to `0–11` and derives the verified count from canonical stored indices (`backend/src/main/java/com/shinpo/service/OnboardingService.java:94-119,153-169`). That closes the out-of-range/count-inflation bug. However, the endpoint still trusts the request's `actionVerified` boolean and awards +50 XP after receiving all valid indices. The frontend sends that assertion from tutorial code (`frontend/src/components/TutorialOverlay.tsx:100-120`; `frontend/src/App.tsx:1909-1920`). An authenticated account can therefore submit all 12 indices directly and claim the reward without completing the intended workflow. The UI tutorial also contains simulated sandbox actions, so a successful tour run is not evidence of real goal → task → schedule → focus learning.

**Recommended action:** Bind reward eligibility to server-observable real workflow events, or remove/defer the onboarding reward until the tutorial is redesigned and verified against real actions. Do not label this reward “server-authoritative” while the server accepts a client-supplied verification flag.

### SH-04 — Production database backups are not protected by the script

**Severity: Medium** · **Confidence: High**

`scripts/backup_db.sh` creates the backup directory and redirects the compressed SQL dump into a new file, but does not set a restrictive `umask`, chmod the directory/file, encrypt the dump, or verify encrypted off-host retention. On a typical host with umask `022`, the directory is `0755` and the SQL dump/checksum are `0644`. The dump contains the application's persisted user and execution data; a checksum detects accidental corruption but does not provide confidentiality or authenticity against an attacker who can replace both files.

**Recommended action:** Enforce a private directory and `umask 077` before creating files; encrypt backups with managed keys before off-host storage; document retention and test a restore from the encrypted artifact. Avoid printing credential-bearing command arguments in process listings where a safer secret handoff is available.

### SH-05 — Process table can report invented per-process telemetry

**Severity: Medium (product/data integrity)** · **Confidence: High**

When `shinpo.sentinel.server-process-scanning.enabled` is enabled, `TaskManagerService.getProcesses` assigns memory values from fixed name-based constants (`backend/src/main/java/com/shinpo/service/TaskManagerService.java:112-118`) and assigns CPU from a PID formula (`:120`). These are not measured process statistics, yet are returned in `ProcessInfo` as CPU and memory values. The production profile currently disables server-side scanning (`application-prod.properties:31-34`), so it returns an empty list rather than those fabricated values. This means current cloud mode does not provide the workstation process table, while enabling the flag would present estimates as measurements and expose server process metadata.

**Recommended action:** Remove the server-wide process table from multi-user cloud mode. For desktop use, collect real local metrics through the native client and label unavailable metrics honestly; never return synthetic values as measurements.

### SH-06 — Rate-limit proxy trust is broader than the configured proxy

**Severity: Medium hardening gap** · **Confidence: High; exploitability depends on network exposure**

`RateLimitingService.isTrustedProxy` trusts any loopback or RFC1918 address (`backend/src/main/java/com/shinpo/security/RateLimitingService.java:97-124`), and then `resolveClientIp` accepts the first syntactically plausible forwarded IP (`:62-94`). If the backend is reachable directly from a private network, a caller can spoof `X-Forwarded-For` and rotate the per-IP registration/login-request buckets. The current `compose.prod.yaml` does not publish a backend host port and Caddy overwrites the forwarded client address, so this is not demonstrated as an Internet-facing bypass in the documented compose topology. It becomes relevant if the backend is exposed directly or moved behind a different proxy.

**Recommended action:** Trust only explicit proxy addresses/subnets supplied by deployment configuration, ensure the edge proxy overwrites—not appends untrusted values to—the client address header, and add a deployment-level test for direct-backend and proxied requests.

### SH-07 — Two high-severity findings exist in the frontend development dependency tree

**Severity: Medium for product runtime; high priority for the build/dev toolchain** · **Confidence: High, registry result on review date**

`npm audit` on `frontend` reports two high-severity package-level findings: `vite@8.3.0` (three `launch-editor` advisories, one rated high) and `source-map-js@1.2.1` (indexed source-map section offsets can cause event-loop denial of service). The registry report says fixes are available. Both are in the development/build dependency tree: `npm audit --omit=dev` reported zero production dependency vulnerabilities. They are therefore not evidence of a known vulnerable package shipped in the static frontend runtime, but they are a developer/CI exposure and should be fixed before continuing to use the dev server/build chain.

**Recommended action:** Upgrade Vite and the lockfile to patched versions, rerun `npm audit`, and make dependency scanning a CI gate. Advisory records: [Vite/launch-editor GHSA-698v-4r3x-3vcv](https://github.com/advisories/GHSA-698v-4r3x-3vcv), [GHSA-r825-w8mm-5pxw](https://github.com/advisories/GHSA-r825-w8mm-5pxw), [GHSA-587h-7wmj-h5pm](https://github.com/advisories/GHSA-587h-7wmj-h5pm), [source-map-js GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q).

### SH-08 — Browser companion permissions disclose broad browsing capability

**Severity: Medium (privacy/product trust)** · **Confidence: High**

`browser-extension/manifests/common.json:7-18` requests `tabs`, `webNavigation`, `scripting`, and host access to every HTTP and HTTPS origin. Its declared content script only matches YouTube (`:27-36`), but the background worker observes top-level navigations so it can apply user focus policies across sites. This may be functionally necessary for all-site blocking, but it is a much broader permission footprint than the YouTube page adapter implies and will concern users. The extension stores its pairing token in extension-local storage. The repository has no `browser-extension/package-lock.json`, so `npm audit` could not produce a locked dependency audit there (the manifest currently declares no npm dependencies).

**Recommended action:** Explain the all-site URL inspection plainly in onboarding/permission copy, reduce host patterns if policy requirements allow, and document precisely which URLs are kept locally versus sent to the user's configured backend.

### SH-09 — Security checks are not enforced in CI

**Severity: Medium (supply-chain/release control)** · **Confidence: High**

`.github/workflows/ci.yml` runs builds, lint, and tests but no dependency advisory scan, secret scan, SAST, container scan, or artifact provenance/signing check. GitHub Actions are referenced by mutable major tags (for example `actions/checkout@v4` and `actions/setup-node@v4`), rather than immutable commit SHAs, and the workflow does not set an explicit least-privilege `permissions` block. `cargo audit`/Rust advisory checks and a Maven SCA scan were not available/run during this review. No common high-entropy credential patterns were found in the scoped application source scan; this is not equivalent to a complete history-aware secret scan.

**Recommended action:** Add automated npm/Maven/Cargo advisory checks, secret scanning, and a minimal workflow token permission block. Pin third-party actions to reviewed SHAs and use dependency-update automation.

## Product and release-health observations

- **Calendar/UI acceptance remains open.** Owner-provided screenshots in this conversation show a collapsed-looking weekly calendar, cramped text, and inconsistent surface treatment. This audit did not rebuild the latest Tauri package or visually replay every route/state, so I treat this as an outstanding acceptance risk rather than a fresh current-build reproduction. Geometry-only checks cannot establish visual quality, legibility, or usable interaction states.
- **Linux is the only platform with evidence in the current ship matrix.** Windows remains explicitly `NOT TESTED`; the Rust crates contain platform-specific code, but source presence is not native execution evidence.
- **Remote production infrastructure was not validated.** No production account, live domain, deployed API, or remote PostgreSQL was made available for this review. Compose configuration is not proof of a running or durable service. The report does not claim laptop independence or a completed deployment.
- **Large change surface raises regression cost.** The working tree contains extensive pre-existing edits and generated/package artifacts. The main React coordinator file is 3,390 lines and native shield enforcement is 1,138 lines. Those sizes are not defects by themselves, but together with cross-cutting UI state and multiple visual systems they make small changes harder to verify. Preserve the current changes and continue with route/state-level acceptance checks rather than a broad rewrite.

## Positive controls observed

- Production Compose requires `POSTGRES_PASSWORD` and `SHINPO_JWT_SECRET`, keeps PostgreSQL off published host ports, and disables server-side process scanning (`compose.prod.yaml:14-18,42-56`).
- The production Spring profile limits exposed actuator endpoints to health/info and disables Hibernate schema mutation (`backend/src/main/resources/application-prod.properties:25-40`).
- JWT tokens have an issuer, expiry, token version, and unique token ID; refresh tokens are random values stored by hash (`backend/src/main/java/com/shinpo/security/JwtTokenService.java`).
- Reviewed Goal, Mission, and Focus Session get/update/delete paths compare the object owner to the authenticated user's ID. The WebSocket interceptor rejects unauthenticated sends and checks user-scoped subscriptions (`backend/src/main/java/com/shinpo/config/WebSocketConfig.java:119-135,164-230`).
- The default Tauri capability set is limited to `core:default` (`frontend/src-tauri/capabilities/default.json:1-11`); native browser pairing secrets are randomly generated, hashed, and compared in constant time (`crates/shinpo-browser-host/src/config.rs:89-133`).

## Verification performed for this report

- Manual source/config review of the shipped frontend, backend, Tauri shell, browser extension/native host, Shield daemon, CI, Docker, proxy, and backup paths.
- Frontend registry check on 2026-10-21: `npm audit` → two high package-level findings; `npm audit --omit=dev` → zero production dependency findings.
- Browser extension audit attempt: not available because the extension has no lockfile (`npm audit` returned `ENOLOCK`); package currently declares no dependencies.
- Scoped high-entropy secret-pattern filename scan: no hits in application source; `.env.example` files only were identified as environment templates.
- No broad test-suite count was used as evidence of code health. This report does not infer production safety from tests passing.

## Not performed / residual limitations

No authenticated production DAST or penetration testing, browser-extension store review, live remote-backend test, Windows execution, current-source packaged-Tauri CSP validation, Maven/Cargo CVE database scan, full Git-history secret scan, or independent accessibility/usability study was performed. An age 1.2.1 encrypted backup/decrypt/restore was exercised only against the isolated ephemeral PostgreSQL QA container; no production restore or off-host retention test was performed. Current Chromium screenshots are agent-driven browser evidence, not owner acceptance. The worktree is dirty and preserves historical releases; findings must be revalidated after subsequent source/package changes.

## Recommended remediation order

1. Reduce CSP origin scope where configuration permits and move long-lived credentials to OS-backed secure storage; verify packaged WebView behavior.
2. Complete interactive first-user workflow and concurrency/restart reward acceptance; reconcile historical awards without rewriting them and plan migration safely.
3. Configure production age recipient/private-key custody, verify off-host retention, and integration-test Docker restore's stdin password handoff.
4. Run Cargo/Maven scans and the actual least-privilege CI workflow.
5. Validate deployment proxy CIDRs and browser-companion permission behavior.
6. Build/install current-source Tauri and complete content-rich visual, accessibility, Windows, and remote-backend acceptance before release.

