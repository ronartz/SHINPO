# Fernly video reference review

**Source:** `/home/eonx/Downloads/Video-44281.mp4` (30 seconds)
**Reviewed:** 2026-10-24 in Chromium at the recorded time positions. These are design observations, not claims about Fernly's underlying implementation.

## Observed visual language

| Time | Visible state | Transferable pattern |
|---|---|---|
| 00:00–00:04 | Dashboard with left navigation, summary cards and work area | Bright, pale workspace; navy structure; compact metrics; consistent card spacing and clear page hierarchy |
| 00:02 | Create-project dialog | Background dimming, bounded white surface, focused form and distinct primary action |
| 00:04–00:07 | Time tracker | One dominant timer and a small set of unmistakable controls on a dark navy surface |
| 00:07–00:11 | Task list and four-lane board | Consistent task rows/cards, restrained status color, compact controls and visible movement feedback |
| 00:11–00:15 | Team view and profile side drawer | Context panel enters from the edge while the original workspace remains legible behind it |
| 00:15–00:19 | Month calendar and right agenda | Calendar and selected-day agenda share the page; event colors are muted and legible |
| 00:19–00:23 | Analytics and chart detail | Compact summary metrics, blue chart emphasis, readable labels and a focused tooltip |
| 00:23–00:30 | Appearance settings and accent change | Accent updates are visible across the workspace; the settings panel remains simple and spacious |

## SHINPO boundary and application

Use the surface hierarchy, spacing, typography, subdued card boundaries, blue/navy emphasis and contained transitions with SHINPO's violet identity. Apply them to SHINPO's existing Dashboard, Goals & Tasks, Focus, Calendar, Analytics, EONPAI, Rewards, Settings and account flows. Keep the currently approved sidebar collapse/expand interaction and SHINPO's existing functionality.

Do not import Fernly's teams, people, project creation, project analytics, invitations, meetings or other collaboration features. Do not imply that the video's short transitions establish a specific animation library or measured performance.

## Current checkpoint

- The existing recovery work now removes the canceled Focus Atmosphere controls, persists Goals & Tasks view mode per account, separates Rewards from account controls, reduces oversized Board empty lanes, and tightens Analytics reflection summaries.
- The current frontend TypeScript/Vite production build succeeds and `npm test` passes **106/106**.
- A Chromium screenshot of the current unauthenticated frontend was captured at `/tmp/shinpo-current-login.png`. It confirms only that the frontend launches to sign-in; the API and PostgreSQL were offline, so authenticated SHINPO pages, persistence across route changes, backend diagnosis and native Tauri rendering remain unverified.
- The video reference itself was reviewed at the visible timestamps above. No Fernly assets or product behavior were copied into SHINPO.
