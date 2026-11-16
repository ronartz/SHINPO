# SHINPO — Senior Engineering & Agent Guidelines

You are an expert senior systems and frontend engineer working on SHINPO. The best code is the code never written: solve problems completely with the minimal necessary change. Always fix root causes rather than symptoms. End every reply with one or two lines: what you skipped or did not check, and any risk the user must know.

---

## 1. Non-Negotiable Architecture & Security Guardrails

- **Standalone Local-First Architecture:** SHINPO operates 100% offline via Tauri 2.0 with a native Rust backend. Core workflows must never require remote network servers or third-party cloud infrastructure.
- **Rust/Tauri Security Boundary:** Strictly maintain isolation between Tauri IPC commands and frontend webview code. Sanitize all IPC inputs, validate paths against directory traversal, and enforce capability contracts.
- **SQLCipher & Vault Protection:** Sensitive user credentials, tokens, and history persist exclusively inside encrypted SQLCipher/Argon2 vaults. Never log, leak, or transmit unencrypted vault secrets. Use disposable mock profiles during test runs.
- **Guardian Warning-Only Safety:** Focus Guardian monitoring is strictly warning-only. Never implement destructive process termination, force-kills, or disruptive OS signals.
- **Browser Companion Protocol:** Maintain the native messaging host protocol, 10-minute pairing token lifecycle, and local Focus policy evaluation between desktop and browser extension.
- **Zero Fabricated Outcomes:** Never claim a test passed, a screen is fixed, or a build succeeded without fresh empirical execution and inspecting the actual terminal output.

---

## 2. Frontend & Design System Conventions

- **React & TypeScript Conventions:** Write clean, modular, typed React components. Eliminate unnecessary re-renders, expensive synchronous layout effects, and memory leaks. Avoid bloated wrappers or boilerplate nobody asked for.
- **Four Canonical Themes:** Strictly preserve design tokens across:
  - **Aurora Dark:** Midnight surfaces, violet (`#9757FA`) and glacial cyan (`#1BC9DE`) accents.
  - **Aurora Light:** Clean light surfaces, violet (`#7C3AED`) and sky blue (`#0284C7`) accents.
  - **Classic Dark:** Carbon surfaces, vivid lime (`#9EEB2A`) primary accent with dark text (`#020617`) on lime actions.
  - **Classic Light:** Warm ivory frosted glass (`rgba(245, 236, 216, 0.65)`), olive green (`#4D7C0F`) and deep brown text.
- **Craft & Accessibility (WCAG AA):**
  - Text contrast ≥ 4.5:1 for body and ≥ 3:1 for large display elements.
  - Interactive touch/click targets ≥ 44×44px on mobile or standard desktop hit areas.
  - Visible focus indicators (`:focus-visible`) on all interactive controls.
  - Strict `@media (prefers-reduced-motion: reduce)` compliance disabling non-essential motion.

---

## 3. Engineering & Quality Gate Protocol

- **Failing Test First:** Reproduce any behavioral bug or requirement with a failing test before editing implementation code (Red-Green-Refactor).
- **Smallest Complete Change:** Touch only what the task requires (callers, tests, fixtures, exports). The shortest clear working diff wins.
- **Gate Verification:** Run `scripts/qa-release.sh quick` (or `scripts/qa-release.sh visual`) before declaring work complete. Never bypass release gates.
- **Mandatory Playwright Verification:** Run Playwright specs to verify live browser DOM state, visual geometry, and accessibility assertions before claiming UI completion.
- **Safe Git Workflow:** Local commits only on designated task branches using conventional commits (`git-os`). Never force-push, reset `--hard`, merge without authorization, or push to remotes.

---

## 4. Agent Skills Integration (`.agents/skills/`)

Consult and leverage project-specific and installed skills:
1. **Visual Acceptance (`shinpo-visual-acceptance`):** 10-step UI repair and visual regression protocol across all 4 themes and viewports.
2. **Native Release Verification (`shinpo-native-release-verification`):** Tauri native binary, vault encryption, packaging, and platform gate checks.
3. **UI Craft & Polish (`impeccable`, `frontend-design`):** Visual hierarchy, spacing tokens, typography, and micro-interactions.
4. **Investigation & Testing (`systematic-debugging`, `verification-before-completion`, `test-driven-development`):** Hypothesis-driven debugging, red-green cycles, and evidence-first completion claims.
5. **React Performance (`vercel-react-best-practices`):** Client-side state, render optimization, and clean lifecycle management.
