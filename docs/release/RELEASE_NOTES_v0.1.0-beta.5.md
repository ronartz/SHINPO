# SHINPO v0.1.0-beta.5

This beta updates the desktop app and Browser Companion. It is for supervised testing; save important work elsewhere and keep backups of your vault.

## What changed

- Fixed Focus controls remaining visible after the session's planned focus time ends.
- Improved Focus completion and reflection handling.
- Fixed Browser Companion pairing codes pasted with spaces, line breaks, hyphens, or uppercase letters.
- Improved browser connection status so pairing is not shown as a live connection.
- Prevented page zoom shortcuts and trackpad zoom in the desktop window.
- Fixed Calendar scrolling so the calendar grid and page can both be scrolled.
- Applied the supplied Mesh Drift shader to Classic mode; Aurora keeps its own background.
- Added consent-gated, process-identity-checked app closing for Strict Guardian. Test it only with disposable apps first; closing an app can lose unsaved work. Windows runtime behavior has not been tested on a Windows desktop.

## Downloads

The release includes Linux RPM, DEB, AppImage and portable archive builds, a Windows x64 NSIS installer, and Chromium and Firefox Browser Companion packages. Check each download against `SHA256SUMS` attached to this release.

## Known limitations

- The installers are CI builds. Clean-machine installation and full desktop workflows have not been verified for this release.
- Browser Companion pairing and live site enforcement have not been verified in a disposable browser profile. Do not assume a paired extension is connected or enforcing rules until SHINPO reports that state.
- Windows installer generation is tested in hosted CI; Windows installation, Tauri runtime, browser integration, and Strict app closure are not verified.
- A GLib dependency security advisory remains unresolved. The Rust dependency security gate is not clean; review the repository's security release gate before testing.
- Updater signing is unavailable unless the release signing secret is configured. Use the attached installers for manual testing; do not expect signed automatic updates.
- This beta is not a guarantee that Guardian will prevent every distraction or preserve unsaved work.
