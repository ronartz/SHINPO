# SHINPO — OPERATION SILK LOGIN BACKGROUND ACCEPTANCE REPORT
## Exact WebGL Animation Replacement with Guaranteed Reversion

**Date:** November 8, 2026  
**Application:** SHINPO (進歩) — Personal Execution OS  
**Branch:** `feature/separate-desktop-mobile-architecture`  
**Git Baseline Commit:** `21244694469cfc9b85b6b877744aa458ddaa188d`  
**Reference Source:** `SilkMeshShaderHero` (`/home/eonx/.local/share/klipper/data/d0d32b8823456cc01f782aa378ff31668638fc8d/d0d32b8823456cc01f782aa378ff31668638fc8d`)

---

## 1. Executive Summary & Protection Verification

Operation Silk Login Background has replaced **ONLY** the animated background behind SHINPO's desktop authentication card with the owner's supplied WebGL silk-mesh shader animation. 

### Scope Boundaries Verified (100% Protected):
- **Login Card Unchanged:** The login card position, dimensions, glass styling, typography, logo, inputs, action buttons, password visibility toggle, error displays, and vault unlock logic remain completely untouched.
- **Form Interactivity Preserved:** The container and canvas elements strictly use `pointer-events: none; z-index: 0; contain: strict;`. Pointer deflection and click ripples are captured passively via window-level listeners with `{ passive: true }`, ensuring no click interception or `preventDefault()` on form elements.
- **Theme Reactivity:** Real-time color updates across all 4 themes (**Aurora Dark**, **Aurora Light**, **Classic Dark**, **Classic Light**) using ref-based uniform caching (`live.current`), eliminating WebGL context recreation or visual stutter during theme changes.
- **Rollback Guarantee:** The legacy Warp Background is preserved in production code and backed up with cryptographic checksums. A single-switch toggle allows instant zero-downtime rollback.

---

## 2. Cryptographic Legacy Backup & Reversion Protocol

Before writing new code, the legacy Warp Background was archived outside active import paths:

| File | Location | SHA-256 Checksum |
| :--- | :--- | :--- |
| **Original Component** | `frontend/src/components/auth/AuthWarpBackground.tsx` | `4df77abc69ab565e8819693aee848539eb7b8224403daa29e57bb4df7be8053c` |
| **Versioned Backup** | `frontend/src/legacy-backup/auth-warp/AuthWarpBackground.legacy.tsx` | `4df77abc69ab565e8819693aee848539eb7b8224403daa29e57bb4df7be8053c` |
| **CSS Backup** | `frontend/src/legacy-backup/auth-warp/auth-warp.legacy.css` | `b0d304774508f8817977b372b7b91676ca32f7f71d2e75c63b6a48791c8fab33` |

### Single-Switch Reversion Mechanism:
In `frontend/src/apps/desktop/components/DesktopLoginBackground.tsx`:
```typescript
export const DEFAULT_LOGIN_BACKGROUND_MODE: 'silk-mesh' | 'legacy-warp' = 'silk-mesh'
```
To revert to the legacy Warp Background:
1. **Permanent:** Change `DEFAULT_LOGIN_BACKGROUND_MODE` to `'legacy-warp'`.
2. **Runtime Override:** Pass `?loginBg=legacy-warp` as a URL query parameter or execute `sessionStorage.setItem('shinpo_login_bg', 'legacy-warp')`.

---

## 3. WebGL Silk-Mesh Implementation Architecture

### 3.1 Shader Characteristics
The shader reproduces the exact visual characteristics of the reference `SilkMeshShaderHero`:
- **Domain Warping:** Iterative sinusoidal warping producing organic silk folds.
- **Lighting & Specular Highlights:** Surface normal derivation (`hx`, `hy`) combined with directional lighting (`L`) and high-exponent specular highlights (`spec = pow(..., 16.0)`).
- **Displaced Mesh Grid:** Fine wireframe grid lines displaced along the fold normals, concentrated toward lower frame areas.
- **Pulse Rings & Ripples:** Radial waves expanding from the center-right and localized click-induced ripple waves.
- **Grading & Vignette:** Subtle vignette curve and high-frequency micro-grain grading for a cinematic texture.

### 3.2 Theme Palette Mappings
| Theme | Shadow (`uC0`) | Body (`uC1`) | Fold (`uC2`) | Highlight / Mesh (`uC3`) |
| :--- | :--- | :--- | :--- | :--- |
| **Aurora Dark** | `#060818` (Cosmic void) | `#3B1D7A` (Aurora violet) | `#4D77F9` (Electric blue) | `#1BC9DE` (Glacial cyan) |
| **Aurora Light** | `#F0F4FF` (Ice white) | `#DBEAFE` (Sky tint) | `#C4B5FD` (Lavender fold) | `#7C3AED` (Royal violet) |
| **Classic Dark** | `#070C09` (Obsidian) | `#10281B` (Deep pine) | `#1B4A32` (Sage emerald) | `#AFF33E` (SHINPO electric lime) |
| **Classic Light**| `#FAF8F4` (Ivory cream) | `#ECE7DA` (Warm linen) | `#D8D1BC` (Sand fold) | `#4D7C0F` (Olive lime) |

### 3.3 Robustness & Device Adaptation
1. **Precision Fallback:** `#ifdef GL_FRAGMENT_PRECISION_HIGH` ensures high-precision on desktop GPUs and medium-precision fallback on embedded Linux WebKitGTK drivers.
2. **DPR Capping:** Canvas backing resolution is clamped to `Math.min(2, window.devicePixelRatio)` to prevent fill-rate saturation on 4K/retina displays.
3. **Reduced Motion:** If `(prefers-reduced-motion: reduce)` is active, a single static frame is rendered with `uIntro = 1.0` and no continuous requestAnimationFrame loop runs.
4. **Lifecycle Pausing:** Animation automatically halts when the window is hidden (`visibilitychange`) or the container is off-screen (`IntersectionObserver`), resuming seamlessly.
5. **Context Recovery:** Subscribes to `webglcontextlost` (calling `preventDefault()`) and `webglcontextrestored`.
6. **CSS Fallback:** If WebGL context creation fails or shader compilation errors occur, an animated multi-stop CSS gradient fallback is activated automatically.

---

## 4. Empirical Test Evidence

### 4.1 Automated Test Execution
- **Frontend Unit Tests:** `170/170 passed` (9 test suites, including dedicated `SilkLoginBackground.test.ts`).
- **Cargo Shinpo-Shield Tests:** `90/90 passed` (50 lib tests + 40 integration tests).
- **Cargo Tauri Native Tests:** `73/73 passed` (1 ignored live OS keyring test).

### 4.2 Motion Frame Verification
To empirically verify that WebGL animation is continuously advancing, three sequential frames were captured at 500ms intervals. All three frame hashes differ:
- **Frame 1:** `38cff6822122fca1d20d0ad7faf7a79e30d7b12cdadaae0fd8b7526c5e3c75c4`
- **Frame 2:** `70caae27b8d24947e1d66a998ec05eee3f357939212d20219ad055d3e87d9d35`
- **Frame 3:** `e6089193c8055d7dff6e55880c9f5dca6c6e798740feb832f39eee639326aa3f`

### 4.3 Form Interactivity Verification
In `interaction_login_filled_1440x900.png`, the user hovered over the silk (triggering silk cloth deflection), clicked the background (triggering a ripple wave), and successfully focused and filled the username (`ronartz`) and password inputs without any event interruption.

### 4.4 Rollback Verification
In `rollback_login_aurora_dark_1440x900.png`, navigating with `?loginBg=legacy-warp` proved that the legacy Warp Background immediately renders in place of the silk mesh.

---

## 5. Visual Artifact Index

All screenshots are stored locally in `docs/qa/screenshots/silk-login/` and the system artifact directory.

### Baseline (16 Captures):
- `docs/qa/screenshots/silk-login/baseline/baseline_login_aurora_dark_1440x900.png`
- `docs/qa/screenshots/silk-login/baseline/baseline_login_aurora_light_1440x900.png`
- `docs/qa/screenshots/silk-login/baseline/baseline_login_classic_dark_1440x900.png`
- `docs/qa/screenshots/silk-login/baseline/baseline_login_classic_light_1440x900.png`
*(plus 1280x720, 960x600, 1920x1080 for each)*

### After (16 Captures):
- `docs/qa/screenshots/silk-login/after/after_login_aurora_dark_1440x900.png`
- `docs/qa/screenshots/silk-login/after/after_login_aurora_light_1440x900.png`
- `docs/qa/screenshots/silk-login/after/after_login_classic_dark_1440x900.png`
- `docs/qa/screenshots/silk-login/after/after_login_classic_light_1440x900.png`
*(plus 1280x720, 960x600, 1920x1080 for each)*

### Verification Captures:
- `docs/qa/screenshots/silk-login/after/rollback_login_aurora_dark_1440x900.png`
- `docs/qa/screenshots/silk-login/after/interaction_login_filled_1440x900.png`
- `docs/qa/screenshots/silk-login/after/motion_silk_frame_1_1440x900.png`
- `docs/qa/screenshots/silk-login/after/motion_silk_frame_2_1440x900.png`
- `docs/qa/screenshots/silk-login/after/motion_silk_frame_3_1440x900.png`
