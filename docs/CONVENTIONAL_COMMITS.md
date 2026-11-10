# SHINPO Conventional Commits Specification

All commit messages in the SHINPO repository follow the [Conventional Commits v1.0.0](https://www.conventionalcommits.org/) specification.

---

## 1. Commit Structure

```
<type>(<optional scope>): <description>

[optional body]

[optional footer(s)]
```

### Examples
- `fix(focus): allow focus session completion while paused`
- `feat(settings): use accessible ShinpoSelect for native AI provider`
- `test(vault): verify paused completion and idempotent retry`
- `style(themes): adjust scrollbar thumb contrast for aurora-light and classic-light`
- `docs(qa): record private beta release readiness and verification evidence`
- `ci(release): support prerelease tags and develop branch in installer build`

---

## 2. Commit Types

| Type | When to Use | Example |
|---|---|---|
| **feat** | Adds a new feature or user-facing capability | `feat(companion): add native messaging host bridge` |
| **fix** | Patches a bug or defect in runtime code | `fix(vault): prevent duplicate XP event on deleted goal` |
| **test** | Adds, updates, or refactors automated tests | `test(native): add full-product journeys e2e suite` |
| **docs** | Documentation-only additions or modifications | `docs(readme): update standalone installation commands` |
| **style** | CSS tokens, whitespace, formatting, theme styling | `style(scrollbar): use transparent tracks across themes` |
| **refactor** | Code restructuring without altering external behavior | `refactor(ui): extract shared date formatting helper` |
| **perf** | Performance optimization or memory leak remediation | `perf(particles): throttle canvas render loop when idle` |
| **ci** | GitHub Actions workflows, build scripts, toolchains | `ci(workflows): pin Ubuntu runner and Rust toolchain` |
| **chore** | Routine maintenance, dependency lock updates | `chore(deps): bump locked dependencies` |

---

## 3. Allowed Scopes

Common approved scopes:
- `vault` (SQLCipher, Argon2, persistence)
- `focus` (Focus Engine, timer, pause/resume)
- `goals` (Goals, tasks, missions, Kanban)
- `analytics` (Skyline, charts, statistics)
- `rewards` (XP ledger, achievements, streaks)
- `companion` (Browser extension, native messaging host)
- `shield` (Focus Guardian, app observation)
- `eonpai` (AI assistant, offline planner)
- `settings` (Preferences, AI provider config)
- `themes` (Aurora Dark/Light, Classic Dark/Light)
- `ui` (Shared components, modals, popovers)
- `native` (Tauri 2 backend, WebKitGTK, WebView2)
- `ci` (GitHub Actions, release gates)
- `docs` (QA reports, architecture, guides)

---

## 4. Breaking Changes & Issue References

- For breaking changes, append `!` after the type/scope or include `BREAKING CHANGE:` in the body/footer.
- To link GitHub issues, use closing keywords in the footer:
  ```
  Closes #42
  Refs #19
  ```
