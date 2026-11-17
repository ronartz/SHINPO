# SHINPO — Linux Private Beta Installation Guide

**Version:** `0.1.0-beta.1`  
**Target Architecture:** Linux x86_64  
**Qualified Platform:** Fedora 40/41 (and compatible RHEL 9+ / Rocky Linux derivatives)  
**Distribution Type:** Friends & Family Private Beta (Local Handoff Only)  
**Debian/Ubuntu Status:** `.deb` packages were **not** built or qualified for this beta. Only the RPM package and portable tarball are available.

---

## 1. System Requirements & Runtime Dependencies

Before running SHINPO, ensure your system has the required WebKitGTK and security libraries:

- **WebKitGTK 4.1:** `webkit2gtk4.1` (provides desktop rendering engine)
- **OpenSSL 3.x:** `openssl-libs` / `libcrypto.so.3`
- **Secret Storage:** `libsecret` (optional, for desktop session persistence)
- **Display Server:** Wayland (native) or X11

On Fedora / RHEL, install missing runtime dependencies if needed:
```bash
sudo dnf install webkit2gtk4.1 openssl-libs libsecret
```

---

## 2. Installation Options

### Option A: RPM Package (Recommended)

Install the provided RPM package via `dnf`:

```bash
sudo dnf install ./SHINPO-0.1.0-beta.1-1.x86_64.rpm
```

Once installed, you can launch SHINPO from your application menu or run:
```bash
shinpo-desktop
```

#### To Uninstall:
```bash
sudo dnf remove shinpo
```

---

### Option B: Portable Tarball (No Root / No Package Manager)

If you prefer not to install system packages:

1. Extract the tarball:
   ```bash
   tar -xzf SHINPO-0.1.0-beta.1-linux-x86_64.tar.gz
   cd SHINPO-0.1.0-beta.1-linux-x86_64
   ```
2. Launch the application directly:
   ```bash
   ./shinpo-desktop
   ```

---

## 3. First Launch & Setup

1. **Create Account:**
   - On first launch, create your local master username and passphrase.
   - **Crucial Warning:** Your data is encrypted locally using SQLCipher (256-bit AES + Argon2id). **There is no cloud server and no password reset email.** If you forget your passphrase, your vault cannot be recovered.
2. **Save Your Recovery Key:**
   - SHINPO will generate a 24-word recovery seed.
   - Record this seed in your password manager or on paper. You can use this seed to reset your passphrase if forgotten.
3. **Choose Your Theme:**
   - Select between **Classic Dark** (emerald lime) and **Aurora Dark** (amethyst violet). You can switch anytime in Settings.

---

## 4. Browser Companion Setup (Optional)

The package bundles an optional browser companion for Chromium and Firefox.

1. **Register the Native Host:**
   Run the companion registration script once:
   ```bash
   /usr/lib/SHINPO/browser-companion/register-browser-companion.sh --chromium --chrome
   ```
   *(Or if using the portable tarball, run `./register-browser-companion.sh --chromium --chrome` from the tarball folder).*

2. **Load Extension in Chromium / Chrome / Brave:**
   - Navigate to `chrome://extensions/` or `brave://extensions/`.
   - Enable **Developer mode** (top-right).
   - Click **Load unpacked** and select `/usr/lib/SHINPO/browser-companion/chromium` (or the unpacked folder from the tarball).

3. **Pairing:**
   - In SHINPO Desktop, open **Settings** → **Browser Companion** → **Generate Pairing Code**.
   - Click the extension icon in your browser toolbar, enter the 6-character code, and confirm.

---

## 5. Data Safety & Backup Precautions

- Your personal encrypted vault is stored under your user directory:
  `~/.local/share/com.shinpo.app/vaults/`
- Before upgrading or running tests, you can back up this folder with:
  ```bash
  cp -r ~/.local/share/com.shinpo.app/vaults ~/shinpo-vault-backup
  ```
- Focus Guardian is **strictly warning-only**: it will display notifications and non-destructive overlays when configured distraction apps are detected, but **it will never kill or close your applications**.

---

## 6. How to Report Bugs

Because this is a private beta distributed directly to friends:
- Please message the app author directly with any issues, crashes, or visual glitches.
- Include your Linux distribution version (`cat /etc/os-release`) and your desktop environment (GNOME, KDE, etc.).
