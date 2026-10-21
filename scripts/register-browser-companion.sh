#!/usr/bin/env bash
# ==============================================================================
# SHINPO — Native Browser Companion Registration Script (Linux / macOS)
# Automatically registers com.shinpo.browser_companion Native Messaging Host
# for Chrome, Chromium, Brave, Edge, and Firefox.
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "======================================================================"
echo "[SHINPO BROWSER HOST] Registering Native Messaging Host..."
echo "======================================================================"

# Locate shinpo-browser-host binary
HOST_BIN=""
if [[ -x "${PROJECT_ROOT}/crates/shinpo-browser-host/target/release/shinpo-browser-host" ]]; then
    HOST_BIN="${PROJECT_ROOT}/crates/shinpo-browser-host/target/release/shinpo-browser-host"
elif [[ -x "${PROJECT_ROOT}/target/release/shinpo-browser-host" ]]; then
    HOST_BIN="${PROJECT_ROOT}/target/release/shinpo-browser-host"
elif [[ -x "${PROJECT_ROOT}/crates/shinpo-browser-host/target/debug/shinpo-browser-host" ]]; then
    HOST_BIN="${PROJECT_ROOT}/crates/shinpo-browser-host/target/debug/shinpo-browser-host"
elif command -v shinpo-browser-host &>/dev/null; then
    HOST_BIN="$(command -v shinpo-browser-host)"
fi

if [[ -z "${HOST_BIN}" ]]; then
    echo "[SHINPO BROWSER HOST] Binary not found. Compiling via cargo..."
    (cd "${PROJECT_ROOT}/crates/shinpo-browser-host" && cargo build --release)
    HOST_BIN="${PROJECT_ROOT}/crates/shinpo-browser-host/target/release/shinpo-browser-host"
fi

HOST_BIN="$(realpath "${HOST_BIN}")"
echo "[SHINPO BROWSER HOST] Target binary: ${HOST_BIN}"

# Manifest Directory and Path
MANIFEST_DIR="${HOME}/.config/shinpo"
mkdir -p "${MANIFEST_DIR}"
MANIFEST_PATH="${MANIFEST_DIR}/com.shinpo.browser_companion.json"
FIREFOX_MANIFEST_PATH="${MANIFEST_DIR}/com.shinpo.browser_companion.firefox.json"

# Write Chromium manifest
cat > "${MANIFEST_PATH}" <<EOF
{
  "name": "com.shinpo.browser_companion",
  "description": "SHINPO Focus Protection Browser Companion Native Host",
  "path": "${HOST_BIN}",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://*",
    "chrome-extension://*/*"
  ]
}
EOF

# Write Firefox manifest
cat > "${FIREFOX_MANIFEST_PATH}" <<EOF
{
  "name": "com.shinpo.browser_companion",
  "description": "SHINPO Focus Protection Browser Companion Native Host",
  "path": "${HOST_BIN}",
  "type": "stdio",
  "allowed_extensions": [
    "companion@shinpo.local",
    "shinpo@shinpo.local"
  ]
}
EOF

# Browser target directories on Linux
TARGET_DIRS=(
    "${HOME}/.config/google-chrome/NativeMessagingHosts"
    "${HOME}/.config/chromium/NativeMessagingHosts"
    "${HOME}/.config/BraveSoftware/Brave-Browser/NativeMessagingHosts"
    "${HOME}/.config/microsoft-edge/NativeMessagingHosts"
)

INSTALLED_COUNT=0
for DIR in "${TARGET_DIRS[@]}"; do
    mkdir -p "${DIR}"
    cp -f "${MANIFEST_PATH}" "${DIR}/com.shinpo.browser_companion.json"
    echo "  [OK] Registered manifest in: ${DIR}"
    INSTALLED_COUNT=$((INSTALLED_COUNT + 1))
done

# Firefox target directories
FIREFOX_TARGETS=(
    "${HOME}/.mozilla/native-messaging-hosts"
)
for DIR in "${FIREFOX_TARGETS[@]}"; do
    mkdir -p "${DIR}"
    cp -f "${FIREFOX_MANIFEST_PATH}" "${DIR}/com.shinpo.browser_companion.json"
    echo "  [OK] Registered Firefox manifest in: ${DIR}"
    INSTALLED_COUNT=$((INSTALLED_COUNT + 1))
done

echo "======================================================================"
echo "[SHINPO BROWSER HOST] Successfully registered in ${INSTALLED_COUNT} browser locations."
echo "Native host path: ${HOST_BIN}"
echo "======================================================================"
