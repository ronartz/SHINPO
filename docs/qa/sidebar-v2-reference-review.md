# Premium Sidebar V2 — Aurora implementation review

This is a local, reversible implementation on `prototype/sidebar-v2-interaction`. On 2026-10-23 the owner requested applying this sidebar treatment to Aurora. Scope is limited to the sidebar; the broader Dashboard and Parts 2–7 remain separate. Nothing outside the sidebar, its shell layout, sidebar-specific surface/theme overrides, and this QA material was redesigned.

## Source examined

- Authoritative reference: [Video-93212.mp4](/home/eonx/Downloads/Video-93212.mp4)
- The file is a 720×1280, 12.222708-second portrait recording. Chromium decoded it successfully; 357 playback frames were captured and inspected. This is a webpage demonstration of a sidebar UI, not evidence that SHINPO should become a mobile app.
- Observed states include a floating white rounded panel with a purple product tile, compact icon rail, explicit toggle, violet gradient active row with soft depth, pale lavender hover, progressive label/nested-link appearance, a numeric message badge, and an avatar/profile footer. Frame samples at 0, 150, 210, and 300 show expanded, active/hover presentation, compact-with-tooltip, and expanded-again states. The recording does not expose the original source CSS or exact easing curves; the timings are adaptations, not claimed copies.
- The numeric message badge and nested Dashboard/Projects group are reference-specific. SHINPO has no equivalent unread-message count or nested route group, so neither was fabricated. Its real Settings destination and real account/protection details remain available instead.

## What changed in SHINPO

- The floating rail is compact at 72px and expands to 260px on desktop. At 1280×800 it sits at x=16 and the Dashboard workspace starts at x=104 collapsed / x=292 expanded. At ≤1000px it overlays at 250px while retaining the compact workspace offset, avoiding a squeezed page.
- Labels and destinations use SHINPO's existing navigation. The violet active pill and compact active tile retain SHINPO's palette; the light version uses a white surface instead of dark colors on a white background. Footer identity and XP/level come from the actual account state.
- A rendered-browser visual pass found the active indicator initially sat 12px off-center immediately after expansion. The layout-transition frame now holds the marker in its final geometry; the final browser measurement is **0px center deviation** in expanded and collapsed states.
- The collapsed Dashboard tooltip is available on pointer hover and keyboard focus. Enter expands; Escape collapses without moving keyboard focus. Reduced-motion preference reduces the transition to the project's near-zero motion duration.

## Motion and rendered evidence

- [Side-by-side playback and keyframes](</home/eonx/Projects/SHINPO/docs/qa/sidebar-v2-motion-comparison.html>)
- Reference playback capture: [WebM](/tmp/shinpo-premium-sidebar-reference.webm), 720×1280, 11.9s, VP9.
- SHINPO choreography capture: [WebM](/tmp/shinpo-premium-sidebar-v2.webm), 1280×800, 2.9s, VP9; recorded sequence is expand, route selection, collapse.
- [Reference/prototype keyframe sheet](/tmp/shinpo-premium-sidebar-keyframes.png)
- Current app renders: [collapsed Dashboard](/tmp/shinpo-premium-sidebar-captures-qRPc0b/01-collapsed-dashboard-dark.png), [expanded Dashboard](/tmp/shinpo-premium-sidebar-captures-qRPc0b/02-expanded-dashboard-dark.png), [selected Goals route](/tmp/shinpo-premium-sidebar-captures-qRPc0b/03-active-goals-dark.png), [collapsed after selection](/tmp/shinpo-premium-sidebar-captures-qRPc0b/04-collapsed-after-selection-dark.png), and [expanded light theme](/tmp/shinpo-premium-sidebar-captures-qRPc0b/05-expanded-dashboard-light.png).
- Timing was measured in headless Chromium against the built production-preview bundle: sidebar width transition 293.8ms; the 87-frame screen capture had median frame gap 16.9ms and p95 26.1ms. During the measured animation window, rAF p95 was 16.7ms and 25/25 samples were within 33.3ms. These are this browser run's measurements, not Fedora hardware/WebKit FPS guarantees.

## Interaction verification

The focused audit `scripts/audit_premium_sidebar.mjs` used a fresh account and disposable PostgreSQL on loopback port 15433, API port 18081, and production preview port 4173. It passed:

- Dashboard beside the collapsed rail; expanded labels, widths and marker geometry.
- 30 route changes with matching destination/title; real Settings modal and account-settings entry.
- 30 expand/collapse cycles; one sidebar and eight navigation buttons remained mounted.
- Enter/Escape keyboard behavior and retained focus; collapsed tooltip; no page-level horizontal overflow at 1200, 1000, and 900px.
- Dark/light surfaces and reduced-motion styling.

Frontend regression checks: 105 tests passed, lint clean, TypeScript/Vite production build passed. See the ship matrix for the exact scope and open gates.

## Known caveats / remaining review

- The run logged a confirmed EONPAI `x-timezone` CORS preflight rejection and a separate HTTP 500 resource response. They were not traced or changed because this checkpoint is sidebar-only; do not interpret this as a clean full-app runtime.
- This is Chromium, not an authenticated packaged Tauri/WebKit session on Fedora. No hardware presentation or full populated-state visual suite has occurred. The owner authorized the Aurora sidebar treatment; review of the final running Aurora appearance remains pending. It is not merged, pushed, or release-qualified.
- QA onboarding was skipped and persisted only in the disposable DB; it is not tutorial acceptance evidence. Temporary videos and screenshots are under `/tmp` and are not durable release assets.
