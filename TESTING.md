# SHINPO — Testing & Verification Standard

> STATUS: HISTORICAL / SUPERSEDED
>
> This document records an earlier verification narrative and a more aggressive milestone timeline than the current repository evidence supports. It should be treated as historical context, not as the current verification baseline. See [SHINPO_IMPLEMENTATION_STATUS.md](SHINPO_IMPLEMENTATION_STATUS.md) for the current status and [SHINPO_MASTER_BLUEPRINT.md](SHINPO_MASTER_BLUEPRINT.md) for the product direction.

## Historical verification notes

The pass counts, scenario tables, and “PASS” labels later in this file belong to an earlier run and are not a current test report. In particular, the old “81 tests” total must not be presented as the current suite result. Current bounded verification evidence is recorded in [SHINPO_IMPLEMENTATION_STATUS.md](SHINPO_IMPLEMENTATION_STATUS.md); rerun the repository commands before making a release claim.

## Verification principle

The current repository requires a more conservative testing posture than this older milestone document implied.

The project has real automated evidence for:

- backend auth, goals, missions, and focus sessions
- AI provider pipeline and context sanitization
- WebSocket telemetry and some enforcement behavior
- Rust shield logic and offline spooling

The project still does not support a claim that all product-level flows are fully completed across browser, desktop, and OS policy surfaces.

## Relevant verification evidence in the repo

- Backend tests under backend/src/test
- Rust tests under crates/shinpo-shield/src
- Frontend build command: `cd frontend && npm run build`
- Tauri shell and shield service integration in frontend/src-tauri

## Current product-level risk areas

- contextual browser classification is not verified as complete
- user-warning and grace-period UI is not verified as implemented
- full platform parity across macOS and Windows is not verified
- product-level accessibility validation remains partial without broader QA

## Verification practice for this repo

Use the following as the working standard:

1. Confirm the feature exists in source code or tests.
2. Check the runtime scope and actual user flow.
3. Distinguish implemented from planned features.
4. Treat older milestone claims as historical unless verified in the current repo.

This is the appropriate standard for the current SHINPO repository state.
 | **03** | Granular Mission Commit | "+ Backlog" button commits single mission and updates UI without re-submitting other missions | PASS |
 | **04** | Sprint Arming Integration | "Start focus" button arms focus session sprint with mission title and estimated duration | PASS |
 | **05** | Accessibility & Motion Standards | Region and group ARIA roles, `:focus-visible` emerald rings, and `@media (prefers-reduced-motion: reduce)` compliance | PASS |
 | **06** | Light & Dark Theme Parity | Surface card tokens, button backgrounds, borders, and contrast ratios verified across dark and light modes | PASS |
---

## 12. Phase 2 Slice AI.6 Contextual Execution AI & Silence Engine (`SilenceEngineTests`)

| Scenario | Test Method | Covered Resilience Guarantee | Status |
| :--- | :--- | :--- | :--- |
| **01** | `testSilenceEngineInterceptsPlanningWhenFocusSessionIsActive` | Intercepts "Plan my day" intent during active focus sprint, directs user to complete/pause current sprint, prevents planning theater | PASS |
| **02** | `testSilenceEngineInterceptsGoalDecompositionWhenFocusSessionIsActive` | Intercepts goal decomposition intent during active sprint, warns against task-switching rabbit holes | PASS |
| **03** | `testSilenceEngineMinimalGreetingDuringFocusSession` | Calms greeting response to state active sprint name and remaining duration without spamming multiple planning options | PASS |
| **04** | `testSilenceEngineDeterministicFallbackDuringFocusSession` | Deterministic fallback stays quiet and brief during active focus sprint, avoiding distracting bullet menus | PASS |
| **05** | `testSilenceEngineDirectivesInContextEngineAndPrompt` | `ContextEngine` detects active sprint, sets `isSilenceModeActive()`, and injects strict silence directives into `<context>` prompt | PASS |
| **06** | `testNormalPlanningRestoredAfterFocusSessionCompleted` | Once active session is completed, standard planning and decomposition capabilities are cleanly restored | PASS |
| **07** | `testSilenceEngineViaRestEndpoint` | `POST /api/ai/chat` enforces silence rules over HTTP REST API with JWT bearer auth | PASS |

---

## 13. Phase 2 Slice AI.7 User Execution Profile Engine (`UserExecutionProfileTests`)

| Scenario | Test Method | Covered Behavioral Science & Calibration Guarantee | Status |
| :--- | :--- | :--- | :--- |
| **01** | `testZeroSessions_ReturnsInsufficientDataWithoutFabrication` | 0 completed sessions strictly returns `hasSufficientData: false`, `estimationBiasPercentage: null`, `confidenceLevel: NONE`, zero-fabrication message | PASS |
| **02** | `testTwoSessions_BelowThreshold_NeverFabricatesMetrics` | 2 completed sessions (< 3 threshold) still returns `hasSufficientData: false` and `estimationBiasPercentage: null` | PASS |
| **03** | `testThreeSessions_Underestimating_CalculatesEmpiricalBias` | 3 completed sessions taking longer than planned computes positive bias (+20.0%), category `UNDERESTIMATING`, `LOW` confidence | PASS |
| **04** | `testOverestimatingBias_CalculatesNegativeBiasAndCategory` | Sessions finishing faster than allocated computes negative bias (-25.0%), category `OVERESTIMATING` | PASS |
| **05** | `testOnTrackBias_WithinTolerance` | Sessions finishing within ±15% tolerance computes category `ON_TRACK` | PASS |
| **06** | `testNonCompletedSessionsIgnoredInCalibration` | Incomplete sessions (`ACTIVE`, `SCHEDULED`, `FAILED`) do not distort calibration counts or bias | PASS |
| **07** | `testCrossTenantIsolation_NeverLeaksDataBetweenUsers` | User A's completed focus sessions never leak into User B's profile calculation | PASS |
| **08** | `testToolExecution_GetUserExecutionProfile_ThroughRegistry` | Tool `get_user_execution_profile` executes cleanly via registry with IDOR defense against parameter spoofing | PASS |
| **09** | `testRestEndpoint_GetProfile_AuthenticatedAndUnauthenticated` | `GET /api/ai/profile` requires bearer auth (401 when missing) and returns 200 with typed `UserExecutionProfileDto` | PASS |
| **10** | `testAiGateway_ProcessesProfileIntent` | `AiGateway.processChat` routes profile inquiries ("What is my execution profile?") to `PROFILE` intent with calibrated stats | PASS |

**Total Automated Baseline:** **81 tests, 0 failures, 0 errors, 0 skipped** (`./mvnw test`).


