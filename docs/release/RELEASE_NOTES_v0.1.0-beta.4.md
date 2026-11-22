# 🌌 SHINPO v0.1.0-beta.4 — Supervised Desktop Beta

> **Private beta:** Back up your recovery key before upgrading. SHINPO stores workspace data in a local encrypted vault. If both your password and recovery key are lost, the data may be unrecoverable.

---

## ✨ What's New in Beta 4

### 🛡️ Guardian and Focus Protection

- Strict Guardian on supported Linux systems can close an explicitly blocked, same-user process only while Focus is active and session-level closure consent is enabled.
- Guardian verifies the executable identity, asks the app to close gracefully, and may force-terminate that same verified process if it remains alive. Use only with disposable targets whose unsaved work can be discarded. Protected and unverified processes are excluded.
- Windows process identity checks and app closure are not implemented in this build.
- A vault migration adds session-scoped Guardian closure consent; existing sessions do not gain consent retroactively.

### 🎯 Focus and Productivity

- Includes Focus, task, analytics, background-rendering and desktop interaction fixes.
- Focus records, task state and progress remain stored in the local encrypted vault.

### 🌐 Browser Companion

- Pairing now validates native-host registration before displaying a one-time code.
- Invalid, expired or previously used codes are reported as pairing failures. A failed first policy sync is shown as a sync error rather than a successful connection.
- Install the companion separately and pair it with SHINPO. Store publication is not included.

---

## 📦 Downloads

| Platform | Package | Recommended for | Status |
| --- | --- | --- | --- |
| Fedora / compatible Linux x86_64 | `SHINPO_0.1.0-beta.4_linux_x86_64.rpm` | Fedora users | Extracted-payload smoke only; package-manager install not verified |
| Debian / Ubuntu x86_64 | `SHINPO_0.1.0-beta.4_linux_x86_64.deb` | Debian-family users | Clean installation not verified |
| Linux x86_64 | `SHINPO_0.1.0-beta.4_linux_x86_64.AppImage` | Portable testing | Runtime qualification not verified |
| Windows x64 | `SHINPO_0.1.0-beta.4_windows_x64_setup.exe` | Experimental manual testing | CI-built; installation and runtime not tested |
| Chromium | `shinpo-browser-companion-chromium.zip` | Manual extension installation | Live pairing and policy enforcement not accepted |
| Firefox | `shinpo-browser-companion-firefox.zip` | Manual extension installation | Live pairing and policy enforcement not accepted |

---

## 🛡️ Verification and SHA-256

- **Version:** `0.1.0-beta.4`
- **Source revision used for the desktop artifacts:** `728f117e2866bce3a8668b40159412364e022d6b`
- **Checksums:** [Download `SHA256SUMS`](https://github.com/ronartz/SHINPO/releases/download/v0.1.0-beta.4/SHA256SUMS)

```text
fd8e7ced202e4354429676be061dca34927c86892c769ee97b0dcb76586b898a  SHINPO-0.1.0-beta.4-1.x86_64.rpm
f04b9fec37dd481fc5db5833f3bed342e6fc624e2f7926d9eb17d1b36f5c5541  SHINPO_0.1.0-beta.4_linux_x86_64.deb
16df84253b3b157434ff3debab8f8475674ff4399bdb86296de3440dbf0b139a  SHINPO_0.1.0-beta.4_linux_x86_64.AppImage
49118e61821f0505195e3e1015cd9b12cecbbf25e6de05b167fa251bbdcee82c  SHINPO_0.1.0-beta.4_windows_x64_setup.exe
0f992eada7754af5c3514b3acc725f637682789672567dd63b048d28c210f8b5  shinpo-browser-companion-chromium.zip
a6ae31cf1218fd1502c889c274b171da0338c5091e4e53ec46b5df960940cec1  shinpo-browser-companion-firefox.zip
```

---

## ⚠️ Known Beta Limitations

- **Browser Companion:** Live extension pairing and Focus-to-browser policy enforcement have not passed acceptance. A prior pairing authentication failure remains unresolved. Do not rely on website restrictions as your only enforcement mechanism.
- **Windows:** The NSIS installer was built by GitHub Actions, but installation and native runtime have not been tested on Windows. Native app closure is unavailable on Windows. The updater signature is not Authenticode signing.
- **Linux installation:** Fedora payload smoke testing was performed after extraction; clean package-manager installation and upgrade were not verified.
- **Rust dependency advisory:** Beta 4's Shield and Browser Host binaries use locked `url 2.5.8`, affected by `RUSTSEC-2026-0592` (stack overflow in `Url::origin()` with nested `blob:` URLs). Source lockfiles have since been updated to `url 2.5.9`, but that fix is **not present in these Beta 4 artifacts**; a rebuilt release is required.
- **Other Rust advisories:** The transitive GLib 0.18.5 `VariantStrIter` unsoundness (`RUSTSEC-2024-0429`) remains under a documented exception. `chrono`, `proc-macro-error`, `zbus_names`, `zvariant` and `zvariant_derive` remain reported as unmaintained; these are not fixed in Beta 4.
- **Automatic updates:** Updater artifacts work only when the release signing secret is configured in CI. Manual package downloads do not imply updater signing.

Report defects at <https://github.com/ronartz/SHINPO/issues>.

**Full Changelog:** https://github.com/ronartz/SHINPO/compare/v0.1.0-beta.3...v0.1.0-beta.4
