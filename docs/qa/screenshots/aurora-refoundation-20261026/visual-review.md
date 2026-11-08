# Aurora visual verification — 2026-10-26

## Environment

- Chromium browser render, 1920×1080, 1280×720, and 900×650 (minimum supported Tauri size used by the project).
- Fresh account and disposable PostgreSQL on loopback port 15435; six explicitly labeled QA-only scheduled sessions exercised Focus history.
- AI provider disabled in QA; EONPAI correctly displays its unavailable-provider state.
- The QA API, Vite process, and disposable database were stopped/removed after capture. The personal database and local backend were not used.

## Findings fixed and reviewed

- Aurora Dashboard's existing Tasks Board was hidden by an Aurora selector, leaving a large empty lower area. It is visible again; empty task lanes have a 260px minimum height.
- Long goal labels in task cards now truncate within their flex item instead of clipping.
- Light Aurora cards use Surface 1 within the Aurora scope, matching the MUI card surface; Classic's legacy tinted-card mapping is unchanged.
- Analytics' chart-area fill now follows the semantic primary token rather than a hardcoded blue.
- Focus history, Analytics empty states, EONPAI context/composer layout, and the 769–1000px topbar layout were re-rendered and inspected.
- Chromium reported equal document `scrollWidth` and `clientWidth` on every captured route/viewport; the 10px difference from device width on some sizes is the vertical scrollbar, not horizontal overflow.

## Screenshots

- Aurora Dashboard: [dark](dashboard-aurora-dark-1920x1080.png), [light](dashboard-aurora-light-1920x1080.png), [1280×720](dashboard-aurora-dark-1280x720.png), [900×650](dashboard-aurora-dark-900x650.png).
- Aurora Focus: [dark](focus-aurora-dark-1920x1080.png), [light](focus-aurora-light-1920x1080.png), [1280×720](focus-aurora-dark-1280x720.png), [900×650](focus-aurora-dark-900x650.png).
- Aurora Analytics: [dark](analytics-aurora-dark-1920x1080.png), [light](analytics-aurora-light-1920x1080.png), [1280×720](analytics-aurora-dark-1280x720.png), [900×650](analytics-aurora-dark-900x650.png).
- Aurora EONPAI: [dark](eonpai-aurora-dark-1920x1080.png), [light](eonpai-aurora-light-1920x1080.png), [1280×720](eonpai-aurora-dark-1280x720.png), [900×650](eonpai-aurora-dark-900x650.png).
- Classic regression samples: [Focus dark](focus-classic-dark-1920x1080.png), [Focus light](focus-classic-light-1920x1080.png), [EONPAI dark](eonpai-classic-dark-1920x1080.png), [EONPAI light](eonpai-classic-light-1920x1080.png), [Focus dark 900×650](focus-classic-dark-900x650.png).
- Raw render measurements: [render-check.json](render-check.json).

## Checks and limits

- Frontend tests: 118 passed.
- ESLint: passed.
- TypeScript and Vite production build: passed.
- Classic Light inspection exposed a low-contrast active-navigation label against its dark active background. Left unchanged to preserve Classic styling; this is an existing issue outside this Aurora-scoped change.
- Chromium only: native Tauri/WebKitGTK, Windows WebView2, EONPAI provider connectivity, populated Analytics data, and hardware performance were not verified.
