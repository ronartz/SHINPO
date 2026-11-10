# SHINPO — Safe Branch Consolidation & Two-Branch Strategy Plan

**Document Status:** Ready for Owner Review & Approval  
**Date:** 2026-11-10  
**Target Long-Term Architecture:**  
- `main` — Production/Release branch (stable, tagged, protected).  
- `develop` — Release-candidate preparation & active integration.  
- Zero lingering feature branches. Temporary feature branches are pruned after PR merge.

---

## 1. Branch Inventory & Classification

Every local branch has been empirically audited against `fix/systematic-layout-and-composition` (HEAD at `436017f`):

| Local Branch | Commit Hash | Subject / Focus | Classification | Status |
|---|---|---|---|---|
| `fix/systematic-layout-and-composition` | `436017f` | Test(e2e): Add native deep full product journeys | **Currently Required (Active)** | Current worktree head containing all integrated work. |
| `feature/standalone-release-hardening` | `4a5405f` | Docs(qa): record final integrated release candidate certification | **Fully Merged (Stale)** | 100% merged into active branch. Safe to prune after approval. |
| `fix/frontend-layout-systematic` | `4a5405f` | Docs(qa): record final integrated release candidate certification | **Fully Merged (Stale)** | Identical commit to `feature/standalone-release-hardening`. |
| `fix/classic-dashboard-glass-composition` | `a3510b7` | Fix(ui): eliminate focus intention dead space | **Fully Merged (Stale)** | 100% merged into active branch. Safe to prune after approval. |
| `feature/separate-desktop-mobile-architecture` | `acb40c0` | Feat(ui,extension): finalize desktop repairs | **Fully Merged (Stale)** | 100% merged into active branch. Safe to prune after approval. |
| `chore/remove-legacy-backend` | `981dce1` | Docs: finalize standalone architecture documentation | **Fully Merged (Stale)** | 100% merged into active branch. Safe to prune after approval. |
| `codex/final-completion-20261031` | `2124469` | Ci: fix NSIS resource report path handling | **Fully Merged (Stale)** | 100% merged into active branch. Safe to prune after approval. |
| `fix/release-blockers-20261106` | `2124469` | Ci: fix NSIS resource report path handling | **Fully Merged (Stale)** | Identical commit to `codex/final-completion-20261031`. |
| `codex/aurora-token-consolidation` | `cdb80f6` | Feat(security): add transactional encrypted vault migrations | **Fully Merged (Stale)** | 100% merged into active branch. Safe to prune after approval. |
| `main` | `90e0f6b` | Merge SHINPO product work and Focus phase integration | **Protected (Long-Term)** | Stable release branch. To be updated to release candidate. |

---

## 2. Preservation Verification

Before proposing deletion, all commits and refs across all branches were captured in a full Git bundle:
```bash
# Generated recovery bundle:
docs/qa/recovery-bundle-all-refs-20261110.bundle
# Generated working tree diff patch:
docs/qa/uncommitted-worktree-20261110.patch
```
No unique commits or unmerged work will be lost.

---

## 3. Staged Deletion Commands (For Owner Approval)

**DO NOT execute automatically. Run only after owner reviews and authorizes:**

```bash
# Step 1: Establish 'develop' branch at current verified HEAD
git branch develop fix/systematic-layout-and-composition

# Step 2: Delete fully merged local feature branches
git branch -d chore/remove-legacy-backend
git branch -d codex/aurora-token-consolidation
git branch -d codex/final-completion-20261031
git branch -d feature/separate-desktop-mobile-architecture
git branch -d feature/standalone-release-hardening
git branch -d fix/classic-dashboard-glass-composition
git branch -d fix/frontend-layout-systematic
git branch -d fix/release-blockers-20261106

# Step 3: Fast-forward 'main' to the verified release candidate when approved
git checkout main
git merge --ff-only fix/systematic-layout-and-composition

# Step 4: Delete the temporary fix branch
git branch -d fix/systematic-layout-and-composition

# Resulting state: Exactly two branches — 'main' and 'develop'
```

---

## 4. GitHub Remote Hygiene Recommendation

In GitHub repository settings:
1. Set Default branch to `main`.
2. Enable **"Automatically delete head branches"** under Settings → General → Pull Requests.
3. Prune obsolete Dependabot branches that were targeting the legacy Java/Maven backend:
   ```bash
   # Example: prune legacy maven remote branches
   git push origin --delete dependabot/maven/backend/com.auth0-java-jwt-4.6.2
   git push origin --delete dependabot/maven/backend/org.apache.maven-apache-maven-3.10.0
   git push origin --delete dependabot/maven/backend/org.springframework.boot-spring-boot-starter-parent-4.1.2
   ```
