#!/usr/bin/env bash
# ==============================================================================
# SHINPO — Automated Release & Update Publisher
# Bumps version, synchronizes updater manifests, tags, and triggers GitHub CI
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

if [[ $# -lt 1 ]]; then
    echo "Usage: $0 <version> [notes]"
    echo "Example: $0 0.1.0-beta.2 'Native companion pairing fix and visual polish'"
    exit 1
fi

TARGET_VERSION="$1"
# Strip leading 'v' if provided
TARGET_VERSION="${TARGET_VERSION#v}"
RELEASE_NOTES="${2:-SHINPO ${TARGET_VERSION} update release}"
TAG="v${TARGET_VERSION}"

echo "======================================================================"
echo "  SHINPO Release & Update Publisher"
echo "  Target Version : ${TARGET_VERSION}"
echo "  Git Tag        : ${TAG}"
echo "  Release Notes  : ${RELEASE_NOTES}"
echo "======================================================================"

cd "${PROJECT_ROOT}"

# Ensure on beta branch
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "${CURRENT_BRANCH}" != "beta" ]]; then
    echo "Error: Must be on 'beta' branch to initiate a release. Current: ${CURRENT_BRANCH}" >&2
    exit 1
fi

# Ensure clean working tree
git update-index -q --refresh || true
UNCOMMITTED="$(git status --porcelain)"
if [[ -n "${UNCOMMITTED}" ]]; then
    echo "Error: Uncommitted changes detected. Commit or stash them before releasing:" >&2
    echo "${UNCOMMITTED}"
    exit 1
fi

echo ""
echo "[1/5] Updating version in configuration files..."

# 1. Update frontend/src-tauri/tauri.conf.json
node -e "
  const fs = require('fs');
  const path = 'frontend/src-tauri/tauri.conf.json';
  const conf = JSON.parse(fs.readFileSync(path, 'utf8'));
  conf.version = '${TARGET_VERSION}';
  fs.writeFileSync(path, JSON.stringify(conf, null, 2) + '\n');
"

# 2. Update frontend/package.json
node -e "
  const fs = require('fs');
  const path = 'frontend/package.json';
  const pkg = JSON.parse(fs.readFileSync(path, 'utf8'));
  pkg.version = '${TARGET_VERSION}';
  fs.writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
"

# 3. Update frontend/src-tauri/Cargo.toml & Cargo.lock
node -e "
  const fs = require('fs');
  const path = 'frontend/src-tauri/Cargo.toml';
  let cargo = fs.readFileSync(path, 'utf8');
  cargo = cargo.replace(/version\s*=\s*\"[^\"]+\"/, 'version = \"${TARGET_VERSION}\"');
  fs.writeFileSync(path, cargo);
"
cargo check --quiet --manifest-path frontend/src-tauri/Cargo.toml

# 4. Update releases/beta/latest.json
node -e "
  const fs = require('fs');
  const path = 'releases/beta/latest.json';
  const data = JSON.parse(fs.readFileSync(path, 'utf8'));
  data.version = '${TARGET_VERSION}';
  data.notes = '${RELEASE_NOTES}';
  data.pub_date = new Date().toISOString();
  if (data.platforms['linux-x86_64']) {
    data.platforms['linux-x86_64'].url = 'https://github.com/ronartz/SHINPO/releases/download/${TAG}/SHINPO_${TARGET_VERSION}_linux_x86_64.AppImage.tar.gz';
  }
  if (data.platforms['windows-x86_64']) {
    data.platforms['windows-x86_64'].url = 'https://github.com/ronartz/SHINPO/releases/download/${TAG}/SHINPO_${TARGET_VERSION}_windows_x64_setup.exe.zip';
  }
  fs.writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
"

echo "  ✓ tauri.conf.json -> ${TARGET_VERSION}"
echo "  ✓ frontend/package.json -> ${TARGET_VERSION}"
echo "  ✓ frontend/src-tauri/Cargo.toml -> ${TARGET_VERSION}"
echo "  ✓ releases/beta/latest.json -> ${TARGET_VERSION}"

echo ""
echo "[2/5] Running test suites..."
npm test --prefix browser-extension > /dev/null
cargo test --quiet --manifest-path crates/shinpo-browser-host/Cargo.toml
echo "  ✓ All tests passed"

echo ""
echo "[3/5] Committing release metadata to beta..."
git add frontend/src-tauri/tauri.conf.json frontend/package.json frontend/src-tauri/Cargo.toml frontend/src-tauri/Cargo.lock releases/beta/latest.json
git commit -m "chore(release): bump version to ${TARGET_VERSION} and update release manifests"
git push origin beta

echo ""
echo "[4/5] Synchronizing to main (strict two-branch policy)..."
git checkout main
git merge --ff-only beta
git push origin main
git checkout beta

echo ""
echo "[5/5] Creating and pushing release tag ${TAG}..."
git tag -a "${TAG}" -m "SHINPO ${TAG}: ${RELEASE_NOTES}"
git push origin "${TAG}"

echo ""
echo "======================================================================"
echo "  Release ${TAG} successfully created and pushed!"
echo "  GitHub Actions will now build, package, and publish the release."
echo "  Live status: https://github.com/ronartz/SHINPO/actions"
echo "  Releases   : https://github.com/ronartz/SHINPO/releases"
echo "======================================================================"
