# SHINPO v0.1.0-beta.4

SHINPO is a local-first focus and productivity desktop application. This build refreshes the Beta 4 Linux, Windows and Browser Companion downloads from the reviewed source revision below.

## Highlights

- Focus sessions, Goals & Tasks, analytics and encrypted local workspace support.
- Guardian can observe recognized applications. On supported Linux systems, Strict mode can request closure only for an explicitly blocked, verified same-user process when session consent is enabled. Use only disposable targets with no unsaved work.
- Browser Companion packages are provided for manual installation.
- The bundled Rust dependency locks include `url 2.5.9`, addressing the prior Beta 4 `url 2.5.8` advisory.

## Downloads

| Platform | File | Qualification |
| --- | --- | --- |
| Fedora / compatible Linux x86_64 | `SHINPO_0.1.0-beta.4_linux_x86_64.rpm` | Built in CI; clean package-manager installation is not verified. |
| Debian / Ubuntu x86_64 | `SHINPO_0.1.0-beta.4_linux_x86_64.deb` | Built in CI; clean installation is not verified. |
| Portable Linux x86_64 | `SHINPO_0.1.0-beta.4_linux_x86_64.AppImage` | Built in CI; runtime qualification is not verified. |
| Windows x64 | `SHINPO_0.1.0-beta.4_windows_x64_setup.exe` | CI-built NSIS installer; Windows installation and runtime are not tested. |
| Chromium | `shinpo-browser-companion-chromium.zip` | Live pairing and website-policy enforcement are not accepted. |
| Firefox | `shinpo-browser-companion-firefox.zip` | Live pairing and website-policy enforcement are not accepted. |

The portable Linux archive `SHINPO_0.1.0-beta.4_linux_x86_64.tar.gz` is also available. Verify downloaded files with [`SHA256SUMS`](https://github.com/ronartz/SHINPO/releases/download/v0.1.0-beta.4/SHA256SUMS). Build provenance and qualification details are in [`BUILD_INFO.json`](https://github.com/ronartz/SHINPO/releases/download/v0.1.0-beta.4/BUILD_INFO.json).

## Build and verification

- **Artifact source revision:** [`1d8f81626860fe551c467df517217213c7d8f228`](https://github.com/ronartz/SHINPO/commit/1d8f81626860fe551c467df517217213c7d8f228)
- **GitHub Actions:** [run 45040341006](https://github.com/ronartz/SHINPO/actions/runs/45040341006) — mandatory QA, Linux package build and Windows NSIS build passed.
- Linux and Windows artifacts were produced by hosted CI. This does not establish clean-machine installation or runtime acceptance.
- The existing `v0.1.0-beta.4` Git tag remains at `2160e30d668413bb94a3f4530f83524315bb6e48`, while these refreshed assets were built from `1d8f81626860fe551c467df517217213c7d8f228`. The tag was not moved; use the artifact source revision above when tracing these binaries.

## Known limitations

- Browser Companion live pairing and Focus policy enforcement have not passed acceptance. A previous pairing authentication failure remains unresolved. Do not rely on website restrictions as the only protection.
- Windows installation, native runtime and process handling are not tested. Native app closure is unavailable on Windows.
- Fedora package-manager installation and fresh Linux installation/upgrade are not verified; prior evidence was limited to extracted-payload smoke testing.
- Guardian behavior is platform- and consent-dependent. Do not use it on important applications or unsaved work. Protected and unverified processes must remain untouched.
- `RUSTSEC-2024-0429` for the transitive GLib 0.18.5 `VariantStrIter` API remains an explicitly documented exception, not a fix. Unmaintained transitive Rust dependencies also remain documented.
- Signed automatic updates are not configured for this build. The Windows installer is not Authenticode-signed.
- SHINPO remains a beta build; the GitHub release listing is marked as a regular release at the owner's request, but that status does not imply production readiness.

Report issues at <https://github.com/ronartz/SHINPO/issues>.
