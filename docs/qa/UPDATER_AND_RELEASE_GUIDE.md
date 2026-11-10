# SHINPO — Automatic Updates via GitHub & Release Architecture Guide

**Version:** `v0.1.0-beta.1`  
**Target:** Private Beta (5 Initial Testers on Linux & Windows)  
**Tauri Framework:** Tauri 2.12 (Rust backend, React 19 webview)

---

## 1. End-to-End Update Lifecycle

The owner’s required release-and-update workflow operates as follows:

```
[Developer Commits to 'develop']
                │
                ▼
[GitHub Actions CI: Tests, Lint, Rust & Security Audits]
                │
                ▼ (Only on explicit release approval / tag v0.1.0-beta.x)
[Release Packaging Workflow]
   ├── Linux: Builds .AppImage, .deb, .rpm
   ├── Windows: Builds NSIS installer (current-user)
   └── Signs artifacts using Tauri private updater key
                │
                ▼
[Draft GitHub Release Created with Signed Assets & latest.json Manifest]
                │
                ▼ (Owner reviews & publishes Release)
[SHINPO Desktop Client Starts / User checks "Check for updates"]
   ├── Queries update manifest (latest.json)
   ├── Compares semver (e.g., v0.1.0-beta.1 -> v0.1.0-beta.2)
   ├── Cryptographically verifies signature using embedded public key
   ├── Informs user with Release Notes & Download Size
   ├── Prompts user: "Install and Restart" (never interrupts active Focus)
   ├── Atomic file replacement
   └── Seamless restart into new version (SQLCipher vault untouched)
```

---

## 2. Cryptographic Signing Keypair Architecture

Tauri 2 uses minisign-compatible Ed25519 signatures.

### Generating the Keypair
```bash
# Generated on the developer's secure workstation (NOT in CI or repo):
npx @tauri-apps/cli signer generate -w ~/.tauri/shinpo.key
```
This produces:
- **Private Key:** `~/.tauri/shinpo.key` (with a passphrase).  
  *Never commit this file or expose it.* It is stored in GitHub Repository Secrets as `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.
- **Public Key:** `~/.tauri/shinpo.key.pub` (a single-line text string).  
  This key is safe to embed in `tauri.conf.json`.

### Embedding Public Key in `tauri.conf.json`
```json
{
  "plugins": {
    "updater": {
      "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXkKUldUUW12QzBL...",
      "endpoints": [
        "https://github.com/ronartz/SHINPO/releases/download/v{{version}}/latest.json"
      ]
    }
  }
}
```

> **Security Rule:** If signature verification fails, the update is immediately rejected and the downloaded temporary payload is deleted. Distributed binaries must never enable an unsigned or unverified updater endpoint.

---

## 3. Private-Beta Distribution Models: Trade-Off Analysis

For the 5 initial testers, two distribution models were evaluated:

### Option A: Publicly Downloadable GitHub Prerelease (Recommended for Beta 1)
- **Mechanism:** GitHub Releases marked as **"Prerelease"**. Anyone with the URL can download the installers, but they are not listed as the official latest stable release.
- **Pros:** Zero friction, no credentials needed by testers, native Tauri updater works cleanly out of the box via GitHub asset URLs.
- **Security:** The application requires no GitHub personal access tokens. All telemetry and user data remain 100% offline in local SQLCipher storage; no backend accounts or server credentials are involved.

### Option B: Restricted Private Repository Releases
- **Mechanism:** Binaries hosted in a private GitHub repository.
- **Drawback:** Tauri updater requests must pass an `Authorization: Bearer <GITHUB_TOKEN>` header. Embedding a single shared GitHub personal access token in client software is an anti-pattern that risks token leak and unauthorized repository access.
- **Alternative:** Hosting an authenticated AWS S3 / Cloudflare R2 bucket with signed expiring download URLs.

**Decision for Private Beta:**  
Use Option A (Prereleases on GitHub) or direct manual delivery of the 5 installer packages, accompanied by signed SHA-256 manifests.

---

## 4. Update Manifest (`latest.json`) Structure

When release `v0.1.0-beta.2` is built, the build action generates and uploads `latest.json`:

```json
{
  "version": "v0.1.0-beta.2",
  "notes": "## Improvements in v0.1.0-beta.2\n- Fixed focus completion when paused.\n- Improved light theme contrast.",
  "pub_date": "2026-11-15T10:00:00Z",
  "platforms": {
    "linux-x86_64": {
      "signature": "SIGNATURE_OF_APPIMAGE_TAR_GZ",
      "url": "https://github.com/ronartz/SHINPO/releases/download/v0.1.0-beta.2/SHINPO_0.1.0-beta.2_amd64.AppImage.tar.gz"
    },
    "windows-x86_64": {
      "signature": "SIGNATURE_OF_NSIS_ZIP",
      "url": "https://github.com/ronartz/SHINPO/releases/download/v0.1.0-beta.2/SHINPO_0.1.0-beta.2_x64-setup.nsis.zip"
    }
  }
}
```

---

## 5. Non-Disruptive Client Updater Rules

1. **Focus Protection:** Updates are never checked or downloaded while an active Focus session is in progress (`status == "ACTIVE" || status == "PAUSED"`).
2. **Offline Resilience:** If GitHub is unreachable (offline mode), update checks silently fail without blocking or disrupting app launch.
3. **No Automatic Restarts:** The user is shown an update banner with release notes and explicitly clicks "Restart to update" when convenient.
4. **Data Preservation:** User settings, active tasks, and the encrypted SQLCipher database file (`~/.shinpo/vault.sqlcipher` or `%APPDATA%\SHINPO\vault.sqlcipher`) reside strictly in user application data directories and are completely unaffected by executable updates.

---

## 6. Release Withdrawal & Emergency Rollback Procedure

If a deployed update contains a critical defect:
1. **Immediately delete or rename `latest.json`** on the GitHub Release asset list so clients stop detecting it.
2. Build and publish a corrected hotfix version with incremented semver (e.g. `v0.1.0-beta.3`).
3. Clients checking for updates will see `v0.1.0-beta.3` and upgrade directly over the bad build.
4. Provide testers with the manual fallback installer link and instructions if needed.
