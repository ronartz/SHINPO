# SHINPO Auto-Updater Release Manifests & Architecture

This directory houses static channel manifests and documentation for SHINPO's production in-app auto-updater.

## Channel Architecture

SHINPO provides dual-channel update progression:

| Channel | Manifest Endpoint | Fallback Endpoint | Audience |
| :--- | :--- | :--- | :--- |
| **Beta** | `https://ronartz.github.io/SHINPO/updates/beta/latest.json` | `https://raw.githubusercontent.com/ronartz/SHINPO/main/releases/beta/latest.json` | Private beta testers, preview adopters |
| **Stable** | `https://ronartz.github.io/SHINPO/updates/stable/latest.json` | `https://raw.githubusercontent.com/ronartz/SHINPO/main/releases/stable/latest.json` | Production milestone users |

Users can freely toggle between channels at any time in **Settings → Software Updates**.

---

## Cryptographic Security (Minisign Ed25519)

All update packages are cryptographically signed before release.

- **Public Key:** Configured in `frontend/src-tauri/tauri.conf.json` under `plugins.updater.pubkey`.
  ```text
  dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IEE3Qjg4NkNGODVFRTRBNjQKUldSa1N1NkZ6NGE0cDhMNVcrNWlYR2o0KzVQT1RvbEU4MG9TMy9PeG1PRmNaL20yMDU1bVdGYmsK
  ```
- **Private Key:** Stored strictly outside the repository in GitHub Secrets:
  - `TAURI_SIGNING_PRIVATE_KEY` (Minisign Ed25519 private key)
  - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (Passphrase)

---

## Platform Packaging Support Matrix

| Platform / Package | In-App Replacement Supported? | User Experience |
| :--- | :--- | :--- |
| **Linux AppImage** | Yes (Native In-App) | Binary download, signature verify, staged atomic replacement on restart. |
| **Linux DEB** | No (External Package Manager) | Honest notification: guides user to `apt` / package manager or download link. |
| **Linux RPM** | No (External Package Manager) | Honest notification: guides user to `dnf` / package manager or download link. |
| **Windows NSIS** | Yes (Native In-App) | Downloads `.nsis.zip`, verifies signature, installs in background. |
| **macOS** | Unsupported | Documented as unsupported for current Linux/Windows release. |

---

## GitHub Actions Release Pipeline

When creating a release tag (e.g. `v0.1.0-beta.2`):
1. `.github/workflows/release-build.yml` runs the mandatory quality gates (`./scripts/qa-release.sh release`).
2. Builds the binaries with `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.
3. Produces `.tar.gz` / `.zip` updater bundles alongside `.sig` signature files.
4. Generates `latest.json` with the corresponding platform signature and release asset URL.
5. Publishes assets to GitHub Releases and stages `latest.json` for deployment.
