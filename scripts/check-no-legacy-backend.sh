#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# SHINPO — Guardrail: Ensure Zero Legacy Backend Residue in Active Source
# ==============================================================================
# Verifies that no forbidden legacy backend terms (spring, postgres, flyway,
# stomp, jdbc, actuator, localhost:8080) appear in active client, daemon,
# native crates, or workflow files.
#
# Allowed exceptions are strictly documented below:
# 1. crates/shinpo-shield/src/enforcer.rs & process_identity.rs:
#    References to "postgres" / "postgresql" are part of the OS system daemon
#    immunity list (SYSTEM_PROTECTED_DAEMONS) preventing accidental termination
#    of host OS database services.
# ==============================================================================

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

FORBIDDEN_REGEX="(spring|postgres|flyway|stomp|jdbc|actuator|localhost:8080)"

TARGET_DIRS=(
  "frontend/src"
  "frontend/src-tauri/src"
  "crates"
  "browser-extension/src"
  "daemon"
  ".github/workflows"
)

TARGET_FILES=(
  ".github/dependabot.yml"
)

echo "Scanning active source, config, and workflows for forbidden legacy backend terms..."

MATCHES=$(grep -rnI -i -E "$FORBIDDEN_REGEX" "${TARGET_DIRS[@]}" "${TARGET_FILES[@]}" --exclude-dir=target --exclude-dir=node_modules || true)

# Filter out documented exceptions:
# Exception: OS system daemon immunity list in shinpo-shield
FILTERED_MATCHES=$(echo "$MATCHES" | grep -v -E "crates/shinpo-shield/src/(enforcer|process_identity)\.rs.*(postgres|postgresql)" | grep -v "^$" || true)

if [ -n "$FILTERED_MATCHES" ]; then
  echo "FAIL: Forbidden legacy backend terms detected in active source:"
  echo "----------------------------------------------------------------------"
  echo "$FILTERED_MATCHES"
  echo "----------------------------------------------------------------------"
  echo "SHINPO is a 100% standalone desktop application. No legacy backend"
  echo "dependencies, endpoints, or terms are permitted in active source."
  exit 1
fi

echo "PASS: Zero legacy backend residue detected in active source, config, and workflows."
exit 0
