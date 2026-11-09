# SHINPO Frontend Systematic Layout Audit (Phase 0 Baseline)

**Date:** 2026-11-09T15:00:48.066Z
**Total Findings:** 1575
**P0 (Critical Collisions / Text Missing):** 54
**P1 (Overlaps / Redundancy / Misalignment / Fill Ratio):** 66
**P2 (Dead Space / Text Size):** 1455

## Defect Mapping from Red-Circled Visual Evidence

| User Red-Circled Area | Defect Description | Target Detector | Current Audit Status |
| :--- | :--- | :--- | :--- |
| **Area 1: Focus Intention Void** | ~340px empty space in intention card | **D1 EMPTY BOX & D4 DEAD SPACE** | Intention card reduced to 264.5px; hugs content cleanly |
| **Area 2: Guardian Mode Hollow Buttons** | 72px buttons with empty space inside | **D3 MISSING CONTENT & D4 DEAD SPACE** | Sub-labels added to buttons; padding condensed |
| **Area 3: Consent Label Border Touch** | `legend` touches border without padding | **D5 OVERLAP (Legend Padding)** | Flagged by D5; legend needs reserved space/padding-top |
| **Area 4: Duration Presets Redundancy** | Tabs (15m, 30m..) AND Plan cards (55m..) | **D9 REDUNDANCY** | Flagged by D9; single compact control required |
| **Area 5: Installed Apps Contradicting Badge** | Badge reads 0 while subtitle says 78 | **D6 COUNTER CONTRADICTION** | Fixed in TaskManagerView (now shows discovered count) |
| **Area 6: Installed Apps 40px Gutter Drift** | List indented 40px right of search | **D6 MISALIGNMENT** | Fixed in task-manager.css (padding: 0 4px 0 0) |

## Detailed Findings Table (Ranked by Severity)

| Severity | Detector | Screen | Viewport | Element Selector | Measured Value | Message |
| :---: | :--- | :--- | :---: | :--- | :---: | :--- |
| **P0** | D5 OVERLAP | Focus Protection | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 788 | Physical text overlap of 788px² between "discord" and "View default distrac" |
| **P0** | D5 OVERLAP | Focus Protection | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 331 | Physical text overlap of 331px² between "Spotify" and "Website restrictions" |
| **P0** | D5 OVERLAP | Focus Protection | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 405 | Physical text overlap of 405px² between "Block" and "Website restrictions" |
| **P0** | D5 OVERLAP | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 187 | Physical text overlap of 187px² between "Calendar" and "12" |
| **P0** | D5 OVERLAP | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 222 | Physical text overlap of 222px² between "Schedule Focus" and ":00" |
| **P0** | D5 OVERLAP | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 203 | Physical text overlap of 203px² between "LOCAL TIME" and "18" |
| **P0** | D5 OVERLAP | AI Assistant | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 437 | Physical text overlap of 437px² between "Break down goal" and "Summarize session" |
| **P0** | D5 OVERLAP | AI Assistant | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 399 | Physical text overlap of 399px² between "Focus protection" and "Guided tour" |
| **P0** | D5 OVERLAP | AI Assistant | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 298 | Physical text overlap of 298px² between "No saved conversatio" and "What are we working " |
| **P0** | D5 OVERLAP | Focus Engine | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 467 | Physical text overlap of 467px² between "30:00" and "Define your directio" |
| **P0** | D5 OVERLAP | Focus Engine | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 849 | Physical text overlap of 849px² between "Choose one meaningfu" and "Master TypeScript & " |
| **P0** | D5 OVERLAP | Focus Engine | 1280x720 | `div#study-mode-section > p.study-mode-descrip` | 511 | Physical text overlap of 511px² between "With separate consen" and "Focus Practice" |
| **P0** | D5 OVERLAP | Focus Engine | 1280x720 | `div#study-mode-section > fieldset.guardian-co` | 138 | Physical text overlap of 138px² between "App observation cons" and "Establish 2-Hour Dai" |
| **P0** | D5 OVERLAP | Focus Engine | 1280x720 | `div#study-mode-section > fieldset.guardian-co` | 1418 | Physical text overlap of 1418px² between "Allow SHINPO to obse" and "Protect mornings for" |
| **P0** | D5 OVERLAP | Focus Engine | 1280x720 | `div#study-mode-section > fieldset.guardian-co` | 1080 | Physical text overlap of 1080px² between "Allow Standard to co" and "Next Stage" |
| **P0** | D5 OVERLAP | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 165 | Physical text overlap of 165px² between "Plan your focus time" and "13" |
| **P0** | D5 OVERLAP | Dashboard | 1440x900 | `div#root > div.shinpo-desktop-app.app-shell >` | 2070 | Physical text overlap of 2070px² between "Today's Priority" and "Define your directio" |
| **P0** | D5 OVERLAP | Dashboard | 1440x900 | `div#root > div.shinpo-desktop-app.app-shell >` | 3541 | Physical text overlap of 3541px² between "Nothing planned yet" and "Select an ambitious " |
| **P0** | D5 OVERLAP | Dashboard | 1440x900 | `div#root > div.shinpo-desktop-app.app-shell >` | 1205 | Physical text overlap of 1205px² between "Add a task to start " and "Product Delivery" |
| **P0** | D5 OVERLAP | Dashboard | 1440x900 | `div#root > div.shinpo-desktop-app.app-shell >` | 122 | Physical text overlap of 122px² between "View All Tasks" and "Design deep module i" |
| **P0** | D5 OVERLAP | Dashboard | 1440x900 | `div#root > div.shinpo-desktop-app.app-shell >` | 907 | Physical text overlap of 907px² between "+ Schedule Focus Blo" and "Establish 2-Hour Dai" |
| **P0** | D5 OVERLAP | Focus Engine | 1440x900 | `div#root > div.shinpo-desktop-app.app-shell >` | 42 | Physical text overlap of 42px² between "Make room for focuse" and "3" |
| **P0** | D5 OVERLAP | Focus Engine | 1440x900 | `div#root > div.shinpo-desktop-app.app-shell >` | 382 | Physical text overlap of 382px² between "Session Intention" and "Launch SHINPO Privat" |
| **P0** | D5 OVERLAP | Focus Engine | 1440x900 | `div#root > div.shinpo-desktop-app.app-shell >` | 798 | Physical text overlap of 798px² between "Define the single ou" and "Design deep module i" |
| **P0** | D5 OVERLAP | Focus Engine | 1440x900 | `div#study-mode-section > fieldset.guardian-co` | 748 | Physical text overlap of 748px² between "On Fedora Wayland, f" and "Protect mornings for" |
| **P0** | D5 OVERLAP | Focus Engine | 1440x900 | `div#root > div.shinpo-desktop-app.app-shell >` | 1073 | Physical text overlap of 1073px² between "Include one midpoint" and "Next Stage" |
| **P0** | D5 OVERLAP | Schedule | 1440x900 | `div#root > div.shinpo-desktop-app.app-shell >` | 153 | Physical text overlap of 153px² between "Calendar" and "11" |
| **P0** | D5 OVERLAP | Focus Engine | 2560x1440 | `div#root > div.shinpo-desktop-app.app-shell >` | 812 | Physical text overlap of 812px² between "One continuous focus" and "Establish 2-Hour Dai" |
| **P0** | D5 OVERLAP | Focus Engine | 2560x1440 | `div#root > div.shinpo-desktop-app.app-shell >` | 1332 | Physical text overlap of 1332px² between "60-Minute Focus" and "Protect mornings for" |
| **P0** | D5 OVERLAP | Schedule | 2560x1440 | `div#root > div.shinpo-desktop-app.app-shell >` | 158 | Physical text overlap of 158px² between "LOCAL TIME" and "06" |
| **P0** | D5 OVERLAP | AI Assistant | 2560x1440 | `div#root > div.shinpo-desktop-app.app-shell >` | 190 | Physical text overlap of 190px² between "Plan my day" and "Master TypeScript & " |
| **P0** | D5 OVERLAP | AI Assistant | 2560x1440 | `div#root > div.shinpo-desktop-app.app-shell >` | 1240 | Physical text overlap of 1240px² between "Break down a goal" and "Establish 2-Hour Dai" |
| **P0** | D5 OVERLAP | AI Assistant | 2560x1440 | `div#root > div.shinpo-desktop-app.app-shell >` | 609 | Physical text overlap of 609px² between "Review progress" and "Design deep module i" |
| **P1** | D1 EMPTY BOX | Focus Engine | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 13 | Container area 164112px² has only 13% content fill (< 15% threshold) |
| **P1** | D1 EMPTY BOX | Focus Engine | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 4 | Container area 133952px² has only 4% content fill (< 15% threshold) |
| **P1** | D9 REDUNDANCY | Focus Engine | 960x600 | `.preset-chip-row and .pomodoro-plan-grid` | 2 | Redundant duration controls: preset-chip-row and pomodoro-plan-grid both configure duration on the same screen |
| **P1** | D1 EMPTY BOX | Analytics | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 8 | Container area 229632px² has only 8% content fill (< 15% threshold) |
| **P1** | D1 EMPTY BOX | Analytics | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 7 | Container area 54120px² has only 7% content fill (< 15% threshold) |
| **P1** | D1 EMPTY BOX | Analytics | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 9 | Container area 54120px² has only 9% content fill (< 15% threshold) |
| **P1** | D1 EMPTY BOX | Analytics | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 8 | Container area 54120px² has only 8% content fill (< 15% threshold) |
| **P1** | D1 EMPTY BOX | Analytics | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 9 | Container area 54120px² has only 9% content fill (< 15% threshold) |
| **P1** | D1 EMPTY BOX | Analytics | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 13 | Container area 468650px² has only 13% content fill (< 15% threshold) |
| **P1** | D1 EMPTY BOX | Analytics | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 7 | Container area 240396px² has only 7% content fill (< 15% threshold) |
| **P1** | D1 EMPTY BOX | Focus Engine | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Container area 185415px² has only 12% content fill (< 15% threshold) |
| **P1** | D1 EMPTY BOX | Focus Engine | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 4 | Container area 151340px² has only 4% content fill (< 15% threshold) |
| **P1** | D1 EMPTY BOX | Focus Protection | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 14 | Container area 92198px² has only 14% content fill (< 15% threshold) |
| **P1** | D6 MISALIGNMENT | Focus Protection | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 35 | List left edge is misaligned with header/control by 35px |
| **P1** | D1 EMPTY BOX | Analytics | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 14 | Container area 126973px² has only 14% content fill (< 15% threshold) |
| **P1** | D1 EMPTY BOX | Analytics | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 13 | Container area 30528px² has only 13% content fill (< 15% threshold) |
| **P1** | D1 EMPTY BOX | Analytics | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 15 | Container area 30528px² has only 15% content fill (< 15% threshold) |
| **P1** | D1 EMPTY BOX | Analytics | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 15 | Container area 366453px² has only 15% content fill (< 15% threshold) |
| **P1** | D1 EMPTY BOX | Analytics | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 9 | Container area 181733px² has only 9% content fill (< 15% threshold) |
| **P1** | D4 DEAD SPACE | Focus Engine | 1440x900 | `div#root > div.shinpo-desktop-app.app-shell >` | 29 | Two-column height imbalance of 29% (col1: 694px, col2: 980px) |
| **P1** | D1 EMPTY BOX | Analytics | 1440x900 | `div#root > div.shinpo-desktop-app.app-shell >` | 14 | Container area 35112px² has only 14% content fill (< 15% threshold) |
| **P1** | D1 EMPTY BOX | Analytics | 1440x900 | `div#root > div.shinpo-desktop-app.app-shell >` | 13 | Container area 35112px² has only 13% content fill (< 15% threshold) |
| **P1** | D1 EMPTY BOX | Analytics | 1440x900 | `div#root > div.shinpo-desktop-app.app-shell >` | 14 | Container area 103849px² has only 14% content fill (< 15% threshold) |
| **P1** | D1 EMPTY BOX | Rewards | 1920x1080 | `div#root > div.shinpo-desktop-app.app-shell >` | 13 | Container area 372238px² has only 13% content fill (< 15% threshold) |
| **P1** | D1 EMPTY BOX | Goals & Missions | 2560x1440 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Container area 382395px² has only 11% content fill (< 15% threshold) |
| **P1** | D1 EMPTY BOX | Schedule | 2560x1440 | `div#root > div.shinpo-desktop-app.app-shell >` | 10 | Container area 3391813px² has only 10% content fill (< 15% threshold) |
| **P1** | D1 EMPTY BOX | AI Assistant | 2560x1440 | `div#root > div.shinpo-desktop-app.app-shell >` | 7 | Container area 2243824px² has only 7% content fill (< 15% threshold) |
| **P2** | D8 TEXT SIZE | Dashboard | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Dashboard | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Dashboard | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Dashboard | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 13 | Body text size 13px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Dashboard | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Dashboard | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Dashboard | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Dashboard | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 13 | Body text size 13px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Dashboard | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 13 | Body text size 13px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Dashboard | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Dashboard | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Dashboard | 960x600 | `div#aurora-tasks-board > div:nth-of-type(2).M` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Dashboard | 960x600 | `div#aurora-tasks-board > div:nth-of-type(2).M` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Dashboard | 960x600 | `div#aurora-tasks-board > div:nth-of-type(2).M` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Dashboard | 960x600 | `div#aurora-tasks-board > div:nth-of-type(3).d` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Dashboard | 960x600 | `div#aurora-tasks-board > div:nth-of-type(3).d` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Dashboard | 960x600 | `div#aurora-tasks-board > div:nth-of-type(3).d` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Dashboard | 960x600 | `div#aurora-tasks-board > div:nth-of-type(3).d` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Dashboard | 960x600 | `div#aurora-tasks-board > div:nth-of-type(3).d` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Dashboard | 960x600 | `div#aurora-tasks-board > div:nth-of-type(3).d` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Engine | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Engine | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Engine | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Engine | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Engine | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Engine | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Engine | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Engine | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Engine | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Engine | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Engine | 960x600 | `div#study-mode-section > span.study-section-l` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Engine | 960x600 | `div#study-mode-section > div.study-mode-optio` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Engine | 960x600 | `div#study-mode-section > div.study-mode-optio` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Engine | 960x600 | `div#study-mode-section > div.study-mode-optio` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Engine | 960x600 | `div#study-mode-section > div:nth-of-type(2).g` | 13 | Body text size 13px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Engine | 960x600 | `div#study-mode-section > div:nth-of-type(2).g` | 13 | Body text size 13px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Engine | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Engine | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Engine | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Engine | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Engine | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 13 | Body text size 13px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 13 | Body text size 13px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 13 | Body text size 13px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 13 | Body text size 13px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 13 | Body text size 13px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 13 | Body text size 13px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 13 | Body text size 13px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 13 | Body text size 13px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 13 | Body text size 13px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 13 | Body text size 13px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 13 | Body text size 13px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Goals & Missions | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Goals & Missions | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Goals & Missions | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Goals & Missions | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Goals & Missions | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Goals & Missions | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Goals & Missions | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Goals & Missions | 960x600 | `button#tasks-sort-select > div.shinpo-select-` | 13 | Body text size 13px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Goals & Missions | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 13 | Body text size 13px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Goals & Missions | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 13 | Body text size 13px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Analytics | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Analytics | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Analytics | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Analytics | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Analytics | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Analytics | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Analytics | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Analytics | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 13 | Body text size 13px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Analytics | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Rewards | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Rewards | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Rewards | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Rewards | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 10 | Body text size 10px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Rewards | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 10 | Body text size 10px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Rewards | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Rewards | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Rewards | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Rewards | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Rewards | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Rewards | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Rewards | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Rewards | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Rewards | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Rewards | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Rewards | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Rewards | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Rewards | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Rewards | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Rewards | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Rewards | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Rewards | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Rewards | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Rewards | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Rewards | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | AI Assistant | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | AI Assistant | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | AI Assistant | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | AI Assistant | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | AI Assistant | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | AI Assistant | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | AI Assistant | 960x600 | `div#root > div.shinpo-desktop-app.app-shell >` | 13 | Body text size 13px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Dashboard | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Dashboard | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 10 | Body text size 10px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Dashboard | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Dashboard | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 13 | Body text size 13px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Dashboard | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Dashboard | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 13 | Body text size 13px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Dashboard | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Dashboard | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Dashboard | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Dashboard | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Dashboard | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 13 | Body text size 13px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Dashboard | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Dashboard | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Dashboard | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Dashboard | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 13 | Body text size 13px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Dashboard | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 13 | Body text size 13px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Dashboard | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Dashboard | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Engine | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Engine | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 10 | Body text size 10px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Engine | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Engine | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 13 | Body text size 13px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Engine | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Engine | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 13 | Body text size 13px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Engine | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Engine | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Engine | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Engine | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Engine | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Engine | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Engine | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Engine | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Engine | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Engine | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Engine | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Engine | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Engine | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Engine | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Engine | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Engine | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Engine | 1280x720 | `div#root > div:nth-of-type(2).shinpo-tutorial` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Engine | 1280x720 | `div#root > div:nth-of-type(2).shinpo-tutorial` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Engine | 1280x720 | `div#root > div:nth-of-type(2).shinpo-tutorial` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Engine | 1280x720 | `div#root > div:nth-of-type(2).shinpo-tutorial` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Engine | 1280x720 | `div#root > div:nth-of-type(2).shinpo-tutorial` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Engine | 1280x720 | `div#root > div:nth-of-type(2).shinpo-tutorial` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Engine | 1280x720 | `div#root > div:nth-of-type(2).shinpo-tutorial` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Engine | 1280x720 | `div#root > div:nth-of-type(2).shinpo-tutorial` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Engine | 1280x720 | `div#root > div:nth-of-type(2).shinpo-tutorial` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Engine | 1280x720 | `div#root > div:nth-of-type(2).shinpo-tutorial` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Engine | 1280x720 | `div#root > div:nth-of-type(2).shinpo-tutorial` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Engine | 1280x720 | `div#root > div:nth-of-type(2).shinpo-tutorial` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Engine | 1280x720 | `div#root > div:nth-of-type(2).shinpo-tutorial` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Engine | 1280x720 | `div#root > div:nth-of-type(2).shinpo-tutorial` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Engine | 1280x720 | `div#root > div:nth-of-type(2).shinpo-tutorial` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 10 | Body text size 10px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 13 | Body text size 13px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 13 | Body text size 13px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 13 | Body text size 13px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 13 | Body text size 13px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 13 | Body text size 13px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 13 | Body text size 13px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 13 | Body text size 13px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 13 | Body text size 13px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 13 | Body text size 13px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 13 | Body text size 13px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 13 | Body text size 13px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 13 | Body text size 13px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 13 | Body text size 13px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Protection | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Goals & Missions | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Goals & Missions | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 10 | Body text size 10px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Goals & Missions | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Goals & Missions | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 13 | Body text size 13px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Goals & Missions | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Goals & Missions | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 13 | Body text size 13px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Goals & Missions | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Goals & Missions | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Goals & Missions | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Goals & Missions | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Goals & Missions | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Goals & Missions | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Goals & Missions | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Goals & Missions | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Goals & Missions | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 13 | Body text size 13px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Goals & Missions | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 13 | Body text size 13px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 10 | Body text size 10px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 13 | Body text size 13px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 13 | Body text size 13px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Schedule | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Analytics | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Analytics | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 10 | Body text size 10px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Analytics | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Analytics | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 13 | Body text size 13px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Analytics | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Analytics | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 13 | Body text size 13px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Analytics | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Analytics | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Analytics | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Analytics | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Analytics | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Analytics | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Analytics | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Analytics | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Analytics | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 13 | Body text size 13px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Analytics | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Rewards | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Rewards | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 10 | Body text size 10px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Rewards | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Rewards | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 13 | Body text size 13px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Rewards | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Rewards | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 13 | Body text size 13px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Rewards | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Rewards | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Rewards | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Rewards | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Rewards | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 10 | Body text size 10px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Rewards | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 10 | Body text size 10px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Rewards | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Rewards | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Rewards | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Rewards | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Rewards | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Rewards | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Rewards | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Rewards | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Rewards | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Rewards | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Rewards | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Rewards | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Rewards | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Rewards | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Rewards | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Rewards | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Rewards | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Rewards | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Rewards | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Rewards | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | AI Assistant | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | AI Assistant | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 10 | Body text size 10px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | AI Assistant | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | AI Assistant | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 13 | Body text size 13px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | AI Assistant | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | AI Assistant | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 13 | Body text size 13px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | AI Assistant | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | AI Assistant | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | AI Assistant | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | AI Assistant | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | AI Assistant | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | AI Assistant | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | AI Assistant | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | AI Assistant | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | AI Assistant | 1280x720 | `div#root > div.shinpo-desktop-app.app-shell >` | 13 | Body text size 13px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | AI Assistant | 1280x720 | `aside#eonpai-context-panel > header.eonpai-co` | 10 | Body text size 10px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | AI Assistant | 1280x720 | `aside#eonpai-context-panel > div.eonpai-conte` | 13 | Body text size 13px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | AI Assistant | 1280x720 | `aside#eonpai-context-panel > div.eonpai-conte` | 13 | Body text size 13px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | AI Assistant | 1280x720 | `aside#eonpai-context-panel > div.eonpai-conte` | 13 | Body text size 13px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | AI Assistant | 1280x720 | `aside#eonpai-context-panel > div.eonpai-conte` | 13 | Body text size 13px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | AI Assistant | 1280x720 | `aside#eonpai-context-panel > section.eonpai-c` | 13 | Body text size 13px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | AI Assistant | 1280x720 | `aside#eonpai-context-panel > section.eonpai-c` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | AI Assistant | 1280x720 | `aside#eonpai-context-panel > section:nth-of-t` | 13 | Body text size 13px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | AI Assistant | 1280x720 | `aside#eonpai-context-panel > section:nth-of-t` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | AI Assistant | 1280x720 | `aside#eonpai-context-panel > section:nth-of-t` | 13 | Body text size 13px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | AI Assistant | 1280x720 | `aside#eonpai-context-panel > section:nth-of-t` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Dashboard | 1440x900 | `div#root > div:nth-of-type(2).shinpo-tutorial` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Dashboard | 1440x900 | `div#root > div:nth-of-type(2).shinpo-tutorial` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Dashboard | 1440x900 | `div#root > div:nth-of-type(2).shinpo-tutorial` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Dashboard | 1440x900 | `div#root > div:nth-of-type(2).shinpo-tutorial` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Dashboard | 1440x900 | `div#root > div:nth-of-type(2).shinpo-tutorial` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Dashboard | 1440x900 | `div#root > div:nth-of-type(2).shinpo-tutorial` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Dashboard | 1440x900 | `div#root > div:nth-of-type(2).shinpo-tutorial` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Dashboard | 1440x900 | `div#root > div:nth-of-type(2).shinpo-tutorial` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Dashboard | 1440x900 | `div#root > div:nth-of-type(2).shinpo-tutorial` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Dashboard | 1440x900 | `div#root > div:nth-of-type(2).shinpo-tutorial` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Dashboard | 1440x900 | `div#root > div:nth-of-type(2).shinpo-tutorial` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Dashboard | 1440x900 | `div#root > div:nth-of-type(2).shinpo-tutorial` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Dashboard | 1440x900 | `div#root > div:nth-of-type(2).shinpo-tutorial` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Dashboard | 1440x900 | `div#root > div:nth-of-type(2).shinpo-tutorial` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Dashboard | 1440x900 | `div#root > div:nth-of-type(2).shinpo-tutorial` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Engine | 1440x900 | `div#root > div.shinpo-desktop-app.app-shell >` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Engine | 1440x900 | `div#root > div.shinpo-desktop-app.app-shell >` | 13 | Body text size 13px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Engine | 1440x900 | `div#root > div.shinpo-desktop-app.app-shell >` | 13 | Body text size 13px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Engine | 1440x900 | `div#root > div.shinpo-desktop-app.app-shell >` | 13 | Body text size 13px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Engine | 1440x900 | `div#root > div.shinpo-desktop-app.app-shell >` | 13 | Body text size 13px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | Focus Engine | 1440x900 | `div#root > div.shinpo-desktop-app.app-shell >` | 13 | Body text size 13px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | AI Assistant | 2560x1440 | `div#root > div:nth-of-type(2).shinpo-tutorial` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | AI Assistant | 2560x1440 | `div#root > div:nth-of-type(2).shinpo-tutorial` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | AI Assistant | 2560x1440 | `div#root > div:nth-of-type(2).shinpo-tutorial` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | AI Assistant | 2560x1440 | `div#root > div:nth-of-type(2).shinpo-tutorial` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | AI Assistant | 2560x1440 | `div#root > div:nth-of-type(2).shinpo-tutorial` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | AI Assistant | 2560x1440 | `div#root > div:nth-of-type(2).shinpo-tutorial` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | AI Assistant | 2560x1440 | `div#root > div:nth-of-type(2).shinpo-tutorial` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | AI Assistant | 2560x1440 | `div#root > div:nth-of-type(2).shinpo-tutorial` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | AI Assistant | 2560x1440 | `div#root > div:nth-of-type(2).shinpo-tutorial` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | AI Assistant | 2560x1440 | `div#root > div:nth-of-type(2).shinpo-tutorial` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | AI Assistant | 2560x1440 | `div#root > div:nth-of-type(2).shinpo-tutorial` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | AI Assistant | 2560x1440 | `div#root > div:nth-of-type(2).shinpo-tutorial` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | AI Assistant | 2560x1440 | `div#root > div:nth-of-type(2).shinpo-tutorial` | 11 | Body text size 11px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | AI Assistant | 2560x1440 | `div#root > div:nth-of-type(2).shinpo-tutorial` | 12 | Body text size 12px < 13px minimum standard |
| **P2** | D8 TEXT SIZE | AI Assistant | 2560x1440 | `div#root > div:nth-of-type(2).shinpo-tutorial` | 12 | Body text size 12px < 13px minimum standard |
