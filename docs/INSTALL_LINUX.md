# SHINPO — Linux Installation Guide (Beta 0.1.0-beta.1)

This guide walks you through installing and setting up the **SHINPO (進歩)** desktop app and its optional browser companion on Linux x86_64 distributions.

---

## System Requirements

- **OS:** Linux x86_64 (Fedora 38+, RHEL 9+, Ubuntu 22.04 LTS+, Debian 12+)
- **Display Server:** Wayland or X11
- **Key System Libraries:**
  - `webkit2gtk-4.1` (or `libwebkit2gtk-4.1-0`)
  - `openssl` (3.x) / `libcrypto.so.3`
  - `libsecret-1` (recommended for OS secret storage)

---

## 1. Installing the Desktop Application

Download the release package (`.rpm` or `.deb`) from the release assets or distribution bundle.

### Fedora / RHEL / Rocky Linux (.rpm)

```bash
# Install the RPM package via dnf or rpm
sudo dnf install ./SHINPO-0.1.0-beta.1-1.x86_64.rpm

# Or using rpm directly:
sudo rpm -i ./SHINPO-0.1.0-beta.1-1.x86_64.rpm
```

### Ubuntu / Debian / Pop!_OS (.deb)

```bash
# Install the Debian package via apt (resolves any missing runtime dependencies automatically)
sudo apt update
sudo apt install ./shinpo-desktop_0.1.0-beta.1_amd64.deb

# Or via dpkg with dependency fix:
sudo dpkg -i ./shinpo-desktop_0.1.0-beta.1_amd64.deb || sudo apt-get install -f -y
```

### Launching the Application

Once installed, you can launch SHINPO from your desktop application launcher (search for "SHINPO") or run from terminal:

```bash
shinpo-desktop
```

---

## 2. First Launch & Setup Walkthrough

1. **Welcome Screen:** On initial start, you will be prompted to create your local master account.
2. **Master Passphrase:**
   - Choose a memorable, strong master passphrase.
   - This passphrase derives your SQLCipher encryption key using Argon2id.
   - **Crucial:** SHINPO is local-first. We do not operate cloud servers and cannot reset your passphrase if forgotten.
3. **Save Your Recovery Key:**
   - Upon vault initialization, SHINPO displays a multi-word cryptographic recovery seed.
   - Write this down or store it in your password manager.
4. **Theme Preference:**
   - Select between Classic Dark (emerald green accent) or Aurora Dark (amethyst violet accent). You can also switch themes at any time in Settings.

---

## 3. Browser Companion Setup (Optional)

The SHINPO Browser Companion connects supported Chromium and Firefox browsers to your desktop focus engine via native messaging.

### Companion Files Location

When SHINPO is installed via RPM or DEB, companion assets reside in `/usr/lib/SHINPO/browser-companion/`:
- `shinpo-browser-host` (the native messaging host binary)
- `register-browser-companion.sh` (registration helper script)
- `chromium/` (unpacked extension directory for Chromium, Chrome, Brave, Edge)
- `firefox/` (unpacked extension directory for Firefox)

### Step 1: Register Native Messaging Host

Run the registration script once for your target browser:

```bash
# For Google Chrome:
/usr/lib/SHINPO/browser-companion/register-browser-companion.sh --chrome

# For Chromium / Brave:
/usr/lib/SHINPO/browser-companion/register-browser-companion.sh --chromium --brave

# For Mozilla Firefox:
/usr/lib/SHINPO/browser-companion/register-browser-companion.sh --firefox

# Or register for all installed browsers:
/usr/lib/SHINPO/browser-companion/register-browser-companion.sh --all
```

### Step 2: Load Extension in Your Browser

#### Google Chrome / Brave / Edge:
1. Open your browser and navigate to `chrome://extensions/` (or `brave://extensions/`).
2. Toggle on **Developer mode** (top-right corner).
3. Click **Load unpacked**.
4. Select the directory: `/usr/lib/SHINPO/browser-companion/chromium`.

#### Mozilla Firefox:
1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on...**.
3. Select `/usr/lib/SHINPO/browser-companion/firefox/manifest.json`.
*(Note: Permanent loading in release Firefox builds requires Mozilla signing; temporary loading is used for beta testing).*

### Step 3: Pair Companion with SHINPO Desktop
1. In SHINPO Desktop, open **Settings** (gear icon) → **Browser Companion**.
2. Click **Generate Pairing Code**. A 6-character, time-limited code is generated.
3. Click the SHINPO extension icon in your browser toolbar, enter the code, and click **Pair**.
4. The extension icon turns green and reports active policy synchronization.

---

## 4. Troubleshooting & FAQ

### Issue: "error while loading shared libraries: libwebkit2gtk-4.1.so.0"
- **Cause:** WebKitGTK 4.1 library is missing.
- **Solution:**
  - Ubuntu/Debian: `sudo apt install libwebkit2gtk-4.1-0`
  - Fedora/RHEL: `sudo dnf install webkit2gtk4.1`
  - Arch Linux: `sudo pacman -S webkit2gtk-4.1`

### Issue: OS Secret Storage / Keyring Warning
- **Cause:** No active D-Bus Secret Service provider (e.g. `gnome-keyring` or `ksecretservice`) detected in minimal window managers.
- **Solution:** SHINPO will automatically fall back to secure file-backed vault authentication. To enable system keyring, ensure `gnome-keyring` is installed and unlocked at login.

### Issue: App window does not appear under Wayland
- **Workaround:** Run with XWayland compatibility if necessary:
  ```bash
  GDK_BACKEND=x11 shinpo-desktop
  ```
