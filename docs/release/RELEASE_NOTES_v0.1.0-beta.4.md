# SHINPO 0.1.0-beta.4 — Private Beta

This is a prerelease for supervised testing. Back up your recovery key before upgrading. SHINPO stores workspace data locally in an encrypted vault; losing both the password and recovery key can make that data unrecoverable.

## Changes

- Browser Companion pairing now registers and validates a usable native messaging host before displaying a one-time pairing code. Rejected codes report that they may be invalid, expired, or already used. If pairing succeeds but the first policy sync fails, the extension reports that state without pretending the sync succeeded.
- Strict Guardian on supported Linux systems can close only an explicitly blocked, same-user process whose executable identity is verified, while the session is in Focus and the user has enabled session-level closure consent. It requests a graceful close, then may force-terminate the same verified process if it remains alive. Test this only with applications whose unsaved work can be discarded. Protected and unverified processes are excluded. Windows process identity and app closure are not implemented in this build.
- Focus, task, analytics, background rendering and desktop interaction fixes are included. The vault migration adds session-scoped Guardian closure consent; prior sessions do not receive retroactive consent.
- Updates the transitive `url` dependency to 2.5.9 to address RustSec `RUSTSEC-2026-0592`.

## Important beta limitations

- Linux app closure has automated disposable-process coverage, but this release has not been qualified against every Fedora desktop environment or every application. Guardian must not be treated as a substitute for operating-system controls.
- Browser Companion requires the packaged extension to be installed and paired by the user. Pairing authenticates the extension to the local host; website restrictions still depend on a current synchronized policy. Live pairing and Focus-to-browser policy enforcement have not passed acceptance; a previous pairing authentication failure remains unresolved pending a real paired-browser test. Do not rely on it as the only enforcement mechanism.
- No Windows installer is attached to this Linux-only prerelease. Windows native installation/runtime is untested, and app closure is unavailable on Windows.
- RustSec still reports the GLib 0.18.5 `VariantStrIter` unsoundness (`RUSTSEC-2024-0429`) in the GTK/WebKit dependency chain, plus unmaintained warnings for `chrono`, `proc-macro-error`, `zbus_names`, `zvariant` and `zvariant_derive`. These are not fixed by this release; review the project's current security disposition before supervised testing.
- Automatic updater artifacts are available only when the release signing secret is configured in CI. Otherwise, install from the manual package assets; no updater signature is implied.

## Platform status

- **Fedora/Linux x86_64:** The Beta 4 RPM payload passed a disposable Fedora Tauri/WebKitGTK screen smoke after extraction. It was not installed with the system package manager; clean installation and upgrade remain unverified. Back up first and use disposable Guardian targets.
- **Windows x64:** Not included in this Linux-only prerelease. Native installation and runtime behavior are not verified. Strict app closure is disabled there.
- **Browser Companion:** Chromium and Firefox extension files are distributed for manual installation where included. Store publication is not part of this beta.

Use the SHA-256 manifest attached to the release to verify downloaded files. Report defects at <https://github.com/ronartz/SHINPO/issues>.
