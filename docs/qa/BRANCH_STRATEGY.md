# SHINPO — Git Branch Strategy & Consolidation Record

## 1. Strict Two-Branch Policy

SHINPO enforces a strict two-branch repository policy across both local developer environments and the `origin` (`github.com/ronartz/SHINPO`) remote.

```text
LOCAL:
  main
  beta

REMOTE:
  origin/main (Default)
  origin/beta
```

### 1.1 `main` (Production & Public Releases)
- **Role:** Stable, production-ready codebase.
- **Rules:**
  - Default branch on GitHub.
  - No direct development commits.
  - Protected from experimental or incomplete code.
  - Fast-forward or squash-merged strictly from `beta` after release qualification.
  - Pinned release tags (e.g. `v0.1.0-beta.1`) reference commits on `main`.

### 1.2 `beta` (Active Development, Integration & QA)
- **Role:** The single active branch for all ongoing engineering.
- **Rules:**
  - All new feature implementation occurs directly on or integrates into `beta`.
  - All bug fixes, security remediations, and visual repairs land on `beta`.
  - All Linux and Windows cross-platform QA runs against `beta`.
  - No permanent feature, fix, or topic branches are retained.
  - Release candidate verification is performed on `beta` before promotion to `main`.

---

## 2. Consolidation Inventory

Prior to consolidation, the repository contained multiple historical fix, backup, release, and automated bot branches across local clones and `origin`.

### 2.1 Evaluated Source Branches

| Branch Name | Origin Tracking | Latest SHA | Ancestor of main/beta | Integration Status |
|---|---|---|---|---|
| `release/final-gate` | `origin/release/final-gate` | `2abd31d` | **YES** (Identical) | Fully merged into `main` and `beta`. |
| `fix/visual-perfection-beta` | None (Local only) | `e88dd8e` | **YES** | Ancestor of `a450677`; verified present in `beta`. |
| `fix/total-ui-reconstruction` | `origin/fix/total-ui-reconstruction` | `58ac92b` | **YES** | Ancestor of `beta`; all changes integrated. |
| `fix/systematic-layout-and-composition` | `origin/fix/systematic-layout-and-composition` | `b6fd5a3` | **YES** | Ancestor of `beta`; all changes integrated. |
| `backup/release-candidate-0.1.0-beta.1-preflight` | None (Local only) | `9c0de18` | **YES** | Preflight snapshot; fully superseded by `beta`. |
| `backup/pre-revert-ui-reconstruction` | `origin/backup/pre-revert-ui-reconstruction` | `1571646` | **YES** | Historical snapshot; fully superseded by `beta`. |
| `dependabot/cargo/frontend/src-tauri/tauri-rust-dependencies-1aeea5ad18` | `origin/dependabot/...` | `3524bfb` | NO (Outdated lockfile bump) | Preserved in bundle; removed from remote. |
| `dependabot/npm_and_yarn/frontend/frontend-dependencies-36651cef14` | `origin/dependabot/...` | `051c3ab` | NO (Outdated lockfile bump) | Preserved in bundle; removed from remote. |

---

## 3. Recovery Bundle Safeguard

Before removing any branch references, a full, cryptographically verified Git bundle was generated outside the repository directory:

- **Bundle Path:** `/home/eonx/Projects/SHINPO-pre-two-branch-cleanup.bundle`
- **Bundle Size:** ~910 MiB (10,281 objects, all refs included)
- **Verification Status:** `The bundle records a complete history. The bundle uses this hash algorithm: sha1. ../SHINPO-pre-two-branch-cleanup.bundle is okay.`
- **Contents:** Every branch commit, ref, tag, and stash across repository history is safely preserved and recoverable.

---

## 4. Execution Log

1. **Created & Synchronized `beta`:**
   - Created branch `beta` at commit `2abd31d`.
   - Verified 100% of frontend tests pass (250/250 passing suites).
   - Non-forced push to remote: `git push -u origin beta`.

2. **Deleted Obsolete Local Branches:**
   - `git branch -d backup/pre-revert-ui-reconstruction`
   - `git branch -d backup/release-candidate-0.1.0-beta.1-preflight`
   - `git branch -d fix/systematic-layout-and-composition`
   - `git branch -d fix/total-ui-reconstruction`
   - `git branch -d fix/visual-perfection-beta`
   - `git branch -d release/final-gate`
   - *Result: Zero forced `-D` flags required; all branches cleanly integrated.*

3. **Deleted Obsolete Remote Branches:**
   - `git push origin --delete release/final-gate`
   - `git push origin --delete fix/total-ui-reconstruction`
   - `git push origin --delete fix/systematic-layout-and-composition`
   - `git push origin --delete backup/pre-revert-ui-reconstruction`
   - `git push origin --delete dependabot/cargo/frontend/src-tauri/tauri-rust-dependencies-1aeea5ad18`
   - `git push origin --delete dependabot/npm_and_yarn/frontend/frontend-dependencies-36651cef14`

---

## 5. Final State Verification

### Local Heads
```text
$ git branch --list
* beta
  main
```

### Remote Heads (`origin`)
```text
$ git ls-remote --heads origin
2abd31d13c81945657bd8c3a7fdee7255b881f6c	refs/heads/beta
2abd31d13c81945657bd8c3a7fdee7255b881f6c	refs/heads/main
```

### Repository Defaults
- **Default Branch:** `main` (`refs/remotes/origin/HEAD -> origin/main`)
- **Main Commit SHA:** `2abd31d13c81945657bd8c3a7fdee7255b881f6c`
- **Beta Commit SHA:** `2abd31d13c81945657bd8c3a7fdee7255b881f6c`
- **Integrity Status:** Working tree clean, zero uncommitted or orphaned state.
