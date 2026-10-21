# SHINPO Current Source Manifest — 2026-10-21

This manifest identifies the dirty working-tree candidate tested on 2026-10-21. It is not a release approval. No commit was created; the shared repository already contained extensive user changes.

## Source identity

- Base commit: `0145fb3aae7acdc52719dff8397e76484f7c5024` (`main`).
- Tracked paths changed from `HEAD`: **122**.
- Untracked, non-ignored paths excluding this manifest: **99**.
- Tracked diff (binary-safe `git diff --binary HEAD`) SHA-256: `937a7c95ba35954ed843599a4eab90cea9afd2182721a1e7abd63e890f95bdbc`.
- Untracked path/content inventory SHA-256: `8f304da63ea7815575864b544ffa11a45ec6be6dd83f7a2930b516eb68f5c727`.
- Porcelain status snapshot excluding this manifest: `09c8eb412d12a4bc3dd527e6f63eeac5af4127fcefd15cfe47c71a5ff1ec2af6`.
- The full tracked path/status inventory is `git diff --name-status HEAD`; untracked paths are `git ls-files --others --exclude-standard`. Main change areas: backend auth/rate limits, telemetry, onboarding/rewards, and persistence; React/Tauri API, design, onboarding, and focus UI; Rust Shield/Browser Host; browser companion; CI/deployment/backup scripts; acceptance and QA docs; existing screenshots and release artifacts.

To reproduce these values, exclude only this manifest from the status and untracked inventories:

```bash
git diff --binary HEAD | sha256sum
git ls-files --others --exclude-standard -z | grep -z -v '^docs/qa/SHINPO_CURRENT_SOURCE_MANIFEST_2026-10-21.md$' | xargs -0 sha256sum | sha256sum
git status --porcelain=v1 | grep -vF '?? docs/qa/SHINPO_CURRENT_SOURCE_MANIFEST_2026-10-21.md' | sha256sum
```

## Build inputs at capture

| Input | Version / SHA-256 |
|---|---|
| Java | `25.0.4.1` |
| Maven wrapper distribution | `3.9.11` |
| Node.js / npm | `v24.18.0` / `11.16.0` |
| Rust / Cargo | `1.99.0` / `1.99.0` |
| `frontend/package-lock.json` | `9ea480d7052926df741eaaef8dedf03b8e9315de0982036793b2f1c2cb18cf39` |
| `backend/pom.xml` | `7b81a8e6855444df7b1d6dd125f283fd023ad5acc49a3d0e3df3b6baa3077d6b` |
| `crates/shinpo-shield/Cargo.lock` | `870bfc010c4653b9a6b79240e3571e3c9c5ccf134563c691df9fdd99327e659c` |
| `crates/shinpo-browser-host/Cargo.lock` | `ca99e3c56ef63242d22cef5245e8d8f88de76d7fa98a5fc66722a7d9aaf4264a` |
| `frontend/src-tauri/Cargo.lock` | `5c9f6103d081d30eab10d6b34f7c1ccf4e7402f1a8304ed707a5b8f87a19d614` |
| `browser-extension/package.json` | `6222790af3f7578c8e9d649006207437f1269a6b3288ea9efcc72d0f600a6d20` |
| `frontend/src-tauri/tauri.conf.json` | `78b60789037caa7d4b9bca658c403b4992ec1b69e687e9d9e65ef4f97dfe7024` |
| `scripts/package-linux.sh` | `9fe4346bbd103ceef7c835cb802bb8c29a6766684c216e40b27eb7f25471a8aa` |

Current source-built Linux DEB (kept outside the repository): SHA-256 `fc75b3018f869c52b09d082c51df8cecb07b6c27eb02d616e27d8214ee1b5932`. It was extracted rather than installed and visually smoke-tested under the packaged Tauri/WebKit runtime; it is not a release artifact. The captured 1400×900 login screenshot is `docs/qa/evidence/2026-10-21/current-source-tauri-login.png` (SHA-256 `27bbe17fd472ec53a6440e3c5ca0c66116cea3fc01ce634df952eaa13e1e575a`).

## Existing Linux RC artifacts — preserved, not current-source qualified

`release/rc/BUILD_INFO.json` identifies `shinpo-v1.0.0-rc2-0145fb3`, built at `2026-10-21T12:33:59Z` from the base commit above. It does not identify the dirty/untracked inputs captured here, so none of these files is represented as built from this candidate. Existing artifact SHA-256 values from `release/rc/SHA256SUMS`:

| Artifact | SHA-256 |
|---|---|
| `SHINPO-1.0.0-1.x86_64.rpm` | `d9b874381cf49284f6207a4740559215332a84cf7828f1578f1d0849193e913e` |
| `SHINPO_1.0.0_amd64.AppImage` | `c75f7a49a1e858de3ea28673b5aafce89dc4df163f91506ffaf3c15ed0210bb0` |
| `SHINPO_1.0.0_amd64.deb` | `fb7693314b07ef145580b6b8d028140a70a34f715ed535f382eaea566793257b` |
| `SHINPO_1.0.0_linux_x86_64.tar.gz` | `f4cdd6a093ed46f986be1efce33f06039819e481dd42ee5960892fede34bd865` |
| `shinpo-desktop` | `a1d7dc8579c707090d34685827a0aa2ead2c83ab74cfcf877cee41e9df54ef76` |
| `shinpo-shield` | `2562564eb0e1066bff9995f2059269f8a8e78f370ac5ba1d0f96d8c912ff73e4` |
| `shinpo-browser-host` | `306728b0cb82e731c90cc3a66098e5a936787b208fcb37de709d1d0b727e1655` |

## Verification attached to this source capture

- Backend full test suite: **396 passed, 0 failed**, isolated `shinpo_qa` PostgreSQL with tmpfs storage, `shinpo_test` schema, and 24 Flyway migrations.
- Frontend: **91 passed** after removal of the dead demo-credential quick-fill; ESLint **0 errors / 0 warnings**; production Vite build passed (one >500 kB chunk advisory).
- Rust: Shield **77 passed**; Browser Host **6 passed**; browser companion **15 passed**, Chromium and Firefox builds passed.
- Frontend `npm audit`: **0 advisories**.
- Current-source DEB built and extracted-launch smoke verified; no system package install, Windows runtime, remote service, cloud deployment, Maven/Cargo advisory scan, or complete first-time-user workflow is verified. Maven dependency-check 13.0.0 could not analyze because no NVD API key was available and its local database was empty; `cargo-audit` is not installed.

This records reproducible identity and evidence, not deterministic build equivalence. Toolchain/container image digests, host kernel/WebKit versions, native package dependencies, and external service behavior remain additional reproducibility inputs.
