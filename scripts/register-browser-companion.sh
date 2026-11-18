#!/usr/bin/env bash
# ==============================================================================
# SHINPO — Native Browser Companion Registration Script (Linux / macOS)
# Registers only the explicitly selected browser's SHINPO Native Messaging Host.
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
CONFIG_HOME="${XDG_CONFIG_HOME:-${HOME}/.config}"
HOST_NAME="com.shinpo.browser_companion"
HOST_ALIAS="com.shinpo.companion"
CHROMIUM_ID="ndknhgihhogcfkliohfjcllglpjdgjpj"
FIREFOX_ID="browser-companion@shinpo.local"
MANIFEST_DIR="${CONFIG_HOME}/shinpo"
MANIFEST_PATH="${MANIFEST_DIR}/${HOST_NAME}.json"
MANIFEST_ALIAS_PATH="${MANIFEST_DIR}/${HOST_ALIAS}.json"
FIREFOX_MANIFEST_PATH="${MANIFEST_DIR}/${HOST_NAME}.firefox.json"
FIREFOX_MANIFEST_ALIAS_PATH="${MANIFEST_DIR}/${HOST_ALIAS}.firefox.json"
TARGET_DIRS=(
    "${CONFIG_HOME}/google-chrome/NativeMessagingHosts"
    "${CONFIG_HOME}/google-chrome-for-testing/NativeMessagingHosts"
    "${CONFIG_HOME}/chromium/NativeMessagingHosts"
    "${CONFIG_HOME}/BraveSoftware/Brave-Browser/NativeMessagingHosts"
    "${CONFIG_HOME}/microsoft-edge/NativeMessagingHosts"
    "${HOME}/.var/app/com.google.Chrome/config/google-chrome/NativeMessagingHosts"
    "${HOME}/.var/app/com.brave.Browser/config/BraveSoftware/Brave-Browser/NativeMessagingHosts"
)
FIREFOX_TARGETS=(
    "${HOME}/.mozilla/native-messaging-hosts"
    "${HOME}/.var/app/org.mozilla.firefox/.mozilla/native-messaging-hosts"
)
SELECTED_TARGETS=()
REGISTER_FIREFOX=false
REGISTER_ALL=false
UNINSTALL=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --chrome)
            SELECTED_TARGETS+=("${TARGET_DIRS[0]}" "${TARGET_DIRS[1]}")
            shift
            ;;
        --chromium)
            SELECTED_TARGETS+=("${TARGET_DIRS[2]}")
            shift
            ;;
        --brave)
            SELECTED_TARGETS+=("${TARGET_DIRS[3]}")
            shift
            ;;
        --edge)
            SELECTED_TARGETS+=("${TARGET_DIRS[4]}")
            shift
            ;;
        --target-dir)
            SELECTED_TARGETS+=("$2")
            shift 2
            ;;
        --user-data-dir)
            SELECTED_TARGETS+=("$2/NativeMessagingHosts")
            shift 2
            ;;
        --firefox)
            REGISTER_FIREFOX=true
            shift
            ;;
        --all)
            REGISTER_ALL=true
            shift
            ;;
        --uninstall)
            UNINSTALL=true
            shift
            ;;
        *)
            echo "Unknown option: $1" >&2
            exit 2
            ;;
    esac
done

if [[ "${REGISTER_ALL}" == true ]]; then
    SELECTED_TARGETS=("${TARGET_DIRS[@]}")
    REGISTER_FIREFOX=true
fi

is_shinpo_manifest() {
    [[ -f "$1" ]] && python3 -c 'import json,sys; name = json.load(open(sys.argv[1], encoding="utf-8")).get("name"); sys.exit(0 if name in ("com.shinpo.browser_companion", "com.shinpo.companion") else 1)' "$1" 2>/dev/null
}

if [[ "${UNINSTALL}" == true ]]; then
    for DIR in "${TARGET_DIRS[@]}" "${FIREFOX_TARGETS[@]}"; do
        for NAME in "${HOST_NAME}" "${HOST_ALIAS}"; do
            DEST="${DIR}/${NAME}.json"
            if is_shinpo_manifest "${DEST}"; then
                rm -f -- "${DEST}"
                echo "Removed SHINPO host registration: ${DEST}"
            fi
        done
    done
    for MANIFEST in "${MANIFEST_PATH}" "${MANIFEST_ALIAS_PATH}" "${FIREFOX_MANIFEST_PATH}" "${FIREFOX_MANIFEST_ALIAS_PATH}"; do
        if is_shinpo_manifest "${MANIFEST}"; then rm -f -- "${MANIFEST}"; fi
    done
    exit 0
fi

echo "======================================================================"
echo "[SHINPO BROWSER HOST] Registering Native Messaging Host..."
echo "======================================================================"

if [[ ${#SELECTED_TARGETS[@]} -eq 0 && "${REGISTER_FIREFOX}" != true ]]; then
    SELECTED_TARGETS=("${TARGET_DIRS[@]}")
    REGISTER_FIREFOX=true
    echo "[SHINPO BROWSER HOST] Auto-registering for all standard browser locations..."
    echo "[SHINPO BROWSER HOST] (Choose a browser explicitly: --chrome, --chromium, --edge, --brave, --firefox, or --all)"
fi

# Locate shinpo-browser-host binary
HOST_BIN=""
if [[ -x "${SCRIPT_DIR}/shinpo-browser-host" ]]; then
    HOST_BIN="${SCRIPT_DIR}/shinpo-browser-host"
elif [[ -x "/usr/lib/SHINPO/browser-companion/shinpo-browser-host" ]]; then
    HOST_BIN="/usr/lib/SHINPO/browser-companion/shinpo-browser-host"
elif [[ -x "${PROJECT_ROOT}/release/shinpo-browser-host" ]]; then
    HOST_BIN="${PROJECT_ROOT}/release/shinpo-browser-host"
elif [[ -x "${PROJECT_ROOT}/crates/shinpo-browser-host/target/release/shinpo-browser-host" ]]; then
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

# Validate every destination before writing any registration.
DESTINATIONS=("${MANIFEST_PATH}" "${MANIFEST_ALIAS_PATH}")
if [[ "${REGISTER_FIREFOX}" == true ]]; then
    DESTINATIONS+=("${FIREFOX_MANIFEST_PATH}" "${FIREFOX_MANIFEST_ALIAS_PATH}")
    for DIR in "${FIREFOX_TARGETS[@]}"; do
        DESTINATIONS+=("${DIR}/${HOST_NAME}.json" "${DIR}/${HOST_ALIAS}.json")
    done
fi
for DIR in "${SELECTED_TARGETS[@]}"; do
    DESTINATIONS+=("${DIR}/${HOST_NAME}.json" "${DIR}/${HOST_ALIAS}.json")
done
for MANIFEST in "${DESTINATIONS[@]}"; do
    if [[ -e "${MANIFEST}" ]] && ! is_shinpo_manifest "${MANIFEST}"; then
        echo "Refusing to overwrite a non-SHINPO native host manifest: ${MANIFEST}" >&2
        exit 1
    fi
done

# Manifest Directory and Path
mkdir -p "${MANIFEST_DIR}"

# Write Chromium manifests (canonical and alias)
for M_NAME in "${HOST_NAME}" "${HOST_ALIAS}"; do
    M_PATH="${MANIFEST_DIR}/${M_NAME}.json"
    cat > "${M_PATH}" <<EOF
{
  "name": "${M_NAME}",
  "description": "SHINPO Focus Protection Browser Companion Native Host",
  "path": "${HOST_BIN}",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://${CHROMIUM_ID}/"
  ]
}
EOF
done

if [[ "${REGISTER_FIREFOX}" == true ]]; then
    # Write Firefox manifests (canonical and alias)
    for M_NAME in "${HOST_NAME}" "${HOST_ALIAS}"; do
        M_PATH="${MANIFEST_DIR}/${M_NAME}.firefox.json"
        cat > "${M_PATH}" <<EOF
{
  "name": "${M_NAME}",
  "description": "SHINPO Focus Protection Browser Companion Native Host",
  "path": "${HOST_BIN}",
  "type": "stdio",
  "allowed_extensions": [
    "${FIREFOX_ID}",
    "companion@shinpo.local",
    "shinpo@shinpo.local"
  ]
}
EOF
    done
fi

# Browser target directories on Linux
INSTALLED_COUNT=0
for DIR in "${SELECTED_TARGETS[@]}"; do
    mkdir -p "${DIR}"
    for M_NAME in "${HOST_NAME}" "${HOST_ALIAS}"; do
        SRC="${MANIFEST_DIR}/${M_NAME}.json"
        DEST="${DIR}/${M_NAME}.json"
        if [[ -e "${DEST}" ]] && ! is_shinpo_manifest "${DEST}"; then
            echo "Refusing to overwrite a non-SHINPO native host manifest: ${DEST}" >&2
            exit 1
        fi
        install -m 644 "${SRC}" "${DEST}"
        INSTALLED_COUNT=$((INSTALLED_COUNT + 1))
    done
    echo "  [OK] Registered manifests (${HOST_NAME}, ${HOST_ALIAS}) in: ${DIR}"
done

# Firefox target directories
if [[ "${REGISTER_FIREFOX}" == true ]]; then
    for DIR in "${FIREFOX_TARGETS[@]}"; do
        mkdir -p "${DIR}"
        for M_NAME in "${HOST_NAME}" "${HOST_ALIAS}"; do
            SRC="${MANIFEST_DIR}/${M_NAME}.firefox.json"
            DEST="${DIR}/${M_NAME}.json"
            install -m 644 "${SRC}" "${DEST}"
            INSTALLED_COUNT=$((INSTALLED_COUNT + 1))
        done
        echo "  [OK] Registered Firefox manifests (${HOST_NAME}, ${HOST_ALIAS}) in: ${DIR}"
    done
fi

echo "======================================================================"
echo "[SHINPO BROWSER HOST] Successfully registered in ${INSTALLED_COUNT} browser locations."
echo "Native host path: ${HOST_BIN}"
echo "======================================================================"
