# SHINPO Browser Companion installation

The desktop installers include the Rust native-messaging host, Chromium and Firefox extension folders, and per-user registration scripts. The extension builds are unpacked developer builds; they are not signed or store-published.

## Fedora / Linux

1. Install the RPM using the system package manager.
2. Locate the installed `browser-companion` resource directory from the package file list (for the current RPM: `/usr/lib/SHINPO/browser-companion`). It contains `shinpo-browser-host`, `chromium/`, `firefox/`, and this guide.
3. In a terminal, run the registration script for only the browser you will use, for example `bash /usr/lib/SHINPO/browser-companion/register-browser-companion.sh --chrome`. Supported selectors are `--chrome`, `--chromium`, `--edge`, `--brave`, `--firefox`, or `--all`. Registration writes only the selected browser's per-user NativeMessagingHosts manifest; `--uninstall` removes only SHINPO-owned registrations.
4. In Chromium-family browsers, open the extensions page, enable Developer mode, choose **Load unpacked**, and select `/usr/lib/SHINPO/browser-companion/chromium`. In Firefox, load `/usr/lib/SHINPO/browser-companion/firefox/manifest.json` as a temporary add-on; Firefox permanent installation requires a signed extension.
5. Open SHINPO Settings, generate a pairing code, then enter it in the extension. Pairing codes are single-use and expire after ten minutes. The host stores a separate revocable browser credential.

The browser must be restarted after installing the extension or registering its native host. Browser developer mode, extension installation, microphone, and desktop interaction permissions remain under the user's control.

## Windows

Use the installer resource directory's `register-browser-companion.ps1` from the current-user PowerShell session, then load the packaged `chromium/` folder through the browser's extension developer page. In Firefox, load the packaged manifest temporarily. The PowerShell registration is per-user; Firefox permanent installation still requires a signed extension.

## Safety and current limits

The registration scripts use absolute host executable paths, exact extension identities, and refuse to overwrite a foreign host manifest. They do not edit extension data or browser profiles. Choose only the browser whose native-host registration you intend to add.

Pairing only proves that the extension can authenticate to the local host. Confirm the extension reports a current policy before relying on website restrictions. The current Fedora release has not yet passed the installed-app Focus/Break/Grace/Return browser acceptance journey. Website enforcement, disconnect behavior, and Guardian warnings must be treated as unqualified until that runtime test is complete. Process closure remains disabled; app observations are not proof that an app was blocked.
