# SHINPO Design System

This document records SHINPO's Classic and Aurora color systems. Both support dark and light modes. `frontend/src/styles/tokens.css` is the color source of truth; `frontend/src/v2/theme/auroraTokens.ts` and `auroraTheme.ts` map Aurora tokens into Material UI. Palette application does not imply that every screen has been visually accepted.

## Product character

SHINPO is a focused desktop productivity workspace. The interface should feel calm, capable, legible, and deliberate. Visual emphasis belongs to the user's next action and verified progress. Avoid decoration that competes with task, focus, or protection state.

## Color semantics

| Role | Classic dark | Classic light | Aurora dark | Aurora light | Use |
|---|---|---|---|---|---|
| Canvas | `#020617` | `#F4EDE0` | `#1F3D2B` | `#E8DCC4` | App background |
| Surface 1 | `#0F172A` | `#FFF9F0` | `#294736` | `#F4EDE0` | Primary cards and panels |
| Surface 2 | `#1E293B` | `#E8DCC4` | `#335541` | `#DED1B8` | Secondary regions, muted surfaces, borders |
| Surface 3 | `#1E293B` | `#DACBB0` | `#42684F` | `#D2C2A4` | Elevated and selected controls |
| Brand accent | `#AFF33E` | `#4D7C0F` | `#885CF6` | `#885CF6` | Classic lime; Aurora violet identity |
| Accessible primary action | `#AFF33E` | `#4D7C0F` | `#B9A1FF` | `#6936DF` | Near-black foreground on Classic dark lime, white on Classic light green and Aurora light purple; dark forest text on Aurora dark purple |
| Keyboard focus | `#AFF33E` | `#4D7C0F` | `#B9A1FF` | `#6936DF` | Visible focus and execution state |
| Main text | `#F8FAFC` | `#14213D` | `#F4EDE0` | `#1F3D2B` | Body and headings |
| Success | `#16A36A` | `#087A50` | `#16A36A` | `#087A50` | Verified completion |
| Warning | `#B7791F` | `#8A5700` | `#B7791F` | `#8A5700` | Caution and upcoming limits |
| Danger | `#F87171` | `#B91C1C` | `#F87171` | `#B91C1C` | Destructive or blocked state |

Classic dark uses `#14532D` as its supporting forest accent and `#991B1B` for destructive surfaces. Its chart sequence is `#AFF33E`, `#3B82F6`, `#22C55E`, `#A855F7`, and `#F59E0B`. Classic light keeps the warm cream surfaces and uses a darker lime-family action (`#4D7C0F`) so white action text remains readable. Aurora's forest, sand, violet and blue system remains independently mapped.

`data-brand="classic|aurora"` selects the palette and `data-theme="dark|light"` selects its mode. The exact Aurora identity purple is `--aurora-electric-purple: #885CF6`; accessible action shades are used where needed to preserve readable foreground contrast. Semantic success, warning, and danger colors remain distinct from brand accents.

Use semantic variables such as `--color-primary`, `--color-focus`, `--color-ai`, `--color-success`, `--color-warning`, and `--color-danger`; do not hardcode palette values in components. Keep legacy aliases only for compatibility while migrating callers.

## Typography

The interface uses Nunito with platform sans-serif fallbacks. Use the shared scale: display 28px, title 22px, heading 18px, subheading 16px, body 15px, label 14px, caption 13px, metadata 12px. Use the monospace stack for times, durations, IDs, and other values where aligned digits help scanning. Keep labels and supporting text readable at normal desktop scale.

## Spacing and shape

Use the 4px spacing rhythm: 4, 8, 12, 16, 24, 32, 48, and 64px. Standard radii are 6, 8, 10, 12, and 16px; pill shape is reserved for compact status chips. Borders should distinguish adjacent surfaces without adding visual noise. Keep elevation restrained; the canonical glow shadow is `none`.

## Motion

Motion is state feedback, not ambient decoration. Current token durations are 150ms for hover, 210ms for controls, 320ms for panels, and 380ms for page transitions, using the shared kinetic easing. Respect reduced-motion preferences. Avoid continuous motion and large layout shifts.

## Component guidance

- **Navigation:** stable icon alignment, clear selected state, visible keyboard focus, reversible collapse behavior.
- **Buttons and forms:** clear primary/secondary/destructive hierarchy; consistent heights and spacing; preserve readable disabled, loading, and error states.
- **Cards and dialogs:** align to a shared spacing grid, use one clear heading and action area, and keep content from colliding at narrow desktop widths.
- **Focus:** reserve the focus token for active execution; communicate paused, break, and completed states distinctly and truthfully.
- **EONPAI:** use Aurora violet as the AI identity accent; distinguish generated suggestions from confirmed application actions.
- **Charts and progress:** use persisted product data, labeled units, and restrained semantic colors. Never imply activity or protection that was not recorded.
- **Light mode:** keep surfaces warm and readable while retaining each brand's accent hierarchy.

## Implementation references

- CSS tokens: `frontend/src/styles/tokens.css`
- Aurora token map: `frontend/src/v2/theme/auroraTokens.ts`
- Material UI theme: `frontend/src/v2/theme/auroraTheme.ts`
- Aurora component styling: `frontend/src/v2/theme/aurora.css`

When these files disagree, inspect their active consumers and fix the canonical token mapping first. Do not use this document as evidence that a screen has been visually tested.
