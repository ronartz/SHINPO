# SHINPO — Universal Interactive Button & Theme-Aware Energy System Repair Report

**Date:** November 16, 2026  
**Repository:** `ronartz/SHINPO`  
**Branch:** `fix/systematic-layout-and-composition`  
**Execution Mode:** Production-Grade Repair & Verification (Offline Standalone Local-First)  

---

## 1. Executive Summary

The Universal Interactive Button & Theme-Aware Energy Feedback System (originally introduced in commit `1571646`) was designed to provide FlameButton-inspired edge-sensitive energy aura, cursor-following sheen, tactile press compression, and click ripple activation pulses across all native and shared buttons in SHINPO. However, across the real application UI, buttons appeared static, aura glows failed to render, edge lighting failed to respond to mouse trajectory, and press compression was intermittently broken.

This investigation conducted a root-cause diagnosis across the mathematical engine, event delegation lifecycle, and CSS stacking/cascade pipeline. All 5 identified architectural and rendering defects have been resolved, verified empirically across all 4 canonical themes, tested against an expanded 247-test suite, and validated with live DOM style extraction and Playwright visual acceptance captures.

---

## 2. Exact Root Causes & Diagnostic Findings

Empirical inspection of `interactiveButtonPhysics.ts`, `interactiveButtonListener.ts`, `interactive-button.css`, and `desktop.css` revealed five distinct root causes:

### Root Cause 1: CSS Selector Exclusion of Native UI Buttons
- **Defect:** `interactive-button.css` previously scoped its `::before` (aura) and `::after` (sheen) pseudo-elements exclusively to `.shinpo-interactive-btn`, `.btn-timer`, and `[data-interactive-btn]`.
- **Impact:** Native HTML buttons (`<button class="sidebar-btn">`, modal actions, preset chips, goal buttons) never matched the pseudo-element rules. In computed styles, `::before` and `::after` evaluated to `content: "none"`, preventing any glow or sheen from rendering.
- **Resolution:** Overhauled base selectors to target `button:not([data-no-interactive]):not(.no-interactive)` and `[data-interactive-btn]`, while establishing `position: relative`, `isolation: isolate`, and strict child z-index ordering (`> * { z-index: 2; pointer-events: none; }`).

### Root Cause 2: Stacking Context & Opaque Background Masking
- **Defect:** The outer aura pseudo-element (`::before`) was defined with `inset: -4px` and `z-index: -1` inside elements with `isolation: isolate`.
- **Impact:** In CSS specification, child pseudo-elements with `z-index: -1` render *behind* their parent element's background painting layer. Because buttons across SHINPO have opaque dark or tinted backgrounds (`#0F172A`, `#131B2E`, `#AFF33E`), the entire radial gradient aura was painted behind the element background and completely clipped.
- **Resolution:** Re-architected the pseudo-element layering. For primary variants, `::before` now casts a luminous blur halo beyond the border-box (`filter: blur(8px)` with opacity modulated by edge proximity). For all buttons, child contents are elevated to `z-index: 2` while sheen sits at `z-index: 1` directly on top of the button background.

### Root Cause 3: Invisibility of `mix-blend-mode: overlay` on Low-Luminance Dark Surfaces
- **Defect:** The cursor-following radial sheen on `::after` utilized `mix-blend-mode: overlay`.
- **Impact:** In the W3C Compositing and Blending specification, the formula for `overlay` with background luminance $B < 0.5$ is:
  $$\text{Result} = 2 \times B \times S$$
  On dark surfaces such as Carbon (`#0F172A`, $B \approx 0.08$) and Midnight (`#0B0F19`, $B \approx 0.05$), this formula multiplies the sheen color down to near-zero contrast ($< 2\%$). The cursor-tracking highlight was mathematically invisible on dark themes.
- **Resolution:** Replaced `mix-blend-mode: overlay` with direct alpha-blended radial gradients using CSS `color-mix(in srgb, white 40%, var(--btn-energy-primary))` transitioning cleanly to transparent. This produces vivid, crisp cursor highlights across Classic Dark, Classic Light, Aurora Dark, and Aurora Light.

### Root Cause 4: Discontinuous 12% vs 88% Pointer Position Jump
- **Defect:** In `interactiveButtonPhysics.ts`, `edgePercent` was calculated using a discontinuous ternary:
  ```ts
  const edgePercent = normX >= 0.5 ? 88 : 12;
  ```
- **Impact:** As the user moved their mouse horizontally across the center of any button, the CSS variable `--btn-edge-side` jumped discontinuously by 76% (from 12% to 88%) at the midpoint ($normX = 0.5$), resulting in an unnatural flickering pop instead of a smooth beam transition.
- **Resolution:** Implemented continuous linear interpolation across the button width:
  $$\text{edgePercent} = 12 + 76 \times \text{normX}$$
  At left edge ($\text{normX} = 0.0$): 12.0%. At center ($\text{normX} = 0.5$): 50.0%. At right edge ($\text{normX} = 1.0$): 88.0%.

### Root Cause 5: Stylesheet Cascade Order Inversion
- **Defect:** In `frontend/src/apps/desktop/styles/desktop.css`, `@import '../../../styles/components/interactive-button.css'` was located at line 20, preceding view stylesheets (`focus-engine.css`, `task-manager.css`) and `microkit-motion.css`.
- **Impact:** Individual view rules (e.g. `.btn-timer:hover { transform: translateY(-1px); }`) and `:active` rules overrode the universal interactive button transforms (`scale(0.972)` tactile press compression) and ripple box-shadows.
- **Resolution:** Moved `@import '../../../styles/components/interactive-button.css'` to the very bottom of `desktop.css` (Section 10), ensuring that the universal tactile interaction transforms, press states, and pulse animations cascade with definitive precedence.

---

## 3. Files Modified & Changes Summary

| File | Changes Made |
| :--- | :--- |
| [frontend/src/utils/interactiveButtonPhysics.ts](file:///home/eonx/Projects/SHINPO/frontend/src/utils/interactiveButtonPhysics.ts) | Fixed `edgePercent` to continuous linear interpolation ($12 + 76 \times \text{normX}$). Added normalized `normY` tracking. Preserved `calculateEdgeProximity` curve ($(\text{distanceFromCenter})^{1.6}$). |
| [frontend/src/utils/interactiveButtonListener.ts](file:///home/eonx/Projects/SHINPO/frontend/src/utils/interactiveButtonListener.ts) | Enhanced delegated listener to target all `button`, `[data-interactive-btn]`, `[role="button"]`. Added `pointerover` to initialize coordinates without latency. Added keyboard `keydown`/`keyup` for Enter and Space tactile triggers. Added `.is-pressed` class and `--btn-pressed` variable management. Excluded `disabled`, `aria-disabled`, `is-loading`, `data-loading="true"`, `role="switch"`, `role="checkbox"`, and `data-no-interactive`. |
| [frontend/src/components/common/InteractiveButton.tsx](file:///home/eonx/Projects/SHINPO/frontend/src/components/common/InteractiveButton.tsx) | Added `normY` state tracking. Added keyboard event handlers (`onKeyDown`, `onKeyUp`). Managed `.is-pressed` class synchronization. Reset hover and press states cleanly on `onPointerLeave`. |
| [frontend/src/styles/components/interactive-button.css](file:///home/eonx/Projects/SHINPO/frontend/src/styles/components/interactive-button.css) | Scoped base styles to all non-excluded native and custom buttons. Replaced invisible `overlay` blend mode with alpha-blended radial gradients. Configured tactile press compression (`scale(0.972)`). Added `shinpo-btn-activation-pulse` animation. Enforced strict reduced-motion and disabled/loading suppression. |
| [frontend/src/apps/desktop/styles/desktop.css](file:///home/eonx/Projects/SHINPO/frontend/src/apps/desktop/styles/desktop.css) | Moved `interactive-button.css` import to the very bottom (Section 10) to guarantee cascade override over view-level `:hover` and `:active` transforms. |
| [frontend/src/components/common/InteractiveButton.test.ts](file:///home/eonx/Projects/SHINPO/frontend/src/components/common/InteractiveButton.test.ts) | Expanded unit test suite from 12 to 29 tests covering all 16 regression dimensions, including mock DOM delegation, nested elements, dynamic buttons, keyboard triggers, disabled exclusion, theme token resolution, and reduced motion. |
| [frontend/scripts/verify_interactive_buttons.mjs](file:///home/eonx/Projects/SHINPO/frontend/scripts/verify_interactive_buttons.mjs) | Extended visual acceptance test script with live DOM computed style extraction, multi-theme hover/press verification, 1440×900 and 1920×1080 resolution testing, variants matrix gallery, destructive action modals, and reduced motion validation. |
| [.gitignore](file:///home/eonx/Projects/SHINPO/.gitignore) | Ignored `docs/qa/screenshots/**/*.png` and `docs/qa/screenshots/*.png` to permanently prevent binary screenshot git bloat while maintaining repository scaffolds. |

---

## 4. Before vs After Behavioral Comparison

| Dimension | Before Repair | After Repair |
| :--- | :--- | :--- |
| **Native Button Support** | Ignored by CSS selectors; pseudo-elements had `content: "none"`. | Universal delegation automatically binds and tracks coordinates on all native `<button>` elements. |
| **Cursor Tracking** | Discontinuous jump from 12% to 88% at midpoint; `overlay` blend mode invisible on dark carbon/midnight. | Smooth continuous linear interpolation ($12\% \to 88\%$); vibrant alpha-blended gradient visible on all surfaces. |
| **Edge Proximity Aura** | Masked behind opaque button background in isolated stacking context. | `::before` radial energy aura projects smoothly outward with edge-accelerated opacity ($(\Delta x)^{1.6}$). |
| **Tactile Press** | Inconsistently overridden by view CSS transforms (`translateY(-1px)`). | Guaranteed `scale(0.972)` tactile compression with smooth 80ms release across all buttons. |
| **Click Pulse / Ripple** | Unreliable or missing on native buttons. | 280ms cubic-bezier activation ring pulse (`shinpo-btn-activation-pulse`) with theme-specific ripple colors. |
| **Keyboard Accessibility** | Enter/Space triggered standard click without tactile visual feedback. | `keydown` and `keyup` listeners dynamically trigger `.is-pressed` and `.is-activating` pulse. |
| **Disabled & Loading States** | Partially received hover variables and pointer cursors. | Cleanly suppressed: `opacity: 0.48`, `pointer-events: none`, pseudo-elements `display: none !important`. |
| **Reduced Motion** | Not universally respected across button view rules. | `@media (prefers-reduced-motion: reduce)` removes all transforms, transitions, and aura animations. |

---

## 5. Representative Buttons Verified Across Views

The interactive system was verified on live application DOM across key workflows:

1. **Focus Engine:**
   - Primary Session Timer Trigger: `button.btn-timer.primary` (`Start Focus Session`)
   - Duration Preset Chips: `.preset-chip` (25m Pomodoro, 50m Deep Work)
2. **Global Sidebar Navigation:**
   - Navigation Items: `.sidebar-btn` (with nested SVG icon and text span)
   - Sidebar Toggle Action: `.sidebar-toggle-btn`
3. **Task Manager:**
   - Task Item Actions: `.tm-action-btn`, Focus Launch buttons
4. **Modal Dialogs:**
   - Destructive Database Reset: `.shinpo-interactive-btn.variant-destructive` (`#F87171` danger tokens)
   - Secondary Cancel Action: `.shinpo-interactive-btn.variant-secondary`
5. **Shared Component Gallery:**
   - `InteractiveButton`, `ShinpoButton`, `AuroraButton` across Primary, Secondary, Outline, Ghost, Destructive, Icon (38px), Compact (32px), and Floating variants.

---

## 6. Empirical Multi-Theme Visual & Computed Style Evidence

Live DOM evaluation was executed via Playwright headless Chromium against the production Vite build (`frontend/dist`) across all four canonical themes.

### Theme 1: Classic Dark (Carbon `#0F172A` + Lime `#AFF33E` + Text `#020617`)
- **Center Hover:** `--btn-norm-x: 0.500`, `--btn-edge-proximity: 0.000`, `--btn-edge-side: 50%`, `--btn-energy-primary: #aff33e`
- **Left Edge:** `--btn-norm-x: 0.080`, `--btn-edge-proximity: 0.757`, `--btn-edge-side: 18.1%`
- **Right Edge:** `--btn-norm-x: 0.920`, `--btn-edge-proximity: 0.757`, `--btn-edge-side: 81.9%`
- **Press Compression:** `--btn-pressed: 1`, `is-pressed: true`, computed `transform: matrix(0.972, 0, 0, 0.972, 0, 0)`
- **Artifacts:**
  - [01_classic-dark_button_hover_edge.png](file:///home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/buttons/01_classic-dark_button_hover_edge.png)
  - [01_classic-dark_button_press_active.png](file:///home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/buttons/01_classic-dark_button_press_active.png)

### Theme 2: Classic Light (Warm Ivory + Olive Green `#4D7C0F`)
- **Center Hover:** `--btn-norm-x: 0.500`, `--btn-edge-proximity: 0.000`, `--btn-edge-side: 50%`, `--btn-energy-primary: #4d7c0f`
- **Left Edge:** `--btn-norm-x: 0.080`, `--btn-edge-proximity: 0.757`, `--btn-edge-side: 18.1%`
- **Right Edge:** `--btn-norm-x: 0.920`, `--btn-edge-proximity: 0.757`, `--btn-edge-side: 81.9%`
- **Press Compression:** `--btn-pressed: 1`, `is-pressed: true`, computed `transform: matrix(0.972, 0, 0, 0.972, 0, 0)`
- **Artifacts:**
  - [02_classic-light_button_hover_edge.png](file:///home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/buttons/02_classic-light_button_hover_edge.png)
  - [02_classic-light_button_press_active.png](file:///home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/buttons/02_classic-light_button_press_active.png)

### Theme 3: Aurora Dark (Midnight `#0B0F19` + Violet `#9757FA` + Cyan `#1BC9DE`)
- **Center Hover:** `--btn-norm-x: 0.500`, `--btn-edge-proximity: 0.000`, `--btn-edge-side: 50%`, `--btn-energy-primary: #9757fa`, `afterOpacity: 0.55`
- **Left Edge:** `--btn-norm-x: 0.080`, `--btn-edge-proximity: 0.757`, `--btn-edge-side: 18.1%`
- **Right Edge:** `--btn-norm-x: 0.920`, `--btn-edge-proximity: 0.757`, `--btn-edge-side: 81.9%`
- **Press Compression:** `--btn-pressed: 1`, `is-pressed: true`, computed `transform: matrix(0.972017, 0, 0, 0.972017, 0, 0)`
- **Artifacts:**
  - [03_aurora-dark_button_hover_edge.png](file:///home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/buttons/03_aurora-dark_button_hover_edge.png)
  - [03_aurora-dark_button_press_active.png](file:///home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/buttons/03_aurora-dark_button_press_active.png)

### Theme 4: Aurora Light (Soft Violet `#7C3AED` + Sky Blue `#0284C7`)
- **Center Hover:** `--btn-norm-x: 0.500`, `--btn-edge-proximity: 0.000`, `--btn-edge-side: 50%`, `--btn-energy-primary: #7c3aed`, `beforeOpacity: 0.0275`
- **Left Edge:** `--btn-norm-x: 0.080`, `--btn-edge-proximity: 0.757`, `--btn-edge-side: 18.1%`
- **Right Edge:** `--btn-norm-x: 0.920`, `--btn-edge-proximity: 0.757`, `--btn-edge-side: 81.9%`
- **Press Compression:** `--btn-pressed: 1`, `is-pressed: true`, computed `transform: matrix(0.972269, 0, 0, 0.972269, 0, 0)`
- **Artifacts:**
  - [04_aurora-light_button_hover_edge.png](file:///home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/buttons/04_aurora-light_button_hover_edge.png)
  - [04_aurora-light_button_press_active.png](file:///home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/buttons/04_aurora-light_button_press_active.png)

### Additional Verified Configurations
- **1920×1080 Full HD Viewport:** Verified button geometry, spacing, and hover aura scaling on large displays.  
  Artifact: [05_1920x1080_full_hd_button_interaction.png](file:///home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/buttons/05_1920x1080_full_hd_button_interaction.png)
- **Variants Matrix Gallery:** Verified side-by-side rendering of Primary, Secondary, Outline, Ghost, Destructive, Icon, Compact, and Floating buttons.  
  Artifact: [06_button_variants_matrix.png](file:///home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/buttons/06_button_variants_matrix.png)
- **Destructive Modal Action:** Verified danger semantic token preservation (`#F87171` / `#DC2626`) during hover and press.  
  Artifact: [07_destructive_button_behavior.png](file:///home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/buttons/07_destructive_button_behavior.png)
- **Reduced Motion Compliance:** Verified that `(prefers-reduced-motion: reduce)` removes animations, transforms, and glow filters.  
  Artifact: [08_reduced_motion_behavior.png](file:///home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/buttons/08_reduced_motion_behavior.png)

---

## 7. Quality Gate Verification Results

| Quality Gate | Command | Result | Notes |
| :--- | :--- | :--- | :--- |
| **Vite Production Build** | `npm --prefix frontend run build` | **PASS** (610ms) | Zero compilation errors; asset chunks and stylesheets generated cleanly. |
| **Node.js Test Suite** | `npm --prefix frontend test` | **PASS** (247/247 passing) | 17 suites, 247 tests passing in 2.49s; zero regressions across auth, focus, vault, and UI. |
| **ESLint Static Analysis** | `npm --prefix frontend run lint` | **PASS** (0 errors) | Zero errors across all TypeScript and React files. |
| **Release QA Gate** | `./scripts/qa-release.sh quick` | **PASS** | Automated release runner confirmed `Gate [Quick] finished with status: PASS`. |

---

## 8. Remaining Limitations & Architectural Boundaries

1. **Standalone Offline Constraint:** All button aura colors and physics run 100% locally on client CSS custom properties and delegated pointer events. No network requests or cloud telemetry are involved.
2. **WebGL Logo Isolation:** The WebGL2 glass logo canvas on the startup splash operates independently from the DOM button engine to avoid GPU context contention.
3. **High-Contrast OS Modes:** In high-contrast accessibility modes, Windows/Linux forced-colors rules will override custom CSS gradients with system button colors (`ButtonFace`, `ButtonText`), preserving OS accessibility contracts.
