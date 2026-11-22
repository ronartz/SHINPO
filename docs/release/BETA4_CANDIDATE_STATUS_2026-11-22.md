# SHINPO Beta 4 Linux Candidate — 2026-11-22

## Decision

**PUBLISHED: Linux-only supervised private-beta prerelease.** The current RPM payload launched in Fedora's native Tauri/WebKitGTK environment and passed the authenticated screen smoke using a disposable profile. The RPM was extracted and executed, not installed through the system package manager. This is not a general release-readiness claim.

The remaining known limitations are material and are disclosed in the release notes: live Browser Companion pairing/policy enforcement has not passed acceptance; the GLib unsoundness and unmaintained RustSec advisories remain; Windows runtime is untested; and signed updater artifacts are unavailable without the CI signing secret. Beta 4 must be offered as a supervised preview, not as reliable app/site enforcement or a signed auto-update.

## Source and workflow

- Repository: `ronartz/SHINPO`, branch `main`.
- Reviewed Beta 4 application source commit: `5b7a0ea` (`feat(release): prepare supervised Linux beta 4`).
- The tested application source is committed locally. The tagged workflow rebuilt and published Linux assets from the release tag.
- The release workflow was adjusted so tagged releases do not run or attach the Windows installer. Windows branch/manual CI remains available.
- Portable Linux README now takes the package version from Tauri configuration instead of hard-coding Beta 1.
- Tag `v0.1.0-beta.4` points to `2160e30d668413bb94a3f4530f83524315bb6e48`; GitHub published the Linux prerelease at <https://github.com/ronartz/SHINPO/releases/tag/v0.1.0-beta.4>.

## Verification performed

- Frontend quick gate: 256 tests passed; production TypeScript/Vite build passed; ESLint 0 errors and 65 warnings.
- Browser extension: 38 tests passed.
- Rust: Tauri 108 passed / 1 ignored, Shield 93 passed, Browser Host 15 passed; strict Clippy and formatting passed for all three crates.
- Secret scan: `gitleaks dir --redact --no-banner .` reported no leaks. `git diff --check` passed after workflow and release-document changes; staged secret scan reported no leaks.
- Native packaged-payload smoke: **1 spec passed** in Fedora WebKitGTK using the current Beta 4 RPM payload and disposable profile `/tmp/shinpo-native-wdio-mkTS2c`; Spring Boot/PostgreSQL ports 8080/5432 were stopped. The run visited Dashboard, Calendar (including internal scroll and page-scroll handoff), Analytics, Focus Protection, EONPAI, Rewards, Settings, theme variants and responsive Guardian widths. Result: 1 passed, 0 failed, about 26 seconds.
- Native screenshots: `/tmp/shinpo-native-wdio-mkTS2c/evidence/`. `dashboard-native.png` was visually inspected. This evidence is machine-local, not bundled into source or release assets.
- Package payload check: RPM contains `/usr/bin/shinpo-desktop`, Browser Host, Chromium/Firefox manifests, registration scripts and install guide. `ldd` on the packaged executable found no missing libraries. Required Fedora libraries include WebKitGTK 4.1, GTK 3, libappindicator and OpenSSL.
- Runtime detail: direct execution from the extracted RPM remained alive in a fresh D-Bus session; the native smoke used the extracted RPM payload staged under a disposable path. The WebDriver runs in Flatpak, so staging under `/tmp` was not visible to its spawn path; staging under the disposable home path resolved this environment issue.
- A privileged RPM installation was not performed: `rpm --root` requires root/chroot capability. No `sudo` was used, and no system installation or existing SHINPO profile was modified.

## Current local Linux package artifacts

These local candidate packages are superseded by the hosted release artifacts, rebuilt from the tagged source. Use the release-attached `SHA256SUMS` for downloads.

| Artifact | Size | SHA-256 |
| --- | ---: | --- |
| `SHINPO-0.1.0-beta.4-1.x86_64.rpm` | 17,471,020 bytes | `f57e1c42e29bdfd404b087525ab0c574fde00c9e31c2cf77406b7e73dab3c7f8` |
| `SHINPO_0.1.0-beta.4_amd64.deb` | 17,459,654 bytes | `f4965f6593e8ee6e7d0ccc461fe1aebcd5abdfe035d0719be94dd617a09faa88` |
| `SHINPO_0.1.0-beta.4_amd64.AppImage` | 127,248,888 bytes | `e59b135c2e21028d8ce8506f11f3784c5b4988f73aa35c03b70d9bb1df13d9d3` |

## Known limitations and safety

- **Browser Companion live acceptance: NOT TESTED.** Extension unit tests pass, but extension-to-host pairing and actual site intervention are not proven. A previous owner report described pairing authentication failure; do not assume that is fixed solely from unit tests.
- **GLib security: OPEN.** GTK/WebKit pulls GLib 0.18.5 with `RUSTSEC-2024-0429` (`VariantStrIter` unsoundness). The release does not claim remediation or owner risk acceptance. Unmaintained warnings remain for `chrono`, `proc-macro-error`, `zbus_names`, `zvariant`, and `zvariant_derive`.
- **Windows: NOT TESTED at runtime.** The tag workflow is Linux-only by design for this prerelease; Windows compilation is not a Windows installation test.
- **Updater: NOT VERIFIED.** No signing key is configured in this local environment; local bundles were built without updater artifacts. The release workflow publishes manual Linux packages and must not imply signed updates.
- **Installed RPM: NOT TESTED.** Payload launch was tested after extraction, but clean package-manager installation, uninstall, and upgrade were not.
- **Strict Guardian: use only with disposable targets.** Do not test against personal apps. Verify supported Linux behavior and review the disclosed safety limitations before enabling.

## Hosted release result

- Release workflow run `45020356630`: overall success. Required QA passed, Linux installer/checksum job passed, Windows installer job skipped, and GitHub prerelease publication succeeded.
- Main CI run `45020356320`: security aggregation failed on unresolved RustSec advisories; Linux and Windows build jobs remained in progress at 2026-11-22 12:17 UTC; see the linked run for current status.
- Published assets include RPM, DEB, AppImage, portable Linux tarball, Chromium and Firefox companion ZIPs, and `SHA256SUMS`. No Windows installer is attached.
- The release remains a supervised Linux private beta. Browser live pairing/site intervention and clean system package-manager installation are not verified. GLib RustSec advisory remains unresolved.


## Final source review

- Reviewed source commit: `5b7a0ea`; release evidence documentation is being committed separately.
- `git diff --check`: PASS.
- `gitleaks dir --redact --no-banner .`: PASS, no leaks found.
- Hosted tagged release and published assets verified; regular CI security job remains failed on known RustSec findings, and Windows native runtime remains unverified.


## Published artifact SHA-256

See the release-attached manifest for every file. Key Linux package hashes:

- RPM: `fd8e7ced202e4354429676be061dca34927c86892c769ee97b0dcb76586b898a`
- DEB: `f04b9fec37dd481fc5db5833f3bed342e6fc624e2f7926d9eb17d1b36f5c5541`
- AppImage: `16df84253b3b157434ff3debab8f8475674ff4399bdb86296de3440dbf0b139a`
- Portable tarball: `f15111d423721f7bcfe002349088cd42ec24928396164931dfe8a6b1e4d6dcb6`
