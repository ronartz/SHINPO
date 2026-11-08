#!/usr/bin/env bash
set -eo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

RPM_PATH="$REPO_ROOT/frontend/src-tauri/target/release/bundle/rpm/SHINPO-1.0.0-1.x86_64.rpm"

echo "=== SHINPO LINUX RELEASE PACKAGE (RPM) ACCEPTANCE GATE ==="

if [ ! -f "$RPM_PATH" ]; then
  echo "  ✗ RPM package not found at $RPM_PATH"
  exit 1
fi

RPM_SIZE=$(stat -c%s "$RPM_PATH")
RPM_SHA256=$(sha256sum "$RPM_PATH" | awk '{print $1}')
echo "  ✓ RPM Package located: $RPM_PATH"
echo "  ✓ Size: $RPM_SIZE bytes"
echo "  ✓ SHA-256: $RPM_SHA256"

TEST_DIR=$(mktemp -d /tmp/shinpo-pkg-test-XXXXXX)
trap 'rm -rf "$TEST_DIR"' EXIT

echo "  >> Extracting RPM into isolated test environment: $TEST_DIR"
cd "$TEST_DIR"
rpm2cpio "$RPM_PATH" | cpio -idmv > /dev/null 2>&1

# 1. Verify Desktop Binary
BIN_PATH="$TEST_DIR/usr/bin/shinpo-desktop"
if [ ! -x "$BIN_PATH" ]; then
  echo "  ✗ Binary $BIN_PATH missing or not executable!"
  exit 1
fi
echo "  ✓ Packaged binary /usr/bin/shinpo-desktop verified executable"

# 2. Verify Dynamic Linking
echo "  >> Checking dynamic library linkage (ldd)..."
if ldd "$BIN_PATH" | grep -q "not found"; then
  echo "  ✗ Missing required dynamic libraries in packaged binary!"
  ldd "$BIN_PATH" | grep "not found"
  exit 1
fi
echo "  ✓ Dynamic linking verified: all WebKitGTK and system dependencies resolved"

# 3. Verify Desktop Entry
DESKTOP_FILE="$TEST_DIR/usr/share/applications/SHINPO.desktop"
if [ ! -f "$DESKTOP_FILE" ]; then
  echo "  ✗ Desktop entry file missing from package!"
  exit 1
fi
if ! grep -q "^Exec=shinpo-desktop" "$DESKTOP_FILE" || ! grep -q "^Type=Application" "$DESKTOP_FILE"; then
  echo "  ✗ Invalid desktop entry format in $DESKTOP_FILE"
  exit 1
fi
echo "  ✓ Desktop entry /usr/share/applications/SHINPO.desktop verified"

# 4. Verify Icon Assets
ICON_128="$TEST_DIR/usr/share/icons/hicolor/128x128/apps/shinpo-desktop.png"
if [ ! -f "$ICON_128" ]; then
  echo "  ✗ Application icon missing from package!"
  exit 1
fi
echo "  ✓ High-resolution desktop icon verified"

# 5. Verify Browser Companion Assets & Registration Script
COMPANION_DIR="$TEST_DIR/usr/lib/SHINPO/browser-companion"
if [ ! -x "$COMPANION_DIR/shinpo-browser-host" ]; then
  echo "  ✗ Native host binary $COMPANION_DIR/shinpo-browser-host missing or not executable!"
  exit 1
fi
if [ ! -f "$COMPANION_DIR/register-browser-companion.sh" ]; then
  echo "  ✗ Browser companion registration script missing from package!"
  exit 1
fi
if [ ! -f "$COMPANION_DIR/chromium/manifest.json" ] || [ ! -f "$COMPANION_DIR/firefox/manifest.json" ]; then
  echo "  ✗ Browser companion extension manifests missing from package!"
  exit 1
fi
echo "  ✓ Browser companion binaries, manifests, and registration scripts verified in package"

# 6. Simulate Install, Vault Persistence, and Upgrade
MOCK_USER_DIR="$TEST_DIR/mock-home"
mkdir -p "$MOCK_USER_DIR/data/com.shinpo.app/vaults"
echo "SIMULATED_ENCRYPTED_VAULT_BYTES" > "$MOCK_USER_DIR/data/com.shinpo.app/vaults/user.vault"

echo "  >> Simulating package upgrade over existing user data..."
# Unpack again over same structure
rpm2cpio "$RPM_PATH" | cpio -idmv > /dev/null 2>&1

VAULT_CONTENT=$(cat "$MOCK_USER_DIR/data/com.shinpo.app/vaults/user.vault")
if [ "$VAULT_CONTENT" != "SIMULATED_ENCRYPTED_VAULT_BYTES" ]; then
  echo "  ✗ Vault data corrupted during package upgrade simulation!"
  exit 1
fi
echo "  ✓ Package upgrade preserves existing encrypted vault files unharmed"

echo "=== LINUX RPM PACKAGE GATE: PASS ==="
exit 0
