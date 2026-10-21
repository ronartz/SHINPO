#!/usr/bin/env bash
# ==============================================================================
# SHINPO — Linux Desktop Packaging Script
# Builds the complete SHINPO Linux distribution packages (.deb, .AppImage, tarball).
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
RELEASE_DIR="${1:-${RELEASE_DIR:-${PROJECT_ROOT}/release/rc}}"

echo "======================================================================"
echo "  進歩 (SHINPO) Linux Desktop Package Builder"
echo "  Targets: Standalone AppImage, Debian (.deb), Native Binaries"
echo "  Architecture: Tauri v2 + React 19 + Native Rust Shield & Companion"
echo "======================================================================"

mkdir -p "${RELEASE_DIR}"

# 1. Build React Frontend
echo ""
echo "[1/4] Building React Cockpit production bundle..."
(cd "${PROJECT_ROOT}/frontend" && npm run build)

# 2. Build Native Companion Crates (shinpo-shield, shinpo-browser-host)
echo ""
echo "[2/4] Building native companion binaries (release)..."
(cd "${PROJECT_ROOT}/crates/shinpo-shield" && cargo build --release)
(cd "${PROJECT_ROOT}/crates/shinpo-browser-host" && cargo build --release)

cp -f "${PROJECT_ROOT}/crates/shinpo-shield/target/release/shinpo-shield" "${RELEASE_DIR}/"
cp -f "${PROJECT_ROOT}/crates/shinpo-browser-host/target/release/shinpo-browser-host" "${RELEASE_DIR}/"
echo "  [OK] Staged native shield & browser-host binaries."

# 3. Build Tauri Linux Bundles
echo ""
echo "[3/4] Building Tauri desktop package..."
(cd "${PROJECT_ROOT}/frontend" && npx tauri build)

# 4. Stage Bundles and Compute Checksums
echo ""
echo "[4/4] Staging artifacts into ${RELEASE_DIR}..."

BUNDLE_DIR="${PROJECT_ROOT}/frontend/src-tauri/target/release/bundle"

if [[ -d "${BUNDLE_DIR}/deb" ]]; then
    find "${BUNDLE_DIR}/deb" -name "*.deb" -exec cp -f {} "${RELEASE_DIR}/" \;
    echo "  [OK] Staged Debian (.deb) package."
fi

if [[ -d "${BUNDLE_DIR}/appimage" ]]; then
    find "${BUNDLE_DIR}/appimage" -name "*.AppImage" -exec cp -f {} "${RELEASE_DIR}/" \;
    echo "  [OK] Staged AppImage package."
fi

if [[ -d "${BUNDLE_DIR}/rpm" ]]; then
    find "${BUNDLE_DIR}/rpm" -name "*.rpm" -exec cp -f {} "${RELEASE_DIR}/" \;
    echo "  [OK] Staged RPM package."
fi

if [[ -f "${PROJECT_ROOT}/frontend/src-tauri/target/release/shinpo-desktop" ]]; then
    cp -f "${PROJECT_ROOT}/frontend/src-tauri/target/release/shinpo-desktop" "${RELEASE_DIR}/"
    echo "  [OK] Staged native desktop binary."
fi

# Create tarball bundle
echo ""
echo "Creating portable Linux tarball..."
(
    cd "${RELEASE_DIR}"
    tar -czf SHINPO_1.0.0_linux_x86_64.tar.gz shinpo-desktop shinpo-shield shinpo-browser-host
)
echo "  [OK] Created SHINPO_1.0.0_linux_x86_64.tar.gz"

# Generate Checksums
echo ""
echo "======================================================================"
echo "SHINPO Linux Release Artifacts & Checksums:"
echo "======================================================================"
(
    cd "${RELEASE_DIR}"
    rm -f SHA256SUMS
    shopt -s nullglob
    sha256sum SHINPO*.rpm SHINPO*.AppImage SHINPO*.deb SHINPO*.tar.gz shinpo-desktop shinpo-shield shinpo-browser-host > SHA256SUMS
    shopt -u nullglob
    cat SHA256SUMS

    GIT_REV="$(git -C "${PROJECT_ROOT}" rev-parse HEAD 2>/dev/null || echo 'unknown')"
    GIT_BRANCH="$(git -C "${PROJECT_ROOT}" rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'main')"
    BUILD_TIME="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    cat <<EOF > BUILD_INFO.json
{
  "buildId": "shinpo-v1.0.0-rc3-${GIT_REV:0:7}",
  "gitRevision": "${GIT_REV}",
  "gitBranch": "${GIT_BRANCH}",
  "builtAt": "${BUILD_TIME}",
  "targets": [
    "SHINPO-1.0.0-1.x86_64.rpm",
    "SHINPO_1.0.0_amd64.AppImage",
    "SHINPO_1.0.0_amd64.deb",
    "SHINPO_1.0.0_linux_x86_64.tar.gz",
    "shinpo-desktop",
    "shinpo-shield",
    "shinpo-browser-host"
  ]
}
EOF
)
echo "======================================================================"
echo "Packaging completed successfully. Artifacts ready in: ${RELEASE_DIR}"
echo "======================================================================"

