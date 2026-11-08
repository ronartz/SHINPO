# Legacy Authentication Background Backup (Warp Background)

**Backup Date:** November 8, 2026  
**Source Commit:** `21244694469cfc9b85b6b877744aa458ddaa188d`  
**Original File Path:** `frontend/src/components/auth/AuthWarpBackground.tsx`  
**Original File SHA-256:** `4df77abc69ab565e8819693aee848539eb7b8224403daa29e57bb4df7be8053c`  
**CSS Backup File:** `frontend/src/legacy-backup/auth-warp/auth-warp.legacy.css`  
**CSS Backup SHA-256:** `b0d304774508f8817977b372b7b91676ca32f7f71d2e75c63b6a48791c8fab33`

---

## Restoration Instructions

To immediately restore the legacy Warp Background:
1. In `frontend/src/apps/desktop/DesktopApp.tsx`, set the configuration flag:
   ```typescript
   export const LOGIN_BACKGROUND_MODE: 'legacy-warp' | 'silk-mesh' = 'legacy-warp'
   ```
2. Or in `frontend/src/components/auth/DesktopLoginBackground.tsx`, toggle the selector or import `AuthWarpBackground`.

No manual reconstruction or file copying is needed; both components coexist cleanly with zero data loss or layout disturbance.
