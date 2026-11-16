# Installing and running SHINPO

## Current qualification note

This repository does not provide a currently qualified public release. Do not treat old packages in historical QA reports as current installers. Linux and Windows runtime qualification, signed updater qualification, and release publication are separate gates; see `docs/qa/latest-release-gate.md`.

## Build from source

Install the supported Tauri v2 prerequisites for your operating system, then from the repository root:

```bash
npm ci
npm run tauri:build
```

Tauri writes platform bundles under `frontend/src-tauri/target/release/bundle/`. A successful build does not prove installation or runtime behavior. On Fedora, use the RPM produced by the build; on Debian/Ubuntu, use the DEB or AppImage as appropriate. On Windows, the configured target is a per-user NSIS installer. No installer should be described as signed unless signature verification has been performed.

To run the application in development:

```bash
npm run tauri:dev
```

To verify the encrypted native persistence path without opening a desktop window:

```bash
cargo run --locked --manifest-path frontend/src-tauri/Cargo.toml --bin shinpo-desktop -- --smoke-test
```

## Data safety

The app creates its local data in Tauri's operating-system-specific application-data directory. Do not remove that directory to troubleshoot unless you intend to delete the vault. The recovery key is for vault-key recovery, not a backup. Until encrypted export/restore is qualified, close SHINPO before making a protected copy of the complete application-data directory.

## Browser Companion

The extension is optional. Website rules require installing the matching browser build and registering the packaged native-messaging host for the current user, then pairing inside SHINPO. Follow the packaged `Browser-Companion-Install.md` for the artifact being tested. A paired label alone does not prove that the browser is currently connected or enforcing policy.
