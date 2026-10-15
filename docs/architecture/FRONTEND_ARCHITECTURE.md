# SHINPO (進歩) — Frontend Architecture Guide

## 1. Directory Structure

The frontend is structured around modular, feature-oriented responsibilities:

```text
frontend/src/
├── api/                  # Centralized HTTP client, service modules, WebSocket interfaces
│   ├── client.ts         # Base ApiClient with interceptors, timeout, and typed errors
│   ├── index.ts          # Unified API barrel export
│   ├── auth.ts           # Authentication & token storage services
│   ├── goalsAndMissions.ts # Goals & Missions CRUD and completion
│   ├── focusSessions.ts  # Focus Session lifecycle, pause/resume, agenda
│   ├── device.ts         # Sentinel Shield status, telemetry, warnings
│   ├── nativeShield.ts   # Native Tauri / system-level shield interface
│   ├── ai.ts             # EONPAI AI chat, planning, and controlled actions
│   ├── analytics.ts      # Productive velocity and time metrics
│   ├── websocket.ts      # WebSocket connection management and event bus
│   ├── eventNormalizer.ts# Event schema validation and translation
│   └── config.ts         # Environment URL and WebSocket resolvers
│
├── components/           # Reusable UI component modules
│   ├── common/           # Shared foundational widgets (Icon, LiveClock, ErrorBoundary)
│   ├── dialogs/          # Modal dialogs (Task, Goal, Reflection, Confirmation, Warning)
│   ├── layout/           # Desktop shell components (Sidebar, TopBar)
│   └── ShinpoLogo.tsx    # Responsive vector brand identity component
│
├── hooks/                # Domain business logic & custom state hooks
│   ├── index.ts          # Hooks barrel export
│   ├── useAuth.ts        # Authentication state, login/register, session expiration
│   ├── useTheme.ts       # Dark / Light theme and Aurora V2 preview mode state
│   ├── useNavigation.ts  # View routing, URL synchronization, responsive collapse
│   ├── useConfirmationDialog.ts # In-app accessible confirmation dialog workflow
│   └── useAlerts.ts      # Real-time notifications, toasts, and telemetry drawer
│
├── styles/               # Modular CSS architecture
│   ├── tokens.css        # Colors, radii, typography, elevation variables
│   ├── shell.css         # Desktop application shell, fixed sidebar, topbar, bento layout
│   ├── responsive.css    # Responsive tiers (1920x1080, 1440x900, 1280x800, 1000x768)
│   ├── components/       # Component-specific styles (salutation, modals, glass, telemetry)
│   ├── views/            # View-specific styles (overview, goals, focus, schedule, task manager)
│   └── foundations/      # Themes and keyframe animations
│
├── types/                # Shared TypeScript type definitions
│   └── navigation.ts     # AppView union, navigation item registry
│
├── utils/                # Pure utility functions
│   ├── focusTimer.ts     # Focus countdown calculation, digit formatting
│   ├── shinpoMessages.ts # Rotating motivational messages
│   └── renderTracker.ts  # Performance and render tracking instrument
│
├── views/                # Primary feature views / workspaces
│   ├── OverviewView.tsx  # Executive 12-column Bento Dashboard
│   ├── GoalsView.tsx     # Goals and missions Kanban/flightdeck view
│   ├── FocusView.tsx     # Active focus session engine with progress ring
│   ├── ScheduleView.tsx  # Calendar, agenda, and planned focus blocks
│   ├── TaskManagerView.tsx # Task execution board and queue management
│   ├── AnalyticsView.tsx # Velocity, productivity metrics, streak charts
│   └── EonpaiView.tsx    # EONPAI AI copilot, debriefs, action approval cards
│
├── v2/                   # Cinematic Aurora V2 design presentation layer
│   ├── theme/            # Aurora theme tokens and scoped frosted-glass styles
│   ├── components/       # Aurora-styled card surfaces and navigation pills
│   └── dashboard/        # Aurora dashboard view
│
├── App.tsx               # Primary application orchestrator
├── main.tsx              # Root entry point with top-level ErrorBoundary
└── index.css             # Base reset, document dimensions, font typography
```

---

## 2. Separation of Concerns

1. **Business Logic in Custom Hooks**:
   - Complex state transitions, API calls, timers, and validations are encapsulated inside `hooks/`.
   - UI views (`views/*.tsx`) and components (`components/*.tsx`) receive typed states and callbacks without managing raw network calls directly.

2. **Centralized API Client**:
   - All network interactions route through `api/client.ts`.
   - Authorization headers (`Bearer <token>`) are attached automatically.
   - HTTP errors are normalized into typed `ApiError` instances.
   - 401 Unauthorized responses dispatch a custom `shinpo:unauthorized` window event that logs out cleanly and notifies the user.

3. **Error Boundaries**:
   - `ErrorBoundary` wraps the entire app in `main.tsx`.
   - Individual dynamic tab views in `App.tsx` are wrapped with `ErrorBoundary` so a crash in an auxiliary view does not disrupt an ongoing Focus session.

---

## 3. Styling & Cascade Architecture

- SHINPO enforces a fixed-viewport desktop shell layout:
  - `.icon-sidebar`: Fixed to viewport left (`position: fixed; width: 270px; height: 100vh`).
  - `.icon-sidebar:not(.expanded)`: Auto-collapsed to `70px` on viewports $\le 1000$px.
  - `.app-main`: Offsets by the sidebar width (`margin-left: 270px; width: calc(100% - 270px)`).
  - All theme overrides are scoped via `.theme-light` or `[data-theme='light']`.
  - Aurora V2 styles are strictly namespaced under `.app-shell.theme-aurora` or `.aurora-viewport`.

