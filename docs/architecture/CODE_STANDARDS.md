# SHINPO (進歩) — Coding Standards & Engineering Conventions

## 1. Naming Conventions

### File & Folder Naming
| Entity | Convention | Example |
| :--- | :--- | :--- |
| **React Components** | `PascalCase.tsx` | `Sidebar.tsx`, `CreateTaskModal.tsx` |
| **Custom Hooks** | `use<PascalCase>.ts` | `useAuth.ts`, `useFocusEngine.ts` |
| **API Modules** | `camelCase.ts` | `client.ts`, `goalsAndMissions.ts` |
| **Utilities** | `camelCase.ts` | `focusTimer.ts`, `eventNormalizer.ts` |
| **Stylesheets** | `kebab-case.css` | `shell.css`, `tokens.css`, `responsive.css` |
| **Barrel Files** | `index.ts` | `api/index.ts`, `hooks/index.ts` |

### Code Identifiers
- **Component Functions**: `PascalCase` (`export function OverviewView(...)`)
- **Hook Functions**: `camelCase` starting with `use` (`export function useNavigation(...)`)
- **Types / Interfaces**: `PascalCase` (`Goal`, `FocusSession`, `AuthUser`)
- **Constants**: `UPPER_SNAKE_CASE` (`NAVIGATION_ITEMS`, `TOKEN_KEY`)
- **Functions / Handlers**: `camelCase` with verb prefixes (`handleSelectTab`, `fetchCurrentUser`)

---

## 2. Component Design Principles

1. **Separation of Business Logic**:
   - UI components should be pure and focused on presentation.
   - Extract state transitions, timer intervals, and network calls into custom hooks (`hooks/`).

2. **Error Boundary Wrapping**:
   - Top-level components and all major workspace views MUST be protected with `<ErrorBoundary>` to avoid white-screen crashes.

3. **Accessibility (a11y)**:
   - All interactive icon buttons MUST include `title` and `aria-label` attributes.
   - Modals MUST trap focus, provide `role="dialog"`, and respond to the `Escape` key.
   - Use semantic elements (`<header>`, `<aside>`, `<main>`, `<nav>`, `<button>`).

4. **Styling Hygiene**:
   - Use CSS custom properties defined in `styles/tokens.css`.
   - Never use arbitrary `!important` declarations outside of verified responsive breakpoint overrides.
   - Keep layout-critical coordinates (`position: fixed`, `width: 270px`) centralized in `shell.css`.

