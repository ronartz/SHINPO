# SHINPO Final Form RC — Source Manifest

**Built:** 2026-10-21 (UTC/local system date)  
**Source commit:** `c08049d32a8c6751d2166d546ffd70a513370da8`  
**Tree state:** dirty; package is from this commit plus the hashed working-tree files below, not from a clean checkout.  
**Package:** `/tmp/shinpo-finalform-rc-20261021-CyzYAl/release/bundle/deb/SHINPO_1.0.0_amd64.deb`  
**Package SHA-256:** `2d0b2eb4ca85f635539504ebd0f3d21edb49297c394841fcbcd29ac0e6d9023b` (6.22 MiB)

## Build inputs

- Build command: `CARGO_TARGET_DIR=/tmp/shinpo-finalform-rc-20261021-CyzYAl npx tauri build --bundles deb --ci` from `frontend/`.
- Frontend: Node `v24.18.0`, npm `11.16.0`; `frontend/package.json` SHA-256 `670f2dabee721906b6b4f8b1af1e7cdf71cb18f9ca666287903e17a01bb88466`; `frontend/package-lock.json` SHA-256 `9ea480d7052926df741eaaef8dedf03b8e9315de0982036793b2f1c2cb18cf39`.
- Native: rustc `1.99.0 (b940084d7 2026-09-28)`, cargo `1.99.0 (5f94df478 2026-08-27)`; `frontend/src-tauri/Cargo.toml` SHA-256 `09dc8c1b3ab931c527ec1219fc1bf7ece1214fcd677da124a4ca90cceed2f477`; `frontend/src-tauri/Cargo.lock` SHA-256 `1be965a11ade0516250d42772515138ae34f744835e4977483b6aa065b168047`; `tauri.conf.json` SHA-256 `78b60789037caa7d4b9bca658c403b4992ec1b69e687e9d9e65ef4f97dfe7024`.
- Working-tree runtime files at build time:
  - `frontend/src/App.tsx` — `5a41709b21a980358ac42084bde6693e7b051e6abbfa3e2bad4dcc5ac3e6f66b`
  - `frontend/src/api/auth.ts` — `65fb5132ce4c44fa339f4afdc573673f382850f5678239eda031db5bedd46957`
  - `frontend/src/styles/views/auth.css` — `cfaaf836e7511e809d0d08fd9d8807319f368fb06e44367bbe5aef9452ebf13e`
  - `frontend/src/styles/views/eonpai.css` — `60869d3fe3d9afd4c9711dae4fbae4a4a816456c9b6f011b269631e2f8c34b77`
- Runtime-source diff fingerprint (the four files above against the source commit): `b5f4b6df8460e3709efe6627e8f30edfbb6da4988a315c0fafaffee1fdfc48df`.

## Preserved worktree context

Other modified tracked files at build time included tests and QA documentation; they do not change the bundled runtime. Existing untracked files were preserved and are not frontend imports, Tauri resources, or Cargo build inputs: `GSD-STYLE.md`, `PROJECT_RULES.md`, `VERSION`, `adapters/`, `model_capabilities.yaml`, `docs/qa/RAPID_PRODUCT_TRIAGE_OCTOBER_27.json`, and `scripts/rapid_product_triage.mjs`.

This manifest identifies the exact dirty source used; it does not claim a clean-checkout reproducibility run. The DEB was extracted and its executable had no unresolved `ldd` dependencies. The latest hash above was not installed or launched; see the ship matrix for the earlier extracted-candidate smoke distinction and remaining runtime gates.

## Subsequent worktree delta (not part of this DEB)

At final review, additional uncommitted backend changes appeared in `backend/src/main/java/com/shinpo/controller/UserController.java`, `backend/src/main/java/com/shinpo/service/UserService.java`, and `backend/src/test/java/com/shinpo/security/AuthenticationSecurityHardeningTests.java`. They add `DELETE /api/users/me` and a deletion test. These changes are not inputs to the frontend/Tauri package above and were not reviewed, built, or tested in this continuation. The added test checks removal of the user row, not cleanup of all associated records. Preserve these changes; full-stack acceptance must review their transaction, foreign-key cascade, reauthentication/confirmation behavior, and user-facing recovery before release.
