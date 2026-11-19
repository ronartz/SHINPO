# Installing and Running SHINPO

SHINPO is a local-first personal execution workspace available for **Linux (x86_64)** and **Windows 10/11 (x64)**.

## 📥 Quick Download (Pre-built Binaries)

Official verified releases are published on the [GitHub Releases page](https://github.com/ronartz/SHINPO/releases):
* **Windows 10 & 11 (64-bit)**: Download `SHINPO_<version>_windows_x64_setup.exe.zip`, extract, and run setup. (If Windows SmartScreen prompts, click *More info* → *Run anyway*).
* **Linux Fedora / RHEL**: Install `SHINPO-<version>-1.x86_64.rpm` via `sudo dnf install ./SHINPO-*.rpm`.
* **Linux Ubuntu / Debian**: Install `SHINPO_<version>_amd64.deb` via `sudo apt install ./SHINPO-*.deb`.
* **Linux Universal**: Run `SHINPO_<version>_amd64.AppImage` directly (`chmod +x && ./SHINPO_*.AppImage`).
* **Linux Portable Tarball**: Extract `SHINPO_<version>_linux_x86_64.tar.gz` and run `./shinpo-desktop` without root permissions.

## 🛠️ Build From Source

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
