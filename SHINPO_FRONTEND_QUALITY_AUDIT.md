# SHINPO Frontend Quality Audit

**Audit scope:** `frontend/` source, styles, package scripts, existing tests, and static quality scans  
**Audit date:** 2026-11-01  
**Audit type:** Source-grounded quality audit; no product fixes were made

## Anti-Patterns Verdict

**Conditional fail: the implementation has a strong authored direction, but the accumulated legacy and Aurora layers visibly risk “AI-generated dashboard” tells if they are treated as one system without consolidation.**

The strongest verified tells are:

- Side-tab and stripe accents: colored left borders in
  [`ShinpoToast.tsx`](/home/eonx/Projects/SHINPO/frontend/src/components/ui/Toast/ShinpoToast.tsx:41),
  [`glass-surfaces.css`](/home/eonx/Projects/SHINPO/frontend/src/styles/components/glass-surfaces.css:307), and
  the decorative pseudo-element in [`microkit-motion.css`](/home/eonx/Projects/SHINPO/frontend/src/styles/foundations/microkit-motion.css:147).
- Glass/rgba/shadow treatment is widespread in the legacy surface styles rather than reserved for a small number of meaningful layers.
- Layout properties are animated in multiple shell and reward styles, including `width`, `height`, `max-width`, `margin-left`, `padding`, and `all`.
- A bounce-style easing curve is used in [`progression-rewards.css`](/home/eonx/Projects/SHINPO/frontend/src/styles/components/progression-rewards.css:44), contrary to the project’s otherwise restrained motion language.
- The codebase contains both semantic Aurora tokens and many direct color/fallback literals, creating a visibly inconsistent theme vocabulary.

This is not a claim that the product is unusable or that every detector warning is a defect. The anti-pattern verdict is about coherence and maintenance risk. The visual verdict remains incomplete because the rendered audit could not run without isolated QA endpoints.

## Executive Summary

| Measure | Result |
|---|---:|
| Overall quality score | **72/100** (static evidence only) |
| Critical findings | 0 |
| High findings | 2 |
| Medium findings | 6 |
| Low findings | 3 |
| Detector warnings | 18 heuristic warnings reported |
| Lint | Passed |
| Production build | Passed |
| Existing frontend tests | Passed |
| Rendered visual audit | Not run: `SHINPO_URL` and the second isolated QA endpoint were not configured |

### Most important findings

1. **Mobile controls are below the project’s preferred touch target** and several are close to or above the strict WCAG 2.2 minimum only by relying on surrounding spacing.
2. **Reduced-motion handling is incomplete**: global rules primarily reduce button transitions while other animations and transitions remain active.
3. **The global `overflow-x: hidden` rule can conceal responsive defects** instead of exposing and fixing the overflowing component.
4. **The main CSS and JavaScript bundles are large**, and two intended dynamic imports are ineffective because the same modules are also statically imported.
5. **Token drift is systemic** across legacy CSS and inline styles, making theme changes and contrast auditing harder.

## Detailed Findings by Severity

### High severity

#### H-01 — Mobile touch targets are undersized

- **Location:** [`responsive.css`](/home/eonx/Projects/SHINPO/frontend/src/styles/responsive.css:181), lines 181–183, 219–224, 278–280, 519, and 529.
- **Category:** Accessibility / Responsive
- **Description:** Mobile navigation and action controls are declared at approximately `32×28`, `34×34`, `32×32`, and `30×30` CSS pixels. Sidebar buttons are approximately 42px high.
- **Impact:** Users with motor impairments and users operating on touch screens have smaller activation areas and a higher risk of missed taps. Dense controls also make the interface harder to operate one-handed.
- **WCAG/standard:** WCAG 2.2 SC 2.5.8 Target Size (Minimum) requires a 24×24 CSS-pixel minimum or an allowed exception. The project’s 44×44 target is a stronger practical mobile standard, not a universal WCAG minimum.
- **Recommendation:** Raise primary mobile controls to at least 44×44 where layout permits; where the visual glyph must remain smaller, enlarge the button hit area and verify spacing between adjacent targets. Test at 320px and 375px widths with keyboard and touch emulation.
- **Suggested command:** `/harden` for interaction and accessibility hardening, followed by `/polish` for spacing refinement.

#### H-02 — Reduced-motion support does not cover the motion system

- **Location:** [`index.css`](/home/eonx/Projects/SHINPO/frontend/src/index.css:74), with motion declarations in [`shell.css`](/home/eonx/Projects/SHINPO/frontend/src/styles/shell.css:33) and [`progression-rewards.css`](/home/eonx/Projects/SHINPO/frontend/src/styles/components/progression-rewards.css:44).
- **Category:** Accessibility / Motion
- **Description:** A `prefers-reduced-motion` media query exists, but the observed rules primarily reduce button transitions and active transforms. The repository still contains independent animations and layout transitions that are not shown to be disabled under reduced motion.
- **Impact:** Users who request reduced motion may still experience animated shell movement, reward progress changes, modal effects, or decorative motion.
- **WCAG/standard:** WCAG 2.2 SC 2.3.3 Animation from Interactions; also aligns with the platform `prefers-reduced-motion` contract.
- **Recommendation:** Establish one reduced-motion override for all non-essential animations/transitions, including generated pseudo-elements and progress effects. Preserve instant state changes and essential status feedback. Verify with browser emulation and a route-by-route motion inventory.
- **Suggested command:** `/harden` for accessibility behavior, then `/polish` for motion consistency.

### Medium severity

#### M-01 — Global horizontal overflow suppression can hide defects

- **Location:** [`index.css`](/home/eonx/Projects/SHINPO/frontend/src/index.css:18) and line 23.
- **Category:** Responsive / Debuggability
- **Description:** `html` and `body` use `overflow-x: hidden`.
- **Impact:** Genuine overflow from long labels, dialogs, tables, or new responsive components can be clipped without a visible scrollbar or diagnostic signal. Users may lose content or controls rather than seeing a recoverable overflow.
- **WCAG/standard:** Supports WCAG 1.4.10 Reflow when implemented correctly; a global clip is not evidence that reflow is correct.
- **Recommendation:** Remove the global suppression where possible and fix the overflowing component. If a bounded viewport is intentional, apply clipping only to the responsible surface and add narrow-viewport regression tests.
- **Suggested command:** `/harden` for responsive robustness.

#### M-02 — Layout-property transitions create avoidable reflow work

- **Location:** [`shell.css`](/home/eonx/Projects/SHINPO/frontend/src/styles/shell.css:33), 309, 396, 937, 1055, 1274, and 1350; [`app-shell-refinement.css`](/home/eonx/Projects/SHINPO/frontend/src/styles/app-shell-refinement.css:88).
- **Category:** Performance / Motion
- **Description:** Shell and reward styles animate `width`, `height`, `max-width`, `margin-left`, `padding`, and `all`.
- **Impact:** These properties can trigger layout recalculation and paint on every animation frame, especially during sidebar expansion or dense dashboard updates. They can also produce jank on lower-powered devices.
- **Recommendation:** Prefer transform/opacity for movement and reveal; use grid-template-rows for height-like disclosure where needed. Profile the sidebar and reward routes before and after changes rather than applying `will-change` broadly.
- **Suggested command:** `/optimize` for runtime performance and `/polish` for motion cleanup.

#### M-03 — Sidebar indicator performs synchronous layout reads and writes

- **Location:** [`Sidebar.tsx`](/home/eonx/Projects/SHINPO/frontend/src/components/layout/Sidebar.tsx), the `useLayoutEffect` that reads `offsetTop`/`offsetHeight` and writes inline transform/height.
- **Category:** Performance
- **Description:** The active navigation indicator measures DOM geometry and immediately writes styles in a layout effect.
- **Impact:** This is likely acceptable for occasional navigation changes, but repeated state changes or resize-driven renders can force synchronous layout work and make the sidebar a rendering hotspot.
- **Recommendation:** Confirm the effect’s dependency frequency with the React profiler and a resize test. Batch reads before writes, avoid recalculating when the active item has not changed, and use CSS positioning where the layout permits.
- **Suggested command:** `/optimize`.

#### M-04 — Intended code splitting is partially ineffective

- **Location:** [`analytics.ts`](/home/eonx/Projects/SHINPO/frontend/src/api/analytics.ts:72) and 105.
- **Category:** Performance / Bundle
- **Description:** `focusSessions.ts` and `goalsAndMissions.ts` are dynamically imported by analytics, but the build reports `INEFFECTIVE_DYNAMIC_IMPORT` because the modules are also statically imported by [`App.tsx`](/home/eonx/Projects/SHINPO/frontend/src/App.tsx) and [`FocusView.tsx`](/home/eonx/Projects/SHINPO/frontend/src/views/FocusView.tsx).
- **Impact:** The dynamic imports do not provide the intended chunk boundary, so initial or route-related JavaScript can remain larger than expected.
- **Recommendation:** Decide whether these modules are truly shared startup dependencies. If not, remove the competing static imports and pass the dynamic boundary through the callers; if they are required synchronously, remove the misleading dynamic import and document the intentional trade-off.
- **Suggested command:** `/optimize`.

#### M-05 — Global CSS and main JavaScript assets are large

- **Location:** Production build output from [`frontend/package.json`](/home/eonx/Projects/SHINPO/frontend/package.json).
- **Category:** Performance
- **Description:** The production build reported approximately 564.75 kB CSS and 450.81 kB main JavaScript before gzip.
- **Impact:** Larger first-load transfer and parse costs can delay interaction on mobile networks and low-end devices. The figures are not automatically failures because compressed transfer, caching, and route usage were not measured.
- **Recommendation:** Use a bundle visualizer and route-level performance trace to identify legacy CSS duplication, broad imports, and code that can be loaded after first interaction. Set a measured budget rather than optimizing based on raw size alone.
- **Suggested command:** `/optimize`.

#### M-06 — Theme/token drift makes contrast and dark-mode maintenance fragile

- **Location:** [`tokens.css`](/home/eonx/Projects/SHINPO/frontend/src/styles/tokens.css), [`index.css`](/home/eonx/Projects/SHINPO/frontend/src/index.css:90), lines 102, 107, 121, 125, 130, and 135, plus legacy styles such as [`shell.css`](/home/eonx/Projects/SHINPO/frontend/src/styles/shell.css:1242).
- **Category:** Theming / Accessibility
- **Description:** The canonical token layer coexists with direct `#ffffff`, `rgba(255,255,255,...)`, `rgba(0,0,0,...)`, fallback literals, direct shadows, and gradients throughout legacy styles and inline component code.
- **Impact:** A palette change or dark-mode adjustment can leave isolated controls with stale contrast, inconsistent surfaces, or different interaction states. It also makes automated contrast review less reliable.
- **Recommendation:** Inventory direct values by semantic role. Keep deliberate browser-compatibility fallbacks documented, but migrate product-facing colors and shadows to semantic tokens and add contrast checks for token pairs in both themes.
- **Suggested command:** `/normalize`.

### Low severity

#### L-01 — Decorative accent language is repetitive

- **Location:** [`ShinpoToast.tsx`](/home/eonx/Projects/SHINPO/frontend/src/components/ui/Toast/ShinpoToast.tsx:41), [`glass-surfaces.css`](/home/eonx/Projects/SHINPO/frontend/src/styles/components/glass-surfaces.css:307), and [`microkit-motion.css`](/home/eonx/Projects/SHINPO/frontend/src/styles/foundations/microkit-motion.css:147).
- **Category:** Visual design / Anti-pattern
- **Description:** Multiple components use a colored side border or stripe as the primary emphasis device.
- **Impact:** Repetition reduces hierarchy and contributes to the “template” appearance identified in the anti-pattern verdict.
- **Recommendation:** Reserve the accent for semantic status or use varied, component-specific emphasis such as spacing, type, or a restrained surface change.
- **Suggested command:** `/polish`.

#### L-02 — Bounce easing is inconsistent with the stated motion direction

- **Location:** [`progression-rewards.css`](/home/eonx/Projects/SHINPO/frontend/src/styles/components/progression-rewards.css:44).
- **Category:** Visual design / Motion
- **Description:** A bounce/elastic cubic-bezier is used in the progression/reward experience.
- **Impact:** It can feel ornamental and dated beside the project’s otherwise exponential/ease-out motion tokens.
- **Recommendation:** Replace only after reviewing the interaction in context; prefer the existing `--ease-out-expo` or another non-overshooting curve.
- **Suggested command:** `/polish`.

#### L-03 — Custom focus and combobox behavior needs rendered verification

- **Location:** [`ShinpoDialog.tsx`](/home/eonx/Projects/SHINPO/frontend/src/components/ui/Dialog/ShinpoDialog.tsx) and [`ShinpoSelect.tsx`](/home/eonx/Projects/SHINPO/frontend/src/components/ui/Select/ShinpoSelect.tsx).
- **Category:** Accessibility
- **Description:** Static inspection shows substantial focus management and ARIA coverage, but the dialog uses delayed focus/trapping logic and the select relies on active-descendant behavior with clickable list items.
- **Impact:** Nested dialogs, disabled options, unmounting, focus restoration, and screen-reader announcements can fail in cases that static source review cannot prove.
- **Recommendation:** Run keyboard and screen-reader checks for open, close, nested, disabled, empty, filtered, and unmounted states. Treat this as a verification gap, not a confirmed defect.
- **Suggested command:** `/harden`.

## Patterns & Systemic Issues

1. **Legacy/Aurora coexistence:** The semantic token system is sound in principle, but older CSS and inline styles bypass it. This is the largest maintainability and theme-audit risk.
2. **Motion is not centrally governed:** Some styles use semantic easing tokens while others use one-off curves and layout transitions. Reduced-motion behavior is consequently incomplete.
3. **Responsive sizing is inconsistent:** Mobile controls range from 30px to 42px high. This is a recurring usability concern, not a single isolated component issue.
4. **Global clipping masks symptoms:** `overflow-x: hidden` can make future regressions harder to detect.
5. **Static quality is stronger than runtime evidence:** Lint, build, and tests pass, but contrast, visual hierarchy, touch operation, and screen-reader output still need a configured browser audit.

## Positive Findings

- [`tokens.css`](/home/eonx/Projects/SHINPO/frontend/src/styles/tokens.css) provides a real semantic foundation rather than relying solely on arbitrary per-component values.
- [`ShinpoDialog.tsx`](/home/eonx/Projects/SHINPO/frontend/src/components/ui/Dialog/ShinpoDialog.tsx) includes dialog semantics, `aria-modal`, labelled/described-by support, Escape handling, focus restoration, scroll locking, and a focus trap.
- [`ShinpoSelect.tsx`](/home/eonx/Projects/SHINPO/frontend/src/components/ui/Select/ShinpoSelect.tsx) has substantial combobox/listbox semantics: expanded state, controlled relationships, active descendant, option roles, selected state, and disabled state.
- The application has explicit reduced-motion support rather than ignoring the preference entirely.
- Lint, production build, and the existing frontend test suite all pass.
- Existing tests cover safety-sensitive behavior including confirmation defaults, markdown URL safety, task duration limits, date/time math, and truthful enforcement/status reporting.
- Lazy-loaded views and route-oriented structure show that performance and loading boundaries were considered, even though the analytics imports currently undermine one intended boundary.

## Recommendations by Priority

### Immediate

1. Verify and correct mobile hit areas for navigation, top-bar actions, and sidebar controls.
2. Expand reduced-motion overrides to all non-essential transitions, animations, and pseudo-elements.
3. Add a browser audit configuration and capture baseline screenshots, keyboard traces, and contrast measurements.

### Short-term

1. Remove or scope global horizontal clipping and add narrow viewport regression coverage.
2. Profile sidebar and shell transitions; replace layout animation where it is visible and expensive.
3. Resolve the ineffective dynamic imports and establish a measured initial-load budget.

### Medium-term

1. Create a token migration inventory for direct colors, shadows, radii, and fallback literals.
2. Consolidate legacy shell/glass styles with Aurora tokens, deleting duplicate declarations where safe.
3. Add automated contrast assertions for the semantic token matrix in light and dark themes.

### Long-term

1. Reduce repetitive side-border/stripe decoration and document when accent treatments communicate status.
2. Add screen-reader regression coverage for dialogs, comboboxes, nested overlays, and focus restoration.
3. Re-run the rendered audit on representative routes at 320px, 375px, tablet, desktop, zoomed text, and reduced-motion settings.

## Suggested Commands for Fixes

| Command | Use for | Findings |
|---|---|---|
| `/harden` | Touch targets, reduced motion, focus behavior, keyboard and screen-reader verification | H-01, H-02, M-01, L-03 |
| `/optimize` | Layout profiling, CSS/JS bundle analysis, and code-splitting cleanup | M-02, M-03, M-04, M-05 |
| `/normalize` | Semantic token migration and light/dark theme consistency | M-06 |
| `/polish` | Motion curve and decorative accent refinement after behavior is stable | L-01, L-02 |

## Validation Evidence and Limits

Executed from [`frontend/`](/home/eonx/Projects/SHINPO/frontend):

- `npm run lint` — **passed**.
- `npm run build` — **passed**, with two `INEFFECTIVE_DYNAMIC_IMPORT` warnings described in M-04.
- `npm test` — **passed**.
- `npm run audit:visual` — **blocked before rendering** because `SHINPO_URL` and the second isolated QA endpoint were not configured.

Therefore, this report does **not** claim measured contrast failures, verified horizontal overflow, broken screen-reader output, or route-level frame drops. Those remain explicit follow-up checks.
