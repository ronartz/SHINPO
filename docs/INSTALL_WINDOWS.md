# Windows Support — NOT QUALIFIED FOR THIS BETA (NO-GO)

**Status:** **NO-GO / NOT AUTHORIZED FOR DISTRIBUTION**

Windows packages are **not** qualified for this beta release.

### Why Windows is Blocked:
1. **Linux Build Host:** Native Windows testing, Windows Credential Manager verification, NSIS installation, and WebView2 execution cannot be verified locally on a Linux development host.
2. **Guardian Process Identity Parity:** Process identity checks and sandboxed interception mechanisms must be tested and proven on native Windows hardware before private distribution.
3. **No Code Signing:** Pre-release Windows binaries trigger severe SmartScreen blocks and reputation warnings.

### Distribution Boundary:
- Do **not** distribute Windows installers (`.exe` or `.msi`) to testers during this beta.
- Only the qualified Linux x86_64 RPM package and portable Linux tarball are approved for friends-only beta testing.
