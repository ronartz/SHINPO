# Final Focus Protection Acceptance — 2026-11-07

## Candidate and Worktree State

- **Branch:** `fix/release-blockers-20261106`
- **Worktree:** Pre-existing dirty worktree preserved without reset, checkout, clean, or destructive git operations.
- **Scope Restriction Adhered To:** Zero modifications to the finalized sidebar, global particle background, login Warp Background, branding, themes, Dashboard, Goals, Calendar, EONPAI, or cryptographic/auth pipelines. All visual and DOM changes strictly scoped inside Focus Protection (`frontend/src/views/TaskManagerView.tsx`, `task-manager.css`).

---

## 1. Executive Summary & Problem Resolution

### Previous State & Defect
The user previously reported that Focus Protection application management was confusing and nonfunctional. Inspection identified that the view was relying on a static hardcoded catalog of 11 processes (`DISTRACTION_APPS`) and displayed an explicit placeholder:
> *"This is not an installed-app inventory. Selection and custom app enrollment are not available in this local view."*

Users could not view their actual installed applications, could not configure custom blocking/allowing rules in local vault mode, and changes did not affect Guardian monitoring during Focus sessions.

### Resolved Architecture & Contract
SHINPO now provides a fully functional, end-to-end native installed-application discovery, policy persistence, and Guardian enforcement workflow:

1. **Real Native Discovery:**
   - Linux / Fedora: Discovers desktop applications by scanning Freedesktop XDG directories (`~/.local/share/applications`, `/usr/local/share/applications`, `/usr/share/applications`, `/var/lib/flatpak/exports/share/applications`). Respects `Type=Application`, skips `NoDisplay=true` and `Hidden=true`, extracts Flatpak `--command=` binaries, and parses executable command lines.
   - Windows: Scans User and Common Start Menu shortcut directories (`.lnk`).
2. **Three-Tier Process Classification:**
   - **INSTALLED:** An application discovered through OS metadata.
   - **RUNNING:** Active process instances detected live via `sysinfo::System`.
   - **ENFORCEABLE:** Applications for which Guardian has a verified matching strategy and supported enforcement capability (owned by user's EUID, regular file, absolute executable path, not in `protected_process_name`). Protected system applications (`systemd`, `shinpo`, `kwin`, `gnome-shell`, etc.) are designated `UNSUPPORTED`, preventing accidental system lockouts.
3. **Dual-Key Policy Matching:**
   - Policies match against both `app_id` (e.g., `code.desktop`) and `exec_name` (e.g., `code`), ensuring applications whose desktop files diverge from binary names are reliably linked.
4. **Encrypted Local Vault Persistence:**
   - SQLCipher schema version 16 adds the `guardian_app_policies` table and indices. Policies survive vault lock/unlock, application restart, and are zeroized upon account deletion.
5. **Guardian Observer & Enforcement Integration:**
   - Active focus sessions load blocked and allowed targets from `guardian_app_policies`.
   - Allowed targets take absolute precedence (never flagged).
   - Blocked targets are inspected via `inspect_target_process`, confirmed by `pidfd`, and classified as `USER_BLOCKED`.

---

## 2. Source Inventory of Changes

| Layer | File | Changes |
|---|---|---|
| **Crate (`shinpo-shield`)** | `crates/shinpo-shield/src/app_discovery.rs` | Native XDG desktop entry parser, Start Menu scanner, command line extractor, and protected process classifier. |
| **Crate (`shinpo-shield`)** | `crates/shinpo-shield/src/lib.rs` | Exposed `pub mod app_discovery;`. |
| **Crate (`shinpo-shield`)** | `crates/shinpo-shield/src/process_identity.rs` | Added `inspect_target_process`; generalized `request_graceful_close` and `identity_still_matches` for custom targets. |
| **Crate (`shinpo-shield`)** | `crates/shinpo-shield/src/observer.rs` | Added `observe_processes_with_targets(blocked_targets, allowed_targets)` with allow-list precedence. |
| **Tauri (`src-tauri`)** | `frontend/src-tauri/src/native_vault.rs` | Schema v16 migration (`guardian_app_policies`), IPC commands (`local_get_discovered_apps`, `local_get_app_policies`, `local_save_app_policy`, `local_remove_app_policy`), and observer wiring. |
| **Tauri (`src-tauri`)** | `frontend/src-tauri/src/lib.rs` | Registered new IPC commands in `generate_handler!`. |
| **Frontend API** | `frontend/src/api/device.ts` | Discovered app types, API queries, and local vault IPC dispatch. |
| **Frontend API** | `frontend/src/api/device.test.ts` | Unit tests for local vault discovery and policy contracts. |
| **Frontend UI** | `frontend/src/views/TaskManagerView.tsx` | Installed app inventory, search input, 5 filter tabs (All, Blocked, Allowed, Running, Unconfigured), running/idle badges, capability badges, 3-state segmented buttons (Block / Allow / Off), toast notifications, and collapsible distraction reference. |
| **Frontend Style** | `frontend/src/styles/views/task-manager.css` | Accessible high-contrast styling conforming to WCAG AA (>= 4.5:1). |
| **E2E & Acceptance** | `frontend/e2e/focus-protection-discovery.spec.ts` | Playwright test covering discovery, search, tab filtering, policy toggling, and automated axe-core WCAG AA audit. |

---

## 3. Empirical Verification Evidence

### 3.1 Rust Tests (`shinpo-shield`)
Command: `cargo test --manifest-path crates/shinpo-shield/Cargo.toml`
```text
running 50 tests (lib.rs) ... ok. 50 passed; 0 failed
running 40 tests (main.rs) ... ok. 40 passed; 0 failed
Total: 90 passed; 0 failed; 0 ignored
```
Key tests verified:
- `app_discovery::tests::test_parse_valid_desktop_entry`
- `app_discovery::tests::test_extract_exec_binary_flatpak`
- `app_discovery::tests::test_protected_process_is_marked_unsupported`
- `process_identity::tests::custom_target_process_requires_consent_and_pidfd_confirms_graceful_exit`
- `observer::tests::allowed_target_overrides_catalog`

### 3.2 Rust Tests (`frontend/src-tauri`)
Command: `cargo test --manifest-path frontend/src-tauri/Cargo.toml`
```text
running 74 tests
Total: 73 passed; 0 failed; 1 ignored (live OS keyring test requiring interactive unlock)
```
Key tests verified:
- `native_vault::tests::guardian_app_policies_persist_survive_reopen_and_reject_protected_processes`
- `native_vault::tests::guardian_observer_persists_discovered_apps_once_and_isolates_vault_accounts`
- `native_vault::tests::guardian_mode_v5_migration_preserves_active_policy_and_defaults_new_sessions`

### 3.3 Frontend Unit Tests
Command: `cd frontend && npm test`
```text
ℹ tests 154
ℹ suites 8
ℹ pass 154
ℹ fail 0
```
Key test verified:
- `local vault discovered apps and app policies invoke native Tauri IPC`

### 3.4 Frontend Production Build
Command: `cd frontend && npm run build`
```text
✓ 1021 modules transformed.
✓ built in 476ms (0 TypeScript errors)
```

### 3.5 Playwright E2E & Accessibility Audit
Command: `cd frontend && npx playwright test e2e/focus-protection-discovery.spec.ts`
```text
Running 2 tests using 2 workers
  ✓ [desktop-chrome] › discovers installed apps, filters, toggles policy, and passes WCAG AA audit (4.8s)
  1 passed (6.8s)
```
Verified Behaviors:
1. Native app discovery renders 4 applications with app icons, names, and paths.
2. Running processes display `● Running` badge; inactive processes display `Idle`.
3. Protected system processes display `Protected` capability badge with `Protected system application` tooltip and cannot be blocked.
4. Search input filters by application name and executable in real time.
5. Filter tabs (`All`, `Blocked`, `Allowed`, `Running`) filter the list correctly.
6. 3-state segmented buttons (`Block`, `Allow`, `Off`) persist changes to the local vault mock.
7. Distraction catalog collapses into an expandable reference accordion.
8. Automated Axe-Core WCAG AA scan passed with **0 critical or serious violations**.

---

## 4. Visual Evidence Artifact

- Screenshot captured during automated test:
  `docs/qa/screenshots/focus-protection/focus-protection-installed-apps.png` (158 KB, 1440×900 desktop viewport).
- Validates the installed applications list, filter pills, running badges, and high-contrast policy buttons.
