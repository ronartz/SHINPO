# SHINPO — End-to-End User Journeys Report

**Execution Date:** 2026-11-17  
**Branch:** `release/final-gate`  
**Test Profile Isolation:** Disposable In-Memory & Scratch Test Vaults  
**Final Status:** **PASS** (10 / 10 Journeys Verified)

---

## Journey Acceptance Matrix

### JOURNEY A — First-Time User Experience
- [x] App launches with zero prior data → Clean onboarding prompt displayed.
- [x] Registration: username, email, strong password acceptance verified.
- [x] Recovery key dialog presented with 24-word phrase; acknowledgement required.
- [x] Onboarding completes → Lands on Dashboard with helpful zero-data empty states.
- [x] Background floating particles active and rendered on WebGL/Canvas.
- [x] Zero unhandled console errors or runtime exceptions.
- **Verdict: PASS**

### JOURNEY B — Goals & Tasks Management
- [x] Create goal "Finish SHINPO release" with target completion date.
- [x] Add 3 tasks assigned under the goal with estimated focus budgets.
- [x] Move task between Kanban columns (TODO → IN_PROGRESS → COMPLETED).
- [x] Switch to List view → all tasks remain visible with stable sorting.
- [x] Optimistic task completion: updates state immediately without network delay.
- [x] Goal progress percentage dynamically recomputed from completed task ratio.
- [x] Fast text search locates task by title query.
- [x] Delete task → task is removed immediately from views and vault.
- **Verdict: PASS**

### JOURNEY C — Focus Session Full Flow
- [x] Configure 25-minute focus session with Standard guardian protection mode.
- [x] Explicit observation consent checkbox confirmed before starting.
- [x] Type session intention into dedicated input box.
- [x] Start → timer begins counting down immediately with zero lag.
- [x] Pause → timer halts countdown and persists accumulated active time.
- [x] Resume → timer continues countdown from exact paused timestamp.
- [x] Right panel bento card maintains `align-self: start` with no dead space.
- [x] Finish & reflect → reflection notes and accomplishment rating saved.
- [x] Completed session persists and updates Analytics dashboard data.
- **Verdict: PASS**

### JOURNEY D — Analytics & Verification
- [x] Completed focus session renders in consistency heatmap on the active date.
- [x] Focus Activity chart renders real time bucket bars with zero ghost traces.
- [x] Summary stats row correctly reports 1 session, focus minutes, and active streak.
- [x] Zero-data state test on fresh account: shows flat neutral heatmap and clean CTA.
- **Verdict: PASS**

### JOURNEY E — Guardian Process Monitor (Warning-Only)
- [x] Header clearly displays "Monitoring / warning-only" operational state.
- [x] System processes hidden by default; show/hide toggle functions smoothly.
- [x] Set application rule to Blocked.
- [x] Observation during focus triggers warning toast without terminating process.
- [x] UI visibly displays: "SHINPO never closes applications".
- **Verdict: PASS**

### JOURNEY F — EONPAI AI Assistant
- [x] Opens with offline introductory banner and model selection status.
- [x] Ask "Break my Finish SHINPO release goal into tasks" → generates structured proposal.
- [x] Structured proposal preview displays task titles and durations.
- [x] Approve proposal → tasks are atomically inserted into database.
- [x] Undo action reverts proposal insertion and restores prior state.
- **Verdict: PASS**

### JOURNEY G — Settings & Theme Persistence
- [x] All dropdown menus open downward below trigger button.
- [x] Switch to Classic Dark: lime accent (`#AFF33E`) applied everywhere; 0 purple/violet.
- [x] Switch to Aurora Dark: electric violet accent (`#885CF6`) applied correctly.
- [x] Theme preference persists in vault and restores upon application restart.
- **Verdict: PASS**

### JOURNEY H — Vault Lock & Process Restart
- [x] Lock vault command triggers lock screen immediately.
- [x] Keyboard shortcuts and navigation buttons blocked while locked.
- [x] Incorrect password yields generic error with no information leakage.
- [x] Correct password unlocks vault with 100% data integrity.
- [x] Simulated sudden quit (`kill -9`) followed by relaunch restores data cleanly.
- [x] Direct `strings` inspection of `.db` file confirms zero plaintext leakage.
- **Verdict: PASS**

### JOURNEY I — Recovery Key Account Restoration
- [x] Trigger "Forgot Password" workflow using saved recovery key.
- [x] Master encryption key rewrapped with new user password.
- [x] Login with new password succeeds and grants access to all existing records.
- **Verdict: PASS**

### JOURNEY J — Schedule & Calendar Views
- [x] Completed focus session appears on calendar under the correct date.
- [x] Schedule concurrent session: lane layout partitions events without overlap.
- [x] Session modal dropdowns anchor downward below input triggers.
- [x] Edit scheduled session updates timing and updates calendar display.
- **Verdict: PASS**
