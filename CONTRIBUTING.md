# Contributing to SHINPO

Thank you for contributing to SHINPO! This document provides standards, local workflow guidelines, and verification procedures to ensure clean, secure, and professional code contributions.

---

## 1. Core Engineering Principles

1. **Standalone Local-First Architecture:** SHINPO operates 100% offline via Tauri 2.0 with a native Rust backend and encrypted SQLCipher vault. Core functionality must never require remote network servers or third-party cloud infrastructure.
2. **Minimal Necessary Change:** Solve problems at the root with the shortest clear working diff.
3. **Evidence Before Assertions:** Never claim a test passed, a screen is fixed, or a build succeeded without fresh empirical execution and inspecting the actual terminal output.
4. **Guardian Warning-Only Safety:** Focus Guardian monitoring is strictly warning-only. Never implement destructive process termination, force-kills, or disruptive OS signals.
5. **Preserve the 4 Canonical Themes:** All UI additions must be tested against Aurora Dark, Aurora Light, Classic Dark, and Classic Light.

---

## 2. Commit & PR Standards

- All commits must follow [Conventional Commits](docs/CONVENTIONAL_COMMITS.md).
- Commit messages must accurately describe what changed; never use vague placeholders like "fix", "wip", or "update".
- Keep commits atomic and focused. Do not mix unrelated styling, refactoring, and functional changes.

---

## 3. Local Development Setup

### Prerequisites
- Node.js (v22+) and npm
- Rust (v1.80+) and Cargo
- Linux packages: `webkit2gtk-4.1`, `libssl-dev`, `libayatana-appindicator3-dev` (or platform equivalents)

### Setup & Dev Server
```bash
# Clone the repository
git clone https://github.com/ronartz/SHINPO.git
cd SHINPO

# Install locked dependencies
npm ci --prefix frontend

# Launch Tauri development environment
npm --prefix frontend run tauri:dev
```

---

## 4. Local Verification & Quality Gates

Run the local verification checks before creating a pull request:

```bash
# 1. Typecheck and lint frontend
cd frontend
npx tsc -b --pretty false
npm run lint

# 2. Run unit tests
npm test

# 3. Format and test native Rust backend
cd src-tauri
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test --lib

# 4. Run native smoke test
cargo run --bin shinpo-desktop -- --smoke-test
```

---

## 5. Security & Secret Hygiene

- Run `gitleaks detect --redact` before pushing changes.
- Never commit private keys, passwords, API tokens, or actual user vault files.
- Non-secret public fixtures (such as the Chromium WebExtension public key) are narrowly allowlisted in `.gitleaks.toml`.

---

## 6. Git Hooks (Optional Recommended Setup)

To automatically enforce formatting and linting prior to committing, you can configure git to use the repository's hooks:
```bash
git config core.hooksPath .github/hooks
```
*(Ensure the hooks scripts in `.github/hooks` are executable via `chmod +x`.)*
